/**
 * network-status-card.js  —  v2
 * UniFi network status — AP states, client counts, SSID names.
 * Extracted from technology-card. Standalone — use independently anywhere.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/network-status-card/network-status-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/network-status-card/network-status-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:network-status-card
 * entities:
  ap_hallway:     binary_sensor.ap_hallway          # required — AP binary sensors
  ap_family_room: binary_sensor.ap_family_room
  clients_main:   sensor.unifi_clients_main         # optional — client count sensors
  clients_iot:    sensor.unifi_clients_iot
  ssid_main:      sensor.unifi_ssid_main            # optional — SSID name sensors
 */

import { COLORS, getVal, getAttr, getNum } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_SECTION } from '../../shared/ha-styles.js';

class NetworkStatusCardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
  }

  static getStubConfig() { return { entities: {
        ap_hallway:     'binary_sensor.ap_hallway',
        ap_family_room: 'binary_sensor.ap_family_room',
        clients_main:   'sensor.unifi_clients_main',
        clients_iot:    'sensor.unifi_clients_iot',
        ssid_main:      'sensor.unifi_ssid_main',
      } }; }
  static getConfigForm() {
    return {
      schema: { name: 'entities', type: 'grid', schema: [
      { name: 'ap_hallway',     label: 'AP Hallway (binary_sensor)',     selector: { entity: { domain: 'binary_sensor' } } },
      { name: 'ap_family_room', label: 'AP Family Room (binary_sensor)', selector: { entity: { domain: 'binary_sensor' } } },
      { name: 'clients_main',   label: 'Clients Main (sensor)',          selector: { entity: { domain: 'sensor' } } },
      { name: 'clients_iot',    label: 'Clients IoT (sensor)',           selector: { entity: { domain: 'sensor' } } },
      { name: 'ssid_main',      label: 'SSID Main (sensor)',             selector: { entity: { domain: 'sensor' } } },
    ] },
      assertCustomElement: 'network-status-card',
    };
  }


  setConfig(c) {
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 3; }

  _e(k)   { const id = this._config.entities?.[k]; return id || null; }


  _s(id)    { return id ? this._hass?.states[id] : null; }

  _val(id)   { return this._s(id)?.state; }

  _isOn(id)  {
    const v = this._val(id)?.toLowerCase();
    if (!v || v === 'unavailable' || v === 'unknown') return false;
    if (v === 'not_home' || v === 'off' || v === 'exited' || v === 'disconnected') return false;
    return ['on','online','home','playing','paused','running','started','connected'].includes(v);
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────

  _listen() {}  // no interactive elements — no-op

  _css() {
    return `${CSS_RESET}${CSS_TAPPABLE}${CSS_SECTION}

    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card { overflow: hidden; }
    .card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px;border-bottom:1.5px solid rgba(255,255,255,.28)}
    .sec{padding:8px 14px 12px;display:flex;flex-direction:column;gap:8px}
    .placeholder{font-size:12px;color:rgba(255,255,255,.25);padding:4px 0;font-style:italic}
    .big-row{display:flex;align-items:center;gap:12px;padding:10px 14px}
    .big-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0}
    .big-label{font-size:18px;font-weight:700;line-height:1}
    .big-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:2px}
    .sdot{border-radius:50%;flex-shrink:0;display:inline-block}
    .green{background:#4ade80}.red{background:#f87171}.amber{background:#fbbf24}
    .chips{display:flex;gap:6px;flex-wrap:wrap}
    .chip{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:7px;border:1.5px solid rgba(255,255,255,.40);background:rgba(255,255,255,0)}
    .chip-lbl{font-size:11px;color:rgba(255,255,255,.45)}
    .chip-val{font-size:13px;font-weight:700;color:#e2e8f0;margin-left:2px}
    .speed-row{display:flex;gap:6px}
    .speed-item{flex:1;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30);border-radius:8px;padding:8px 10px}
    .speed-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3);margin-bottom:3px}
    .speed-val{font-size:17px;font-weight:700;color:#e2e8f0}
    .speed-unit{font-size:11px;color:rgba(255,255,255,.3);margin-left:2px}
    .spark{display:block;height:24px;width:100%;margin-top:5px}
    .ink-row{display:flex;gap:6px}
    .ink-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
    .ink-bar-wrap{width:100%;height:52px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.12);border-radius:6px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
    .ink-bar{width:100%;border-radius:0}
    .ink-pct{font-size:12px;font-weight:700;color:#e2e8f0}
    .ink-label{font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase}
    .ink-warn{font-size:9px;font-weight:700;color:#fbbf24}
    .rbtn{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-radius:8px;border:1.5px solid rgba(255,255,255,.40);background:rgba(255,255,255,0);cursor:pointer;user-select:none;transition:background .12s;-webkit-tap-highlight-color:transparent}
    .rbtn:active{background:rgba(255,255,255,.09)}
    .rbtn-left{display:flex;align-items:center;gap:9px}
    .rbtn-icon{width:30px;height:30px;border-radius:7px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.40);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .rbtn-name{font-size:13px;font-weight:700;color:#e2e8f0}
    .rbtn-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .rbtn.danger{border-color:rgba(239,68,68,.25);background:rgba(239,68,68,.05)}
    .ap-row{display:flex;align-items:center;justify-content:space-between}
    .ap-left{display:flex;align-items:center;gap:9px}
    .ap-name{font-size:13px;font-weight:700;color:#e2e8f0}
    .ap-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .services{display:flex;gap:6px;flex-wrap:wrap}
    .svc{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:6px;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30)}
    .svc-lbl{font-size:12px;font-weight:600}
    .media-item{display:flex;align-items:center;gap:10px;padding:7px 0}
    .media-item+.media-item{border-top:1.5px solid rgba(255,255,255,.28)}
    .media-poster{width:32px;height:46px;border-radius:4px;background:rgba(255,255,255,.08);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:rgba(255,255,255,.25);text-transform:uppercase}
    .media-info{flex:1;min-width:0}
    .media-title{font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .media-meta{font-size:11px;color:rgba(255,255,255,.35);margin-top:2px}
    .badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0}
    .badge-movie{background:rgba(96,165,250,.15);color:#60a5fa}
    .badge-tv{background:rgba(167,139,250,.15);color:#a78bfa}
    .storage-row{display:flex;align-items:center;gap:10px}
    .storage-lbl{font-size:12px;color:rgba(255,255,255,.4);width:52px;flex-shrink:0}
    .storage-bar-wrap{flex:1;height:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .storage-bar{height:100%;border-radius:99px;transition:width .3s}
    .storage-pct{font-size:12px;font-weight:700;color:rgba(255,255,255,.5);width:32px;text-align:right;flex-shrink:0}
    .storage-detail{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.22);margin-top:-3px}
    .stat-row{display:flex;align-items:center;justify-content:space-between}
    .stat-left{display:flex;align-items:center;gap:9px}
    .stat-name{font-size:14px;font-weight:700;color:#e2e8f0}
    .stat-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);align-items:flex-end;justify-content:center;z-index:9999}
    .overlay.open{display:flex}
    .sheet{background:var(--card-background-color,#1e1e1e);border:1.5px solid rgba(255,255,255,.40);border-radius:16px 16px 0 0;border-bottom:none;padding:0 0 16px;width:100%;max-width:100%}
    @media(min-width:768px){
      .overlay{align-items:center;justify-content:center;padding:24px}
      .sheet{max-width:420px;border-radius:16px;border-bottom:1.5px solid rgba(255,255,255,.40)}
      .sheet-handle{display:none!important}
    }
    .sheet-handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);margin:12px auto 8px}
    .sheet-head{display:flex;align-items:flex-start;justify-content:space-between;padding:0 16px 12px;border-bottom:1.5px solid rgba(255,255,255,.30)}
    .sheet-title{font-size:16px;font-weight:700;color:#e2e8f0;margin-bottom:3px}
    .sheet-sub{font-size:12px;color:rgba(255,255,255,.4);line-height:1.5}
    .sheet-close{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.08);cursor:pointer;color:rgba(255,255,255,.6);font-size:17px;display:flex;align-items:center;justify-content:center;border:none;flex-shrink:0}
    .sheet-body{padding:14px 16px 0}
    .sheet-btns{display:flex;gap:8px}
    .btn-yes{flex:1;height:40px;border-radius:8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;font-size:14px;font-weight:700;cursor:pointer}
    .btn-yes:active{background:rgba(239,68,68,.25)}
    .btn-no{flex:1;height:40px;border-radius:8px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.40);color:rgba(255,255,255,.5);font-size:14px;font-weight:700;cursor:pointer}
    .btn-no:active{background:rgba(255,255,255,.12)}
  `; }

  _ico(path, c, s) {
    return `<svg width="${s||14}" height="${s||14}" viewBox="0 0 24 24" fill="none" stroke="${c||'rgba(255,255,255,.5)'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>    `;
  }

  // ── Render / Patch ──────────────────────────────────────────────────────────
  _render() {
    const inner = this._buildNetwork();
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><ha-card>${inner}</ha-card>`;
    this._listen();
  }

  _patch() {
    const inner = this._buildNetwork();
    const haCard = this.shadowRoot.querySelector('ha-card');
    if (!haCard) { this._render(); return; }
    haCard.innerHTML = inner;
    this._listen();
  }

  // ── Section builder (from technology-card) ───────────────────────────────────
  _buildNetwork() {
    const apIds = [this._e('ap_hallway'), this._e('ap_family_room')].filter(Boolean);
    const apsOn = !apIds.length || apIds.every(id => this._isOn(id));
    const apAny = apIds.some(id => this._isOn(id));
    const wanOn = apAny;
    const wC = wanOn ? '74,222,128' : '239,68,68';
    const aC = apsOn ? '74,222,128' : apAny ? '251,191,36' : '239,68,68';
    const wDot = wanOn?'green':'red', aDot = apsOn?'green':apAny?'amber':'red';
    const wTxt = wanOn?'Connected':'No internet';
    const aTxt = apsOn?'All access points online':apAny?'Some APs offline':'WiFi offline';
    const wLbl = wanOn?'#4ade80':'#f87171', aLbl = apsOn?'#4ade80':apAny?'#fbbf24':'#f87171';
    const main  = this._val(this._e('clients_main'))  || '—';
    const iot   = this._val(this._e('clients_iot'))   || '—';
    const guest = this._val(this._e('clients_guest')) || '—';
    return `<div class="card">
      <div class="card-hdr">Network</div>
      <div class="big-row" style="background:rgba(${wC},.10);border:1.5px solid rgba(${wC},.45);border-radius:8px;margin:6px 10px 4px">
        <div class="big-dot sdot ${wDot}" style="width:16px;height:16px"></div>
        <div><div class="big-label" style="color:${wLbl}">Internet</div><div class="big-sub">${wTxt}</div></div>
      </div>
      <div class="big-row" style="background:rgba(${aC},.10);border:1.5px solid rgba(${aC},.40);border-radius:8px;margin:0 10px 8px">
        <div class="big-dot sdot ${aDot}" style="width:16px;height:16px"></div>
        <div><div class="big-label" style="color:${aLbl}">WiFi</div><div class="big-sub">${aTxt}</div></div>
      </div>
      <div class="sec" style="padding-top:4px">
        <div class="chips">
          <div class="chip"><span class="sdot green" style="width:9px;height:9px;margin-right:2px"></span><span class="chip-lbl">Main</span><span class="chip-val">${main}</span></div>
          <div class="chip"><span class="sdot amber" style="width:9px;height:9px;margin-right:2px"></span><span class="chip-lbl">IoT</span><span class="chip-val">${iot}</span></div>
          <div class="chip"><span class="sdot" style="width:9px;height:9px;margin-right:2px;background:#a78bfa"></span><span class="chip-lbl">Guest</span><span class="chip-val">${guest}</span></div>
        </div>
      </div>
    </div>`;
  }
}

customElements.define('network-status-card', NetworkStatusCardCard);
