/**
 * tesla-commute-card.js  —  v12
 * Expanded Tesla card for the Commute view. Surfaces all commute-relevant
 * data inline — no popup needed. Compact tesla-card on the Home view remains
 * unchanged; this card is an independent component.
 *
 * CONFIG:
 * type: custom:tesla-commute-card
 * name: Magneton                    # optional — vehicle nickname
 * tire_warn_psi: 40                 # optional — warn threshold (default 40)
 * temp_unit: F                      # optional — F or C (default F)
 * entities:
 *   battery_level:        sensor.magneton_battery
 *   battery_range:        sensor.magneton_range
 *   charging_state:       binary_sensor.magneton_charging
 *   door_lock:            lock.magneton_doors
 *   climate:              climate.magneton_hvac_climate_system
 *   trunk:                cover.magneton_trunk
 *   sentry_mode:          switch.magneton_sentry_mode
 *   odometer:             sensor.magneton_odometer
 *   interior_temperature: sensor.magneton_temperature_inside
 *   exterior_temperature: sensor.magneton_temperature_outside
 *   tire_pressure_fl:     sensor.magneton_tpms_front_left
 *   tire_pressure_fr:     sensor.magneton_tpms_front_right
 *   tire_pressure_rl:     sensor.magneton_tpms_rear_left
 *   tire_pressure_rr:     sensor.magneton_tpms_rear_right
 */

class TeslaCommuteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
  }

  setConfig(c) {
    if (!c.entities) throw new Error('tesla-commute-card: entities is required');
    this._config = { name: '', tire_warn_psi: 40, temp_unit: 'F', ...c };
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 7; }

  // ── Entity helpers ────────────────────────────────────────────────────────
  _e(k)      { const id = this._config.entities?.[k]; return id ? this._hass?.states[id] : null; }
  _val(k)    { return this._e(k)?.state ?? null; }
  _num(k)    { const v = parseFloat(this._val(k)); return isNaN(v) ? null : v; }
  _attr(k,a) { return this._e(k)?.attributes?.[a] ?? null; }
  _isOn(k)   { const v = this._val(k); return v === 'on' || v === 'true' || v === 'locked'; }
  _avail(k)  { const e = this._e(k); return e && e.state !== 'unavailable' && e.state !== 'unknown'; }

  _battPct() {
    const v = this._num('battery_level');
    return v != null ? Math.round(Math.min(100, Math.max(0, v))) : null;
  }
  _battColor(pct) {
    if (pct == null) return '#60a5fa';
    if (pct >= 50)  return '#4ade80';
    if (pct >= 20)  return '#fbbf24';
    return '#f87171';
  }
  _isCharging()  {
    const v = (this._val('charging_state') || '').toLowerCase();
    return v === 'on' || v === 'true' || v === 'charging';
  }
  _isLocked()    { return this._val('door_lock') === 'locked'; }
  _climateOn()   { const v = this._val('climate'); return v && v !== 'off' && v !== 'unavailable'; }
  _targetTemp()  { return this._attr('climate','temperature') ?? this._attr('climate','target_temp_high'); }
  _trunkOpen()   { const v = this._val('trunk'); return v === 'open'; }
  _sentryOn()    { return this._isOn('sentry_mode'); }
  _lastUpdated() {
    const e = this._e('battery_level') || this._e('door_lock');
    if (!e) return null;
    const d = new Date(e.last_updated || e.last_changed);
    if (isNaN(d)) return null;
    const diff = Math.round((Date.now() - d) / 60000);
    if (diff < 1)  return 'just now';
    if (diff < 60) return `${diff} min ago`;
    const h = Math.round(diff / 60);
    return `${h}h ago`;
  }

  async _callService(domain, service, data, key) {
    if (this._busy[key]) return;
    this._busy[key] = true;
    try { await this._hass.callService(domain, service, data); }
    catch(e) { console.warn('tesla-commute-card:', e); }
    setTimeout(() => { this._busy[key] = false; }, 1500);
  }
  _toggleLock()    { const id = this._config.entities.door_lock;  this._callService('lock',   this._isLocked()  ? 'unlock' : 'lock',     { entity_id: id }, 'lock');    }
  _toggleTrunk()   { const id = this._config.entities.trunk;      this._callService('cover',  this._trunkOpen() ? 'close_cover' : 'open_cover', { entity_id: id }, 'trunk'); }
  _toggleSentry()  { const id = this._config.entities.sentry_mode; this._callService('switch', this._sentryOn() ? 'turn_off' : 'turn_on', { entity_id: id }, 'sentry'); }
  _adjustTemp(d)   {
    const id = this._config.entities.climate;
    const t  = this._targetTemp();
    if (t == null) return;
    this._callService('climate','set_temperature',{ entity_id:id, temperature: parseFloat(t)+d },'temp');
  }
  _toggleClimate() {
    const id = this._config.entities.climate;
    this._callService('climate', this._climateOn() ? 'turn_off' : 'turn_on', { entity_id:id }, 'climate');
  }

  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card{border-radius:10px;border:1.5px solid rgba(255,255,255,.40);overflow:hidden}
    .divider{height:1px;background:rgba(255,255,255,.07)}
    .sec{padding:10px 14px 12px;display:flex;flex-direction:column;gap:8px}
    .sec-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28)}

    /* header */
    .hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1.5px solid rgba(255,255,255,.28)}
    .car-name{font-size:17px;font-weight:700;color:#e2e8f0;line-height:1}
    .car-sub{font-size:11px;color:rgba(255,255,255,.32);margin-top:3px}
    .lock-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:5px}

    /* battery */
    .batt-sec{padding:0 14px 12px}
    .batt-row{display:flex;align-items:center;gap:12px;margin-bottom:9px}
    .batt-pct{font-size:34px;font-weight:700;letter-spacing:-1.5px;line-height:1}
    .batt-vline{width:1px;height:30px;background:rgba(255,255,255,.1);flex-shrink:0}
    .batt-detail{display:flex;flex-direction:column;gap:3px}
    .batt-range{font-size:14px;font-weight:700;color:#e2e8f0}
    .batt-status{font-size:10px;color:rgba(255,255,255,.35)}
    .batt-bar-bg{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
    .batt-bar-fill{height:100%;border-radius:99px;transition:width .5s}

    /* temp grid */
    .temp-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .temp-tile{background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30);border-radius:8px;padding:9px 11px}
    .temp-tile-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3);margin-bottom:3px}
    .temp-val{font-size:24px;font-weight:700;letter-spacing:-.5px;line-height:1}
    .temp-unit{font-size:11px;color:rgba(255,255,255,.35);margin-left:1px}

    /* climate row */
    .climate-row{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;user-select:none;transition:filter .1s;-webkit-tap-highlight-color:transparent}
    .climate-row:active{filter:brightness(.85)}
    .climate-ico{width:18px;height:18px;flex-shrink:0}
    .climate-ico svg{width:100%;height:100%}
    .climate-lbl{font-size:12px;color:rgba(255,255,255,.45);flex:1}
    .climate-controls{display:flex;align-items:center;gap:8px}
    .temp-stepper{display:flex;align-items:center;gap:5px}
    .temp-btn{width:30px;height:30px;border-radius:7px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.40);color:rgba(255,255,255,.7);font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;transition:background .1s}
    .temp-btn:active{background:rgba(255,255,255,.18)}
    .temp-display{font-size:14px;font-weight:700;min-width:44px;text-align:center;line-height:1}
    .on-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px}

    /* tire grid */
    .tire-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .tire-tile{background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30);border-radius:8px;padding:8px 11px;display:flex;align-items:center;justify-content:space-between}
    .tire-tile.warn{background:rgba(248,113,113,.06);border-color:rgba(248,113,113,.25)}
    .tire-pos{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3)}
    .tire-pos.warn{color:#f87171}
    .tire-val{font-size:16px;font-weight:700}
    .tire-unit{font-size:9px;color:rgba(255,255,255,.3);margin-left:1px}
    .sec-lbl.warn{color:#f87171}

    /* action row */
    .action-row{display:flex;gap:7px;padding:10px 14px}
    .action-btn{flex:1;border-radius:9px;padding:10px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;border:1px solid;transition:filter .1s;user-select:none;-webkit-tap-highlight-color:transparent}
    .action-btn:active{filter:brightness(.85)}
    .action-ico{width:22px;height:22px;flex-shrink:0}
    .action-ico svg{width:100%;height:100%}
    .action-lbl{font-size:10px;font-weight:700;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center}
  `; }

  _tireSection() {
    const warn  = this._config.tire_warn_psi || 40;
    const tires = [
      { key: 'tire_pressure_fl', pos: 'FL' },
      { key: 'tire_pressure_fr', pos: 'FR' },
      { key: 'tire_pressure_rl', pos: 'RL' },
      { key: 'tire_pressure_rr', pos: 'RR' },
    ];
    const hasAny   = tires.some(t => this._avail(t.key));
    if (!hasAny) return '';
    const hasWarn  = tires.some(t => { const v = this._num(t.key); return v != null && v < warn; });
    const tilesHtml = tires.map(t => {
      const v    = this._num(t.key);
      const bad  = v != null && v < warn;
      const clr  = v == null ? 'rgba(255,255,255,.3)' : bad ? '#f87171' : '#4ade80';
      return `<div class="tire-tile${bad ? ' warn' : ''}">
        <span class="tire-pos${bad ? ' warn' : ''}">${t.pos}</span>
        <div><span class="tire-val" style="color:${clr}" id="tc-${t.key}">${v != null ? Math.round(v) : '—'}</span><span class="tire-unit">PSI</span></div>
      </div>`;
    }).join('');
    return `
      <div class="divider"></div>
      <div class="sec" style="gap:6px">
        <div class="sec-lbl${hasWarn ? ' warn' : ''}">${hasWarn ? 'Tire pressure — check required' : 'Tire pressure'}</div>
        <div class="tire-grid" id="tc-tire-grid">${tilesHtml}</div>
      </div>`;
  }

  _render() {
    const cfg       = this._config;
    const ents      = cfg.entities;
    const pct       = this._battPct();
    const battColor = this._battColor(pct);
    const range     = this._num('battery_range');
    const charging  = this._isCharging();
    const locked    = this._isLocked();
    const climateOn = this._climateOn();
    const tgtTemp   = this._targetTemp();
    const trunkOpen = this._trunkOpen();
    const sentryOn  = this._sentryOn();
    const intTemp   = this._num('interior_temperature');
    const extTemp   = this._num('exterior_temperature');
    const odo       = this._num('odometer');
    const unit      = (cfg.temp_unit || 'F').toUpperCase();
    const updated   = this._lastUpdated();

    const battStatus = charging ? `<span style="color:#60a5fa">Charging</span>` : `Not charging`;
    const tempFmt = (v) => v != null ? `${Math.round(v)}` : '—';

    // interior color: hot = orange, comfortable = white, cold = blue
    const intColor = intTemp == null ? '#e2e8f0'
      : intTemp > 85 ? '#fb923c'
      : intTemp < 45 ? '#60a5fa'
      : '#e2e8f0';

    // Climate
    const climateColor  = climateOn ? '#f97316' : 'rgba(255,255,255,.25)';
    const climateBg     = climateOn ? 'rgba(249,115,22,.06)' : '';
    const climateLblClr = climateOn ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.4)';
    const tempStepHtml  = (climateOn && tgtTemp != null)
      ? `<div class="temp-stepper">
           <button class="temp-btn" id="tc-temp-down">−</button>
           <div class="temp-display" style="color:#f97316" id="tc-temp-val">${Math.round(tgtTemp)}°${unit}</div>
           <button class="temp-btn" id="tc-temp-up">+</button>
         </div>`
      : `<div class="temp-display" style="color:rgba(255,255,255,.3)" id="tc-temp-val"></div>`;
    const climateMode = this._hass?.states[ents.climate]?.state || 'off';
    const climateModeLabel = {
      heat: 'Heating', cool: 'Cooling', heat_cool: 'Auto',
      auto: 'Auto', fan_only: 'Fan', dry: 'Dry', off: 'Off'
    }[climateMode] || climateMode;
    const onBadgeStyle = climateOn
      ? `background:rgba(249,115,22,.15);color:#f97316;border:1.5px solid rgba(249,115,22,.5)`
      : `background:rgba(255,255,255,.07);color:rgba(255,255,255,.3)`;

    // Lock badge
    const lockBadgeStyle = locked
      ? `background:rgba(74,222,128,.12);color:#4ade80;border:1.5px solid rgba(74,222,128,.5)`
      : `background:rgba(248,113,113,.12);color:#f87171;border:1.5px solid rgba(248,113,113,.5)`;

    // Action buttons
    const OFF_BG  = `background:rgba(255,255,255,0);border-color:rgba(255,255,255,.28)`;
    const btnLock   = ents.door_lock   ? `<div class="action-btn" id="tc-lock-btn" style="${locked ? 'background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.4)' : OFF_BG}">
      <div class="action-ico"><svg viewBox="0 0 24 24" fill="none" stroke="${locked ? '#4ade80' : '#f87171'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${locked ? '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' : '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'}
      </svg></div>
      <div class="action-lbl" style="color:${locked ? '#4ade80' : '#f87171'}" id="tc-lock-lbl">${locked ? 'Locked' : 'Unlocked'}</div>
    </div>` : '';

    const btnTrunk  = ents.trunk       ? `<div class="action-btn" id="tc-trunk-btn" style="${trunkOpen ? 'background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.4)' : OFF_BG}">
      <div class="action-ico"><svg viewBox="0 0 24 24" fill="none" stroke="${trunkOpen ? '#60a5fa' : 'rgba(255,255,255,.3)'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><path d="M13 16h2"/></svg></div>
      <div class="action-lbl" style="color:${trunkOpen ? '#60a5fa' : 'rgba(255,255,255,.35)'}" id="tc-trunk-lbl">${trunkOpen ? 'Open' : 'Trunk'}</div>
    </div>` : '';

    const btnSentry = ents.sentry_mode ? `<div class="action-btn" id="tc-sentry-btn" style="${sentryOn ? 'background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.4)' : OFF_BG}">
      <div class="action-ico"><svg viewBox="0 0 24 24" fill="none" stroke="${sentryOn ? '#60a5fa' : 'rgba(255,255,255,.3)'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <div class="action-lbl" style="color:${sentryOn ? '#60a5fa' : 'rgba(255,255,255,.35)'}" id="tc-sentry-lbl">${sentryOn ? 'Sentry on' : 'Sentry'}</div>
    </div>` : '';

    const odoDisplay = odo != null ? odo.toLocaleString()+' mi' : '—';
    const btnOdo     = ents.odometer   ? `<div class="action-btn" style="${OFF_BG};cursor:default">
      <div class="action-ico"><svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
      <div class="action-lbl" style="color:rgba(255,255,255,.35)" id="tc-odo-lbl">${odoDisplay}</div>
    </div>` : '';

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

          <div class="hdr">
            <div>
              <div class="car-name">${cfg.name}</div>
              <div class="car-sub">Model Y${updated ? ` · ${updated}` : ''}</div>
            </div>
            <div class="lock-badge" id="tc-lock-badge" style="${lockBadgeStyle}">${locked ? 'Locked' : 'Unlocked'}</div>
          </div>
          <div class="divider"></div>

          <div class="batt-sec" style="padding-top:12px">
            <div class="batt-row">
              <div class="batt-pct" style="color:${battColor}" id="tc-batt-pct">${pct ?? '—'}%</div>
              <div class="batt-vline"></div>
              <div class="batt-detail">
                <div class="batt-range" id="tc-batt-range">${range != null ? range+' mi range' : '—'}</div>
                <div class="batt-status" id="tc-batt-status">${battStatus}</div>
              </div>
            </div>
            <div class="batt-bar-bg"><div class="batt-bar-fill" id="tc-batt-bar" style="width:${pct ?? 0}%;background:${battColor}"></div></div>
          </div>

          ${(ents.interior_temperature || ents.exterior_temperature) ? `
          <div class="divider"></div>
          <div class="sec" style="gap:6px">
            <div class="sec-lbl">Temperature</div>
            <div class="temp-grid">
              ${ents.interior_temperature ? `<div class="temp-tile">
                <div class="temp-tile-lbl">Interior</div>
                <div><span class="temp-val" id="tc-int-temp" style="color:${intColor}">${tempFmt(intTemp)}</span><span class="temp-unit">°${unit}</span></div>
              </div>` : ''}
              ${ents.exterior_temperature ? `<div class="temp-tile">
                <div class="temp-tile-lbl">Exterior</div>
                <div><span class="temp-val" id="tc-ext-temp">${tempFmt(extTemp)}</span><span class="temp-unit">°${unit}</span></div>
              </div>` : ''}
            </div>
          </div>` : ''}

          ${ents.climate ? `
          <div class="divider"></div>
          <div class="climate-row" id="tc-climate-row" style="${climateBg}">
            <div class="climate-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="${climateColor}" stroke-width="1.7" stroke-linecap="round">
                <path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07l14.14-14.14"/>
              </svg>
            </div>
            <div class="climate-lbl" style="color:${climateLblClr}">Climate</div>
            <div class="climate-controls">
              ${tempStepHtml}
              <div class="on-badge" id="tc-on-badge" style="${onBadgeStyle}">${climateModeLabel}</div>
            </div>
          </div>` : ''}

          ${this._tireSection()}

          <div class="divider"></div>
          <div class="action-row">
            ${btnLock}${btnTrunk}${btnSentry}${btnOdo}
          </div>

        </div>
      </ha-card>`;

    this._attachListeners();
  }

  _patch() {
    const sr        = this.shadowRoot;
    const el        = id => sr.getElementById(id);
    const pct       = this._battPct();
    const battColor = this._battColor(pct);
    const range     = this._num('battery_range');
    const charging  = this._isCharging();
    const locked    = this._isLocked();
    const climateOn = this._climateOn();
    const tgtTemp   = this._targetTemp();
    const trunkOpen = this._trunkOpen();
    const sentryOn  = this._sentryOn();
    const intTemp   = this._num('interior_temperature');
    const extTemp   = this._num('exterior_temperature');
    const odo       = this._num('odometer');
    const unit      = (this._config.temp_unit || 'F').toUpperCase();
    const warn      = this._config.tire_warn_psi || 40;

    const intColor  = intTemp == null ? '#e2e8f0' : intTemp > 85 ? '#fb923c' : intTemp < 45 ? '#60a5fa' : '#e2e8f0';

    if (el('tc-batt-pct'))    { el('tc-batt-pct').textContent = (pct ?? '—')+'%'; el('tc-batt-pct').style.color = battColor; }
    if (el('tc-batt-bar'))    { el('tc-batt-bar').style.width = (pct ?? 0)+'%'; el('tc-batt-bar').style.background = battColor; }
    if (el('tc-batt-range'))  el('tc-batt-range').textContent = range != null ? range+' mi range' : '—';
    if (el('tc-batt-status')) el('tc-batt-status').innerHTML  = charging ? `<span style="color:#60a5fa">Charging</span>` : 'Not charging';
    if (el('tc-int-temp'))    { el('tc-int-temp').textContent = intTemp != null ? Math.round(intTemp) : '—'; el('tc-int-temp').style.color = intColor; }
    if (el('tc-ext-temp'))    el('tc-ext-temp').textContent   = extTemp != null ? Math.round(extTemp) : '—';

    // climate
    if (el('tc-temp-val'))   el('tc-temp-val').textContent   = climateOn && tgtTemp != null ? `${Math.round(tgtTemp)}°${unit}` : '';
    const _climateMode = this._hass?.states[this._config.entities?.climate]?.state || 'off';
    const _climateModeLabel = {heat:'Heating',cool:'Cooling',heat_cool:'Auto',auto:'Auto',fan_only:'Fan',dry:'Dry',off:'Off'}[_climateMode] || _climateMode;
    if (el('tc-on-badge'))   {
      el('tc-on-badge').textContent   = _climateModeLabel;
      el('tc-on-badge').style.cssText = climateOn
        ? 'background:rgba(249,115,22,.15);color:#f97316;border:1px solid rgba(249,115,22,.3);font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px'
        : 'background:rgba(255,255,255,.07);color:rgba(255,255,255,.3);font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px';
    }

    // lock badge + button
    const lbStyle = locked
      ? 'background:rgba(74,222,128,.12);color:#4ade80;border:1px solid rgba(74,222,128,.3);font-size:10px;font-weight:700;padding:3px 9px;border-radius:5px'
      : 'background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.3);font-size:10px;font-weight:700;padding:3px 9px;border-radius:5px';
    if (el('tc-lock-badge')) { el('tc-lock-badge').textContent = locked ? 'Locked' : 'Unlocked'; el('tc-lock-badge').style.cssText = lbStyle; }
    if (el('tc-lock-lbl'))   { el('tc-lock-lbl').textContent = locked ? 'Locked' : 'Unlocked'; el('tc-lock-lbl').style.color = locked ? '#4ade80' : '#f87171'; }

    // trunk + sentry
    if (el('tc-trunk-lbl'))  { el('tc-trunk-lbl').textContent = trunkOpen ? 'Open' : 'Trunk'; el('tc-trunk-lbl').style.color = trunkOpen ? '#60a5fa' : 'rgba(255,255,255,.35)'; }
    if (el('tc-sentry-lbl')) { el('tc-sentry-lbl').textContent = sentryOn ? 'Sentry on' : 'Sentry'; el('tc-sentry-lbl').style.color = sentryOn ? '#60a5fa' : 'rgba(255,255,255,.35)'; }
    if (el('tc-odo-lbl'))    el('tc-odo-lbl').textContent = odo != null ? odo.toLocaleString()+' mi' : '—';

    // tires — patch in-place
    const tireKeys = ['tire_pressure_fl','tire_pressure_fr','tire_pressure_rl','tire_pressure_rr'];
    tireKeys.forEach(k => {
      const v   = this._num(k);
      const bad = v != null && v < warn;
      const e   = el(`tc-${k}`);
      if (e) { e.textContent = v != null ? Math.round(v) : '—'; e.style.color = v == null ? 'rgba(255,255,255,.3)' : bad ? '#f87171' : '#4ade80'; }
    });
  }

  _attachListeners() {
    const sr = this.shadowRoot;
    sr.getElementById('tc-lock-btn')?.addEventListener('click',   () => this._toggleLock());
    sr.getElementById('tc-trunk-btn')?.addEventListener('click',  () => this._toggleTrunk());
    sr.getElementById('tc-sentry-btn')?.addEventListener('click', () => this._toggleSentry());
    sr.getElementById('tc-climate-row')?.addEventListener('click', () => this._toggleClimate());
    sr.getElementById('tc-temp-down')?.addEventListener('click', e => { e.stopPropagation(); this._adjustTemp(-1); });
    sr.getElementById('tc-temp-up')?.addEventListener('click',   e => { e.stopPropagation(); this._adjustTemp(+1); });
  }
}

customElements.define('tesla-commute-card', TeslaCommuteCard);
