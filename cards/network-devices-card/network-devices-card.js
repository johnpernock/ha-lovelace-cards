/**
 * network-devices-card.js  —  v1
 * Network infrastructure monitoring card for Home Assistant Lovelace.
 * Shows gateway stats, managed switch port grids with a PoE control popup,
 * and lightweight pills for unmanaged switches.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/network-devices-card/network-devices-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/network-devices-card/network-devices-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:network-devices-card
 * gateway:
 *   name: UniFi Dream Machine
 *   latency_sensor:  sensor.udm_ping_latency       # ms ping sensor
 *   uptime_sensor:   sensor.udm_uptime             # seconds or human string
 *   clients_sensor:  sensor.unifi_clients_total    # client count
 *   wan_ip_sensor:   sensor.wan_ip                 # optional — public IP
 *   wan_sensor:      binary_sensor.wan_online      # optional — WAN state
 *
 * managed_switches:
 *   - name: USW-24-PoE
 *     ip: 192.168.1.2                              # shown in card
 *     description: 24 port · PoE+                  # shown in card
 *     uptime_sensor:  sensor.usw24_uptime           # optional
 *     ports_up:       18                            # count or sensor entity
 *     ports_down:     4
 *     ports_sfp:      2
 *     poe_used_sensor: sensor.usw24_poe_power       # watts used
 *     poe_budget:     100                           # watts total
 *     poe_ports:                                    # PoE-controlled ports
 *       - port: 3
 *         name: Front Door Kiosk
 *         entity: switch.usw24_port_3_poe           # switch entity to toggle
 *         power_sensor: sensor.usw24_port_3_power   # optional watts sensor
 *         speed: "1000 Mbps"                        # optional static label
 *
 * unmanaged_switches:
 *   - name: USW-Flex · Office
 *     ip: 192.168.1.4
 *     online_sensor: binary_sensor.flex_office_online  # optional
 *
 * pending:                                          # optional coming-soon tiles
 *   - name: Pi-hole
 *     sub: DNS · block rate
 *   - name: UPS
 *     sub: Battery · runtime
 */

import {
  createPopupPortal,
  destroyPopupPortal,
  popupHeaderHtml,
} from '../../shared/ha-popup.js';

class NetworkDevicesCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config       = {};
    this._hass         = null;
    this._busy         = {};
    this._portal       = null;
    this._activeSwIdx  = null;   // which switch's popup is open
    this._docHandlers  = [];
  }

  static getStubConfig() {
    return {
      gateway: {
        name: 'UniFi Dream Machine',
        latency_sensor: 'sensor.udm_ping_latency',
        clients_sensor: 'sensor.unifi_clients_total',
      },
      managed_switches: [
        {
          name: 'USW-24-PoE',
          ip: '192.168.1.2',
          description: '24 port · PoE+',
          ports_up: 18, ports_down: 4, ports_sfp: 2,
          poe_used_sensor: 'sensor.usw24_poe_power',
          poe_budget: 100,
          poe_ports: [
            { port: 3, name: 'Front Door Kiosk', entity: 'switch.usw24_port_3_poe' },
          ],
        },
      ],
      unmanaged_switches: [
        { name: 'USW-Flex · Office', ip: '192.168.1.4' },
      ],
    };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: 'gateway',            label: 'Gateway config',       type: 'expandable', schema: [
          { name: 'name',             label: 'Device name',          selector: { text: {} } },
          { name: 'latency_sensor',   label: 'Latency sensor',       selector: { entity: { domain: 'sensor' } } },
          { name: 'uptime_sensor',    label: 'Uptime sensor',        selector: { entity: { domain: 'sensor' } } },
          { name: 'clients_sensor',   label: 'Clients sensor',       selector: { entity: { domain: 'sensor' } } },
          { name: 'wan_ip_sensor',    label: 'WAN IP sensor',        selector: { entity: { domain: 'sensor' } } },
          { name: 'wan_sensor',       label: 'WAN online sensor',    selector: { entity: { domain: 'binary_sensor' } } },
        ] },
      ],
      assertCustomElement: 'network-devices-card',
    };
  }

  setConfig(c) {
    if (!c.gateway && !c.managed_switches?.length && !c.unmanaged_switches?.length) {
      throw new Error('network-devices-card: define at least gateway, managed_switches, or unmanaged_switches');
    }
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() {
    const gwRows = this._config.gateway ? 3 : 0;
    const swRows = (this._config.managed_switches?.length || 0) * 3;
    const unRows = this._config.unmanaged_switches?.length ? 1 : 0;
    return gwRows + swRows + unRows + 2;
  }

  disconnectedCallback() {
    this._destroyPortal();
    this._clearDocHandlers();
  }

  _trackDoc(event, handler, opts) {
    document.addEventListener(event, handler, opts);
    this._docHandlers.push([event, handler]);
  }

  _clearDocHandlers() {
    this._docHandlers.forEach(([ev, h]) => document.removeEventListener(ev, h));
    this._docHandlers = [];
  }

  _destroyPortal() {
    if (this._portal) {
      destroyPopupPortal(this._portal);
      this._portal = null;
      this._activeSwIdx = null;
    }
  }

  // ── State helpers ───────────────────────────────────────────────────────────

  _state(entity) {
    return entity ? (this._hass?.states[entity]?.state ?? null) : null;
  }
  _attr(entity, k) {
    return entity ? (this._hass?.states[entity]?.attributes?.[k] ?? null) : null;
  }
  _num(entity, fallback = null) {
    const v = parseFloat(this._state(entity));
    return isNaN(v) ? fallback : v;
  }
  _isOn(entity) {
    return this._state(entity) === 'on';
  }
  _isAvail(entity) {
    if (!entity) return false;
    const s = this._state(entity);
    return s !== null && s !== 'unavailable' && s !== 'unknown';
  }

  // Resolve a value that can be either a static number/string or a sensor entity
  _resolve(val, decimals = 0) {
    if (val == null) return null;
    if (typeof val === 'number') return decimals ? val.toFixed(decimals) : String(val);
    if (typeof val === 'string' && val.includes('.')) {
      // Looks like an entity ID
      const n = this._num(val);
      return n == null ? null : (decimals ? n.toFixed(decimals) : String(Math.round(n)));
    }
    return String(val);
  }

  _formatUptime(entity) {
    if (!entity) return null;
    const s = this._state(entity);
    if (!s || s === 'unavailable') return null;
    const n = parseFloat(s);
    if (!isNaN(n)) {
      const d = Math.floor(n / 86400);
      const h = Math.floor((n % 86400) / 3600);
      if (d > 0) return `${d}d ${h}h`;
      return `${h}h ${Math.floor((n % 3600) / 60)}m`;
    }
    return s; // already formatted string
  }

  _call(domain, service, data) {
    this._hass?.callService(domain, service, data);
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  _css() { return `
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .wrap{border-radius:10px;overflow:hidden}
    .card-hdr{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.2px;padding:10px 14px 9px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
    .chip{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:4px}
    .chip-ok{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.28);color:#4ade80}
    .chip-warn{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.22);color:#fbbf24}
    .chip-err{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.22);color:#f87171}
    .chip-info{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);color:rgba(96,165,250,.8)}
    .sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28);padding:8px 14px 4px}
    .divider{height:1px;background:rgba(255,255,255,.07)}

    /* Device rows */
    .dev-row{padding:8px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
    .dev-row:last-of-type{border-bottom:none}
    .dev-top{display:flex;align-items:center;gap:9px;margin-bottom:9px}
    .dev-ico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .di-gw{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2)}
    .di-sw{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2)}
    .dev-info{flex:1;min-width:0}
    .dev-name{font-size:12px;font-weight:700;color:#e2e8f0}
    .dev-sub{font-size:9px;color:rgba(255,255,255,.28);margin-top:1px}
    .dev-badge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0}
    .db-ok{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);color:#4ade80}
    .db-off{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.3)}

    /* WAN bar */
    .wan{display:flex;align-items:center;gap:7px;padding:6px 10px;border-radius:7px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:8px}
    .wan-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
    .wan-lbl{font-size:10px;font-weight:700;flex:1}
    .wan-ip{font-size:9px;color:rgba(255,255,255,.28);font-variant-numeric:tabular-nums}

    /* Stat tiles */
    .stat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}
    .stat{padding:7px 9px;border-radius:7px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)}
    .stat-l{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.22);margin-bottom:3px}
    .stat-v{font-size:12px;font-weight:700;color:#e2e8f0}
    .stat-s{font-size:9px;color:rgba(255,255,255,.25);margin-top:2px}

    /* Port grid */
    .ports-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
    .ports-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.22)}
    .poe-btn{font-size:9px;font-weight:700;padding:3px 8px;border-radius:5px;background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);color:#60a5fa;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;display:flex;align-items:center;gap:4px;transition:transform .1s,filter .12s}
    .poe-btn:active{transform:scale(.95);filter:brightness(.82)}
    .ports{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px}
    .port{width:17px;height:17px;border-radius:3px}
    .p-up{background:rgba(74,222,128,.22);border:1px solid rgba(74,222,128,.38)}
    .p-poe{background:rgba(251,191,36,.2);border:1px solid rgba(251,191,36,.35)}
    .p-dn{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}
    .p-sfp{background:rgba(96,165,250,.14);border:1px solid rgba(96,165,250,.3)}

    /* PoE budget bar */
    .poe-bud{margin-top:0}
    .poe-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
    .poe-lbl{font-size:9px;color:rgba(255,255,255,.28)}
    .poe-val{font-size:9px;font-weight:700}
    .poe-track{height:3px;border-radius:2px;background:rgba(255,255,255,.08)}
    .poe-fill{height:100%;border-radius:2px;transition:width .4s}

    /* Unmanaged pills */
    .pills-row{padding:7px 14px 10px;display:flex;gap:6px;flex-wrap:wrap}
    .pill{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);flex:1;min-width:140px}
    .pill-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
    .pill-body{flex:1;min-width:0}
    .pill-name{font-size:11px;font-weight:700;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pill-sub{font-size:9px;color:rgba(255,255,255,.22);margin-top:1px}

    /* Pending tiles */
    .pend-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:4px 14px 10px}
    .pend-tile{padding:9px 11px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);display:flex;gap:8px;align-items:center}
    .pt-ico{width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .pt-n{font-size:10px;font-weight:700;color:rgba(255,255,255,.32)}
    .pt-s{font-size:9px;color:rgba(255,255,255,.2);margin-top:1px}

    /* Popup styles — portal renders to document.body, these needed for shadow DOM fallback */
    .pp-poe-row{display:flex;align-items:center;border-radius:0 8px 8px 0;padding:9px 12px;margin-bottom:5px;gap:10px;transition:filter .12s}
    .pp-port-on{border-left:3px solid #4ade80;background:rgba(74,222,128,.04);border-top:1px solid rgba(74,222,128,.1);border-right:1px solid rgba(74,222,128,.1);border-bottom:1px solid rgba(74,222,128,.1)}
    .pp-port-hi{border-left:3px solid #fbbf24;background:rgba(251,191,36,.04);border-top:1px solid rgba(251,191,36,.12);border-right:1px solid rgba(251,191,36,.12);border-bottom:1px solid rgba(251,191,36,.12)}
    .pp-port-off{border-left:3px solid rgba(255,255,255,.1);background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);opacity:.55}
    .pp-pid{font-size:10px;font-weight:700;color:rgba(255,255,255,.3);width:22px;flex-shrink:0}
    .pp-body{flex:1;min-width:0}
    .pp-pname{font-size:12px;font-weight:700;color:#e2e8f0}
    .pp-pmeta{font-size:9px;color:rgba(255,255,255,.28);margin-top:2px}
    .pp-tog{width:40px;height:24px;border-radius:99px;position:relative;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;user-select:none;transition:background .12s}
    .pp-tog-on{background:rgba(74,222,128,.16);border:1.5px solid rgba(74,222,128,.4)}
    .pp-tog-off{background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.11)}
    .pp-tog-thumb{width:18px;height:18px;border-radius:50%;position:absolute;top:2px;transition:left .12s,background .12s}
    .pp-tog-on .pp-tog-thumb{left:18px;background:#4ade80}
    .pp-tog-off .pp-tog-thumb{left:2px;background:rgba(255,255,255,.22)}
    .pp-tog:active{filter:brightness(.85)}
    .pp-bud-wrap{padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:12px}
    .pp-bud-top{display:flex;justify-content:space-between;margin-bottom:5px}
    .pp-bud-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28)}
    .pp-bud-val{font-size:10px;font-weight:700;color:#fbbf24}
    .pp-bud-track{height:4px;border-radius:2px;background:rgba(255,255,255,.08)}
    .pp-bud-fill{height:100%;border-radius:2px;background:#fbbf24;transition:width .4s}
    .pp-sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28);margin:10px 0 7px}
    .pp-summary{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:4px}
    .pp-sum-tile{padding:7px 10px;border-radius:7px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)}
    .pp-sum-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.22);margin-bottom:3px}
    .pp-sum-val{font-size:11px;font-weight:700;color:#e2e8f0}
    .pp-sum-sub{font-size:9px;color:rgba(255,255,255,.25);margin-top:2px}
  `; }

  // ── SVG icons ────────────────────────────────────────────────────────────────

  _ico(path, stroke = 'rgba(255,255,255,.5)', size = 14) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  _gwIco(stroke) {
    return this._ico('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>', stroke, 15);
  }
  _swIco(stroke) {
    return this._ico('<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="6" cy="12" r="1.2" fill="' + stroke + '"/><circle cx="10" cy="12" r="1.2" fill="' + stroke + '" opacity=".4"/><circle cx="14" cy="12" r="1.2" fill="' + stroke + '"/><circle cx="18" cy="12" r="1.2" fill="' + stroke + '"/>', stroke, 15);
  }
  _boltIco(stroke = '#60a5fa', size = 9) {
    return this._ico('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', stroke, size);
  }
  _infoIco(stroke = 'rgba(255,255,255,.28)', size = 11) {
    return this._ico('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>', stroke, size);
  }
  _battIco(stroke = 'rgba(255,255,255,.28)', size = 11) {
    return this._ico('<rect x="2" y="7" width="16" height="11" rx="2"/><path d="M20 11h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1"/><path d="M6 7V5a2 2 0 0 1 4 0v2"/>', stroke, size);
  }

  // ── Gateway section ──────────────────────────────────────────────────────────

  _buildGateway() {
    const gw = this._config.gateway;
    if (!gw) return '';

    const latency  = this._num(gw.latency_sensor);
    const clients  = this._num(gw.clients_sensor);
    const uptime   = this._formatUptime(gw.uptime_sensor);
    const wanIp    = gw.wan_ip_sensor ? this._state(gw.wan_ip_sensor) : null;
    const wanOn    = gw.wan_sensor ? this._isOn(gw.wan_sensor) : true;
    const latColor = latency == null ? '#e2e8f0' : latency < 20 ? '#4ade80' : latency < 60 ? '#fbbf24' : '#f87171';

    const wanHtml = `
      <div class="wan" id="wan-bar">
        <div class="wan-dot" id="wan-dot" style="background:${wanOn ? '#4ade80' : '#f87171'}"></div>
        <div class="wan-lbl" id="wan-lbl" style="color:${wanOn ? '#4ade80' : '#f87171'}">${wanOn ? 'WAN connected' : 'WAN offline'}</div>
        ${wanIp ? `<div class="wan-ip" id="wan-ip">${this._maskIp(wanIp)}</div>` : ''}
      </div>`;

    // Only render stat tiles for configured sensors
    const statTiles = [
      gw.latency_sensor ? `<div class="stat">
          <div class="stat-l">Latency</div>
          <div class="stat-v" id="gw-latency" style="color:${latColor}">${latency != null ? latency + ' ms' : '—'}</div>
          <div class="stat-s">to 8.8.8.8</div>
        </div>` : '',
      gw.uptime_sensor ? `<div class="stat">
          <div class="stat-l">Uptime</div>
          <div class="stat-v" id="gw-uptime">${uptime ?? '—'}</div>
          <div class="stat-s">last reboot</div>
        </div>` : '',
      gw.clients_sensor ? `<div class="stat">
          <div class="stat-l">Clients</div>
          <div class="stat-v" id="gw-clients">${clients != null ? clients : '—'}</div>
          <div class="stat-s">active</div>
        </div>` : '',
    ].filter(Boolean);
    const statsHtml = statTiles.length
      ? `<div class="stat-grid">${statTiles.join('')}</div>`
      : '';

    return `
      <div class="sec-lbl">Gateway</div>
      <div class="dev-row" style="border-bottom:none">
        <div class="dev-top">
          <div class="dev-ico di-gw">${this._gwIco('#4ade80')}</div>
          <div class="dev-info">
            <div class="dev-name">${gw.name ?? 'Gateway'}</div>
            ${gw.ip ? `<div class="dev-sub">${gw.ip} · gateway + controller</div>` : ''}
          </div>
          <div class="dev-badge db-ok" id="gw-badge">Online</div>
        </div>
        ${wanHtml}
        ${statsHtml}
      </div>`;
  }

  _maskIp(ip) {
    if (!ip || typeof ip !== 'string') return '';
    // Show first two octets + mask rest for privacy
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
    return ip;
  }

  // ── Managed switches ─────────────────────────────────────────────────────────

  _buildManagedSwitches() {
    const switches = this._config.managed_switches;
    if (!switches?.length) return '';

    const rows = switches.map((sw, i) => {
      const poeUsed   = this._num(sw.poe_used_sensor);
      const poeBudget = sw.poe_budget ?? 100;
      const poeRatio  = poeUsed != null ? Math.min(100, Math.round((poeUsed / poeBudget) * 100)) : null;
      const poeColor  = poeRatio == null ? '#fbbf24' : poeRatio > 80 ? '#f87171' : poeRatio > 60 ? '#fbbf24' : '#4ade80';
      const uptime    = this._formatUptime(sw.uptime_sensor);

      const portsUp   = this._resolve(sw.ports_up,   0) ?? '—';
      const portsDn   = this._resolve(sw.ports_down, 0) ?? '—';
      const portsSfp  = this._resolve(sw.ports_sfp,  0);
      const portLabel = `${portsUp} up · ${portsDn} down${portsSfp ? ` · ${portsSfp} SFP` : ''}`;

      const portGrid   = this._buildPortGrid(sw);
      const hasPortData = sw.ports_up != null || sw.ports_down != null;

      return `
        <div class="dev-row" id="sw-row-${i}">
          <div class="dev-top">
            <div class="dev-ico di-sw">${this._swIco('#60a5fa')}</div>
            <div class="dev-info">
              <div class="dev-name">${sw.name ?? `Switch ${i + 1}`}</div>
              <div class="dev-sub">${sw.ip ? sw.ip + ' · ' : ''}${sw.description ?? ''}</div>
            </div>
            <div class="dev-badge db-ok">Online</div>
          </div>
          ${sw.poe_ports?.length ? `
          <div class="ports-hdr">
            ${hasPortData ? `<div class="ports-lbl" id="sw-port-lbl-${i}">${portLabel}</div>` : '<div></div>'}
            <div class="poe-btn" data-sw="${i}" id="poe-btn-${i}">
              ${this._boltIco()} PoE ports
            </div>
          </div>` : ''}
          ${hasPortData ? `<div class="ports" id="sw-ports-${i}">${portGrid}</div>` : ''}
          ${(poeUsed != null || sw.poe_budget) && hasPortData ? `
            <div class="poe-bud">
              <div class="poe-top">
                <div class="poe-lbl">PoE budget</div>
                <div class="poe-val" id="sw-poe-val-${i}" style="color:${poeColor}">${poeUsed != null ? poeUsed + 'W' : '—'} / ${poeBudget}W</div>
              </div>
              <div class="poe-track"><div class="poe-fill" id="sw-poe-fill-${i}" style="width:${poeRatio ?? 0}%;background:${poeColor}"></div></div>
            </div>` : ''}
        </div>`;
    }).join('');

    return `
      ${this._config.gateway ? '<div class="divider"></div>' : ''}
      <div class="sec-lbl">Managed switches</div>
      ${rows}`;
  }

  _buildPortGrid(sw) {
    const up    = parseInt(this._resolve(sw.ports_up,   0)) || 0;
    const dn    = parseInt(this._resolve(sw.ports_down, 0)) || 0;
    const sfp   = parseInt(this._resolve(sw.ports_sfp,  0)) || 0;
    const poe   = sw.poe_ports?.length || 0;
    // Standard ports — approximate: poe ports as amber, rest as green, down as dim
    const upNonPoe = Math.max(0, up - poe);
    const ports = [];
    for (let i = 0; i < poe;       i++) ports.push('<div class="port p-poe"></div>');
    for (let i = 0; i < upNonPoe;  i++) ports.push('<div class="port p-up"></div>');
    for (let i = 0; i < dn;        i++) ports.push('<div class="port p-dn"></div>');
    for (let i = 0; i < sfp;       i++) ports.push('<div class="port p-sfp"></div>');
    return ports.join('');
  }

  // ── Unmanaged switches ───────────────────────────────────────────────────────

  _buildUnmanaged() {
    const switches = this._config.unmanaged_switches;
    if (!switches?.length) return '';

    const pills = switches.map(sw => {
      const online  = sw.online_sensor ? this._isOn(sw.online_sensor) : true;
      const dotCol  = online ? '#4ade80' : 'rgba(255,255,255,.2)';
      return `
        <div class="pill">
          <div class="pill-dot" style="background:${dotCol}"></div>
          <div class="pill-body">
            <div class="pill-name">${sw.name ?? 'Switch'}</div>
            <div class="pill-sub">${sw.ip ? sw.ip + ' · ' : ''}${sw.ports ?? 5} port</div>
          </div>
        </div>`;
    }).join('');

    const hasSections = !!(this._config.gateway || this._config.managed_switches?.length);
    return `
      ${hasSections ? '<div class="divider"></div>' : ''}
      <div class="sec-lbl">Unmanaged</div>
      <div class="pills-row">${pills}</div>`;
  }

  // ── Pending tiles ────────────────────────────────────────────────────────────

  _buildPending() {
    const pending = this._config.pending;
    if (!pending?.length) return '';

    const tiles = pending.map(p => `
      <div class="pend-tile">
        <div class="pt-ico">${this._infoIco()}</div>
        <div>
          <div class="pt-n">${p.name ?? 'Device'}</div>
          ${p.sub ? `<div class="pt-s">${p.sub}</div>` : ''}
        </div>
      </div>`).join('');

    return `
      <div class="divider"></div>
      <div class="sec-lbl" style="display:flex;align-items:center;justify-content:space-between;padding-right:14px">
        Coming soon
        <div class="chip chip-info" style="font-size:8px">${pending.length} pending</div>
      </div>
      <div class="pend-grid">${tiles}</div>`;
  }

  // ── PoE popup ────────────────────────────────────────────────────────────────

  _buildPoEPopupContent(swIdx) {
    const sw        = this._config.managed_switches?.[swIdx];
    if (!sw) return '';
    const poeUsed   = this._num(sw.poe_used_sensor);
    const poeBudget = sw.poe_budget ?? 100;
    const poeRatio  = poeUsed != null ? Math.min(100, Math.round((poeUsed / poeBudget) * 100)) : 0;

    const portRows = (sw.poe_ports ?? []).map((p, pi) => {
      const on    = this._isOn(p.entity);
      const watts = p.power_sensor ? this._num(p.power_sensor) : null;
      const hi    = watts != null && watts > 10;
      const cls   = !p.entity ? 'pp-port-on' : on ? (hi ? 'pp-port-hi' : 'pp-port-on') : 'pp-port-off';
      const meta  = [watts != null ? watts + 'W' : null, p.speed].filter(Boolean).join(' · ') || (on ? 'PoE on' : 'PoE off · no link');

      return `
        <div class="pp-poe-row ${cls}" id="pp-port-${pi}">
          <div class="pp-pid">P${p.port ?? pi + 1}</div>
          <div class="pp-body">
            <div class="pp-pname">${p.name ?? `Port ${p.port ?? pi + 1}`}</div>
            <div class="pp-pmeta" id="pp-meta-${pi}">${meta}</div>
          </div>
          ${p.entity ? `
            <div class="pp-tog ${on ? 'pp-tog-on' : 'pp-tog-off'}" data-sw="${swIdx}" data-pi="${pi}" data-entity="${p.entity}">
              <div class="pp-tog-thumb"></div>
            </div>` : ''}
        </div>`;
    }).join('');

    const portsUp  = parseInt(this._resolve(sw.ports_up,  0)) || 0;
    const portsDn  = parseInt(this._resolve(sw.ports_down,0)) || 0;
    const portsSfp = parseInt(this._resolve(sw.ports_sfp, 0)) || 0;

    return `
      ${popupHeaderHtml(sw.name ?? 'Switch', `PoE ports · ${poeUsed != null ? poeUsed + 'W' : '—'} of ${poeBudget}W used`)}
      <div class="pp-bud-wrap">
        <div class="pp-bud-top">
          <div class="pp-bud-lbl">PoE budget</div>
          <div class="pp-bud-val">${poeUsed != null ? poeUsed + 'W' : '—'} / ${poeBudget}W</div>
        </div>
        <div class="pp-bud-track"><div class="pp-bud-fill" style="width:${poeRatio}%"></div></div>
      </div>
      <div class="pp-sec-lbl">Active PoE ports</div>
      ${portRows}
      <div class="pp-sec-lbl">Non-PoE summary</div>
      <div class="pp-summary">
        <div class="pp-sum-tile">
          <div class="pp-sum-lbl">Uplink</div>
          <div class="pp-sum-val" style="color:${portsSfp ? '#4ade80' : '#e2e8f0'}">${portsSfp ? 'Active' : '—'}</div>
          <div class="pp-sum-sub">${portsSfp ? portsSfp + ' SFP' : 'No SFP'}</div>
        </div>
        <div class="pp-sum-tile">
          <div class="pp-sum-lbl">Standard</div>
          <div class="pp-sum-val">${portsUp} up · ${portsDn} dn</div>
          <div class="pp-sum-sub">no PoE</div>
        </div>
      </div>`;
  }

  _openPoEPopup(swIdx) {
    this._activeSwIdx = swIdx;
    const sw = this._config.managed_switches?.[swIdx];
    if (!sw) return;

    if (this._portal) destroyPopupPortal(this._portal);

    this._portal = createPopupPortal(
      `network-devices-poe-popup`,
      this._buildPoEPopupContent(swIdx),
      () => { this._activeSwIdx = null; },
      { maxWidth: '440px' }
    );

    // Delegate toggle clicks inside portal
    this._portal.content.addEventListener('click', e => {
      const tog = e.target.closest('.pp-tog');
      if (!tog) return;
      const entity = tog.dataset.entity;
      const pi     = parseInt(tog.dataset.pi);
      const sw2    = this._config.managed_switches?.[parseInt(tog.dataset.sw)];
      if (!entity || !sw2 || this._busy[entity]) return;
      this._busy[entity] = true;
      setTimeout(() => { this._busy[entity] = false; }, 1500);
      this._call('switch', this._isOn(entity) ? 'turn_off' : 'turn_on', { entity_id: entity });
    });

    this._portal.open();
  }

  _patchPoEPopup() {
    if (!this._portal?.isOpen || this._activeSwIdx == null) return;
    const sw = this._config.managed_switches?.[this._activeSwIdx];
    if (!sw) return;

    // Update budget
    const poeUsed   = this._num(sw.poe_used_sensor);
    const poeBudget = sw.poe_budget ?? 100;
    const poeRatio  = poeUsed != null ? Math.min(100, Math.round((poeUsed / poeBudget) * 100)) : 0;
    const budVal    = this._portal.content.querySelector('.pp-bud-val');
    const budFill   = this._portal.content.querySelector('.pp-bud-fill');
    if (budVal)  budVal.textContent  = `${poeUsed != null ? poeUsed + 'W' : '—'} / ${poeBudget}W`;
    if (budFill) budFill.style.width = `${poeRatio}%`;

    // Update per-port
    (sw.poe_ports ?? []).forEach((p, pi) => {
      if (!p.entity) return;
      const on    = this._isOn(p.entity);
      const watts = p.power_sensor ? this._num(p.power_sensor) : null;
      const hi    = watts != null && watts > 10;
      const row   = this._portal.content.getElementById(`pp-port-${pi}`);
      const tog   = this._portal.content.querySelector(`[data-pi="${pi}"]`);
      const meta  = this._portal.content.getElementById(`pp-meta-${pi}`);
      if (row) {
        row.className = `pp-poe-row ${on ? (hi ? 'pp-port-hi' : 'pp-port-on') : 'pp-port-off'}`;
        row.style.opacity = on ? '' : '0.55';
      }
      if (tog) tog.className = `pp-tog ${on ? 'pp-tog-on' : 'pp-tog-off'}`;
      if (meta) meta.textContent = [watts != null ? watts + 'W' : null, p.speed].filter(Boolean).join(' · ') || (on ? 'PoE on' : 'PoE off · no link');
    });
  }

  // ── Render / Patch ───────────────────────────────────────────────────────────

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card><div class="wrap">
        ${this._buildHeader()}
        ${this._buildGateway()}
        ${this._buildManagedSwitches()}
        ${this._buildUnmanaged()}
        ${this._buildPending()}
      </div></ha-card>`;
    this._listen();
  }

  _buildHeader() {
    const allOnline = this._allOnline();
    const chip = allOnline
      ? `<div class="chip chip-ok">All online</div>`
      : `<div class="chip chip-warn">Check devices</div>`;
    return `<div class="card-hdr"><span>Network devices</span><div id="hdr-chip">${chip}</div></div>`;
  }

  _allOnline() {
    // Simple check — if we have any binary sensors, check them
    const sensors = [
      this._config.gateway?.wan_sensor,
      ...(this._config.unmanaged_switches ?? []).map(s => s.online_sensor),
    ].filter(Boolean);
    return sensors.length === 0 || sensors.every(s => this._isOn(s));
  }

  _patch() {
    const sr = this.shadowRoot;

    // Header chip
    const chip = sr.getElementById('hdr-chip');
    if (chip) chip.innerHTML = this._allOnline()
      ? `<div class="chip chip-ok">All online</div>`
      : `<div class="chip chip-warn">Check devices</div>`;

    // Gateway
    const gw = this._config.gateway;
    if (gw) {
      const latency = this._num(gw.latency_sensor);
      const latColor = latency == null ? '#e2e8f0' : latency < 20 ? '#4ade80' : latency < 60 ? '#fbbf24' : '#f87171';
      const set = (id, val, style) => {
        const el = sr.getElementById(id);
        if (!el) return;
        if (val  !== undefined) el.textContent = val;
        if (style !== undefined) el.style.color = style;
      };
      set('gw-latency', latency != null ? latency + ' ms' : '—', latColor);
      set('gw-uptime',  this._formatUptime(gw.uptime_sensor) ?? '—');
      set('gw-clients', this._num(gw.clients_sensor) ?? '—');
      const wanOn  = gw.wan_sensor ? this._isOn(gw.wan_sensor) : true;
      const wanDot = sr.getElementById('wan-dot');
      const wanLbl = sr.getElementById('wan-lbl');
      const wanIpEl= sr.getElementById('wan-ip');
      if (wanDot) wanDot.style.background = wanOn ? '#4ade80' : '#f87171';
      if (wanLbl) { wanLbl.textContent = wanOn ? 'WAN connected' : 'WAN offline'; wanLbl.style.color = wanOn ? '#4ade80' : '#f87171'; }
      if (wanIpEl && gw.wan_ip_sensor) wanIpEl.textContent = this._maskIp(this._state(gw.wan_ip_sensor));
    }

    // Managed switches
    (this._config.managed_switches ?? []).forEach((sw, i) => {
      const poeUsed   = this._num(sw.poe_used_sensor);
      const poeBudget = sw.poe_budget ?? 100;
      const poeRatio  = poeUsed != null ? Math.min(100, Math.round((poeUsed / poeBudget) * 100)) : null;
      const poeColor  = poeRatio == null ? '#fbbf24' : poeRatio > 80 ? '#f87171' : poeRatio > 60 ? '#fbbf24' : '#4ade80';
      const poeVal    = sr.getElementById(`sw-poe-val-${i}`);
      const poeFill   = sr.getElementById(`sw-poe-fill-${i}`);
      if (poeVal)  { poeVal.textContent = `${poeUsed != null ? poeUsed + 'W' : '—'} / ${poeBudget}W`; poeVal.style.color = poeColor; }
      if (poeFill) { poeFill.style.width = `${poeRatio ?? 0}%`; poeFill.style.background = poeColor; }
    });

    // Popup
    this._patchPoEPopup();
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  _listen() {
    const sr = this.shadowRoot;
    sr.querySelectorAll('.poe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const swIdx = parseInt(btn.dataset.sw);
        this._openPoEPopup(swIdx);
      });
    });
  }
}

customElements.define('network-devices-card', NetworkDevicesCard);
