/**
 * wallbox-card.js  —  v14
 * Wallbox EV charger status card for Home Assistant Lovelace.
 *
 * CONFIG:
 * type: custom:wallbox-card
 * prefix: wallbox_beryl_pulsar_plus   # required — entity ID prefix
 * name: Wallbox Beryl Pulsar Plus     # optional display name
 */

class WallboxCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
  
    this._docHandlers = [];
  }

  static getStubConfig() { return { prefix: 'wallbox_beryl_pulsar_plus' }; }
  static getConfigForm() {
    return {
      schema: [
      { name: 'prefix', label: 'Wallbox entity prefix', selector: { text: {} } },
      { name: 'name',   label: 'Display name',          selector: { text: {} } },
    ],
      assertCustomElement: 'wallbox-card',
    };
  }


  setConfig(c) {
    if (!c.prefix) throw new Error('wallbox-card: prefix is required');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
    this._patch();
  }

  disconnectedCallback() {
    this._docHandlers.forEach(h => {
      document.removeEventListener('mousemove',  h);
      document.removeEventListener('touchmove',  h);
      document.removeEventListener('mouseup',    h);
      document.removeEventListener('touchend',   h);
    });
    this._docHandlers = [];
  }

  getCardSize() { return 5; }

  // ── Entity helpers ────────────────────────────────────────────────────────
  _pfx()         { return this._config.prefix; }
  _eid(s)        { return `sensor.${this._pfx()}_${s}`; }
  _estate(s)     { return this._hass?.states[this._eid(s)] || null; }
  _eval(s)       { return this._estate(s)?.state ?? null; }
  _enum(s)       { const v = parseFloat(this._eval(s)); return isNaN(v) ? null : v; }
  _raw(id)       { return this._hass?.states[id] || null; }
  _rval(id)      { return this._raw(id)?.state ?? null; }
  _rnum(id)      { const v = parseFloat(this._rval(id)); return isNaN(v) ? null : v; }

  // ── Status → theme ────────────────────────────────────────────────────────
  _statusTheme(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('charging'))
      return { label: 'Charging',     color: '#60a5fa', rgb: '96,165,250',   dot: '#60a5fa'  };
    if (s.includes('ready') || s === '1' || s === '164' || s === '180' || s === '181')
      return { label: 'Ready',        color: '#4ade80', rgb: '74,222,128',   dot: '#4ade80'  };
    if (s.includes('connected') || s === '2')
      return { label: 'Connected',    color: '#fbbf24', rgb: '251,191,36',   dot: '#fbbf24'  };
    if (s.includes('pause') || s.includes('stopped'))
      return { label: 'Paused',       color: '#fbbf24', rgb: '251,191,36',   dot: '#fbbf24'  };
    if (s.includes('error') || s.includes('fault'))
      return { label: 'Error',        color: '#f87171', rgb: '248,113,113',  dot: '#f87171'  };
    if (s.includes('locked'))
      return { label: 'Locked',       color: 'rgba(255,255,255,.4)', rgb: '180,180,180', dot: 'rgba(255,255,255,.3)' };
    return       { label: status || 'Unknown', color: 'rgba(255,255,255,.4)', rgb: '180,180,180', dot: 'rgba(255,255,255,.3)' };
  }

  // ── Solar mode cycle ──────────────────────────────────────────────────────
  async _setSolarMode(mode) {
    const id = `select.${this._pfx()}_solar_charging`;
    if (this._busy.solar) return;
    this._busy.solar = true;
    try {
      await this._hass.callService('select', 'select_option', { entity_id: id, option: mode });
    } catch(e) { console.warn('wallbox-card solar mode:', e); }
    setTimeout(() => { this._busy.solar = false; }, 1000);
  }

  // ── Lock toggle ───────────────────────────────────────────────────────────
  async _toggleLock() {
    const id = `lock.${this._pfx()}_lock`;
    if (this._busy.lock) return;
    this._busy.lock = true;
    const locked = this._rval(id) === 'locked';
    try {
      await this._hass.callService('lock', locked ? 'unlock' : 'lock', { entity_id: id });
    } catch(e) { console.warn('wallbox-card lock:', e); }
    setTimeout(() => { this._busy.lock = false; }, 1000);
  }

  // ── Max current adjust ────────────────────────────────────────────────────
  async _setMaxCurrent(val) {
    const id = `number.${this._pfx()}_maximum_charging_current`;
    if (this._busy.current) return;
    this._busy.current = true;
    try {
      await this._hass.callService('number', 'set_value', { entity_id: id, value: val });
    } catch(e) { console.warn('wallbox-card current:', e); }
    setTimeout(() => { this._busy.current = false; }, 600);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card { overflow: hidden; }
    .sbanner{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1.5px solid rgba(255,255,255,.40)}
    .sdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .slabel{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;line-height:1}
    .ssub{font-size:10px;color:rgba(255,255,255,.4);margin-top:2px}
    .sec{padding:10px 14px 12px;display:flex;flex-direction:column;gap:8px}
    .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .stat-tile{background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.40);border-radius:8px;padding:9px 11px}
    .stat-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3);margin-bottom:3px}
    .stat-val{font-size:20px;font-weight:700;color:#e2e8f0;letter-spacing:-.5px;line-height:1}
    .stat-unit{font-size:11px;color:rgba(255,255,255,.35);margin-left:2px}
    .bar-wrap{display:flex;flex-direction:column;gap:4px}
    .bar-label-row{display:flex;justify-content:space-between;align-items:baseline}
    .bar-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3)}
    .bar-val{font-size:11px;font-weight:700;color:rgba(255,255,255,.5)}
    .bar-bg{height:6px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .bar-fill{height:100%;border-radius:99px;transition:width .3s}
    .bar-ends{display:flex;justify-content:space-between;margin-top:2px}
    .bar-end{font-size:9px;color:rgba(255,255,255,.2)}
    .divider{height:2px;background:rgba(255,255,255,.22)}
    .ctrl-row{display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1.5px solid rgba(255,255,255,.28);cursor:pointer;user-select:none;transition:filter .1s;-webkit-tap-highlight-color:transparent}
    .ctrl-row:active{filter:brightness(.85)}
    .ctrl-ico{width:18px;height:18px;flex-shrink:0}
    .ctrl-ico svg{width:100%;height:100%}
    .ctrl-lbl{font-size:12px;color:rgba(255,255,255,.45);flex:1}
    .ctrl-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;flex-shrink:0}
    .mode-row{display:flex;align-items:center;gap:6px;padding:8px 14px;border-top:1.5px solid rgba(255,255,255,.28)}
    .mode-ico{width:16px;height:16px;flex-shrink:0}
    .mode-ico svg{width:100%;height:100%}
    .mode-lbl{font-size:11px;color:rgba(255,255,255,.3);flex:1}
    .mode-opt{font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;border:1.5px solid rgba(255,255,255,.40);color:rgba(255,255,255,.3);cursor:pointer;transition:background .15s,color .15s,border-color .15s;user-select:none;-webkit-tap-highlight-color:transparent}
    .mode-opt:active{filter:brightness(.85)}
    .mode-opt.active{background:rgba(74,222,128,.12);border-color:rgba(74,222,128,.3);color:#4ade80}
    .mode-opt.active-eco{background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.3);color:#60a5fa}
    .mode-opt.active-solar{background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.3);color:#fbbf24}
    .current-slider{display:flex;flex-direction:column;gap:6px}
    .slider-track-wrap{position:relative;height:28px;display:flex;align-items:center;touch-action:none;cursor:pointer}
    .slider-track{width:100%;height:6px;border-radius:99px;background:rgba(255,255,255,.08);position:relative;overflow:visible}
    .slider-fill{height:100%;border-radius:99px;background:#60a5fa;pointer-events:none;transition:width .05s}
    .slider-thumb{position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:50%;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.4);pointer-events:none;transition:left .05s}
  `; }

  // ── Render ────────────────────────────────────────────────────────────────
  _render() {
    const status     = this._eval('status_description');
    const theme      = this._statusTheme(status);
    const energy     = this._enum('added_energy');
    const rangeAdded = this._enum('added_range');
    const power      = this._enum('charging_power');
    const speed      = this._enum('charging_speed');
    const maxCur     = this._rnum(`number.${this._pfx()}_maximum_charging_current`);
    const maxAvail   = this._enum('max_available_power');
    const lockState  = this._rval(`lock.${this._pfx()}_lock`);
    const locked     = lockState === 'locked';
    const solarMode  = this._rval(`select.${this._pfx()}_solar_charging`) || 'off';
    const name       = this._config.name || 'EV Charger';

    const curPct   = (maxCur != null && maxAvail) ? Math.round((maxCur / maxAvail) * 100) : 0;

    const fmtNum = (v, dec=0) => v != null ? v.toFixed(dec) : '—';

    const solarClass = (m) => {
      if (solarMode === m) {
        if (m === 'off')        return 'mode-opt active';
        if (m === 'eco_mode')   return 'mode-opt active-eco';
        if (m === 'full_solar') return 'mode-opt active-solar';
      }
      return 'mode-opt';
    };

    this.shadowRoot.innerHTML = `
      <style>${this._css()}
    /* ── Light mode override (no Amoled+ theme / default HA) ─────────────── */
    @media (prefers-color-scheme: light) {
      .card,.wrap,.room,.exp-wrap { border-color: var(--divider-color, rgba(0,0,0,.15)) !important; background: var(--card-background-color, #fff) !important; }
      .fpip { border-color: var(--divider-color, rgba(0,0,0,.15)) !important; background: transparent !important; }
      .fpip-dot { background: var(--secondary-text-color, rgba(0,0,0,.4)) !important; }
      .fpip-dot-off { color: var(--secondary-text-color, rgba(0,0,0,.4)) !important; }
      .itog { border-color: var(--divider-color, rgba(0,0,0,.15)) !important; background: transparent !important; }
      .itog-dot { background: var(--secondary-text-color, rgba(0,0,0,.4)) !important; }
      .itog-lbl { color: var(--primary-text-color, rgba(0,0,0,.75)) !important; }
      .sec-hdr,.sec-lbl,.fan-nm,.card-hdr-title,.stat-lbl,.stat-lbl-sm,.bar-label,.dir-lbl,.exp-row-lbl,.exp-arr-lbl,.exp-sec-lbl { color: var(--secondary-text-color, rgba(0,0,0,.5)) !important; }
      .slabel,.stat-val,.time-big,.exp-time-xl,.exp-time-sm,.cur-temp,.card-hdr { color: var(--primary-text-color, rgba(0,0,0,.87)) !important; }
      .lm-thumb,.tog-thumb { background: var(--primary-text-color, rgba(0,0,0,.4)) !important; }
      .tog { border-color: var(--divider-color, rgba(0,0,0,.2)) !important; background: transparent !important; }
      .stat-tile,.stat-tile-sm,.speed-item,.session-tile,.titem,.iitem,.tire-tile,.temp-tile,.aslot,.rbtn { border-color: var(--divider-color, rgba(0,0,0,.12)) !important; background: transparent !important; }
      .lm-track,.lm-bar,.batt-bar-bg,.pp-ltrack,.strack { background: var(--divider-color, rgba(0,0,0,.1)) !important; }
      .idle-dot,.bdot { background: var(--secondary-text-color, rgba(0,0,0,.3)) !important; }
    }
</style>
      <ha-card>
        <div class="card" style="background:rgba(255,255,255,0);border-color:rgba(${theme.rgb},.35)">
          <div class="sbanner">
            <div class="sdot" style="background:${theme.dot}"></div>
            <div>
              <div class="slabel" style="color:${theme.color}">${theme.label}</div>
              <div class="ssub">${name}</div>
            </div>
          </div>

          <div class="sec">
            <div class="stat-grid">
              <div class="stat-tile">
                <div class="stat-lbl">Session energy</div>
                <div><span class="stat-val" id="wb-energy">${fmtNum(energy,2)}</span><span class="stat-unit">kWh</span></div>
              </div>
              <div class="stat-tile">
                <div class="stat-lbl">Range added</div>
                <div><span class="stat-val" id="wb-range">${fmtNum(rangeAdded,0)}</span><span class="stat-unit">mi</span></div>
              </div>
              <div class="stat-tile">
                <div class="stat-lbl">Charge power</div>
                <div><span class="stat-val" id="wb-power" style="color:${power && power > 0 ? '#60a5fa' : '#e2e8f0'}">${fmtNum(power,1)}</span><span class="stat-unit">kW</span></div>
              </div>
              <div class="stat-tile">
                <div class="stat-lbl">Charge speed</div>
                <div><span class="stat-val" id="wb-speed" style="font-size:16px">${speed != null ? speed : '—'}</span><span class="stat-unit" style="font-size:10px"> km/h added</span></div>
              </div>
            </div>

            <div class="current-slider">
              <div class="bar-label-row">
                <span class="bar-label">Max current</span>
                <span class="bar-val" id="wb-cur-val">${maxCur != null ? maxCur : '—'} A</span>
              </div>
              <div class="slider-track-wrap" id="wb-cur-wrap" style="touch-action:none">
                <div class="slider-track">
                  <div class="slider-fill" id="wb-cur-fill" style="width:${curPct}%"></div>
                  <div class="slider-thumb" id="wb-cur-thumb" style="left:${curPct}%"></div>
                </div>
              </div>
              <div class="bar-ends"><span class="bar-end">6 A</span><span class="bar-end">48 A</span></div>
            </div>
          </div>

          <div class="ctrl-row" id="wb-lock-row">
            <div class="ctrl-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                ${locked
                  ? '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
                  : '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'}
              </svg>
            </div>
            <div class="ctrl-lbl">Charger lock</div>
            <div class="ctrl-badge" id="wb-lock-badge"
              style="background:${locked ? 'rgba(248,113,113,.12)' : 'rgba(74,222,128,.12)'};color:${locked ? '#f87171' : '#4ade80'}">
              ${locked ? 'Locked' : 'Unlocked'}
            </div>
          </div>

          <div class="mode-row">
            <div class="mode-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.7" stroke-linecap="round">
                <circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
              </svg>
            </div>
            <span class="mode-lbl">Solar mode</span>
            <div class="${solarClass('off')}"         id="wbm-off"  data-mode="off">Off</div>
            <div class="${solarClass('eco_mode')}"    id="wbm-eco"  data-mode="eco_mode">Eco</div>
            <div class="${solarClass('full_solar')}"  id="wbm-full" data-mode="full_solar">Full solar</div>
          </div>
        </div>
      </ha-card>`;

    this._attachListeners();
  }

  _patch() {
    const sr = this.shadowRoot;
    const status   = this._eval('status_description');
    const theme    = this._statusTheme(status);
    const energy   = this._enum('added_energy');
    const range    = this._enum('added_range');
    const power    = this._enum('charging_power');
    const speed    = this._enum('charging_speed');
    const maxCur   = this._rnum(`number.${this._pfx()}_maximum_charging_current`);
    const maxAvail = this._enum('max_available_power');
    const locked   = this._rval(`lock.${this._pfx()}_lock`) === 'locked';
    const solarMode= this._rval(`select.${this._pfx()}_solar_charging`) || 'off';
    const curPct   = (maxCur != null && maxAvail) ? Math.round((maxCur / maxAvail) * 100) : 0;
    const fmtNum   = (v, dec=0) => v != null ? v.toFixed(dec) : '—';

    const el = id => sr.getElementById(id);
    if (el('wb-energy')) el('wb-energy').textContent = fmtNum(energy,2);
    if (el('wb-range'))  el('wb-range').textContent  = fmtNum(range,0);
    if (el('wb-power'))  { el('wb-power').textContent = fmtNum(power,1); el('wb-power').style.color = power && power > 0 ? '#60a5fa' : '#e2e8f0'; }
    if (el('wb-speed'))  el('wb-speed').textContent  = speed != null ? speed : '—';
    if (el('wb-cur-val'))   el('wb-cur-val').textContent   = maxCur != null ? maxCur+' A' : '—';
    if (el('wb-cur-fill'))  el('wb-cur-fill').style.width  = curPct+'%';
    if (el('wb-cur-thumb')) el('wb-cur-thumb').style.left  = curPct+'%';
    if (el('wb-lock-badge')) {
      el('wb-lock-badge').textContent = locked ? 'Locked' : 'Unlocked';
      el('wb-lock-badge').style.background = locked ? 'rgba(248,113,113,.12)' : 'rgba(74,222,128,.12)';
      el('wb-lock-badge').style.color      = locked ? '#f87171' : '#4ade80';
    }
    ['off','eco','full'].forEach(k => {
      const modeVal = k === 'off' ? 'off' : k === 'eco' ? 'eco_mode' : 'full_solar';
      const el2 = sr.getElementById(`wbm-${k}`);
      if (!el2) return;
      el2.className = solarMode === modeVal
        ? (k==='off' ? 'mode-opt active' : k==='eco' ? 'mode-opt active-eco' : 'mode-opt active-solar')
        : 'mode-opt';
    });
  }

  _attachListeners() {
    const sr = this.shadowRoot;
    // lock toggle
    sr.getElementById('wb-lock-row')?.addEventListener('click', () => this._toggleLock());
    // solar mode buttons
    sr.querySelectorAll('.mode-opt').forEach(btn => {
      btn.addEventListener('click', () => this._setSolarMode(btn.dataset.mode));
    });
    // max current drag slider
    const wrap = sr.getElementById('wb-cur-wrap');
    if (!wrap) return;
    let dragging = false;
    let debounce = null;
    const MIN = 6, MAX = 48;
    const update = (clientX, isFinal) => {
      const rect = wrap.getBoundingClientRect();
      const pct  = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const val  = Math.round(MIN + pct * (MAX - MIN));
      const fill  = sr.getElementById('wb-cur-fill');
      const thumb = sr.getElementById('wb-cur-thumb');
      const label = sr.getElementById('wb-cur-val');
      const fpct  = Math.round((val - MIN) / (MAX - MIN) * 100);
      if (fill)  fill.style.width  = fpct+'%';
      if (thumb) thumb.style.left  = fpct+'%';
      if (label) label.textContent = val+' A';
      if (debounce) clearTimeout(debounce);
      if (isFinal) this._setMaxCurrent(val);
      else debounce = setTimeout(() => this._setMaxCurrent(val), 150);
    };
    wrap.addEventListener('mousedown',  e => { dragging=true; update(e.clientX,false); e.preventDefault(); });
    wrap.addEventListener('touchstart', e => { dragging=true; update(e.touches[0].clientX,false); }, {passive:true});
    const _onMove  = e => { if(dragging) update(e.clientX,false); };
    const _onMoveT = e => { if(dragging) update(e.touches[0].clientX,false); };
    const _onUp    = () => { dragging=false; };
    document.addEventListener('mousemove',  _onMove);
    document.addEventListener('touchmove',  _onMoveT, {passive:true});
    document.addEventListener('mouseup',    _onUp);
    document.addEventListener('touchend',   _onUp);
    this._docHandlers.push(_onMove, _onMoveT, _onUp);
  }
}

customElements.define('wallbox-card', WallboxCard);
