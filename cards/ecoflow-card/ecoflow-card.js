/**
 * ecoflow-card.js  —  v9
 * Ecoflow River 2 Pro power station card for Home Assistant Lovelace.
 *
 * CONFIG:
 * type: custom:ecoflow-card
 * prefix: river_2_pro     # required — entity ID prefix
 * name: River 2 Pro       # optional display name
 */

class EcoflowCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
  }

  static getStubConfig() { return { prefix: 'river_2_pro' }; }

  setConfig(c) {
    if (!c.prefix) throw new Error('ecoflow-card: prefix is required');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 6; }

  // ── Entity helpers ─────────────────────────────────────────────────────────
  _pfx()       { return this._config.prefix; }
  _eid(type, s){ return `${type}.${this._pfx()}_${s}`; }
  _sval(s)     { return this._hass?.states[this._eid('sensor',s)]?.state ?? null; }
  _snum(s)     { const v = parseFloat(this._sval(s)); return isNaN(v) ? null : v; }
  _swval(s)    { return this._hass?.states[this._eid('switch',s)]?.state ?? null; }
  _nval(s)     { return this._hass?.states[this._eid('number',s)]?.state ?? null; }
  _nnum(s)     { const v = parseFloat(this._nval(s)); return isNaN(v) ? null : v; }
  _non(s)      { return this._swval(s) === 'on'; }

  async _toggleSwitch(suffix) {
    if (this._busy[suffix]) return;
    this._busy[suffix] = true;
    const id  = this._eid('switch', suffix);
    const on  = this._swval(suffix) === 'on';
    try {
      await this._hass.callService('switch', on ? 'turn_off' : 'turn_on', { entity_id: id });
    } catch(e) { console.warn('ecoflow-card toggle:', e); }
    setTimeout(() => { this._busy[suffix] = false; }, 800);
  }

  async _setMaxCharge(val) {
    if (this._busy.maxcharge) return;
    this._busy.maxcharge = true;
    try {
      await this._hass.callService('number', 'set_value', {
        entity_id: this._eid('number', 'max_charge_level'),
        value: val,
      });
    } catch(e) { console.warn('ecoflow-card max charge:', e); }
    setTimeout(() => { this._busy.maxcharge = false; }, 600);
  }

  // ── Battery level → color ──────────────────────────────────────────────────
  _battColor(pct) {
    if (pct == null) return '#60a5fa';
    if (pct >= 60) return '#4ade80';
    if (pct >= 30) return '#fbbf24';
    return '#f87171';
  }

  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card { overflow: hidden; }
    .card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
    .sbanner{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1.5px solid rgba(255,255,255,.28)}
    .batt-wrap{display:flex;align-items:center;gap:10px;flex:1}
    .batt-pct{font-size:24px;font-weight:700;letter-spacing:-1px;line-height:1}
    .batt-bar-wrap{flex:1}
    .batt-bar-bg{height:10px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .batt-bar-fill{height:100%;border-radius:99px;transition:width .5s}
    .batt-sub{font-size:10px;color:rgba(255,255,255,.35);margin-top:3px}
    .status-badge{font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;flex-shrink:0}
    .sec{padding:10px 14px 12px;display:flex;flex-direction:column;gap:7px}
    .ha-tap{-webkit-tap-highlight-color:transparent;transition:transform .1s,filter .12s;cursor:pointer;user-select:none}
    .ha-tap:active{transform:scale(0.96);filter:brightness(0.9)}
    .power-row{display:flex;align-items:center;gap:10px;padding:5px 0}
    .pw-ico{width:18px;height:18px;flex-shrink:0}
    .pw-ico svg{width:100%;height:100%}
    .pw-lbl{font-size:12px;color:rgba(255,255,255,.4);flex:1}
    .pw-val{font-size:14px;font-weight:700}
    .pw-sub{font-size:10px;color:rgba(255,255,255,.3);margin-left:4px}
    .divider{height:2px;background:rgba(255,255,255,.22)}
    .slider-section{display:flex;flex-direction:column;gap:5px;padding:6px 0}
    .slider-lbl-row{display:flex;justify-content:space-between;align-items:baseline}
    .slider-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3)}
    .slider-val{font-size:12px;font-weight:700;color:rgba(255,255,255,.6)}
    .slider-track-wrap{position:relative;height:28px;display:flex;align-items:center;touch-action:none;cursor:pointer}
    .slider-track{width:100%;height:6px;border-radius:99px;background:rgba(255,255,255,.08);position:relative;overflow:visible}
    .slider-fill{height:100%;border-radius:99px;background:#4ade80;pointer-events:none;transition:width .05s}
    .slider-thumb{position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:50%;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.4);pointer-events:none;transition:left .05s}
    .slider-ends{display:flex;justify-content:space-between;margin-top:2px}
    .slider-end{font-size:9px;color:rgba(255,255,255,.2)}
    .ctrl-row{display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1.5px solid rgba(255,255,255,.18);cursor:pointer;user-select:none;transition:filter .1s}
    .ctrl-row:active{filter:brightness(.85)}
    .ctrl-ico{width:18px;height:18px;flex-shrink:0}
    .ctrl-ico svg{width:100%;height:100%}
    .ctrl-lbl{font-size:12px;color:rgba(255,255,255,.45);flex:1}
    .ctrl-sub{font-size:10px;color:rgba(255,255,255,.25)}
    .ctrl-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;flex-shrink:0}
    .stat-row-small{display:flex;gap:8px}
    .stat-tile-sm{flex:1;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30);border-radius:8px;padding:8px 10px}
    .stat-lbl-sm{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3);margin-bottom:3px}
    .stat-val-sm{font-size:15px;font-weight:700;color:#e2e8f0}
    .stat-unit-sm{font-size:10px;color:rgba(255,255,255,.3);margin-left:1px}
  `; }

  _powerRow(id, label, val, color, icoPath) {
    const active = val != null && val > 0;
    const clr    = active ? color : 'rgba(255,255,255,.2)';
    return `<div class="power-row">
      <div class="pw-ico"><svg viewBox="0 0 24 24" fill="none" stroke="${clr}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icoPath}</svg></div>
      <div class="pw-lbl">${label}</div>
      <div class="pw-val" style="color:${clr}" id="${id}">${val != null ? val : '—'}</div>
      <span class="pw-sub">W</span>
    </div>`;
  }

  _render() {
    const batt     = this._snum('battery_level');
    const battColor= this._battColor(batt);
    const health   = this._snum('state_of_health');
    const cycles   = this._snum('cycles');
    const temp     = this._snum('battery_temperature');
    const status   = this._sval('status') || 'unknown';
    const online   = status === 'online' || status?.includes('online');
    const acIn     = this._snum('ac_in_power');
    const acOut    = this._snum('ac_out_power');
    const solar    = this._snum('solar_in_power');
    const dcOut    = this._snum('dc_out_power');
    const chargeRem= this._snum('charge_remaining_time');
    const dischRem = this._snum('discharge_remaining_time');
    const maxCharge= this._nnum('max_charge_level');
    const acEnabled= this._non('ac_enabled');
    const dcEnabled= this._non('dc_12v_enabled');
    const maxChgPct= maxCharge != null ? Math.round((maxCharge - 50) / (100 - 50) * 100) : 100;
    const name     = this._config.name || 'River 2 Pro';
    const remStr   = chargeRem && chargeRem > 0
      ? `${chargeRem}m to full`
      : dischRem && dischRem > 0
      ? `${dischRem}m remaining`
      : `${health ?? 100}% health · ${cycles ?? 0} cycles`;

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
        <div class="card">
          <div class="card-hdr">${name}</div>
          <div class="sbanner">
            <div class="batt-wrap">
              <span class="batt-pct" style="color:${battColor}" id="ef-batt">${batt ?? '—'}%</span>
              <div class="batt-bar-wrap">
                <div class="batt-bar-bg"><div class="batt-bar-fill" id="ef-battbar" style="width:${batt ?? 0}%;background:${battColor}"></div></div>
                <div class="batt-sub" id="ef-sub">${remStr}</div>
              </div>
            </div>
            <div class="status-badge" style="background:${online ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.07)'};color:${online ? '#4ade80' : 'rgba(255,255,255,.35)'}">
              ${online ? 'Online' : 'Offline'}
            </div>
          </div>

          <div class="sec">
            ${this._powerRow('ef-acin',  'AC in',     acIn,  '#60a5fa', '<path d="M12 2v7l4 2-8 11v-7l-4-2 8-11z"/>')}
            ${this._powerRow('ef-solar', 'Solar in',  solar, '#4ade80', '<circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3"/>')}
            ${this._powerRow('ef-acout', 'AC out',    acOut, '#fbbf24', '<path d="M12 2v7l4 2-8 11v-7l-4-2 8-11z"/>')}
            ${this._powerRow('ef-dcout', 'DC out',    dcOut, '#a78bfa', '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M22 11h1a1 1 0 0 1 0 2h-1"/>')}
            <div class="divider"></div>
            <div class="slider-section">
              <div class="slider-lbl-row">
                <span class="slider-lbl">Max charge level</span>
                <span class="slider-val" id="ef-maxlbl">${maxCharge ?? 100}%</span>
              </div>
              <div class="slider-track-wrap" id="ef-maxwrap" style="touch-action:none">
                <div class="slider-track">
                  <div class="slider-fill" id="ef-maxfill" style="width:${maxChgPct}%"></div>
                  <div class="slider-thumb" id="ef-maxthumb" style="left:${maxChgPct}%"></div>
                </div>
              </div>
              <div class="slider-ends"><span class="slider-end">50%</span><span class="slider-end">100%</span></div>
            </div>
            <div class="stat-row-small">
              <div class="stat-tile-sm">
                <div class="stat-lbl-sm">Temp</div>
                <span class="stat-val-sm" id="ef-temp">${temp ?? '—'}</span><span class="stat-unit-sm">°F</span>
              </div>
              <div class="stat-tile-sm">
                <div class="stat-lbl-sm">Health</div>
                <span class="stat-val-sm" id="ef-health">${health ?? '—'}</span><span class="stat-unit-sm">%</span>
              </div>
              <div class="stat-tile-sm">
                <div class="stat-lbl-sm">Cycles</div>
                <span class="stat-val-sm" id="ef-cycles">${cycles ?? '—'}</span>
              </div>
            </div>
          </div>

          <div class="ctrl-row" id="ef-actoggle">
            <div class="ctrl-ico"><svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.7" stroke-linecap="round"><path d="M12 2v7l4 2-8 11v-7l-4-2 8-11z"/></svg></div>
            <div>
              <div class="ctrl-lbl">AC output</div>
            </div>
            <div class="ctrl-badge" id="ef-ac-badge" style="background:${acEnabled ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.07)'};color:${acEnabled ? '#4ade80' : 'rgba(255,255,255,.35)'}">
              ${acEnabled ? 'On' : 'Off'}
            </div>
          </div>
          <div class="ctrl-row" id="ef-dctoggle">
            <div class="ctrl-ico"><svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.7" stroke-linecap="round"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M22 11h1a1 1 0 0 1 0 2h-1"/></svg></div>
            <div>
              <div class="ctrl-lbl">DC 12V output</div>
            </div>
            <div class="ctrl-badge" id="ef-dc-badge" style="background:${dcEnabled ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.07)'};color:${dcEnabled ? '#4ade80' : 'rgba(255,255,255,.35)'}">
              ${dcEnabled ? 'On' : 'Off'}
            </div>
          </div>
        </div>
      </ha-card>`;

    this._attachListeners();
  }

  _patch() {
    const sr       = this.shadowRoot;
    const el       = id => sr.getElementById(id);
    const batt     = this._snum('battery_level');
    const battColor= this._battColor(batt);
    const health   = this._snum('state_of_health');
    const cycles   = this._snum('cycles');
    const temp     = this._snum('battery_temperature');
    const chargeRem= this._snum('charge_remaining_time');
    const dischRem = this._snum('discharge_remaining_time');
    const acIn     = this._snum('ac_in_power');
    const acOut    = this._snum('ac_out_power');
    const solar    = this._snum('solar_in_power');
    const dcOut    = this._snum('dc_out_power');
    const maxCharge= this._nnum('max_charge_level');
    const acEnabled= this._non('ac_enabled');
    const dcEnabled= this._non('dc_12v_enabled');
    const maxChgPct= maxCharge != null ? Math.round((maxCharge - 50) / (100 - 50) * 100) : 100;
    const remStr   = chargeRem && chargeRem > 0
      ? `${chargeRem}m to full`
      : dischRem && dischRem > 0
      ? `${dischRem}m remaining`
      : `${health ?? 100}% health · ${cycles ?? 0} cycles`;

    const setW = (id, val, color) => {
      const e = el(id);
      if (!e) return;
      const active = val != null && val > 0;
      e.textContent = val != null ? val : '—';
      e.style.color  = active ? color : 'rgba(255,255,255,.2)';
      const row  = e.closest('.power-row');
      const ico  = row?.querySelector('svg');
      if (ico) ico.style.stroke = active ? color : 'rgba(255,255,255,.2)';
    };

    if (el('ef-batt'))    { el('ef-batt').textContent = (batt ?? '—')+'%'; el('ef-batt').style.color = battColor; }
    if (el('ef-battbar')) { el('ef-battbar').style.width = (batt ?? 0)+'%'; el('ef-battbar').style.background = battColor; }
    if (el('ef-sub'))     el('ef-sub').textContent = remStr;
    if (el('ef-temp'))    el('ef-temp').textContent  = temp ?? '—';
    if (el('ef-health'))  el('ef-health').textContent= health ?? '—';
    if (el('ef-cycles'))  el('ef-cycles').textContent= cycles ?? '—';
    setW('ef-acin',  acIn,  '#60a5fa');
    setW('ef-solar', solar, '#4ade80');
    setW('ef-acout', acOut, '#fbbf24');
    setW('ef-dcout', dcOut, '#a78bfa');
    if (el('ef-maxlbl'))   el('ef-maxlbl').textContent  = (maxCharge ?? 100)+'%';
    if (el('ef-maxfill'))  el('ef-maxfill').style.width = maxChgPct+'%';
    if (el('ef-maxthumb')) el('ef-maxthumb').style.left = maxChgPct+'%';
    const badge = (id, on) => {
      const e = el(id);
      if (!e) return;
      e.textContent = on ? 'On' : 'Off';
      e.style.background = on ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.07)';
      e.style.color      = on ? '#4ade80' : 'rgba(255,255,255,.35)';
    };
    badge('ef-ac-badge', acEnabled);
    badge('ef-dc-badge', dcEnabled);
  }

  _attachListeners() {
    const sr = this.shadowRoot;
    sr.getElementById('ef-actoggle')?.addEventListener('click', () => this._toggleSwitch('ac_enabled'));
    sr.getElementById('ef-dctoggle')?.addEventListener('click', () => this._toggleSwitch('dc_12v_enabled'));

    const wrap = sr.getElementById('ef-maxwrap');
    if (!wrap) return;
    let dragging = false;
    let debounce = null;
    const MIN = 50, MAX = 100;
    const update = (clientX, isFinal) => {
      const rect = wrap.getBoundingClientRect();
      const pct  = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const val  = Math.round(MIN + pct * (MAX - MIN));
      const fpct = Math.round((val - MIN) / (MAX - MIN) * 100);
      const fill  = sr.getElementById('ef-maxfill');
      const thumb = sr.getElementById('ef-maxthumb');
      const lbl   = sr.getElementById('ef-maxlbl');
      if (fill)  fill.style.width  = fpct+'%';
      if (thumb) thumb.style.left  = fpct+'%';
      if (lbl)   lbl.textContent   = val+'%';
      if (debounce) clearTimeout(debounce);
      if (isFinal) this._setMaxCharge(val);
      else debounce = setTimeout(() => this._setMaxCharge(val), 150);
    };
    wrap.addEventListener('mousedown',  e => { dragging=true; update(e.clientX,false); e.preventDefault(); });
    wrap.addEventListener('touchstart', e => { dragging=true; update(e.touches[0].clientX,false); }, {passive:true});
    document.addEventListener('mousemove',  e => { if(dragging) update(e.clientX,false); });
    document.addEventListener('touchmove',  e => { if(dragging) update(e.touches[0].clientX,false); }, {passive:true});
    document.addEventListener('mouseup',    () => { dragging=false; });
    document.addEventListener('touchend',   () => { dragging=false; });
  }
}

customElements.define('ecoflow-card', EcoflowCard);
