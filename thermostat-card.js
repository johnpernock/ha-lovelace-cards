/**
 * thermostat-card.js
 * Compact Home Assistant Lovelace thermostat card with detail popup.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy this file to /config/www/thermostat-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/thermostat-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:thermostat-card
 * entity: climate.main_floor   # required
 * name: Main Floor              # optional — overrides friendly_name
 * step: 1                       # optional — °F/°C per tap (default 1)
 *
 * ── LAYOUT (three-across horizontal stack) ────────────────────────────────────
 * type: horizontal-stack
 * cards:
 *   - type: custom:thermostat-card
 *     entity: climate.main_floor
 *     name: Main Floor
 *   - type: custom:thermostat-card
 *     entity: climate.family_room
 *     name: Family Rm
 *   - type: custom:thermostat-card
 *     entity: climate.solarium
 *     name: Solarium
 *
 * ── COMPACT CARD ──────────────────────────────────────────────────────────────
 * Shows: current temp · target temp · −/+ buttons · mode indicator
 * Tap anywhere on the card (not the buttons) → opens detail popup
 * The −/+ buttons still work directly without opening the popup
 *
 * ── POPUP ─────────────────────────────────────────────────────────────────────
 * Left tile:  current temp (large) + humidity underneath
 * Right tile: target temp (large) + full-width −/+ buttons underneath
 * Icon pill rows (only sections the entity actually supports):
 *   • Mode        — heat, cool, heat/cool, fan, dry, off
 *   • Fan speed   — auto, low, medium, high, turbo, quiet, …
 *   • Swing       — off, vertical, horizontal, both
 *   • Preset      — eco, away, boost, comfort, sleep, home, activity, …
 * All sections auto-populated from entity attributes at runtime.
 * Mobile: bottom sheet  •  Desktop ≥768px: centered modal
 *
 * ── MODES ─────────────────────────────────────────────────────────────────────
 * heat_cool / auto  → orange+blue split dot
 * heat              → orange
 * cool              → blue
 * fan_only          → teal
 * dry               → amber
 * off               → gray
 */

class ThermostatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config     = {};
    this._hass       = null;
    this._busy       = false;
    this._popupOpen  = false;
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
    this._hass = hass;
    this._render();
  }

  disconnectedCallback() {
    this._popupOpen = false;
  }

  getCardSize() { return 3; }

  // ── Entity helpers ───────────────────────────────────────────────────────────

  _entity() {
    if (!this._hass || !this._config.entity) return null;
    return this._hass.states[this._config.entity] || null;
  }

  _attr(key) {
    const e = this._entity();
    return e ? (e.attributes[key] ?? null) : null;
  }

  _fmt(val) {
    return val != null ? Math.round(val) : '—';
  }

  // ── Mode / fan / swing / preset metadata ─────────────────────────────────────

  static get MODE_META() {
    return {
      heat_cool: { label: 'Auto',  split: true,  dot: null,                        border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', color: '#fb923c', acl: 'a-orange' },
      auto:      { label: 'Auto',  split: true,  dot: null,                        border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', color: '#fb923c', acl: 'a-orange' },
      heat:      { label: 'Heat',  split: false, dot: '#fb923c',                   border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', color: '#fb923c', acl: 'a-orange' },
      cool:      { label: 'Cool',  split: false, dot: '#60a5fa',                   border: 'rgba(96,165,250,0.35)', bg: 'rgba(96,165,250,0.07)', color: '#60a5fa', acl: 'a-blue'   },
      fan_only:  { label: 'Fan',   split: false, dot: '#2dd4bf',                   border: 'rgba(45,212,191,0.35)', bg: 'rgba(45,212,191,0.07)', color: '#2dd4bf', acl: 'a-teal'   },
      dry:       { label: 'Dry',   split: false, dot: '#fbbf24',                   border: 'rgba(251,191,36,0.35)', bg: 'rgba(251,191,36,0.07)', color: '#fbbf24', acl: 'a-amber'  },
      off:       { label: 'Off',   split: false, dot: 'rgba(255,255,255,0.25)',    border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', acl: 'a-gray' },
    };
  }

  static get FAN_META() {
    return {
      auto:   { label: 'Auto',  color: '#2dd4bf', acl: 'a-teal', ico: 'fan_auto'  },
      low:    { label: 'Low',   color: '#2dd4bf', acl: 'a-teal', ico: 'fan_low'   },
      medium: { label: 'Med',   color: '#2dd4bf', acl: 'a-teal', ico: 'fan_med'   },
      high:   { label: 'High',  color: '#2dd4bf', acl: 'a-teal', ico: 'fan_high'  },
      turbo:  { label: 'Turbo', color: '#2dd4bf', acl: 'a-teal', ico: 'fan_turbo' },
      quiet:  { label: 'Quiet', color: '#2dd4bf', acl: 'a-teal', ico: 'fan_low'   },
    };
  }

  static get SWING_META() {
    return {
      'off':        { label: 'Off',   color: 'rgba(255,255,255,0.45)', acl: 'a-gray', ico: 'sw_off'   },
      'vertical':   { label: 'Vert',  color: '#60a5fa',                acl: 'a-blue', ico: 'sw_vert'  },
      'horizontal': { label: 'Horiz', color: '#60a5fa',                acl: 'a-blue', ico: 'sw_horiz' },
      'both':       { label: 'Both',  color: '#60a5fa',                acl: 'a-blue', ico: 'sw_both'  },
    };
  }

  static get PRESET_META() {
    return {
      eco:      { label: 'Eco',     color: '#4ade80',                acl: 'a-green',  ico: 'pr_eco'      },
      away:     { label: 'Away',    color: 'rgba(255,255,255,0.45)', acl: 'a-gray',   ico: 'pr_away'     },
      boost:    { label: 'Boost',   color: '#fb923c',                acl: 'a-orange', ico: 'pr_boost'    },
      comfort:  { label: 'Comfort', color: '#a78bfa',                acl: 'a-purple', ico: 'pr_comfort'  },
      sleep:    { label: 'Sleep',   color: '#60a5fa',                acl: 'a-blue',   ico: 'pr_sleep'    },
      home:     { label: 'Home',    color: '#4ade80',                acl: 'a-green',  ico: 'pr_home'     },
      activity: { label: 'Active',  color: '#fb923c',                acl: 'a-orange', ico: 'pr_activity' },
    };
  }

  _modeMeta(key) {
    return ThermostatCard.MODE_META[key] || ThermostatCard.MODE_META['off'];
  }

  _supportedModes() {
    const ORDER = ['heat_cool', 'auto', 'heat', 'cool', 'fan_only', 'dry', 'off'];
    const raw   = this._attr('hvac_modes') || [];
    return ORDER.filter(m => raw.includes(m));
  }

  // ── SVG icons ────────────────────────────────────────────────────────────────

  static _svg(path, color, size = 20) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
      `stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  static get ICON_PATHS() {
    return {
      heat:       `<path d="M12 3v1M12 20v1M4.22 4.22l.7.7M19.07 19.07l.71.71M1 12h1M22 12h1M4.22 19.78l.7-.7M19.07 4.93l.71-.71"/><circle cx="12" cy="12" r="4"/><path d="M12 8c-2 0-4 1.5-4 4"/>`,
      cool:       `<line x1="12" y1="2" x2="12" y2="22"/><path d="m20 10-8 2-8-2"/><path d="m4 6 2 2-2 2"/><path d="m20 6-2 2 2 2"/><path d="m4 18 2-2-2-2"/><path d="m20 18-2-2 2-2"/>`,
      heat_cool:  `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/><circle cx="12" cy="12" r="3"/><path d="M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>`,
      fan_only:   `<circle cx="12" cy="12" r="3"/><path d="M12 2C9 2 6 5 6 9c3 0 6-2 6-7z"/><path d="M22 12c0-3-3-6-7-6 0 3 2 6 7 6z"/><path d="M12 22c3 0 6-3 6-7-3 0-6 2-6 7z"/><path d="M2 12c0 3 3 6 7 6 0-3-2-6-7-6z"/>`,
      dry:        `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`,
      off:        `<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>`,
      fan_auto:   `<circle cx="12" cy="12" r="3"/><path d="M12 2C9 2 6 5 6 9c3 0 6-2 6-7z"/><path d="M22 12c0-3-3-6-7-6 0 3 2 6 7 6z"/><path d="M12 22c3 0 6-3 6-7-3 0-6 2-6 7z"/><path d="M2 12c0 3 3 6 7 6 0-3-2-6-7-6z"/>`,
      fan_low:    `<circle cx="12" cy="12" r="2"/><path d="M12 5C11 5 9.5 6.5 9.5 9c1.5 0 2.5-1.5 2.5-4z" opacity=".45"/><path d="M19 12c0-1-1.5-2.5-4-2.5 0 1.5 1.5 2.5 4 2.5z" opacity=".45"/><path d="M12 19c1 0 2.5-1.5 2.5-4-1.5 0-2.5 1.5-2.5 4z" opacity=".45"/><path d="M5 12c0 1 1.5 2.5 4 2.5 0-1.5-1.5-2.5-4-2.5z" opacity=".45"/>`,
      fan_med:    `<circle cx="12" cy="12" r="2.5"/><path d="M12 3C10 3 7.5 5.5 7.5 9c2.5 0 4.5-2 4.5-6z"/><path d="M21 12c0-2-2.5-4.5-6-4.5 0 2.5 2 4.5 6 4.5z"/><path d="M12 21c2 0 4.5-2.5 4.5-6-2.5 0-4.5 2-4.5 6z"/><path d="M3 12c0 2 2.5 4.5 6 4.5 0-2.5-2-4.5-6-4.5z"/>`,
      fan_high:   `<circle cx="12" cy="12" r="3"/><path d="M12 2C9 2 6 5 6 9c3 0 6-2 6-7z"/><path d="M22 12c0-3-3-6-7-6 0 3 2 6 7 6z"/><path d="M12 22c3 0 6-3 6-7-3 0-6 2-6 7z"/><path d="M2 12c0 3 3 6 7 6 0-3-2-6-7-6z"/>`,
      fan_turbo:  `<circle cx="12" cy="12" r="3"/><path d="M12 1C8 1 4 5 4 10c4 0 8-3 8-9z"/><path d="M23 12c0-4-4-8-9-8 0 4 3 8 9 8z"/><path d="M12 23c4 0 8-4 8-9-4 0-8 3-8 9z"/><path d="M1 12c0 4 4 8 9 8 0-4-3-8-9-8z"/>`,
      sw_off:     `<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/>`,
      sw_vert:    `<path d="M8 3v18M12 3v18M16 3v18"/><path d="M6 7l2-4 2 4"/><path d="M14 17l2 4 2-4"/>`,
      sw_horiz:   `<path d="M3 8h18M3 12h18M3 16h18"/><path d="M7 6l-4 2 4 2"/><path d="M17 14l4 2-4 2"/>`,
      sw_both:    `<path d="M12 3v18M3 12h18"/><path d="M10 5l2-2 2 2"/><path d="M10 19l2 2 2-2"/><path d="M5 10l-2 2 2 2"/><path d="M19 10l2 2-2 2"/>`,
      pr_eco:     `<path d="M2 22c1-1 2-4 6-5s7 0 10-4c-1 1-4 2-7 1s-5-4-9-3c0 0 2 3 4 4-2-1-3-3-4-4C1 16 1 21 2 22z"/>`,
      pr_away:    `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      pr_boost:   `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
      pr_comfort: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
      pr_sleep:   `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
      pr_home:    `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      pr_activity:`<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
      drop:       `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`,
    };
  }

  _icon(key, color, size = 20) {
    const path = ThermostatCard.ICON_PATHS[key];
    if (!path) return '';
    return ThermostatCard._svg(path, color, size);
  }

  // ── Mode dot (compact card) ───────────────────────────────────────────────────

  _modeDotHtml(modeKey) {
    const m = this._modeMeta(modeKey);
    if (m.split) {
      return `<div style="width:8px;height:8px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex">
        <div style="flex:1;background:#fb923c"></div>
        <div style="flex:1;background:#60a5fa"></div>
      </div>`;
    }
    return `<div style="width:8px;height:8px;border-radius:50%;background:${m.dot};flex-shrink:0"></div>`;
  }

  // ── Icon pill builder ─────────────────────────────────────────────────────────

  _iconPill(icoKey, label, acl, color, isActive, onclickAttr) {
    const ico = this._icon(icoKey, isActive ? color : 'rgba(255,255,255,0.28)');
    return `<div class="ipill ${isActive ? acl : 'off'}" ${onclickAttr}>
      ${ico}
      <div class="ipill-lbl" style="color:${isActive ? color : 'rgba(255,255,255,0.35)'}">${label}</div>
    </div>`;
  }

  // ── Service calls ────────────────────────────────────────────────────────────

  async _callService(domain, service, data) {
    if (this._busy) return;
    this._busy = true;
    try {
      await this._hass.callService(domain, service, data);
    } catch (err) {
      console.warn('thermostat-card:', service, err);
    }
    setTimeout(() => { this._busy = false; }, 600);
  }

  _adjustTemp(delta) {
    const e = this._entity();
    if (!e) return;
    const current = e.attributes.temperature ?? e.attributes.target_temp_high ?? null;
    if (current == null) return;
    const step    = parseFloat(this._config.step) || 1;
    const min     = e.attributes.min_temp ?? -Infinity;
    const max     = e.attributes.max_temp ??  Infinity;
    const newTemp = Math.round(Math.min(max, Math.max(min, parseFloat(current) + delta * step)) * 10) / 10;
    this._callService('climate', 'set_temperature', {
      entity_id:   this._config.entity,
      temperature: newTemp,
    });
  }

  _cycleMode() {
    const supported = this._supportedModes();
    if (supported.length < 2) return;
    const current = (this._entity()?.state || '').toLowerCase();
    const idx     = supported.indexOf(current);
    const next    = supported[(idx + 1) % supported.length];
    this._callService('climate', 'set_hvac_mode', {
      entity_id: this._config.entity,
      hvac_mode: next,
    });
  }

  _setMode(mode) {
    this._callService('climate', 'set_hvac_mode', {
      entity_id: this._config.entity,
      hvac_mode: mode,
    });
  }

  _setFanMode(mode) {
    this._callService('climate', 'set_fan_mode', {
      entity_id: this._config.entity,
      fan_mode:  mode,
    });
  }

  _setSwingMode(mode) {
    this._callService('climate', 'set_swing_mode', {
      entity_id:  this._config.entity,
      swing_mode: mode,
    });
  }

  _setPresetMode(mode) {
    this._callService('climate', 'set_preset_mode', {
      entity_id:   this._config.entity,
      preset_mode: mode,
    });
  }

  // ── Popup ─────────────────────────────────────────────────────────────────────

  _openPopup() {
    const overlay = this.shadowRoot.getElementById('tc-overlay');
    if (!overlay) return;
    this._popupOpen = true;
    overlay.style.display = 'flex';
    this._renderPopup();
    setTimeout(() => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this._closePopup();
      }, { once: true });
    }, 50);
  }

  _closePopup() {
    this._popupOpen = false;
    const overlay = this.shadowRoot.getElementById('tc-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  _renderPopup() {
    const popup = this.shadowRoot.getElementById('tc-popup');
    if (!popup) return;

    const e        = this._entity();
    if (!e) return;

    const name     = this._config.name || e.attributes.friendly_name || this._config.entity;
    const curMode  = (e.state || 'off').toLowerCase();
    const meta     = this._modeMeta(curMode);
    const unit     = e.attributes.temperature_unit || '°F';
    const curTemp  = this._fmt(e.attributes.current_temperature);
    const tgtTemp  = this._fmt(e.attributes.temperature ?? e.attributes.target_temp_high);
    const humidity = e.attributes.current_humidity ?? e.attributes.humidity ?? null;

    // ── Mode pills ───────────────────────────────────────────────────────────
    const supportedModes = this._supportedModes();
    const modePillsHtml  = supportedModes.map(mode => {
      const mm       = this._modeMeta(mode);
      const isActive = mode === curMode;
      const icoKey   = mode === 'fan_only' ? 'fan_only'
                     : (mode === 'heat_cool' || mode === 'auto') ? 'heat_cool'
                     : mode;
      return this._iconPill(icoKey, mm.label, mm.acl, mm.color, isActive,
        `data-action="mode" data-value="${mode}"`);
    }).join('');

    // ── Fan speed pills ───────────────────────────────────────────────────────
    const fanModes    = e.attributes.fan_modes || [];
    const curFan      = e.attributes.fan_mode  || null;
    let   fanSection  = '';
    if (fanModes.length > 1) {
      const pills = fanModes.map(fm => {
        const mm       = ThermostatCard.FAN_META[fm] || { label: fm, color: '#2dd4bf', acl: 'a-teal', ico: 'fan_auto' };
        const isActive = fm === curFan;
        return this._iconPill(mm.ico, mm.label, mm.acl, mm.color, isActive,
          `data-action="fan" data-value="${fm}"`);
      }).join('');
      fanSection = `<div class="pop-sec"><div class="pop-sec-lbl">Fan speed</div><div class="icon-grid">${pills}</div></div>`;
    }

    // ── Swing pills ───────────────────────────────────────────────────────────
    const swingModes   = e.attributes.swing_modes || [];
    const curSwing     = e.attributes.swing_mode  || null;
    let   swingSection = '';
    if (swingModes.length > 1) {
      const pills = swingModes.map(sw => {
        const mm       = ThermostatCard.SWING_META[sw] || { label: sw, color: '#60a5fa', acl: 'a-blue', ico: 'sw_off' };
        const isActive = sw === curSwing;
        return this._iconPill(mm.ico, mm.label, mm.acl, mm.color, isActive,
          `data-action="swing" data-value="${sw}"`);
      }).join('');
      swingSection = `<div class="pop-sec"><div class="pop-sec-lbl">Airflow swing</div><div class="icon-grid">${pills}</div></div>`;
    }

    // ── Preset pills ──────────────────────────────────────────────────────────
    const presetModes   = e.attributes.preset_modes || [];
    const curPreset     = e.attributes.preset_mode  || null;
    let   presetSection = '';
    if (presetModes.length > 0) {
      const pills = presetModes.map(pr => {
        const mm       = ThermostatCard.PRESET_META[pr] || { label: pr, color: '#4ade80', acl: 'a-green', ico: 'pr_home' };
        const isActive = pr === curPreset;
        return this._iconPill(mm.ico, mm.label, mm.acl, mm.color, isActive,
          `data-action="preset" data-value="${pr}"`);
      }).join('');
      presetSection = `<div class="pop-sec"><div class="pop-sec-lbl">Preset</div><div class="icon-grid">${pills}</div></div>`;
    }

    // ── Humidity ──────────────────────────────────────────────────────────────
    const humHtml = humidity != null
      ? `<div class="hum-strip">
           <div class="hum-ico">${this._icon('drop', '#94a3b8', 14)}</div>
           <span class="hum-val">${Math.round(humidity)}%</span>
           <span class="hum-lbl">Humidity</span>
         </div>`
      : '';

    popup.innerHTML = `
      <div id="tc-handle"></div>
      <div class="pop-head">
        <div>
          <div class="pop-title">${name}</div>
          <div class="pop-sub" style="color:${meta.color}">${meta.label} · ${curTemp}${unit} inside</div>
        </div>
        <button id="tc-close">✕</button>
      </div>
      <div class="pop-divider"></div>

      <div class="top-row">
        <div class="cur-tile">
          <div>
            <div class="cur-main">
              <span class="cur-big">${curTemp}</span>
              <span class="cur-unit-big">${unit}</span>
            </div>
            <div class="tile-lbl">Current</div>
          </div>
          ${humHtml}
        </div>
        <div class="adj-tile">
          <div>
            <div class="adj-val" style="color:${meta.color}" id="tc-tgt-display">
              ${tgtTemp}<span class="adj-unit">${unit}</span>
            </div>
            <div class="tile-lbl">Target</div>
          </div>
          <div class="adj-btn-row">
            <button class="adj-btn" data-action="temp" data-delta="-1">−</button>
            <button class="adj-btn" data-action="temp" data-delta="1">+</button>
          </div>
        </div>
      </div>

      <div class="pop-sec">
        <div class="pop-sec-lbl">Mode</div>
        <div class="icon-grid">${modePillsHtml}</div>
      </div>
      ${fanSection}
      ${swingSection}
      ${presetSection}`;

    // Close
    popup.querySelector('#tc-close')?.addEventListener('click', () => this._closePopup());

    // Temp adjust buttons
    popup.querySelectorAll('[data-action="temp"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._adjustTemp(parseInt(btn.dataset.delta));
      });
    });

    // Mode pills
    popup.querySelectorAll('[data-action="mode"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._setMode(btn.dataset.value);
      });
    });

    // Fan pills
    popup.querySelectorAll('[data-action="fan"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._setFanMode(btn.dataset.value);
      });
    });

    // Swing pills
    popup.querySelectorAll('[data-action="swing"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._setSwingMode(btn.dataset.value);
      });
    });

    // Preset pills
    popup.querySelectorAll('[data-action="preset"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._setPresetMode(btn.dataset.value);
      });
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  _render() {
    const e       = this._entity();
    const unavail = !e || e.state === 'unavailable';
    const name    = this._config.name || e?.attributes?.friendly_name || this._config.entity;
    const curTemp = this._fmt(this._attr('current_temperature'));
    const tgtTemp = this._fmt(this._attr('temperature') ?? this._attr('target_temp_high'));
    const unit    = this._attr('temperature_unit') || '°F';

    const currentMode = (e?.state || 'off').toLowerCase();
    const meta        = this._modeMeta(currentMode);
    const supported   = this._supportedModes();
    const canCycle    = supported.length > 1;

    const dotHtml = this._modeDotHtml(currentMode);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 12px 8px 10px;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        ha-card:active { opacity: 0.88; }

        .room {
          font-size: 10px; font-weight: 700;
          color: var(--secondary-text-color);
          letter-spacing: 0.08em; text-transform: uppercase;
          text-align: center; margin-bottom: 10px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          opacity: 0.6;
        }

        .cur-wrap {
          display: flex; align-items: flex-start;
          justify-content: center; line-height: 1;
        }
        .cur-temp {
          font-size: 34px; font-weight: 700;
          color: var(--primary-text-color);
          letter-spacing: -1.5px; line-height: 1;
        }
        .cur-unit {
          font-size: 12px; font-weight: 600;
          color: var(--secondary-text-color);
          margin-top: 5px; margin-left: 2px;
        }

        .sep {
          width: 28px; height: 1px;
          background: var(--divider-color, rgba(255,255,255,0.1));
          margin: 8px auto;
        }

        .tgt-row {
          display: flex; align-items: center;
          justify-content: center; gap: 6px; width: 100%;
        }
        .tgt-btn {
          flex: 1; height: 40px; border-radius: 10px;
          border: 0.5px solid var(--divider-color, rgba(255,255,255,0.18));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          color: var(--primary-text-color); font-size: 22px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; outline: none;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.12s, transform 0.1s; user-select: none;
        }
        .tgt-btn:active { background: rgba(255,255,255,0.14); transform: scale(0.93); }

        .tgt-temp {
          font-size: 22px; font-weight: 700;
          color: var(--primary-text-color);
          min-width: 34px; text-align: center;
          letter-spacing: -0.5px; line-height: 1; flex-shrink: 0;
        }

        .sep2 {
          width: 100%; height: 1px;
          background: var(--divider-color, rgba(255,255,255,0.07));
          margin: 10px 0 8px;
        }

        .mode-btn {
          width: 100%; height: 32px; border-radius: 8px;
          display: flex; align-items: center;
          justify-content: center; gap: 6px;
          outline: none; -webkit-tap-highlight-color: transparent;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
          user-select: none;
        }
        .mode-btn.can-cycle { cursor: pointer; }
        .mode-btn.can-cycle:active { transform: scale(0.96); }

        .mode-text {
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
        }

        .unavail {
          font-size: 11px; color: var(--secondary-text-color);
          text-align: center; padding: 14px 0;
          opacity: 0.5; font-style: italic;
        }

        /* ── Popup overlay — mobile: bottom sheet, desktop ≥768px: centered modal ── */
        #tc-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 9999;
          box-sizing: border-box;
          align-items: flex-end;
          justify-content: center;
        }
        #tc-popup {
          background: var(--card-background-color, #1e1e2a);
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 16px 16px 0 0;
          border-bottom: none;
          padding: 20px;
          width: 100%;
          max-height: 82vh;
          overflow-y: auto;
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        #tc-popup::-webkit-scrollbar { width: 4px; }
        #tc-popup::-webkit-scrollbar-track { background: transparent; }
        #tc-popup::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        #tc-handle {
          width: 36px; height: 4px;
          background: rgba(255,255,255,0.15); border-radius: 2px;
          margin: 0 auto 16px;
        }

        @media (min-width: 768px) {
          #tc-overlay { align-items: center; justify-content: center; padding: 24px; }
          #tc-popup {
            max-width: 400px;
            border-radius: 16px;
            border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          }
          #tc-handle { display: none; }
        }

        /* ── Popup internals ── */
        .pop-head {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 14px;
        }
        .pop-title {
          font-size: 17px; font-weight: 700;
          color: var(--primary-text-color); line-height: 1.2;
        }
        .pop-sub { font-size: 11px; font-weight: 600; margin-top: 3px; }
        #tc-close {
          background: rgba(255,255,255,0.08); border: none; border-radius: 50%;
          width: 28px; height: 28px; cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          color: var(--secondary-text-color); font-size: 14px;
          line-height: 1; font-family: inherit; flex-shrink: 0;
        }
        .pop-divider {
          height: 1px;
          background: var(--divider-color, rgba(255,255,255,0.09));
          margin-bottom: 14px;
        }
        .pop-sec { margin-bottom: 16px; }
        .pop-sec-lbl {
          font-size: 9.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .1em; color: var(--secondary-text-color);
          opacity: 0.5; margin-bottom: 9px;
        }

        /* Top row — current + adjust tiles */
        .top-row {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; margin-bottom: 14px;
        }

        .cur-tile, .adj-tile {
          background: rgba(255,255,255,0.04);
          border-radius: 12px; padding: 14px 12px;
          display: flex; flex-direction: column;
          justify-content: space-between;
        }

        .cur-main { display: flex; align-items: flex-start; justify-content: center; }
        .cur-big {
          font-size: 40px; font-weight: 700;
          letter-spacing: -2px; line-height: 1;
          color: var(--primary-text-color);
        }
        .cur-unit-big {
          font-size: 14px; font-weight: 600;
          color: var(--secondary-text-color);
          margin-top: 6px; margin-left: 2px;
        }
        .tile-lbl {
          font-size: 10px; font-weight: 700;
          color: var(--secondary-text-color);
          text-transform: uppercase; letter-spacing: .06em;
          opacity: .6; text-align: center; margin-top: 6px;
        }

        .hum-strip {
          display: flex; align-items: center;
          justify-content: center; gap: 5px;
          margin-top: 10px; padding-top: 10px;
          border-top: 1px solid var(--divider-color, rgba(255,255,255,0.07));
        }
        .hum-ico { width: 14px; height: 14px; flex-shrink: 0; opacity: .5; }
        .hum-ico svg { width: 100%; height: 100%; }
        .hum-val {
          font-size: 14px; font-weight: 700;
          color: var(--secondary-text-color);
        }
        .hum-lbl {
          font-size: 10px; font-weight: 600;
          color: var(--secondary-text-color);
          opacity: .5; text-transform: uppercase; letter-spacing: .05em;
        }

        .adj-val {
          font-size: 40px; font-weight: 700;
          letter-spacing: -2px; line-height: 1; text-align: center;
        }
        .adj-unit {
          font-size: 14px; font-weight: 600;
          opacity: .5; margin-left: 1px;
        }
        .adj-btn-row {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 6px; margin-top: 10px; padding-top: 10px;
          border-top: 1px solid var(--divider-color, rgba(255,255,255,0.07));
        }
        .adj-btn {
          height: 36px; border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.07);
          color: var(--primary-text-color);
          font-size: 22px; display: flex; align-items: center;
          justify-content: center; cursor: pointer;
          font-family: inherit; transition: all .12s; width: 100%;
          -webkit-tap-highlight-color: transparent;
        }
        .adj-btn:active { transform: scale(.92); background: rgba(255,255,255,0.14); }

        /* Icon pill grid */
        .icon-grid { display: flex; flex-wrap: wrap; gap: 7px; }

        .ipill {
          border-radius: 10px; padding: 9px 10px; cursor: pointer;
          border: 1px solid transparent; transition: all .15s;
          display: flex; flex-direction: column;
          align-items: center; gap: 4px;
          min-width: 52px; flex: 1;
          -webkit-tap-highlight-color: transparent;
        }
        .ipill:active { filter: brightness(0.82); }
        .ipill svg { display: block; }
        .ipill-lbl {
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; text-align: center; line-height: 1.2;
        }

        .off  { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
        .a-orange{ background: rgba(251,146,60,0.12);  border-color: rgba(251,146,60,0.38); }
        .a-blue  { background: rgba(96,165,250,0.12);  border-color: rgba(96,165,250,0.38); }
        .a-teal  { background: rgba(45,212,191,0.12);  border-color: rgba(45,212,191,0.38); }
        .a-amber { background: rgba(251,191,36,0.12);  border-color: rgba(251,191,36,0.38); }
        .a-green { background: rgba(74,222,128,0.12);  border-color: rgba(74,222,128,0.38); }
        .a-purple{ background: rgba(167,139,250,0.12); border-color: rgba(167,139,250,0.38); }
        .a-gray  { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); }
      </style>

      <ha-card id="tc-card">
        <div class="room">${name}</div>

        ${unavail ? `<div class="unavail">unavailable</div>` : `
          <div class="cur-wrap">
            <span class="cur-temp">${curTemp}</span>
            <span class="cur-unit">${unit}</span>
          </div>

          <div class="sep"></div>

          <div class="tgt-row">
            <button class="tgt-btn" id="tc-down" aria-label="Decrease">−</button>
            <span class="tgt-temp">${tgtTemp}</span>
            <button class="tgt-btn" id="tc-up"   aria-label="Increase">+</button>
          </div>

          <div class="sep2"></div>

          <div class="mode-btn ${canCycle ? 'can-cycle' : ''}" id="tc-mode"
               style="border:0.5px solid ${meta.border};background:${meta.bg}">
            ${dotHtml}
            <span class="mode-text" style="color:${meta.color}">${meta.label}</span>
          </div>
        `}
      </ha-card>

      <div id="tc-overlay">
        <div id="tc-popup"></div>
      </div>`;

    // Compact card tap → popup (but not on the buttons)
    this.shadowRoot.getElementById('tc-card')
      ?.addEventListener('click', e => {
        if (!e.target.closest('#tc-down') && !e.target.closest('#tc-up') && !e.target.closest('#tc-mode')) {
          this._openPopup();
        }
      });

    this.shadowRoot.getElementById('tc-down')
      ?.addEventListener('click', e => { e.stopPropagation(); this._adjustTemp(-1); });
    this.shadowRoot.getElementById('tc-up')
      ?.addEventListener('click', e => { e.stopPropagation(); this._adjustTemp(+1); });
    this.shadowRoot.getElementById('tc-mode')
      ?.addEventListener('click', e => { e.stopPropagation(); if (canCycle) this._cycleMode(); });

    // Restore popup after re-render
    if (this._popupOpen) {
      const overlay = this.shadowRoot.getElementById('tc-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        this._renderPopup();
      }
    }
  }
}

customElements.define('thermostat-card', ThermostatCard);
