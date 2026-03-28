/**
 * kiosk-health-card.js  —  v1
 * Monitoring card showing display API health, Pi CPU temperature,
 * touch-to-wake grab state, and last tap activity.
 * Read-only — no controls. Pairs with kiosk-displays-card.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/kiosk-health-card/kiosk-health-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/kiosk-health-card/kiosk-health-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:kiosk-health-card
 * displays:
 *   - name: Front Door
 *     health_sensor:      sensor.kiosk_front_door_api_health    # required
 *     screen_state:       sensor.kiosk_front_door_screen_state  # optional
 *     temp_sensor:        sensor.kiosk_front_door_cpu_temp      # optional
 *   - name: Garage
 *     health_sensor:      sensor.kiosk_garage_api_health
 *     screen_state:       sensor.kiosk_garage_screen_state
 *     temp_sensor:        sensor.kiosk_garage_cpu_temp
 */

class KioskHealthCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  static getStubConfig() {
    return {
      displays: [
        { name: 'Front Door', health_sensor: 'sensor.kiosk_front_door_api_health', screen_state: 'sensor.kiosk_front_door_screen_state' },
        { name: 'Garage',     health_sensor: 'sensor.kiosk_garage_api_health',     screen_state: 'sensor.kiosk_garage_screen_state' },
      ],
    };
  }

  static getConfigForm() {
    return { schema: [] }; // displays array — configure in YAML
  }

  setConfig(c) {
    if (!c.displays?.length) throw new Error('kiosk-health-card: define at least one display under displays:');
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _state(entity)  { return entity ? (this._hass?.states[entity]?.state ?? null) : null; }
  _attr(entity, k){ return entity ? (this._hass?.states[entity]?.attributes?.[k] ?? null) : null; }

  _isHealthy(sensor) {
    const s = this._state(sensor);
    return s === 'ok' || s === 'online' || s === 'OK';
  }

  _uptime(sensor) {
    const uptime = this._attr(sensor, 'uptime');
    if (uptime == null) return null;
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  _temp(sensor) {
    if (!sensor) return null;
    const v = parseFloat(this._state(sensor));
    return isNaN(v) ? null : `${Math.round(v)}°C`;
  }

  _touchGrabActive() {
    return this._config.displays.some(d => {
      const grab = this._attr(d.screen_state, 'touch_grab');
      return grab === true || grab === 'true';
    });
  }

  _screenOffDisplay() {
    const off = this._config.displays.filter(d => this._state(d.screen_state) === 'off');
    if (!off.length) return null;
    return off.map(d => d.name).join(' & ');
  }

  _allHealthy() {
    return this._config.displays.every(d => this._isHealthy(d.health_sensor));
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  _css() { return `
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important}
    .wrap{border-radius:10px;overflow:hidden}
    .card-hdr{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.2px;padding:10px 14px 9px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
    .chip{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:4px}
    .chip-ok{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.28);color:#4ade80}
    .chip-warn{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.28);color:#fbbf24}
    .chip-err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.28);color:#f87171}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 14px 12px}
    .tile{padding:8px 11px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)}
    .tile-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.25);margin-bottom:4px}
    .tile-val{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:#e2e8f0}
    .tile-sub{font-size:9px;color:rgba(255,255,255,.28);margin-top:2px}
    .mdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  `; }

  // ── Build HTML ───────────────────────────────────────────────────────────────

  _buildTile(id, label, value, dot, sub) {
    return `
      <div class="tile" id="${id}">
        <div class="tile-lbl">${label}</div>
        <div class="tile-val"><div class="mdot" id="${id}-dot" style="background:${dot}"></div><span id="${id}-val">${value}</span></div>
        <div class="tile-sub" id="${id}-sub">${sub}</div>
      </div>`;
  }

  _displayTileData(d) {
    const ok    = this._isHealthy(d.health_sensor);
    const ut    = this._uptime(d.health_sensor);
    const temp  = this._temp(d.temp_sensor);
    const dot   = ok ? '#4ade80' : '#f87171';
    const val   = ok ? 'Online' : 'Offline';
    const parts = [ut && `${ut} uptime`, temp].filter(Boolean);
    return { dot, val, sub: parts.join(' · ') || (ok ? 'No uptime data' : 'API unreachable') };
  }

  _grabTileData() {
    const grab = this._touchGrabActive();
    const offNames = this._screenOffDisplay();
    return {
      dot: grab ? '#60a5fa' : 'rgba(255,255,255,.2)',
      val: grab ? 'Grab active' : 'Inactive',
      sub: grab ? `${offNames || 'Display'} screen off` : 'All screens on',
    };
  }

  _lastTapData() {
    // Pull last_activity attribute from screen_state sensors
    let latest = null, latestName = null;
    this._config.displays.forEach(d => {
      const lastAct = this._attr(d.screen_state, 'last_activity');
      if (lastAct) {
        if (!latest || new Date(lastAct) > new Date(latest)) {
          latest     = lastAct;
          latestName = d.name;
        }
      }
    });
    if (!latest) return { dot: 'rgba(255,255,255,.15)', val: '—', sub: 'No activity data' };
    const mins = Math.round((Date.now() - new Date(latest)) / 60000);
    const ago  = mins < 1 ? 'just now' : mins === 1 ? '1m ago' : `${mins}m ago`;
    return { dot: 'rgba(255,255,255,.18)', val: latestName ?? '—', sub: `Woke screen · ${ago}` };
  }

  _buildGrid() {
    const tiles = this._config.displays.map((d, i) => {
      const { dot, val, sub } = this._displayTileData(d);
      return this._buildTile(`disp-tile-${i}`, d.name, val, dot, sub);
    });
    const grab = this._grabTileData();
    const tap  = this._lastTapData();
    tiles.push(this._buildTile('grab-tile', 'Touch wake', grab.val, grab.dot, grab.sub));
    tiles.push(this._buildTile('tap-tile',  'Last tap',   tap.val,  tap.dot,  tap.sub));
    return `<div class="grid">${tiles.join('')}</div>`;
  }

  _buildHdr() {
    const ok = this._allHealthy();
    const chip = ok
      ? `<div class="chip chip-ok">All healthy</div>`
      : `<div class="chip chip-err">Check API</div>`;
    return `<div class="card-hdr"><span>Display health</span><div id="hdr-chip">${chip}</div></div>`;
  }

  // ── Render / Patch ───────────────────────────────────────────────────────────

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card><div class="wrap">${this._buildHdr()}${this._buildGrid()}</div></ha-card>`;
  }

  _patch() {
    const sr = this.shadowRoot;

    const hdrChip = sr.getElementById('hdr-chip');
    if (hdrChip) {
      hdrChip.innerHTML = this._allHealthy()
        ? `<div class="chip chip-ok">All healthy</div>`
        : `<div class="chip chip-err">Check API</div>`;
    }

    const setTile = (id, val, dot, sub) => {
      const v = sr.getElementById(`${id}-val`); if (v) v.textContent = val;
      const d = sr.getElementById(`${id}-dot`); if (d) d.style.background = dot;
      const s = sr.getElementById(`${id}-sub`); if (s) s.textContent = sub;
    };

    this._config.displays.forEach((d, i) => {
      const { dot, val, sub } = this._displayTileData(d);
      setTile(`disp-tile-${i}`, val, dot, sub);
    });

    const grab = this._grabTileData();
    setTile('grab-tile', grab.val, grab.dot, grab.sub);

    const tap = this._lastTapData();
    setTile('tap-tile', tap.val, tap.dot, tap.sub);
  }
}

customElements.define('kiosk-health-card', KioskHealthCard);
