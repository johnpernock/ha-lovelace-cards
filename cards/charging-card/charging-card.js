/**
 * charging-card.js  —  v2
 * Unified EV charging card combining Tesla (battery, range, time-to-full,
 * charging speed) and Wallbox (power, session energy) data into one view.
 *
 * Active charging: pulsing status, battery progress bar, live stats.
 * Not charging: "Not charging" + last session summary from Wallbox.
 *
 * CONFIG:
 * type: custom:charging-card
 * name: Magneton                       # optional
 * wallbox_prefix: wallbox_beryl_pulsar_plus
 * tesla:
 *   battery_level:    sensor.magneton_battery
 *   battery_range:    sensor.magneton_range
 *   charging_state:   binary_sensor.magneton_charging
 *   charge_rate:      sensor.magneton_charging_rate
 *   time_to_full:     sensor.magneton_time_charge_complete
 *   charge_limit:     sensor.magneton_charge_limit
 */

class ChargingCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  setConfig(c) {
    if (!c.tesla)           throw new Error('charging-card: tesla entities required');
    if (!c.wallbox_prefix)  throw new Error('charging-card: wallbox_prefix required');
    this._config = { name: 'Magneton', ...c };
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 4; }

  // ── Tesla helpers ─────────────────────────────────────────────────────────
  _te(k)      { const id = this._config.tesla?.[k]; return id ? this._hass?.states[id] : null; }
  _tval(k)    { return this._te(k)?.state ?? null; }
  _tnum(k)    { const v = parseFloat(this._tval(k)); return isNaN(v) ? null : v; }

  // ── Wallbox helpers ───────────────────────────────────────────────────────
  _pfx()      { return this._config.wallbox_prefix; }
  _weid(s)    { return `sensor.${this._pfx()}_${s}`; }
  _wval(s)    { return this._hass?.states[this._weid(s)]?.state ?? null; }
  _wnum(s)    { const v = parseFloat(this._wval(s)); return isNaN(v) ? null : v; }

  // ── State ─────────────────────────────────────────────────────────────────
  _isCharging() {
    const v = (this._tval('charging_state') || '').toLowerCase();
    return v === 'on' || v === 'true' || v === 'charging';
  }
  _battPct()    { const v = this._tnum('battery_level'); return v != null ? Math.round(Math.min(100,Math.max(0,v))) : null; }
  _chargeLimit(){ const v = this._tnum('charge_limit');  return v != null ? Math.round(v) : 90; }
  _battColor(p) { if (p == null) return '#60a5fa'; if (p>=50) return '#4ade80'; if (p>=20) return '#fbbf24'; return '#f87171'; }

  _fmtTimeToFull() {
    const v = this._tval('time_to_full');
    if (!v || v === 'unavailable' || v === '0') return null;
    // May be "2:14" (h:m) or a float (hours) or minutes integer
    if (v.includes(':')) {
      const [h,m] = v.split(':').map(Number);
      if (h === 0) return `${m}m`;
      return m === 0 ? `${h}h` : `${h}h ${m}m`;
    }
    const num = parseFloat(v);
    if (isNaN(num)) return v;
    if (num < 1) return `${Math.round(num * 60)}m`;
    const h = Math.floor(num), m = Math.round((num - h) * 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  _lastChargedAgo() {
    // Use the wallbox added_energy sensor's last_changed as proxy for
    // when the last session ended
    const e = this._hass?.states[this._weid('added_energy')];
    if (!e) return null;
    const d    = new Date(e.last_changed || e.last_updated);
    const diff = Math.round((Date.now() - d) / 60000);
    if (diff < 60)  return `${diff} min ago`;
    const h = Math.floor(diff / 60);
    return `${h}h ago`;
  }

  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card{border-radius:10px;border:1px solid rgba(255,255,255,.1);overflow:hidden}
    .divider{height:1px;background:rgba(255,255,255,.07)}
    .sec{padding:10px 14px 12px;display:flex;flex-direction:column;gap:8px}

    /* banner */
    .banner{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.07)}
    .bdot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    .bdot.pulse{animation:blink 1.8s ease-in-out infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
    .blabel{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;line-height:1}
    .bsub{font-size:10px;color:rgba(255,255,255,.38);margin-top:2px}
    .bttf{font-size:12px;font-weight:700;margin-left:auto;flex-shrink:0}

    /* progress */
    .prog-sec{padding:12px 14px 10px;display:flex;flex-direction:column;gap:5px}
    .prog-lbl-row{display:flex;justify-content:space-between;align-items:baseline}
    .prog-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3)}
    .prog-pct{font-size:11px;font-weight:700;color:rgba(255,255,255,.5)}
    .prog-bg{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;position:relative}
    .prog-fill{height:100%;border-radius:99px;transition:width .5s}
    .prog-limit{position:absolute;top:-2px;bottom:-2px;width:2px;background:rgba(255,255,255,.4);border-radius:1px}
    .prog-ends{display:flex;justify-content:space-between;margin-top:3px}
    .prog-end{font-size:9px;color:rgba(255,255,255,.22)}

    /* stat grid */
    .stat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}
    .stat-tile{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:9px 11px}
    .stat-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3);margin-bottom:3px}
    .stat-val{font-size:18px;font-weight:700;letter-spacing:-.5px;line-height:1}
    .stat-unit{font-size:10px;color:rgba(255,255,255,.35);margin-left:1px}
    .stat-src{font-size:9px;margin-top:2px}

    /* idle */
    .idle-row{display:flex;align-items:flex-start;gap:10px;padding:10px 14px}
    .idle-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.18);flex-shrink:0;margin-top:3px}
    .idle-lbl{font-size:13px;font-weight:700;color:rgba(255,255,255,.45)}
    .idle-sub{font-size:10px;color:rgba(255,255,255,.25);margin-top:2px}
    .session-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 14px 12px}
    .session-tile{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px 10px}
    .session-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:rgba(255,255,255,.25);margin-bottom:2px}
    .session-val{font-size:15px;font-weight:700;color:rgba(255,255,255,.5)}
    .session-unit{font-size:10px;color:rgba(255,255,255,.25);margin-left:1px}
  `; }

  _renderCharging() {
    const pct       = this._battPct();
    const limit     = this._chargeLimit();
    const battColor = this._battColor(pct);
    const range     = this._tnum('battery_range');
    const power     = this._wnum('charging_power');
    const energy    = this._wnum('added_energy');
    const chargeRate= this._tnum('charge_rate');   // mi/hr from Tesla
    const ttf       = this._fmtTimeToFull();
    const limitPct  = Math.min(100, limit);
    const barPct    = pct ?? 0;

    return `
      <div class="banner" style="background:rgba(96,165,250,.04);border-bottom-color:rgba(96,165,250,.12)">
        <div class="bdot pulse" style="background:#60a5fa"></div>
        <div>
          <div class="blabel" style="color:#60a5fa">Charging</div>
          <div class="bsub">${this._config.name} · Beryl Pulsar Plus</div>
        </div>
        ${ttf ? `<div class="bttf" style="color:#60a5fa" id="cc-ttf">Full in ${ttf}</div>` : ''}
      </div>

      <div class="prog-sec">
        <div class="prog-lbl-row">
          <span class="prog-lbl">Battery</span>
          <span class="prog-pct" id="cc-prog-lbl">${pct ?? '—'}% → ${limitPct}% limit</span>
        </div>
        <div class="prog-bg">
          <div class="prog-fill" id="cc-prog-fill" style="width:${barPct}%;background:${battColor}"></div>
          <div class="prog-limit" style="left:${limitPct}%"></div>
        </div>
        <div class="prog-ends">
          <span class="prog-end" style="color:${battColor};font-weight:700" id="cc-prog-now">${pct ?? '—'}% · ${range ?? '—'} mi</span>
          <span class="prog-end">Limit ${limitPct}%</span>
        </div>
      </div>

      <div class="sec">
        <div class="stat-grid">
          <div class="stat-tile" style="border-color:rgba(96,165,250,.2)">
            <div class="stat-lbl">Power</div>
            <div><span class="stat-val" style="color:#60a5fa" id="cc-power">${power != null ? power.toFixed(1) : '—'}</span><span class="stat-unit">kW</span></div>
            <div class="stat-src" style="color:rgba(96,165,250,.45)">Wallbox</div>
          </div>
          <div class="stat-tile">
            <div class="stat-lbl">Added</div>
            <div><span class="stat-val" id="cc-energy">${energy != null ? energy.toFixed(1) : '—'}</span><span class="stat-unit">kWh</span></div>
            <div class="stat-src" style="color:rgba(255,255,255,.25)">Wallbox</div>
          </div>
          <div class="stat-tile" style="border-color:rgba(74,222,128,.15)">
            <div class="stat-lbl">Speed</div>
            <div><span class="stat-val" style="color:#4ade80" id="cc-rate">${chargeRate != null ? Math.round(chargeRate) : '—'}</span><span class="stat-unit">mi/h</span></div>
            <div class="stat-src" style="color:rgba(74,222,128,.4)">Tesla</div>
          </div>
        </div>
      </div>`;
  }

  _renderIdle() {
    const energy    = this._wnum('added_energy');
    const range     = this._wnum('added_range');
    const chargeRate= this._tnum('charge_rate');
    const pct       = this._battPct();
    const wbStatus  = this._wval('status_description') || 'Ready';
    const lastAgo   = this._lastChargedAgo();

    return `
      <div class="banner">
        <div class="bdot" style="background:rgba(255,255,255,.2)"></div>
        <div>
          <div class="blabel" style="color:rgba(255,255,255,.45)">Not charging</div>
          <div class="bsub">Beryl Pulsar Plus · ${wbStatus}</div>
        </div>
        ${lastAgo ? `<div style="font-size:10px;color:rgba(255,255,255,.22);margin-left:auto">Last charged ${lastAgo}</div>` : ''}
      </div>

      <div class="idle-row">
        <div class="idle-dot"></div>
        <div>
          <div class="idle-lbl">Last session</div>
          <div class="idle-sub">Wallbox cumulative totals</div>
        </div>
      </div>

      <div class="session-grid">
        <div class="session-tile">
          <div class="session-lbl">Energy added</div>
          <div><span class="session-val">${energy != null ? energy.toFixed(2) : '—'}</span><span class="session-unit">kWh</span></div>
        </div>
        <div class="session-tile">
          <div class="session-lbl">Range added</div>
          <div><span class="session-val">${range != null ? Math.round(range) : '—'}</span><span class="session-unit">mi</span></div>
        </div>
        <div class="session-tile">
          <div class="session-lbl">Charge speed</div>
          <div><span class="session-val">${chargeRate != null ? Math.round(chargeRate) : '—'}</span><span class="session-unit">mi/h</span></div>
        </div>
        <div class="session-tile">
          <div class="session-lbl">Battery now</div>
          <div><span class="session-val" style="color:${this._battColor(pct)}">${pct ?? '—'}</span><span class="session-unit">%</span></div>
        </div>
      </div>`;
  }

  _render() {
    const charging = this._isCharging();
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="card" id="cc-inner">
          ${charging ? this._renderCharging() : this._renderIdle()}
        </div>
      </ha-card>`;
  }

  _patch() {
    // Full re-render only when charging state changes (switches between sections)
    const charging = this._isCharging();
    const inner    = this.shadowRoot.getElementById('cc-inner');
    if (!inner) { this._render(); return; }

    // Detect if we switched charging state — if so, full re-render
    const wasCharging = inner.querySelector('.bdot.pulse') !== null;
    if (charging !== wasCharging) { this._render(); return; }

    if (!charging) return; // idle state is static enough

    // Patch active charging values in-place
    const sr        = this.shadowRoot;
    const el        = id => sr.getElementById(id);
    const pct       = this._battPct();
    const limit     = this._chargeLimit();
    const battColor = this._battColor(pct);
    const range     = this._tnum('battery_range');
    const power     = this._wnum('charging_power');
    const energy    = this._wnum('added_energy');
    const chargeRate= this._tnum('charge_rate');
    const ttf       = this._fmtTimeToFull();
    const barPct    = pct ?? 0;

    if (el('cc-ttf'))       el('cc-ttf').textContent      = ttf ? `Full in ${ttf}` : '';
    if (el('cc-prog-lbl'))  el('cc-prog-lbl').textContent = `${pct ?? '—'}% → ${limit}% limit`;
    if (el('cc-prog-fill')) { el('cc-prog-fill').style.width = barPct+'%'; el('cc-prog-fill').style.background = battColor; }
    if (el('cc-prog-now'))  { el('cc-prog-now').textContent = `${pct ?? '—'}% · ${range ?? '—'} mi`; el('cc-prog-now').style.color = battColor; }
    if (el('cc-power'))     el('cc-power').textContent     = power     != null ? power.toFixed(1)         : '—';
    if (el('cc-energy'))    el('cc-energy').textContent    = energy    != null ? energy.toFixed(1)        : '—';
    if (el('cc-rate'))      el('cc-rate').textContent      = chargeRate != null ? Math.round(chargeRate)  : '—';
  }
}

customElements.define('charging-card', ChargingCard);
