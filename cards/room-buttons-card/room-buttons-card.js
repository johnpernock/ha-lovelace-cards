/**
 * room-buttons-card.js  —  v14
 * Compact 2-column room button grid for Home Assistant Lovelace.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/room-buttons-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/room-buttons-card.js
 *      Type: JavaScript Module
 *
 * ── BUTTON BEHAVIOUR ──────────────────────────────────────────────────────────
 * Without popup_entities / lights / fans:
 *   tap       → fires hass-more-info (opens bubble card popup)
 *   hold 600ms → toggles the entity
 *
 * With lights:, fans:, or popup_entities: defined:
 *   tap       → opens custom room popup
 *
 * Cover buttons (tap_action: toggle, no popup config):
 *   tap       → calls cover.open_cover / cover.close_cover immediately
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:room-buttons-card
 * buttons:
 *
 *   # Simple button — tap opens hass-more-info, hold toggles
 *   - entity: light.main_lights
 *     name: Main Lights
 *     icon: bulb
 *
 *   # Cover direct-toggle (no popup)
 *   - entity: cover.garage_door
 *     name: Garage Door
 *     icon: garage
 *     tap_action: toggle
 *
 *   # Button with lights popup — master brightness slider + per-light sliders
 *   # Color temperature and RGB color pickers appear automatically for lights
 *   # that support them. Tap the chevron (›) next to a light to expand colors.
 *   - entity: light.family_room        # drives the button active state
 *     name: Family Room
 *     icon: sofa
 *     lights:
 *       entity: light.all_family_room  # master group entity (slider controls all)
 *       mode: slider                   # optional — 'slider' (default for lights) or 'toggle'
 *       individuals:                   # optional — per-light rows below master
 *         - entity: light.family_room_main
 *           name: Main
 *         - entity: switch.family_room_lamp
 *           name: Lamp
 *           mode: toggle               # optional — override auto-detection per row
 *
 *   # Button with fans popup — pip-dot speed buttons per fan
 *   - entity: fan.family_room_ceiling
 *     name: Family Room
 *     icon: sofa
 *     fans:
 *       - entity: fan.family_room_ceiling
 *         name: Ceiling Fan   # optional, falls back to friendly_name
 *         speeds: 3           # optional — 3 or 4, auto-detected if omitted
 *
 *   # Theme sensor — shows a holiday color strip + name label on the button,
 *   # and a color swatch bar at the top of the popup.
 *   # Reads all_outdoor_colors, emoji, accent, is_holiday from sensor attributes.
 *   - entity: light.yard
 *     name: Yard
 *     icon: tree
 *     theme_sensor: sensor.outdoor_lighting_theme
 *     lights:
 *       entity: light.all_yard_lights
 *
 *   # Legacy popup_entities — still fully supported
 *   - entity: light.family_room
 *     name: Family Room
 *     icon: sofa
 *     popup_entities:
 *       - entity: sensor.family_room_temperature
 *         label: Temperature
 *         type: stat
 *       - entity: light.family_room
 *         label: Main Lights
 *         type: toggle
 *         icon: bulb
 *       - entity: fan.family_room_ceiling
 *         label: Ceiling Fan
 *         type: fan
 *         speeds: 3
 *       - entity: cover.fr_blind_1
 *         label: Blinds
 *         type: cover_group
 *         max_position: 70
 *         entities:
 *           - cover.fr_blind_1
 *           - cover.fr_blind_2
 *
 * ── ICONS ─────────────────────────────────────────────────────────────────────
 * bulb, garage, sofa, sun, kitchen, dining, desk, bed, bath, stairs, tree,
 * fan, blinds, tv, appletv, homepod, speaker, lock, thermo, plug, home
 * Any unknown value falls back to the generic home icon.
 */

class RoomButtonsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._busy      = {};
    this._popupOpen = false;
    this._activeBtn = null;
  }

  static getStubConfig() {
    return {
      buttons: [
        { entity: 'light.main_lights',    name: 'Main Lights',   icon: 'bulb'    },
        { entity: 'cover.garage_door',    name: 'Garage Door',   icon: 'garage',  tap_action: 'toggle' },
        { entity: 'light.family_room',    name: 'Family Room',   icon: 'sofa'    },
        { entity: 'light.solarium',       name: 'Solarium',      icon: 'sun'     },
        { entity: 'light.kitchen',        name: 'Kitchen',       icon: 'kitchen' },
        { entity: 'light.dining_room',    name: 'Dining Room',   icon: 'dining'  },
        { entity: 'light.office',         name: 'Office',        icon: 'desk'    },
        { entity: 'light.bedroom',        name: 'Bedroom',       icon: 'bed'     },
        { entity: 'switch.bathroom',      name: 'Bathroom',      icon: 'bath'    },
        { entity: 'light.basement',       name: 'Basement',      icon: 'stairs'  },
        { entity: 'switch.yard',          name: 'Yard',          icon: 'tree'    },
        { entity: 'light.garage_lights',  name: 'Garage Lights', icon: 'bulb'    },
      ],
    };
  }

  setConfig(config) {
    if (!config.buttons || !config.buttons.length) {
      throw new Error('room-buttons-card: define at least one button');
    }
    this._config = config;
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.grid') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return Math.ceil(this._config.buttons?.length / 2) || 3; }

  // ── Icons ────────────────────────────────────────────────────────────────────

  static get ICONS() {
    const s = `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
    const w = `<svg viewBox="0 0 24 24" fill="none" ${s}>`;
    return {
      // existing
      bulb:    `${w}<path d="M9 21h6"/><path d="M12 3a6 6 0 0 1 6 6c0 2.2-1.2 4.2-3 5.4V18H9v-3.6A6 6 0 0 1 6 9a6 6 0 0 1 6-6z"/></svg>`,
      garage:  `${w}<path d="M2 10 L12 3 L22 10"/><rect x="2" y="10" width="20" height="11" rx="1.5"/><line x1="6" y1="15" x2="18" y2="15"/><line x1="6" y1="18" x2="18" y2="18"/></svg>`,
      sofa:    `${w}<path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/><path d="M2 11a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6H2v-6z"/><path d="M6 17v2"/><path d="M18 17v2"/></svg>`,
      sun:     `${w}<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`,
      kitchen: `${w}<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8h.01"/><path d="M7 12h.01"/></svg>`,
      dining:  `${w}<path d="M3 2v7c0 1.7 1.3 3 3 3s3-1.3 3-3V2"/><path d="M6 12v10"/><path d="M14 2v20"/><path d="M14 7h7"/></svg>`,
      desk:    `${w}<rect x="2" y="13" width="20" height="3" rx="1"/><path d="M5 16v3"/><path d="M19 16v3"/><path d="M12 13V7"/><path d="M9 7h6"/></svg>`,
      bed:     `${w}<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
      bath:    `${w}<path d="M9 6 L9 4 a3 3 0 0 1 6 0 L15 6"/><rect x="2" y="11" width="20" height="4" rx="2"/><path d="M5 15v3"/><path d="M19 15v3"/></svg>`,
      stairs:  `${w}<path d="M4 20h4v-4h4v-4h4V8h4"/><path d="M4 20V4"/></svg>`,
      tree:    `${w}<path d="M12 22v-6"/><path d="M8 18l4-4 4 4"/><path d="M6 14l6-6 6 6"/><path d="M4 10l8-8 8 8"/></svg>`,
      home:    `${w}<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      // new
      fan:     `${w}<circle cx="12" cy="12" r="3"/><path d="M12 2C9 2 6 5 6 9c3 0 6-2 6-7z"/><path d="M22 12c0-3-3-6-7-6 0 3 2 6 7 6z"/><path d="M12 22c3 0 6-3 6-7-3 0-6 2-6 7z"/><path d="M2 12c0 3 3 6 7 6 0-3-2-6-7-6z"/></svg>`,
      blinds:  `${w}<rect x="2" y="3" width="20" height="2" rx="1"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="14" x2="22" y2="14"/><line x1="2" y1="19" x2="22" y2="19"/><line x1="12" y1="5" x2="12" y2="22"/></svg>`,
      tv:      `${w}<rect x="2" y="7" width="20" height="13" rx="2"/><polyline points="16 2 12 7 8 2"/></svg>`,
      appletv: `${w}<rect x="2" y="5" width="20" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`,
      homepod: `${w}<path d="M12 2a8 8 0 0 1 8 8v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a8 8 0 0 1 8-8z"/><circle cx="12" cy="14" r="3"/></svg>`,
      speaker: `${w}<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/></svg>`,
      lock:    `${w}<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      thermo:  `${w}<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
      plug:    `${w}<line x1="8" y1="6" x2="8" y2="2"/><line x1="16" y1="6" x2="16" y2="2"/><path d="M6 6h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V6z"/><line x1="12" y1="16" x2="12" y2="22"/></svg>`,
    };
  }

  _icon(name) {
    return RoomButtonsCard.ICONS[name] || RoomButtonsCard.ICONS.home;
  }

  // ── State helpers ────────────────────────────────────────────────────────────

  _entityState(entityId) {
    if (!this._hass || !entityId) return null;
    return this._hass.states[entityId] || null;
  }

  _isCover(btn) {
    return btn.entity.startsWith('cover.') || btn.tap_action === 'toggle';
  }

  _coverState(entityId) {
    const e = this._entityState(entityId);
    if (!e) return 'unknown';
    return (e.state || 'unknown').toLowerCase();
  }

  _isOn(entityId) {
    const e = this._entityState(entityId);
    if (!e) return false;
    return e.state === 'on' || e.state === 'open';
  }

  _isToggleOn(entityId) {
    const e = this._entityState(entityId);
    if (!e) return false;
    const s = e.state;
    return s === 'on' || s === 'open' || s === 'playing' || s === 'paused' || s === 'idle';
  }

  _brightness(entityId) {
    const e = this._entityState(entityId);
    if (!e || e.state !== 'on') return null;
    const b = e.attributes.brightness;
    if (b == null) return null;
    return Math.round((b / 255) * 100);
  }

  _stateVal(entityId) {
    const e = this._entityState(entityId);
    if (!e) return '—';
    const v = e.state;
    if (v === 'unavailable' || v === 'unknown') return '—';
    return v;
  }

  _attr(entityId, key) {
    return this._entityState(entityId)?.attributes?.[key] ?? null;
  }

  _call(domain, service, data, busyKey) {
    this._callServiceData(domain, service, data, busyKey);
  }

  _unitOf(entityId) {
    const e = this._entityState(entityId);
    return e?.attributes?.unit_of_measurement || '';
  }

  _toggleStateLabel(entityId) {
    const domain = entityId.split('.')[0];
    if (domain === 'media_player') {
      const e = this._entityState(entityId);
      if (!e) return 'Off';
      const s = e.state;
      if (s === 'playing') return 'Playing';
      if (s === 'paused')  return 'Paused';
      if (s === 'idle')    return 'Idle';
      if (s === 'on')      return 'On';
      return 'Off';
    }
    const on = this._isOn(entityId);
    if (!on) return 'Off';
    if (domain === 'light') {
      const bri = this._brightness(entityId);
      return bri != null ? `On · ${bri}%` : 'On';
    }
    return 'On';
  }

  _toggleColor(entityId) {
    const domain = entityId.split('.')[0];
    if (domain === 'light')        return '#fbbf24';
    if (domain === 'media_player') return '#a78bfa';
    return '#60a5fa';
  }

  _toggleOnClass(entityId) {
    const c = this._toggleColor(entityId);
    if (c === '#fbbf24') return 'on-amber';
    if (c === '#a78bfa') return 'on-purple';
    return 'on-blue';
  }

  _domainIcon(entityId) {
    const domain = entityId.split('.')[0];
    const map = {
      light: 'bulb', switch: 'plug', fan: 'fan',
      media_player: 'tv', cover: 'blinds', lock: 'lock', climate: 'thermo',
    };
    return map[domain] || 'home';
  }

  _fanResolvedSpeeds(cfg) {
    if (cfg.speeds != null) return cfg.speeds;
    const e = this._entityState(cfg.entity);
    if (!e) return 3;
    const step = e.attributes.percentage_step;
    if (step && step > 0) return Math.round(100 / step);
    const sc = e.attributes.speed_count;
    if (sc && sc > 1) return sc;
    return 3;
  }

  _fanSpeedPercentages(cfg) {
    if (cfg.speed_percentages) return cfg.speed_percentages;
    const speeds = this._fanResolvedSpeeds(cfg);
    return Array.from({length: speeds}, (_, i) => Math.round((i + 1) * (100 / speeds)));
  }

  _fanCurrentStep(cfg) {
    const e = this._entityState(cfg.entity);
    if (!e || e.state === 'off' || e.state === 'unavailable') return 0;
    const pct = e.attributes.percentage;
    if (pct == null || pct === 0) return e.state === 'on' ? 1 : 0;
    const sps = this._fanSpeedPercentages(cfg);
    for (let i = 0; i < sps.length; i++) {
      if (pct <= sps[i] + 8) return i + 1;
    }
    return sps.length;
  }

  _coverGroupState(cfg) {
    const entities = cfg.entities || [cfg.entity];
    const e = this._entityState(entities[0]);
    if (!e) return 'unknown';
    return e.state.toLowerCase();
  }

  // ── Theme (main grid buttons — unchanged) ────────────────────────────────────

  _theme(btn) {
    if (this._isCover(btn)) {
      const cs = this._coverState(btn.entity);
      if (cs === 'opening') return {
        bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.35)',
        iconColor: '#fbbf24', nameColor: 'rgba(251,191,36,0.65)', stateColor: 'rgba(251,191,36,0.5)',
        stateLabel: 'Opening…', canAct: false, indeterminate: true,
      };
      if (cs === 'closing') return {
        bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.35)',
        iconColor: '#fb923c', nameColor: 'rgba(251,146,60,0.65)', stateColor: 'rgba(251,146,60,0.5)',
        stateLabel: 'Closing…', canAct: false, indeterminate: true,
      };
      if (cs === 'open') return {
        bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.55)',
        iconColor: '#60a5fa', nameColor: '#bfdbfe', stateColor: '#93c5fd',
        stateLabel: 'Open', canAct: true, indeterminate: false,
      };
      return {
        bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.55)',
        iconColor: '#4ade80', nameColor: '#bbf7d0', stateColor: '#86efac',
        stateLabel: 'Closed', canAct: true, indeterminate: false,
      };
    }

    const on = this._isOn(btn.entity);
    if (!on) return {
      bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)',
      iconColor: 'rgba(255,255,255,0.22)', nameColor: 'rgba(255,255,255,0.55)', stateColor: 'rgba(255,255,255,0.3)',
      stateLabel: 'Off', canAct: true, indeterminate: false,
    };

    const pct = this._brightness(btn.entity);
    const domain = btn.entity.split('.')[0];
    const stateLabel = domain === 'switch' ? 'On' : (pct != null ? `On · ${pct}%` : 'On');

    return {
      bg: 'rgba(251,191,36,0.13)', border: 'rgba(251,191,36,0.55)',
      iconColor: '#fbbf24', nameColor: '#fde68a', stateColor: '#fcd34d',
      stateLabel, canAct: true, indeterminate: false,
    };
  }

  // ── Service calls ─────────────────────────────────────────────────────────────

  async _callService(domain, service, entityId, lockKey) {
    if (this._busy[lockKey]) return;
    this._busy[lockKey] = true;
    try {
      await this._hass.callService(domain, service, { entity_id: entityId });
    } catch (err) {
      console.warn('room-buttons-card: service call failed', err);
    }
    setTimeout(() => { this._busy[lockKey] = false; }, 800);
  }

  async _callServiceData(domain, service, data, lockKey) {
    if (this._busy[lockKey]) return;
    this._busy[lockKey] = true;
    try {
      await this._hass.callService(domain, service, data);
    } catch (err) {
      console.warn('room-buttons-card: service call failed', err);
    }
    setTimeout(() => { this._busy[lockKey] = false; }, 800);
  }

  _toggleEntity(btn) {
    const domain = btn.entity.split('.')[0];
    if (domain === 'cover') {
      const cs = this._coverState(btn.entity);
      const service = cs === 'open' ? 'close_cover' : 'open_cover';
      this._callService('cover', service, btn.entity, btn.entity);
    } else {
      this._callService(domain, 'toggle', btn.entity, btn.entity);
    }
  }

  _togglePopupEntity(entityId) {
    const domain  = entityId.split('.')[0];
    const service = this._isToggleOn(entityId) ? 'turn_off' : 'turn_on';
    this._callService(domain, service, entityId, entityId);
  }

  _setBrightness(entityId, pct) {
    this._callServiceData('light', 'turn_on', {
      entity_id: entityId,
      brightness_pct: Math.round(pct),
    }, `bri-${entityId}`);
  }

  _setFanSpeed(cfg, step) {
    const entityId = cfg.entity;
    if (step === 0) {
      this._callService('fan', 'turn_off', entityId, `fan-${entityId}`);
      return;
    }
    const sps = this._fanSpeedPercentages(cfg);
    const pct = sps[step - 1] || 100;
    this._callServiceData('fan', 'set_percentage', {
      entity_id:  entityId,
      percentage: pct,
    }, `fan-${entityId}`);
  }

  // ── Color / CT helpers ────────────────────────────────────────────────────────

  static get DEFAULT_CT() {
    return [
      { label: 'Candle',     kelvin: 1900, color: '#ff8c3a' },
      { label: 'Warm White', kelvin: 2700, color: '#ffcf7d' },
      { label: 'Soft White', kelvin: 3000, color: '#ffe4a8' },
      { label: 'Natural',    kelvin: 4000, color: '#fff5d6' },
      { label: 'Daylight',   kelvin: 5000, color: '#fffbf0' },
      { label: 'Cool',       kelvin: 6500, color: '#d4eeff' },
    ];
  }

  static get DEFAULT_COLORS() {
    return [
      { label: 'Red',    rgb: [255, 107, 107], color: '#ff6b6b' },
      { label: 'Orange', rgb: [255, 154,  60], color: '#ff9a3c' },
      { label: 'Yellow', rgb: [255, 212,  59], color: '#ffd43b' },
      { label: 'Green',  rgb: [105, 219, 124], color: '#69db7c' },
      { label: 'Teal',   rgb: [ 56, 217, 169], color: '#38d9a9' },
      { label: 'Blue',   rgb: [116, 192, 252], color: '#74c0fc' },
      { label: 'Purple', rgb: [151, 117, 250], color: '#9775fa' },
      { label: 'Pink',   rgb: [247, 131, 172], color: '#f783ac' },
      { label: 'Lavend', rgb: [192, 132, 252], color: '#c084fc' },
      { label: 'White',  rgb: [240, 244, 255], color: '#f0f4ff' },
    ];
  }

  _ctPresets()    { return RoomButtonsCard.DEFAULT_CT; }
  _colorPresets() { return RoomButtonsCard.DEFAULT_COLORS; }

  _supportsCT(id) {
    const modes = this._attr(id, 'supported_color_modes') || [];
    return modes.some(m => ['color_temp', 'xy', 'hs', 'rgb', 'rgbw', 'rgbww'].includes(m)) ||
           this._attr(id, 'color_temp_kelvin') != null;
  }

  _supportsColor(id) {
    const modes = this._attr(id, 'supported_color_modes') || [];
    return modes.some(m => ['xy', 'hs', 'rgb', 'rgbw', 'rgbww'].includes(m));
  }

  _ctRange(id) {
    const min = this._attr(id, 'min_color_temp_kelvin') || 2000;
    const max = this._attr(id, 'max_color_temp_kelvin') || 6500;
    return { min, max };
  }

  _lightDotColor(id) {
    // Returns a CSS color representing the light's current color/temperature.
    // Used to tint the expand chevron to match the light it controls.
    const s = this._entityState(id);
    if (!s || s.state !== 'on') return 'rgba(255,255,255,.2)';
    const rgb = s.attributes.rgb_color;
    if (rgb) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    const k = s.attributes.color_temp_kelvin;
    if (k) {
      // Linear interpolation from candle (~1900K, warm orange) to cool white (6500K)
      const t = Math.max(0, Math.min(1, (k - 1900) / (6500 - 1900)));
      const r = Math.round(255 - t * (255 - 212));
      const g = Math.round(147 + t * (244 - 147));
      const b = Math.round(41  + t * (255 - 41));
      return `rgb(${r},${g},${b})`;
    }
    return '#fbbf24'; // on but no color info — default amber
  }

  _setColorTemp(entityId, kelvin) {
    this._callServiceData('light', 'turn_on', { entity_id: entityId, color_temp_kelvin: kelvin }, null);
  }

  _setColor(entityId, rgb) {
    this._callServiceData('light', 'turn_on', { entity_id: entityId, rgb_color: rgb }, null);
  }

  _selPreset(el) {
    const row = el.closest('.rb-presets,.rb-presets-grid');
    if (row) row.querySelectorAll('.rb-preset').forEach(p => {
      p.classList.remove('rb-preset-sel');
      p.style.borderColor = ''; p.style.background = '';
      const d = p.querySelector('.rb-dot-lbl'); if (d) d.style.color = 'rgba(255,255,255,.35)';
    });
    el.classList.add('rb-preset-sel');
    const dot = el.querySelector('.rb-dot');
    if (dot) { el.style.borderColor = dot.style.background + '55'; el.style.background = dot.style.background + '1a'; }
    const d = el.querySelector('.rb-dot-lbl'); if (d) d.style.color = 'rgba(255,255,255,.82)';
  }

  _presetRow(list, prefix, grid = false) {
    return (grid ? `<div class="rb-presets-grid">` : `<div class="rb-presets">`) +
      list.map((p, i) => `<div class="rb-preset" data-rb-preset="${prefix}" data-idx="${i}"><div class="rb-dot" style="background:${p.color}"></div><div class="rb-dot-lbl">${p.label}</div></div>`).join('') +
    `</div>`;
  }

  _openCoverGroup(cfg) {
    const max      = cfg.max_position || 100;
    const entities = cfg.entities || [cfg.entity];
    entities.forEach(id => {
      this._callServiceData('cover', 'set_cover_position', {
        entity_id: id,
        position:  max,
      }, `cover-${id}`);
    });
  }

  _closeCoverGroup(cfg) {
    const entities = cfg.entities || [cfg.entity];
    entities.forEach(id => {
      this._callService('cover', 'close_cover', id, `cover-${id}`);
    });
  }

  _fireMoreInfo(entityId) {
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      bubbles: true, composed: true,
      detail: { entityId },
    }));
  }

  _patch() {
    if (!this._config.buttons) return;
    this._config.buttons.forEach((btn, i) => {
      const el = this.shadowRoot.getElementById(`rbtn-${i}`);
      if (!el) return;
      const t = this._theme(btn);
      el.style.background   = t.bg;
      el.style.borderColor  = t.border;
      el.disabled           = !t.canAct;
      el.className          = `room-btn ${t.canAct ? 'can-act' : 'btn-disabled'}`;

      const nameEl  = el.querySelector('.btn-name');
      const stateEl = el.querySelector('.btn-state');
      const icoEl   = el.querySelector('.btn-icon');
      if (nameEl)  nameEl.style.color  = t.nameColor;
      if (stateEl) { stateEl.textContent = t.stateLabel; stateEl.style.color = t.stateColor; }
      if (icoEl)   icoEl.style.color   = t.iconColor;

      // Theme strip — update colors
      if (btn.theme_sensor) {
        const sensor = this._entityState(btn.theme_sensor);
        const theme  = sensor?.state?.trim() || 'Default';
        const attrs  = sensor?.attributes || {};
        const colors = attrs.all_outdoor_colors || [];
        const isHol  = attrs.is_holiday === true || theme !== 'Default';
        const strip  = el.querySelector('.btn-theme-strip');
        const lbl    = el.querySelector('.btn-theme-name');
        if (strip && isHol && colors.length) {
          strip.innerHTML = colors.map(c => `<div style="flex:1;background:${c}"></div>`).join('');
        }
        if (lbl && isHol) {
          lbl.textContent = `${attrs.emoji || ''} ${theme}`;
          lbl.style.color  = attrs.accent || 'rgba(255,255,255,.5)';
        }
      }
    });
    // If popup is open, refresh its values too
    if (this._popupOpen && this._activeBtn) {
      const masterWrap = this.shadowRoot.querySelector('[data-action="rb-master-drag"]');
      if (!masterWrap) return;
      const btn    = this._activeBtn;
      const lcfg   = btn.lights;
      if (!lcfg) return;
      const on     = this._isOn(lcfg.entity || btn.entity);
      const avg    = this._brightness(lcfg.entity || btn.entity) ?? (on ? 100 : 0);
      const fill   = this.shadowRoot.getElementById('rbmf');
      const thumb  = this.shadowRoot.getElementById('rbmt');
      const pct    = this.shadowRoot.getElementById('rbmpct');
      if (fill)  fill.style.width  = on ? avg + '%' : '0%';
      if (thumb) thumb.style.left  = on ? Math.min(avg, 96) + '%' : '0%';
      if (pct)   pct.textContent   = on ? avg + '%' : '';
    }
  }

  // ── Helpers for new lights/fans popup ────────────────────────────────────────

  _lightsPopupHtml(btn) {
    const lcfg = btn.lights;
    if (!lcfg) return '';
    const masterEnt = lcfg.entity || btn.entity;
    const indiv     = lcfg.individuals || [];
    const on        = this._isOn(masterEnt);
    // mode: 'auto' = detect from entity domain, 'toggle' = force toggle, 'slider' = force slider
    const mode = lcfg.mode || 'auto';
    const masterIsSwitch = mode === 'toggle' || (mode === 'auto' && masterEnt.startsWith('switch.'));
    const avg       = this._brightness(masterEnt) ?? (on ? 100 : 0);
    const sliderPct = on ? avg : 0;

    // Color support — exclude switches
    const lightEnts = [...indiv.map(l => l.entity), masterEnt].filter(e => !e.startsWith('switch.'));
    const anyCT     = lightEnts.some(e => this._supportsCT(e));
    const anyColor  = lightEnts.some(e => this._supportsColor(e));
    const hasColors = anyCT || anyColor;
    const masterColor = this._lightDotColor(masterEnt);
    const ctEnts = lightEnts.filter(e => this._supportsCT(e));
    const minK = ctEnts.length ? Math.max(...ctEnts.map(e => this._ctRange(e).min)) : 2000;
    const maxK = ctEnts.length ? Math.min(...ctEnts.map(e => this._ctRange(e).max)) : 6500;
    const filteredCT = this._ctPresets().filter(p => p.kelvin >= minK && p.kelvin <= maxK);

    const chevSvg = (id, color) =>
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" style="transition:transform .2s" id="${id}"><polyline points="6 9 12 15 18 9"/></svg>`;

    // Master row — slider for lights, toggle for switches
    const masterInner = masterIsSwitch
      ? `<div class="rb-sw-row" data-action="rb-master-toggle" data-entity="${masterEnt}" style="cursor:pointer;-webkit-tap-highlight-color:transparent">
          <span class="rb-sw-lbl">All Lights</span>
          <span class="rb-sw-state" id="rbmstate" style="color:${on ? '#fbbf24' : 'rgba(255,255,255,.35)'}">${on ? 'On' : 'Off'}</span>
        </div>`
      : `<div class="rb-slider-wrap" data-action="rb-master-drag" data-entity="${masterEnt}" style="touch-action:none">
          <div class="rb-track"><div class="rb-fill" id="rbmf" style="width:${sliderPct}%"></div></div>
          <div class="rb-thumb" id="rbmt" style="left:${Math.min(sliderPct, 96)}%"></div>
        </div>
        <span class="rb-pct" id="rbmpct">${on ? avg + '%' : ''}</span>`;

    const masterHtml = `
      <div class="rb-master">
        <div class="rb-mrow">
          ${masterInner}
          ${hasColors ? `<div class="rb-mchev" data-action="rb-master-expand" id="rbmc">${chevSvg('rbmc-a', masterColor)}</div>` : ''}
        </div>
        <div class="rb-master-exp hidden" id="rbme">
          ${anyCT    ? `<div class="rb-clbl">Color temperature</div>${this._presetRow(filteredCT, 'rbpct-all', true)}` : ''}
          ${anyColor ? `<div class="rb-clbl">Color</div>${this._presetRow(this._colorPresets(), 'rbpcc-all', true)}` : ''}
        </div>
      </div>`;

    // Individual lights — 3-col itog-grid matching room-controls-card exactly
    let indivHtml = '';
    if (indiv.length) {
      const btns = indiv.map(l => {
        const lon = this._isOn(l.entity);
        const bg  = lon ? 'rgba(251,191,36,.10)' : 'rgba(255,255,255,.04)';
        const bc  = lon ? 'rgba(251,191,36,.30)' : 'rgba(255,255,255,.08)';
        const dc  = lon ? '#fbbf24' : 'rgba(255,255,255,.2)';
        const lc  = lon ? 'rgba(251,191,36,.8)' : 'rgba(255,255,255,.35)';
        const nm  = l.name || this._attr(l.entity, 'friendly_name') || l.entity.split('.').pop().replace(/_/g, ' ');
        const eid = l.entity.replace(/[^a-z0-9]/g, '_');
        return `<div class="itog" id="rbitog-${eid}" data-action="rb-indiv-tog" data-entity="${l.entity}" style="background:${bg};border:1px solid ${bc}"><div class="itog-dot" style="background:${dc}"></div><div class="itog-lbl" style="color:${lc}">${nm}</div></div>`;
      }).join('');
      indivHtml = `<div class="itog-grid">${btns}</div>`;
    }

    return `<div class="rb-lights-sec">${masterHtml}${indivHtml}</div>`;
  }

  // Signal-bar dots — matches room-controls-card _signal() exactly
  _signal(level, active) {
    if (!level) return `<div class="fpip-dot-off">Off</div>`;
    const c = active ? 'fpip-dot fpip-dot-on' : 'fpip-dot';
    if (level <= 3) return `<div class="fpip-dots-row">${Array(level).fill(`<div class="${c}"></div>`).join('')}</div>`;
    return `<div class="fpip-dots-grid">${Array(Math.min(level, 4)).fill(`<div class="${c}"></div>`).join('')}</div>`;
  }

  _fansPopupHtml(btn) {
    const fans = btn.fans;
    if (!fans || !fans.length) return '';
    const html = fans.map((fcfg, fi) => {
      const speeds = this._fanResolvedSpeeds(fcfg);
      const idx    = this._fanCurrentStep(fcfg);
      const fname  = fcfg.name || this._attr(fcfg.entity, 'friendly_name') || fcfg.entity.split('.').pop().replace(/_/g, ' ');
      let pips = '';
      for (let i = 0; i < speeds; i++) {
        pips += `<div class="fpip${i === idx ? ' fpip-on' : ''}" data-fan-idx="${fi}" data-step="${i}">${this._signal(i, i === idx)}</div>`;
      }
      return `<div class="fan-flat"><div class="fan-nm-row"><span class="fan-nm">${fname}</span></div><div class="fpips" id="rbfan-${fi}">${pips}</div></div>`;
    }).join('');
    return `<div class="fan-section">${html}</div>`;
  }


  _themePopupHtml(btn) {
    if (!btn.theme_sensor) return '';
    const sensor = this._entityState(btn.theme_sensor);
    if (!sensor) return '';
    const theme  = sensor.state?.trim() || 'Default';
    const attrs  = sensor.attributes || {};
    const isHol  = attrs.is_holiday === true || theme !== 'Default';
    const accent = attrs.accent || 'rgba(255,255,255,.55)';
    const emoji  = attrs.emoji  || '🌙';
    const colors = attrs.all_outdoor_colors || [];
    const sub    = isHol ? 'Holiday theme active' : 'Warm white';

    if (!colors.length) return '';

    const swatches = colors.slice(0, 8).map(c =>
      `<div class="rb-swatch" style="background:${c}"></div>`
    ).join('');

    return `<div class="rb-theme-block">
      <div class="rb-theme-hdr">
        <span style="font-size:14px;line-height:1">${emoji}</span>
        <div class="rb-theme-name" style="color:${accent}">${theme}</div>
        <div class="rb-theme-sub">${sub}</div>
      </div>
      <div class="rb-swatches">${swatches}</div>
    </div>`;
  }

  _statsPopupHtml(btn) {
    const stats = (btn.popup_entities || []).filter(c => c.type === 'stat');
    if (!stats.length) return '';
    const tiles = stats.map(cfg => {
      const raw = this._stateVal(cfg.entity);
      const num = parseFloat(raw);
      const val = !isNaN(num) ? (Number.isInteger(num) ? num : num.toFixed(1)) : (raw ?? '—');
      const unit = this._entityState(cfg.entity)?.attributes?.unit_of_measurement || '';
      return `<div class="pop-stat">
        <div class="pop-stat-val">${val}<span class="pop-stat-unit">${unit}</span></div>
        <div class="pop-stat-lbl">${cfg.label || ''}</div>
      </div>`;
    }).join('');
    return `<div class="rb-stat-sec"><div class="rb-sec-lbl">Conditions</div><div class="pop-stats">${tiles}</div></div>`;
  }

  // ── Build full popup content ───────────────────────────────────────────────────

  _buildPopupContent(btn) {
    const name = btn.name
      || this._entityState(btn.entity)?.attributes?.friendly_name
      || btn.entity;

    const hasLights = !!(btn.lights);
    const hasFans   = !!(btn.fans && btn.fans.length);

    let sub = '';
    if (hasLights) {
      const on  = this._isOn(btn.lights?.entity || btn.entity);
      const indiv = btn.lights?.individuals || [];
      if (indiv.length) {
        const cnt = indiv.filter(l => this._isOn(l.entity)).length;
        sub = `${cnt} / ${indiv.length} on`;
      } else {
        const bri = this._brightness(btn.lights?.entity || btn.entity);
        sub = on ? (bri != null ? `On · ${bri}%` : 'On') : 'Off';
      }
    }

    const lightsHtml = hasLights ? this._lightsPopupHtml(btn) : '';
    const fansHtml   = hasFans   ? this._fansPopupHtml(btn)   : '';
    const themeHtml  = this._themePopupHtml(btn);
    const statsHtml  = this._statsPopupHtml(btn);

    // Legacy popup_entities (toggle, cover_group) still work
    const popupEntities = btn.popup_entities || [];
    const toggles = popupEntities.filter(c => c.type === 'toggle');
    const covers  = popupEntities.filter(c => c.type === 'cover_group');
    let legacyHtml = '';
    if (toggles.length || covers.length) {
      let inner = '';
      if (toggles.length) inner += `<div class="pop-tiles">${toggles.map((c, i) => this._toggleTileHTML(c, i)).join('')}</div>`;
      covers.forEach(c => { inner += this._coverGroupTileHTML(c); });
      legacyHtml = `<div class="pop-section"><div class="pop-sec-lbl">Controls</div>${inner}</div>`;
    }

    return `
      <div id="rb-handle"></div>
      <div class="pop-head">
        <div>
          <div class="pop-title">${name}</div>
          ${sub ? `<div class="pop-sub">${sub}</div>` : ''}
        </div>
        <button id="rb-close">✕</button>
      </div>
      <div class="pop-divider"></div>
      ${themeHtml}
      ${lightsHtml}
      ${hasFans ? `${hasLights ? '<div class="rb-divider"></div>' : ''}${fansHtml}` : ''}
      ${legacyHtml}
      ${statsHtml}`;
  }

  // ── Popup HTML builders (legacy popup_entities) ────────────────────────────────

  _statTileHTML(cfg) {
    const raw   = this._stateVal(cfg.entity);
    const num   = parseFloat(raw);
    const val   = isNaN(num) ? raw : Math.round(num);
    const unit  = cfg.unit || this._unitOf(cfg.entity);
    const label = cfg.label
      || this._entityState(cfg.entity)?.attributes?.friendly_name
      || cfg.entity;
    return `<div class="pop-stat">
      <div class="pop-stat-val">${val}<span class="pop-stat-unit">${unit}</span></div>
      <div class="pop-stat-lbl">${label}</div>
    </div>`;
  }

  _toggleTileHTML(cfg, idx) {
    const on         = this._isToggleOn(cfg.entity);
    const color      = this._toggleColor(cfg.entity);
    const stateLabel = this._toggleStateLabel(cfg.entity);
    const label      = cfg.label
      || this._entityState(cfg.entity)?.attributes?.friendly_name
      || cfg.entity;
    const onClass  = on ? this._toggleOnClass(cfg.entity) : 'off';
    const iconName = cfg.icon || this._domainIcon(cfg.entity);
    return `<div class="pop-tile ${onClass}" data-toggle-idx="${idx}">
      <div class="pop-tile-ico" style="color:${on ? color : 'rgba(255,255,255,0.28)'}">${this._icon(iconName)}</div>
      <div class="pop-tile-state" style="color:${on ? color : 'rgba(255,255,255,0.38)'}">${stateLabel}</div>
      <div class="pop-tile-lbl">${label}</div>
    </div>`;
  }

  _brightnessSliderHTML(entityId, sliderKey) {
    const bri = this._brightness(entityId) || 0;
    return `<div class="bri-row" data-bri-entity="${entityId}">
      <div class="bri-top">
        <span class="bri-lbl">Brightness</span>
        <span class="bri-val" id="brv-${sliderKey}">${bri}%</span>
      </div>
      <div class="bri-track" id="brt-${sliderKey}">
        <div class="bri-fill"  id="brf-${sliderKey}"  style="width:${bri}%"></div>
        <div class="bri-thumb" id="brth-${sliderKey}" style="left:${bri}%"></div>
      </div>
    </div>`;
  }

  _fanTileHTML(cfg) {
    const speeds       = this._fanResolvedSpeeds(cfg);
    const sps          = this._fanSpeedPercentages(cfg);
    const currentStep  = this._fanCurrentStep(cfg);
    const isOn         = currentStep > 0;
    const color        = '#38bdf8';
    const speedLabels  = ['Off', 'Low', 'Med', 'High', 'Turbo'];
    const label        = cfg.label
      || this._entityState(cfg.entity)?.attributes?.friendly_name
      || cfg.entity;

    // Pip heights for header indicator — generated for any speed count
    const pipHs = Array.from({length: speeds}, (_, i) => Math.round(5 + (i / (speeds - 1 || 1)) * 11));
    const headerPips = pipHs.map((h, i) =>
      `<div style="width:5px;height:${h}px;border-radius:2px 2px 1px 1px;` +
      `background:${i < currentStep && isOn ? color : 'rgba(255,255,255,0.14)'}"></div>`
    ).join('');

    // Speed buttons: off (✕) + 1..speeds (growing pips)
    let speedBtns = '';

    // Off button
    const offActive = currentStep === 0;
    speedBtns += `<div class="spd-btn${offActive ? ' s-active-off' : ''}" data-fan-step="0">
      <div class="spd-x${offActive ? ' spd-x-on' : ''}"></div>
    </div>`;

    // Speed 1..N buttons
    for (let i = 1; i <= speeds; i++) {
      const isActive = i === currentStep;
      const btnPipHs = Array.from({length: i}, (_, j) => Math.round(5 + (j / (speeds - 1 || 1)) * 11));
      const pips     = btnPipHs.map(h =>
        `<div style="width:4px;height:${h}px;border-radius:2px 2px 1px 1px;` +
        `background:${isActive ? color : 'rgba(255,255,255,0.18)'}"></div>`
      ).join('');
      speedBtns += `<div class="spd-btn${isActive ? ' s-active' : ''}" data-fan-step="${i}">
        <div style="display:flex;gap:2px;align-items:flex-end">${pips}</div>
      </div>`;
    }

    return `<div class="fan-tile ${isOn ? 'fan-on' : 'fan-off'}" data-fan-tile="1">
      <div class="fan-row">
        <div class="fan-ico" style="color:${isOn ? color : 'rgba(255,255,255,0.28)'}">${this._icon('fan')}</div>
        <div class="fan-info">
          <div class="fan-lbl">${label}</div>
          <div class="fan-state" style="color:${isOn ? color : 'rgba(255,255,255,0.35)'}">${speedLabels[currentStep]}</div>
        </div>
        <div style="display:flex;gap:2px;align-items:flex-end">${headerPips}</div>
      </div>
      <div class="spd-row">${speedBtns}</div>
    </div>`;
  }

  _coverGroupTileHTML(cfg) {
    const state = this._coverGroupState(cfg);
    const max   = cfg.max_position || 100;
    const label = cfg.label || 'Blinds';

    const META = {
      closed:  { stateLabel: 'All closed',      color: '#94a3b8', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.09)' },
      open:    { stateLabel: `Open to ${max}%`,  color: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.28)'  },
      opening: { stateLabel: 'Opening…',         color: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.25)'  },
      closing: { stateLabel: 'Closing…',         color: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.25)'  },
    };
    const m = META[state] || META.closed;

    const openDisabled  = state === 'open'   || state === 'opening';
    const closeDisabled = state === 'closed' || state === 'closing';

    // Build blind icon with explicit color fill
    const blindIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="${m.color}" stroke-width="1.7" stroke-linecap="round">
      <rect x="2" y="3" width="20" height="2" rx="1" fill="${m.color}" stroke="none"/>
      <line x1="2" y1="9" x2="22" y2="9"/>
      <line x1="2" y1="14" x2="22" y2="14"/>
      <line x1="2" y1="19" x2="22" y2="19"/>
      <line x1="12" y1="5" x2="12" y2="22"/>
    </svg>`;

    return `<div class="cover-tile" style="background:${m.bg};border:1px solid ${m.border}">
      <div class="cover-left">
        <div style="width:20px;height:20px;flex-shrink:0">${blindIcon}</div>
        <div style="min-width:0">
          <div class="cover-name">${label}</div>
          <div class="cover-state" style="color:${m.color}">${m.stateLabel}</div>
        </div>
      </div>
      <div class="cover-btns">
        <button class="cov-btn cov-open"  title="Open to ${max}%"
          ${openDisabled ? 'disabled' : ''} data-cov-action="open">▲</button>
        <button class="cov-btn cov-close" title="Close all"
          ${closeDisabled ? 'disabled' : ''} data-cov-action="close">▼</button>
      </div>
    </div>`;
  }


  // ── Popup open / close ────────────────────────────────────────────────────────

  _openPopup(btn) {
    const overlay = this.shadowRoot.getElementById('rb-overlay');
    const popup   = this.shadowRoot.getElementById('rb-popup');
    if (!overlay || !popup) return;

    this._popupOpen = true;
    this._activeBtn = btn;

    const scrollTop = popup.scrollTop || 0;
    popup.innerHTML = this._buildPopupContent(btn);
    overlay.style.display = 'flex';
    popup.scrollTop = scrollTop;
    document.body.style.overflow = 'hidden';

    // Close
    popup.querySelector('#rb-close')?.addEventListener('click', () => this._closePopup());
    setTimeout(() => {
      overlay.addEventListener('click', e => { if (e.target === overlay) this._closePopup(); }, { once: true });
    }, 50);

    // ── Master toggle (switch entities) ────────────────────────────────────────
    const masterToggle = popup.querySelector('[data-action="rb-master-toggle"]');
    if (masterToggle) {
      const eid = masterToggle.dataset.entity;
      masterToggle.addEventListener('click', e => {
        e.stopPropagation();
        const isOn = this._isOn(eid);
        this._call('switch', isOn ? 'turn_off' : 'turn_on', { entity_id: eid }, null);
        // Update state label immediately for responsiveness
        const stateEl = popup.querySelector('#rbmstate');
        if (stateEl) {
          stateEl.textContent = isOn ? 'Off' : 'On';
          stateEl.style.color = isOn ? 'rgba(255,255,255,.35)' : '#fbbf24';
        }
      });
    }

    // ── Master brightness drag (light entities only) ────────────────────────────
    const masterWrap = popup.querySelector('[data-action="rb-master-drag"]');
    if (masterWrap) {
      const eid = masterWrap.dataset.entity;
      const fill = popup.querySelector('#rbmf'), thumb = popup.querySelector('#rbmt'), pct = popup.querySelector('#rbmpct');
      let dragging = false, timer = null;
      const upd = (cx, commit) => {
        const r = masterWrap.getBoundingClientRect();
        const p = Math.max(0, Math.min(100, Math.round(((cx - r.left) / r.width) * 100)));
        if (fill)  fill.style.width  = p + '%';
        if (thumb) thumb.style.left  = Math.min(p, 96) + '%';
        if (pct)   pct.textContent   = p + '%';
        if (commit) { clearTimeout(timer); timer = setTimeout(() => {
          if (p === 0) this._call('light', 'turn_off', { entity_id: eid }, null);
          else         this._call('light', 'turn_on',  { entity_id: eid, brightness_pct: p }, null);
        }, 150); }
      };
      masterWrap.addEventListener('mousedown',  e => { dragging = true; upd(e.clientX, false); e.preventDefault(); });
      masterWrap.addEventListener('touchstart', e => { dragging = true; upd(e.touches[0].clientX, false); }, { passive: true });
      document.addEventListener('mousemove',  e => { if (dragging) upd(e.clientX, true); });
      document.addEventListener('touchmove',  e => { if (dragging) upd(e.touches[0].clientX, true); }, { passive: true });
      document.addEventListener('mouseup',    () => { dragging = false; });
      document.addEventListener('touchend',   () => { dragging = false; });
    }

    // ── Individual light drag sliders ───────────────────────────────────────────
    popup.querySelectorAll('[data-action="rb-indiv-drag"]').forEach(wrap => {
      const eid = wrap.dataset.entity, li = wrap.dataset.li;
      const fill = popup.querySelector(`#rblf-${li}`), thumb = popup.querySelector(`#rblth-${li}`), pct = popup.querySelector(`#rblpct-${li}`);
      let dragging = false, timer = null;
      const upd = (cx, commit) => {
        const r = wrap.getBoundingClientRect();
        const p = Math.max(0, Math.min(100, Math.round(((cx - r.left) / r.width) * 100)));
        if (fill)  fill.style.width = p + '%';
        if (thumb) thumb.style.left = Math.max(4, Math.min(p, 96)) + '%';
        if (pct)   pct.textContent  = p + '%';
        if (commit) { clearTimeout(timer); timer = setTimeout(() => {
          if (p === 0) this._call('light', 'turn_off', { entity_id: eid }, null);
          else         this._call('light', 'turn_on',  { entity_id: eid, brightness_pct: p }, null);
        }, 150); }
      };
      wrap.addEventListener('mousedown',  e => { dragging = true; upd(e.clientX, false); e.preventDefault(); });
      wrap.addEventListener('touchstart', e => { dragging = true; upd(e.touches[0].clientX, false); }, { passive: true });
      document.addEventListener('mousemove',  e => { if (dragging) upd(e.clientX, true); });
      document.addEventListener('touchmove',  e => { if (dragging) upd(e.touches[0].clientX, true); }, { passive: true });
      document.addEventListener('mouseup',    () => { dragging = false; });
      document.addEventListener('touchend',   () => { dragging = false; });
    });

    // ── Fan pip buttons ─────────────────────────────────────────────────────────
    // Now uses .fpip/.fpip-dot classes (matching room-controls-card exactly)
    const fans = btn.fans || [];
    popup.querySelectorAll('.fpip[data-fan-idx]').forEach(el => {
      const fi   = parseInt(el.dataset.fanIdx);
      const step = parseInt(el.dataset.step);
      const cfg  = fans[fi];
      if (!cfg) return;
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._setFanSpeed(cfg, step);
        // Patch pips in-place
        const row = popup.querySelector(`#rbfan-${fi}`);
        if (row) row.querySelectorAll('.fpip').forEach((pip, i) => {
          pip.classList.toggle('fpip-on', i === step);
          const dotEl = pip.querySelector('.fpip-dots-row, .fpip-dots-grid, .fpip-dot-off');
          if (dotEl) dotEl.outerHTML = this._signal(i, i === step);
        });
      });
    });

    // ── Individual light toggles (itog-grid) ──────────────────────────────────
    popup.querySelectorAll('[data-action="rb-indiv-tog"]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const eid   = el.dataset.entity;
        const isOn  = this._isOn(eid);
        const domain = eid.split('.')[0];
        const svc   = isOn ? 'turn_off' : 'turn_on';
        this._call(domain === 'switch' ? 'switch' : 'light', svc, { entity_id: eid }, null);
        // Optimistic visual update
        const lon   = !isOn;
        el.style.background   = lon ? 'rgba(251,191,36,.10)' : 'rgba(255,255,255,.04)';
        el.style.borderColor  = lon ? 'rgba(251,191,36,.30)' : 'rgba(255,255,255,.08)';
        const dot = el.querySelector('.itog-dot');
        const lbl = el.querySelector('.itog-lbl');
        if (dot) dot.style.background = lon ? '#fbbf24' : 'rgba(255,255,255,.2)';
        if (lbl) lbl.style.color = lon ? 'rgba(251,191,36,.8)' : 'rgba(255,255,255,.35)';
      });
    });

    // ── Master color chevron ──────────────────────────────────────────────────
    const masterChev = popup.querySelector('[data-action="rb-master-expand"]');
    if (masterChev) {
      masterChev.addEventListener('click', e => {
        e.stopPropagation();
        const exp = popup.querySelector('#rbme');
        if (!exp) return;
        // toggle returns true when class was ADDED (now hidden), false when removed (now visible)
        const nowHidden = exp.classList.toggle('hidden');
        const arrow = popup.querySelector('#rbmc-a');
        if (arrow) arrow.style.transform = nowHidden ? '' : 'rotate(180deg)';
        // When opening master, close all individual light color sections
        if (!nowHidden) {
          popup.querySelectorAll('.rb-color-sec:not(.hidden)').forEach(s => s.classList.add('hidden'));
          popup.querySelectorAll('[id^="rbla-"]').forEach(a => { a.style.transform = ''; });
        }
      });
    }

    // ── Preset clicks (color/CT swatches) ────────────────────────────────────
    // Only 'rbpct-all' / 'rbpcc-all' remain — per-light chevrons removed in favour of itog-grid.
    popup.querySelectorAll('[data-rb-preset]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const prefix    = el.dataset.rbPreset;
        const idx       = parseInt(el.dataset.idx);
        const lcfg      = btn.lights;
        const masterEnt = lcfg?.entity || btn.entity;
        const indiv     = lcfg?.individuals || [];
        // Apply to master group entity + all individuals
        const allEnts   = [masterEnt, ...indiv.map(l => l.entity)];

        if (prefix === 'rbpct-all') {
          const p = this._ctPresets()[idx];
          if (p) allEnts.forEach(eid => this._setColorTemp(eid, p.kelvin));
        } else if (prefix === 'rbpcc-all') {
          const p = this._colorPresets()[idx];
          if (p) allEnts.forEach(eid => this._setColor(eid, p.rgb));
        }
        this._selPreset(el);
      });
    });

    // ── Legacy toggle tiles ─────────────────────────────────────────────────────
    const popupEntities = btn.popup_entities || [];
    const toggles = popupEntities.filter(c => c.type === 'toggle');
    const covers  = popupEntities.filter(c => c.type === 'cover_group');

    popup.querySelectorAll('.pop-tile[data-toggle-idx]').forEach(el => {
      const cfg = toggles[parseInt(el.dataset.toggleIdx)];
      if (!cfg) return;
      el.addEventListener('click', () => {
        this._togglePopupEntity(cfg.entity);
        setTimeout(() => { if (this._popupOpen) this._openPopup(btn); }, 350);
      });
    });

    popup.querySelectorAll('.cover-tile').forEach((tileEl, ci) => {
      const cfg = covers[ci];
      if (!cfg) return;
      tileEl.querySelector('[data-cov-action="open"]')?.addEventListener('click', () => {
        this._openCoverGroup(cfg);
        setTimeout(() => { if (this._popupOpen) this._openPopup(btn); }, 400);
      });
      tileEl.querySelector('[data-cov-action="close"]')?.addEventListener('click', () => {
        this._closeCoverGroup(cfg);
        setTimeout(() => { if (this._popupOpen) this._openPopup(btn); }, 400);
      });
    });
  }

  _closePopup() {
    this._popupOpen = false;
    this._activeBtn = null;
    document.body.style.overflow = '';
    const overlay = this.shadowRoot.getElementById('rb-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  _render() {
    if (!this._config.buttons) return;

    const btns = this._config.buttons;

    const buttonsHtml = btns.map((btn, i) => {
      const t    = this._theme(btn);
      const name = btn.name
        || this._entityState(btn.entity)?.attributes?.friendly_name
        || btn.entity;
      const progressHtml = t.indeterminate
        ? `<div class="prog-indeterminate" style="background:${t.iconColor}"></div>`
        : '';

      // Theme strip — shown when button has theme_sensor configured
      let themeStripHtml = '', themeNameHtml = '';
      if (btn.theme_sensor) {
        const sensor  = this._entityState(btn.theme_sensor);
        const theme   = sensor?.state?.trim() || 'Default';
        const attrs   = sensor?.attributes || {};
        const colors  = attrs.all_outdoor_colors || [];
        const emoji   = attrs.emoji || '';
        const isHol   = attrs.is_holiday === true || theme !== 'Default';
        const accent  = attrs.accent || 'rgba(255,255,255,.5)';
        if (isHol && colors.length) {
          const segs = colors.map(c => `<div style="flex:1;background:${c}"></div>`).join('');
          themeStripHtml = `<div class="btn-theme-strip">${segs}</div>`;
          themeNameHtml  = `<div class="btn-theme-name" style="color:${accent}">${emoji} ${theme}</div>`;
        }
      }

      return `<button class="room-btn ${t.canAct ? 'can-act' : 'btn-disabled'}"
          id="rbtn-${i}" style="background:${t.bg};border-color:${t.border}"
          data-idx="${i}" ${t.canAct ? '' : 'disabled'}>
        <div class="btn-icon" style="color:${t.iconColor}">${this._icon(btn.icon)}</div>
        <div class="btn-text">
          <div class="btn-name"  style="color:${t.nameColor}">${name}</div>
          <div class="btn-state" style="color:${t.stateColor}">${t.stateLabel}</div>
          ${themeNameHtml}
        </div>
        ${progressHtml}
        ${themeStripHtml}
      </button>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 8px 14px;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        /* ── Main room buttons ── */
        .room-btn {
          border-radius: 10px;
          padding: 10px 12px;
          border: 1px solid;
          display: flex;
          align-items: center;
          gap: 10px;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          width: 100%;
          text-align: left;
          position: relative;
          overflow: hidden;
          min-height: 46px;
        }
        .room-btn.can-act {
          cursor: pointer;
          transition: transform 0.1s, filter 0.1s;
          user-select: none;
        }
        .room-btn.can-act:active {
          transform: scale(0.97);
          filter: brightness(0.88);
        }
        .room-btn.btn-disabled { cursor: default; }

        .btn-icon { width: 22px; height: 22px; flex-shrink: 0; }
        .btn-icon svg { width: 100%; height: 100%; }
        .btn-text { flex: 1; min-width: 0; }
        .btn-name {
          font-size: 13px; font-weight: 700; line-height: 1.2;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .btn-state { font-size: 11px; font-weight: 500; margin-top: 2px; opacity: 0.8; }
        .btn-theme-name {
          font-size: 9px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          margin-top: 3px; line-height: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .btn-theme-strip {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 3px; display: flex; overflow: hidden;
          border-radius: 0 0 10px 10px;
        }

        .hold-bar {
          position: absolute; bottom: 0; left: 0;
          height: 2px; width: 0%;
          border-radius: 0 0 10px 10px;
          pointer-events: none;
        }
        .prog-indeterminate {
          position: absolute; bottom: 0; height: 2px;
          border-radius: 0 0 10px 10px; pointer-events: none;
          animation: indie 1.6s ease-in-out infinite;
        }
        @keyframes indie {
          0%   { width: 15%; left: 0%; }
          50%  { width: 55%; left: 25%; }
          100% { width: 15%; left: 85%; }
        }

        /* ── Popup overlay ── */
        #rb-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 9999;
          box-sizing: border-box;
          align-items: flex-end;
          justify-content: center;
        }
        #rb-popup {
          background: var(--card-background-color, #1e1e2a);
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 16px 16px 0 0;
          border-bottom: none;
          padding: 20px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        #rb-popup::-webkit-scrollbar { width: 4px; }
        #rb-popup::-webkit-scrollbar-track { background: transparent; }
        #rb-popup::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        @media (min-width: 768px) {
          #rb-overlay {
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          #rb-popup {
            width: 100%;
            max-width: 420px;
            border-radius: 16px;
            border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          }
          #rb-handle { display: none !important; }
        }

        /* ── Popup internals ── */
        #rb-handle {
          width: 36px; height: 4px;
          background: rgba(255,255,255,0.15); border-radius: 2px;
          margin: 0 auto 16px;
        }
        .pop-head {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 14px;
        }
        .pop-title {
          font-size: 17px; font-weight: 700;
          color: var(--primary-text-color); line-height: 1.2;
        }
        .pop-sub { font-size: 11px; color: var(--secondary-text-color); margin-top: 3px; }
        #rb-close {
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
        .pop-section { margin-bottom: 16px; }
        .pop-sec-lbl {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .1em; color: var(--secondary-text-color);
          opacity: 0.5; margin-bottom: 9px;
        }

        /* ── Stat tiles ── */
        .pop-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pop-stat {
          background: rgba(255,255,255,0.04);
          border-radius: 10px; padding: 12px;
        }
        .pop-stat-val {
          font-size: 22px; font-weight: 700;
          color: var(--primary-text-color); line-height: 1;
        }
        .pop-stat-unit {
          font-size: 11px; font-weight: 600;
          color: var(--secondary-text-color); margin-left: 2px;
        }
        .pop-stat-lbl {
          font-size: 10px; font-weight: 600;
          color: var(--secondary-text-color); text-transform: uppercase;
          letter-spacing: .06em; margin-top: 4px; opacity: .7;
        }

        /* ── Toggle tiles ── */
        .pop-tiles {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; margin-bottom: 8px;
        }
        .pop-tile {
          border-radius: 10px; padding: 12px;
          cursor: pointer; border: 1px solid transparent;
          transition: filter .12s; -webkit-tap-highlight-color: transparent;
        }
        .pop-tile:active { filter: brightness(0.82); }
        .pop-tile.off {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.07);
        }
        .pop-tile.on-amber {
          background: rgba(251,191,36,0.1);
          border-color: rgba(251,191,36,0.35);
        }
        .pop-tile.on-blue {
          background: rgba(96,165,250,0.1);
          border-color: rgba(96,165,250,0.35);
        }
        .pop-tile.on-purple {
          background: rgba(167,139,250,0.1);
          border-color: rgba(167,139,250,0.35);
        }
        .pop-tile-ico { width: 18px; height: 18px; margin-bottom: 8px; }
        .pop-tile-ico svg { width: 100%; height: 100%; }
        .pop-tile-state { font-size: 13px; font-weight: 600; line-height: 1.2; }
        .pop-tile-lbl {
          font-size: 10px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .06em; opacity: .55; margin-top: 2px;
          color: var(--secondary-text-color);
        }

        /* ── Brightness slider ── */
        .bri-row {
          margin-bottom: 8px; padding: 10px 13px;
          background: rgba(255,255,255,0.04);
          border-radius: 10px; border: 1px solid rgba(251,191,36,0.2);
        }
        .bri-top {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 7px;
        }
        .bri-lbl {
          font-size: 10px; font-weight: 700; color: rgba(251,191,36,0.7);
          text-transform: uppercase; letter-spacing: .07em;
        }
        .bri-val { font-size: 12px; font-weight: 700; color: #fbbf24; }
        .bri-track {
          position: relative; height: 6px;
          background: rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer;
        }
        .bri-fill  { height: 100%; border-radius: 3px; background: #fbbf24; }
        .bri-thumb {
          position: absolute; top: 50%; transform: translate(-50%, -50%);
          width: 16px; height: 16px; border-radius: 50%;
          background: #fbbf24; cursor: grab; border: 2px solid rgba(0,0,0,0.3);
        }

        /* ── Fan tile ── */
        .fan-tile {
          border-radius: 10px; padding: 12px 14px; cursor: pointer;
          border: 1px solid transparent; margin-bottom: 8px;
          transition: filter .12s; -webkit-tap-highlight-color: transparent;
        }
        .fan-tile:active { filter: brightness(0.9); }
        .fan-off { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.07); }
        .fan-on  { background: rgba(56,189,248,0.08);  border-color: rgba(56,189,248,0.28);  }
        .fan-row { display: flex; align-items: center; gap: 10px; }
        .fan-ico { width: 18px; height: 18px; flex-shrink: 0; }
        .fan-ico svg { width: 100%; height: 100%; }
        .fan-info { flex: 1; min-width: 0; }
        .fan-lbl {
          font-size: 9.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; opacity: .55; margin-bottom: 3px;
          color: var(--secondary-text-color);
        }
        .fan-state { font-size: 13px; font-weight: 600; }

        /* Speed segment row */
        .spd-row { display: flex; gap: 3px; margin-top: 9px; }
        .spd-btn {
          flex: 1; padding: 8px 4px 6px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.04); cursor: pointer;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-end;
          gap: 2px; min-height: 36px; transition: filter .12s;
          -webkit-tap-highlight-color: transparent;
        }
        .spd-btn:active { filter: brightness(0.82); }
        .spd-btn.s-active-off {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.22);
        }
        .spd-btn.s-active {
          background: rgba(56,189,248,0.14);
          border-color: rgba(56,189,248,0.42);
        }
        /* Off ✕ mark via CSS */
        .spd-x {
          width: 10px; height: 10px; position: relative; margin-bottom: 2px;
        }
        .spd-x::before, .spd-x::after {
          content: ''; position: absolute; top: 50%; left: 0;
          width: 100%; height: 1.5px; border-radius: 1px;
          background: rgba(255,255,255,0.28); transform-origin: center;
        }
        .spd-x::before { transform: translateY(-50%) rotate(45deg);  }
        .spd-x::after  { transform: translateY(-50%) rotate(-45deg); }
        .spd-x.spd-x-on::before,
        .spd-x.spd-x-on::after { background: rgba(255,255,255,0.7); }

        /* ── Cover group tile ── */
        .cover-tile {
          border-radius: 11px; padding: 14px 16px; margin-bottom: 8px;
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
        }
        .cover-left {
          display: flex; align-items: center;
          gap: 11px; min-width: 0; flex: 1;
        }
        .cover-name {
          font-size: 13px; font-weight: 700;
          color: var(--primary-text-color);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cover-state { font-size: 11px; margin-top: 2px; }
        .cover-btns  { display: flex; gap: 5px; flex-shrink: 0; }
        .cov-btn {
          width: 40px; height: 40px; border-radius: 10px;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
          font-size: 20px; line-height: 1;
          border: 1px solid transparent; font-family: inherit;
          transition: filter .12s; -webkit-tap-highlight-color: transparent;
        }
        .cov-btn:active { filter: brightness(0.82); }
        .cov-btn:disabled { opacity: .25; cursor: default; filter: none; }
        .cov-open  {
          background: rgba(96,165,250,0.15);
          border-color: rgba(96,165,250,0.4); color: #60a5fa;
        }
        .cov-close {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.14); color: #94a3b8;
        }

        /* ── Lights section ── */
        .rb-sec-hdr{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.65);padding:0 0 4px;display:block}
        .rb-sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28);padding:0 0 6px;display:block}
        .rb-lights-sec{padding:0 0 4px}
        .rb-master{margin:0 0 6px;border-radius:8px;background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.12);overflow:hidden}
        .rb-mrow{display:flex;align-items:center;gap:8px;padding:10px 12px}
        .rb-slider-wrap{flex:1;height:36px;display:flex;align-items:center;position:relative;cursor:ew-resize;min-width:0}
        .rb-track{width:100%;height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;position:relative}
        .rb-fill{height:100%;border-radius:99px;background:#fbbf24;transition:width .05s}
        .rb-thumb{position:absolute;top:50%;width:18px;height:18px;border-radius:50%;background:#fbbf24;border:2px solid rgba(255,255,255,.9);transform:translate(-50%,-50%);pointer-events:none;transition:left .05s}
        .rb-pct{font-size:12px;font-weight:700;color:rgba(255,255,255,.35);width:32px;text-align:right;flex-shrink:0}
        .rb-mchev{width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent}
        .rb-master-exp{padding:0 12px 10px;border-top:1px solid rgba(251,191,36,.12)}
        .rb-master-exp.hidden{display:none}
        .rb-sw-row{flex:1;display:flex;align-items:center;gap:10px;padding:0 4px;min-width:0}
        .rb-sw-lbl{font-size:12px;font-weight:700;color:rgba(255,255,255,.55);flex:1}
        .rb-sw-state{font-size:12px;font-weight:700;flex-shrink:0}
        /* ── Individual lights — itog-grid (matches room-controls-card) ── */
        .itog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:6px 0 2px}
        .itog{border-radius:7px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;min-height:54px;justify-content:center;transition:background .1s,border-color .1s}
        .itog:active{transform:scale(.94)}
        .itog-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
        .itog-lbl{font-size:12px;font-weight:700;text-align:center;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:0 3px}
        /* ── Color expand panels ── */
        .rb-color-sec{padding:7px 0 4px;border-top:1px solid rgba(255,255,255,.06)}
        .rb-color-sec.hidden{display:none}
        .rb-clbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:rgba(255,255,255,.25);margin-bottom:6px;margin-top:3px}
        .rb-presets{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}
        .rb-presets-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px}
        .rb-preset{flex:1;min-width:0;height:54px;border-radius:7px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:0 3px;transition:all .12s;user-select:none;-webkit-tap-highlight-color:transparent}
        .rb-presets-grid .rb-preset{flex:unset}
        .rb-preset:active{transform:scale(.92)}
        .rb-preset-sel{border-width:1.5px}
        .rb-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
        .rb-dot-lbl{font-size:9px;font-weight:700;color:rgba(255,255,255,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:center;line-height:1}
        .rb-preset-sel .rb-dot-lbl{color:rgba(255,255,255,.82)}

        /* ── Section divider ── */
        .rb-divider{height:1px;background:rgba(255,255,255,.07);margin:8px 0}

        /* ── Fans — fpip/fpip-dot (matches room-controls-card exactly) ── */
        .fan-section{display:flex;flex-direction:column;gap:4px;padding:4px 0 8px}
        .fan-flat{display:flex;flex-direction:column;gap:4px}
        .fan-nm-row{padding:0 2px}
        .fan-nm{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3)}
        .fpips{display:flex;gap:4px}
        .fpip{flex:1;height:44px;border-radius:7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,border-color .1s;user-select:none;-webkit-tap-highlight-color:transparent}
        .fpip:active{transform:scale(.9)}
        .fpip-on{background:rgba(45,212,191,.15);border-color:rgba(45,212,191,.4)}
        .fpip-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2)}
        .fpip-dot-on{background:#2dd4bf}
        .fpip-dot-off{font-size:9px;font-weight:700;color:rgba(255,255,255,.25)}
        .fpip-dots-row{display:flex;gap:4px;align-items:center;justify-content:center}
        .fpip-dots-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;align-items:center;justify-items:center}

        /* ── Theme block ── */
        .rb-theme-block{margin-bottom:12px;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
        .rb-theme-hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .rb-theme-name{font-size:13px;font-weight:700;flex:1;min-width:0}
        .rb-theme-sub{font-size:10px;color:rgba(255,255,255,.3)}
        .rb-swatches{display:flex;gap:4px;height:10px;border-radius:5px;overflow:hidden}
        .rb-swatch{flex:1;min-width:0;border-radius:0}

        /* ── Stats section (bottom) ── */
        .rb-stat-sec{padding:8px 0 0}
      </style>

      <ha-card>
        <div class="grid">${buttonsHtml}</div>
      </ha-card>

      <div id="rb-overlay">
        <div id="rb-popup"></div>
      </div>`;

    // ── Attach main button listeners ──────────────────────────────────────────

    btns.forEach((btn, i) => {
      const el       = this.shadowRoot.getElementById(`rbtn-${i}`);
      if (!el) return;

      const hasPopup = btn.popup_entities?.length > 0 || btn.lights || btn.fans?.length > 0;
      const isCover  = this._isCover(btn);

      // Cover without popup → direct toggle
      if (isCover && !hasPopup) {
        el.addEventListener('click', () => this._toggleEntity(btn));
        return;
      }

      // Any button with popup → open popup on tap
      if (hasPopup) {
        el.addEventListener('click', () => this._openPopup(btn));
        return;
      }

      // Default: tap → more-info, hold 600ms → toggle
      let holdStart = null;
      let holdTimer = null;
      let barEl     = null;

      const ensureBar = color => {
        if (el.querySelector('.hold-bar')) return el.querySelector('.hold-bar');
        const bar = document.createElement('div');
        bar.className = 'hold-bar';
        bar.style.background = color;
        el.appendChild(bar);
        return bar;
      };

      const startHold = () => {
        holdStart = Date.now();
        barEl = ensureBar(this._theme(btn).iconColor);
        barEl.style.transition = 'width 600ms linear';
        barEl.style.width = '100%';
        holdTimer = setTimeout(() => {
          this._toggleEntity(btn);
          holdStart = null;
        }, 600);
      };

      const cancelHold = wasTap => {
        clearTimeout(holdTimer);
        if (barEl) { barEl.style.transition = 'width .15s ease'; barEl.style.width = '0%'; }
        if (wasTap && holdStart && (Date.now() - holdStart) < 250) {
          this._fireMoreInfo(btn.entity);
        }
        holdStart = null;
      };

      el.addEventListener('mousedown',   () => startHold());
      el.addEventListener('touchstart',  e  => { e.preventDefault(); startHold(); }, { passive: false });
      el.addEventListener('mouseup',     () => cancelHold(true));
      el.addEventListener('mouseleave',  () => cancelHold(false));
      el.addEventListener('touchend',    () => cancelHold(true));
      el.addEventListener('touchcancel', () => cancelHold(false));
    });

    // Restore popup if it was open before this re-render
    if (this._popupOpen && this._activeBtn) {
      this._openPopup(this._activeBtn);
    }
  }
}

customElements.define('room-buttons-card', RoomButtonsCard);