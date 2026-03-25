/**
 * thermostat-card.js  —  v12
 * Redesigned: matches room-controls tstat style.
 * Colored left bar = mode indicator, mode pill left of controls,
 * individual tadj buttons (44×44, 2px border), no bg tint.
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:thermostat-card
 * entity: climate.main_floor   # required
 * name: Main Floor              # optional — overrides friendly_name
 * step: 1                       # optional — °F/°C per tap (default 1)
 */

class ThermostatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = false;
  }

  static getStubConfig() {
    return { entity: 'climate.main_floor', name: 'Main Floor', step: 1 };
  }

  setConfig(config) {
    if (!config.entity) throw new Error('thermostat-card: please define an entity');
    this._config = { step: 1, ...config };
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.tcur') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 2; }

  _entity() {
    if (!this._hass || !this._config.entity) return null;
    return this._hass.states[this._config.entity] || null;
  }

  _attr(key) {
    const e = this._entity();
    return e ? (e.attributes[key] ?? null) : null;
  }

  _fmt(val) { return val != null ? Math.round(val) : null; }

  static get MODE_ORDER() {
    return ['heat_cool','auto','heat','cool','fan_only','dry','off'];
  }

  static get MODE_META() {
    return {
      heat_cool: { label:'Heat/Cool', split:true,  dot:null,                    border:'rgba(251,146,60,.55)', bg:'rgba(251,146,60,.10)', bar:'rgba(251,146,60,.80)', setColor:'#fb923c' },
      auto:      { label:'Auto',      split:true,  dot:null,                    border:'rgba(251,146,60,.55)', bg:'rgba(251,146,60,.10)', bar:'rgba(251,146,60,.80)', setColor:'#fb923c' },
      heat:      { label:'Heat',      split:false, dot:'#fb923c',               border:'rgba(251,146,60,.55)', bg:'rgba(251,146,60,.10)', bar:'rgba(251,146,60,.80)', setColor:'#fb923c' },
      cool:      { label:'Cool',      split:false, dot:'#60a5fa',               border:'rgba(96,165,250,.55)', bg:'rgba(96,165,250,.10)', bar:'rgba(96,165,250,.80)', setColor:'#60a5fa' },
      fan_only:  { label:'Fan',       split:false, dot:'#2dd4bf',               border:'rgba(45,212,191,.55)', bg:'rgba(45,212,191,.10)', bar:'rgba(45,212,191,.80)', setColor:'#2dd4bf' },
      dry:       { label:'Dry',       split:false, dot:'#fbbf24',               border:'rgba(251,191,36,.55)', bg:'rgba(251,191,36,.10)', bar:'rgba(251,191,36,.80)', setColor:'#fbbf24' },
      off:       { label:'Off',       split:false, dot:'rgba(255,255,255,.55)', border:'rgba(255,255,255,.35)', bg:'transparent',          bar:'rgba(255,255,255,.55)', setColor:'rgba(255,255,255,.35)' },
    };
  }

  _supportedModes() {
    const raw = this._attr('hvac_modes') || [];
    return ThermostatCard.MODE_ORDER.filter(m => raw.includes(m));
  }

  _meta(modeKey) {
    return ThermostatCard.MODE_META[modeKey] || ThermostatCard.MODE_META['off'];
  }

  async _adjustTemp(delta) {
    if (this._busy) return;
    const e = this._entity();
    if (!e) return;
    const current = e.attributes.temperature ?? e.attributes.target_temp_high ?? null;
    if (current == null) return;
    const step    = parseFloat(this._config.step) || 1;
    const raw     = parseFloat(current) + delta * step;
    const min     = e.attributes.min_temp ?? -Infinity;
    const max     = e.attributes.max_temp ??  Infinity;
    const newTemp = Math.round(Math.min(max, Math.max(min, raw)) * 10) / 10;
    this._busy = true;
    try {
      await this._hass.callService('climate', 'set_temperature', {
        entity_id: this._config.entity, temperature: newTemp,
      });
    } catch(err) { console.warn('thermostat-card: set_temperature failed', err); }
    setTimeout(() => { this._busy = false; }, 600);
  }

  async _cycleMode() {
    if (this._busy) return;
    const e = this._entity();
    if (!e) return;
    const supported = this._supportedModes();
    if (supported.length < 2) return;
    const current = (e.state || '').toLowerCase();
    const idx     = supported.indexOf(current);
    const next    = supported[(idx + 1) % supported.length];
    this._busy = true;
    try {
      await this._hass.callService('climate', 'set_hvac_mode', {
        entity_id: this._config.entity, hvac_mode: next,
      });
    } catch(err) { console.warn('thermostat-card: set_hvac_mode failed', err); }
    setTimeout(() => { this._busy = false; }, 600);
  }

  _dotHtml(meta) {
    if (meta.split) return `<div style="width:9px;height:9px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex"><div style="flex:1;background:#fb923c"></div><div style="flex:1;background:#60a5fa"></div></div>`;
    return `<div style="width:9px;height:9px;border-radius:50%;background:${meta.dot};flex-shrink:0"></div>`;
  }

  _patch() {
    const e       = this._entity();
    const unavail = !e || e.state === 'unavailable';
    if (unavail) { this._render(); return; }

    const cur  = this._fmt(this._attr('current_temperature'));
    const set  = this._fmt(this._attr('temperature') ?? this._attr('target_temp_high'));
    const mode = (e.state || 'off').toLowerCase();
    const meta = this._meta(mode);
    const isOff = mode === 'off';
    const supported = this._supportedModes();
    const canCycle  = supported.length > 1;

    const block = this.shadowRoot.getElementById('tc-block');
    const curEl = this.shadowRoot.querySelector('.tcur');
    const setEl = this.shadowRoot.getElementById('tc-set');
    const modeEl = this.shadowRoot.getElementById('tc-mode');
    const dnEl  = this.shadowRoot.getElementById('tc-dn');
    const upEl  = this.shadowRoot.getElementById('tc-up');

    if (block) {
      block.style.borderLeftColor = meta.bar;
    }
    if (curEl) {
      curEl.textContent = cur != null ? cur+'°' : '—';
      curEl.style.color = isOff ? 'rgba(255,255,255,.4)' : 'white';
    }
    if (setEl) {
      setEl.textContent = isOff ? '—' : (set != null ? set+'°' : '—');
      setEl.style.color = isOff ? 'rgba(255,255,255,.35)' : meta.setColor;
    }
    if (modeEl) {
      modeEl.style.borderColor  = meta.border;
      modeEl.style.background   = meta.bg;
      modeEl.style.cursor       = canCycle ? 'pointer' : 'default';
      const dotWrap = modeEl.querySelector('.mode-dot-wrap');
      const modeLbl = modeEl.querySelector('.mode-lbl');
      if (dotWrap) dotWrap.innerHTML = this._dotHtml(meta);
      if (modeLbl) { modeLbl.textContent = meta.label; modeLbl.style.color = meta.dot || '#fb923c'; }
    }
    if (dnEl) {
      dnEl.className = isOff ? 'tadj tadj-off' : 'tadj';
      dnEl.style.pointerEvents = isOff ? 'none' : '';
    }
    if (upEl) {
      upEl.className = isOff ? 'tadj tadj-off' : 'tadj';
      upEl.style.pointerEvents = isOff ? 'none' : '';
    }
  }

  _render() {
    const e       = this._entity();
    const unavail = !e || e.state === 'unavailable';
    const name    = this._config.name || e?.attributes?.friendly_name || this._config.entity;
    const cur     = this._fmt(this._attr('current_temperature'));
    const set     = this._fmt(this._attr('temperature') ?? this._attr('target_temp_high'));
    const unit    = this._attr('temperature_unit') || '°F';
    const mode    = (e?.state || 'off').toLowerCase();
    const meta    = this._meta(mode);
    const isOff   = mode === 'off';
    const supported = this._supportedModes();
    const canCycle  = supported.length > 1;

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
        *{box-sizing:border-box;margin:0;padding:0}
        .wrap{border-radius:10px;border:1.5px solid rgba(255,255,255,.40);overflow:hidden}
        .card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:10px 14px 8px;border-bottom:1.5px solid rgba(255,255,255,.28)}
        .body{padding:8px 10px 10px}
        .tstat-nm{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3);padding:0 2px;margin-bottom:4px}
        .tstat-block{border-radius:0 8px 8px 0;overflow:hidden;background:transparent}
        .tstat-top{display:flex;align-items:center;gap:6px;padding:8px 10px;-webkit-tap-highlight-color:transparent;user-select:none}
        .tstat-top:active{filter:brightness(.88)}
        .tcur{font-size:24px;font-weight:700;letter-spacing:-1px;line-height:1}
        .tcur-off{color:rgba(255,255,255,.4)}
        .hvac-pill{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:7px;height:44px;flex-shrink:0;transition:filter .1s}
        .hvac-pill.can-cycle{cursor:pointer}
        .hvac-pill.can-cycle:active{filter:brightness(.8)}
        .mode-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
        .tadj{width:44px;height:44px;flex-shrink:0;border-radius:7px;background:transparent;border:2px solid rgba(255,255,255,.50);color:white;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;user-select:none;transition:background .1s;-webkit-tap-highlight-color:transparent}
        .tadj:active{background:rgba(255,255,255,.15)}
        .tadj-off{color:rgba(255,255,255,.3);border-color:rgba(255,255,255,.20);pointer-events:none}
        .tsetval{font-size:18px;font-weight:700;min-width:36px;text-align:center;letter-spacing:-.5px}
        .unavail{font-size:11px;color:rgba(255,255,255,.35);text-align:center;padding:16px 0;font-style:italic}
        /* ── Light mode override ─────────────────────────────────────────── */
        @media (prefers-color-scheme: light) {
          .wrap { border-color: var(--divider-color, rgba(0,0,0,.15)) !important; background: var(--card-background-color, #fff) !important; }
          .card-hdr { color: var(--primary-text-color, black) !important; border-bottom-color: var(--divider-color, rgba(0,0,0,.15)) !important; }
          .tcur { color: var(--primary-text-color, black) !important; }
          .tadj { color: var(--primary-text-color, black) !important; border-color: var(--divider-color, rgba(0,0,0,.3)) !important; }
          .tstat-nm { color: var(--secondary-text-color, rgba(0,0,0,.4)) !important; }
        }
      </style>

      <ha-card>
        <div class="wrap">
          <div class="card-hdr">${name}</div>
          <div class="body">
            ${unavail
              ? `<div class="unavail">unavailable</div>`
              : `<div class="tstat-block" id="tc-block" style="border-left:4px solid ${meta.bar}">
                   <div class="tstat-top">
                     <span class="tcur${isOff?' tcur-off':''}" style="color:${isOff?'rgba(255,255,255,.4)':'white'}">${cur!=null?cur+'°':'—'}</span>
                     <span style="flex:1"></span>
                     <div class="hvac-pill${canCycle?' can-cycle':''}" id="tc-mode"
                          style="border:1.5px solid ${meta.border};background:${meta.bg}">
                       <span class="mode-dot-wrap">${this._dotHtml(meta)}</span>
                       <span class="mode-lbl" style="color:${meta.dot||'#fb923c'}">${meta.label}</span>
                     </div>
                     <div class="tadj${isOff?' tadj-off':''}" id="tc-dn">−</div>
                     <span class="tsetval" id="tc-set" style="color:${isOff?'rgba(255,255,255,.35)':meta.setColor}">${isOff?'—':(set!=null?set+'°':'—')}</span>
                     <div class="tadj${isOff?' tadj-off':''}" id="tc-up">+</div>
                   </div>
                 </div>`
            }
          </div>
        </div>
      </ha-card>`;

    this.shadowRoot.getElementById('tc-dn')
      ?.addEventListener('click', ev => { ev.stopPropagation(); this._adjustTemp(-1); });
    this.shadowRoot.getElementById('tc-up')
      ?.addEventListener('click', ev => { ev.stopPropagation(); this._adjustTemp(+1); });
    this.shadowRoot.getElementById('tc-mode')
      ?.addEventListener('click', ev => { ev.stopPropagation(); if(canCycle) this._cycleMode(); });
  }
}

customElements.define('thermostat-card', ThermostatCard);
