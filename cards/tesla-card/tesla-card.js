/**
 * tesla-card.js  —  v13
 * A Home Assistant Lovelace custom card for Tesla vehicles.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy this file to /config/www/tesla-card.js
 * 2. In HA → Settings → Dashboards → Resources, add:
 *      URL:  /local/tesla-card.js
 *      Type: JavaScript Module
 * 3. Add the card to your dashboard (YAML or UI editor).
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:tesla-card
 * name: Model Y
 *
 * entities:
 *   # ── Main card ─────────────────────────────────────────────────────────
 *   battery_level:           sensor.YOUR_ENTITY_HERE
 *   battery_range:           sensor.YOUR_ENTITY_HERE
 *   charging_state:          sensor.YOUR_ENTITY_HERE
 *   door_lock:               lock.YOUR_ENTITY_HERE
 *   climate:                 climate.YOUR_ENTITY_HERE
 *   trunk:                   cover.YOUR_ENTITY_HERE
 *
 *   # ── Main card (charging only) ─────────────────────────────────────────
 *   charge_rate:             sensor.YOUR_ENTITY_HERE
 *   time_to_full_charge:     sensor.YOUR_ENTITY_HERE
 *
 *   # ── Popup — battery section ───────────────────────────────────────────
 *   # (battery_level, battery_range, charge_rate, time_to_full_charge reused)
 *
 *   # ── Popup — tire pressure section ────────────────────────────────────
 *   tire_pressure_fl:        sensor.YOUR_ENTITY_HERE
 *   tire_pressure_fr:        sensor.YOUR_ENTITY_HERE
 *   tire_pressure_rl:        sensor.YOUR_ENTITY_HERE
 *   tire_pressure_rr:        sensor.YOUR_ENTITY_HERE
 *
 *   # ── Popup — temperature section ──────────────────────────────────────
 *   interior_temperature:    sensor.YOUR_ENTITY_HERE
 *   exterior_temperature:    sensor.YOUR_ENTITY_HERE
 *
 *   # ── Popup — climate controls section ─────────────────────────────────
 *   # (climate reused for on/off + target temp)
 *   front_defrost:           switch.YOUR_ENTITY_HERE   # or binary_sensor
 *   rear_defrost:            switch.YOUR_ENTITY_HERE
 *   steering_wheel_heat:     switch.YOUR_ENTITY_HERE
 *
 *   # ── Popup — seat heating section ─────────────────────────────────────
 *   seat_heat_driver:        select.YOUR_ENTITY_HERE   # or sensor/number
 *   seat_heat_passenger:     select.YOUR_ENTITY_HERE
 *
 *   # ── Popup — vehicle status section ───────────────────────────────────
 *   # (door_lock, trunk, charging_state reused)
 *   charge_port:             binary_sensor.YOUR_ENTITY_HERE
 *   sentry_mode:             switch.YOUR_ENTITY_HERE
 *   odometer:                sensor.YOUR_ENTITY_HERE
 *
 * # ── Optional settings ─────────────────────────────────────────────────
 * tire_warn_psi: 40          # PSI below which a tire shows a warning (default 40)
 * temp_unit: F               # F or C (default F)
 */

class TeslaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config     = {};
    this._hass       = null;
    this._callInProgress = {};
    this._popupOpen  = false;
  }

  static getStubConfig() {
    return {
      name: 'Model Y',
      entities: {
        battery_level:        'sensor.my_model_y_battery_level',
        battery_range:        'sensor.my_model_y_battery_range',
        charge_rate:          'sensor.my_model_y_charge_rate',
        charging_state:       'sensor.my_model_y_charging_state',
        time_to_full_charge:  'sensor.my_model_y_time_to_full_charge',
        door_lock:            'lock.my_model_y_door_lock',
        climate:              'climate.my_model_y_hvac_climate_system',
        trunk:                'cover.my_model_y_trunk',
        tire_pressure_fl:     'sensor.my_model_y_tire_pressure_front_left',
        tire_pressure_fr:     'sensor.my_model_y_tire_pressure_front_right',
        tire_pressure_rl:     'sensor.my_model_y_tire_pressure_rear_left',
        tire_pressure_rr:     'sensor.my_model_y_tire_pressure_rear_right',
        interior_temperature: 'sensor.my_model_y_inside_temp',
        exterior_temperature: 'sensor.my_model_y_outside_temp',
        front_defrost:        'switch.my_model_y_defrost_mode',
        rear_defrost:         'switch.my_model_y_rear_defroster',
        steering_wheel_heat:  'switch.my_model_y_steering_wheel_heater',
        seat_heat_driver:     'select.my_model_y_heated_seat_front_left',
        seat_heat_passenger:  'select.my_model_y_heated_seat_front_right',
        charge_port:          'binary_sensor.my_model_y_charge_port_door',
        sentry_mode:          'switch.my_model_y_sentry_mode',
        odometer:             'sensor.my_model_y_odometer',
      }
    };
  }

  setConfig(config) {
    if (!config.entities || typeof config.entities !== 'object') {
      throw new Error('tesla-card: please define an "entities" block.');
    }
    this._config = {
      name:          'Tesla',
      tire_warn_psi: 40,
      temp_unit:     'F',
      show_actions:  true,
      ...config,
      entities: { ...config.entities }
    };
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.shadowRoot.querySelector('ha-card') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 3; }

  // ── Entity helpers ───────────────────────────────────────────────────────────

  _e(key) {
    const id = this._config.entities[key];
    if (!id || !this._hass) return null;
    return this._hass.states[id] || null;
  }

  _state(key)      { const e = this._e(key); return e ? e.state : null; }
  _attr(key, attr) { const e = this._e(key); return e ? (e.attributes[attr] ?? null) : null; }

  _num(key, decimals = 0) {
    const v = parseFloat(this._state(key));
    if (isNaN(v)) return null;
    return decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v);
  }

  _available(key) {
    const s = this._state(key);
    return s !== null && s !== 'unavailable' && s !== 'unknown';
  }

  _isOn(key) {
    const s = (this._state(key) || '').toLowerCase();
    return s === 'on' || s === 'true';
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  _batteryPct() {
    const v = this._num('battery_level');
    return v !== null ? Math.min(100, Math.max(0, v)) : null;
  }

  _battColor(pct) {
    if (pct === null) return '#94a3b8';
    if (pct <= 20)   return '#f87171';
    if (pct <= 40)   return '#facc15';
    return '#4ade80';
  }

  _isCharging()     { return (this._state('charging_state') || '').toLowerCase() === 'charging'; }
  _isLocked()       { return this._state('door_lock') === 'locked'; }
  _climateOn()      { const s = this._state('climate'); return s && s !== 'off'; }
  _trunkOpen()      { return this._state('trunk') === 'open'; }
  _chargePortOpen() { return this._state('charge_port') === 'on'; }
  _sentryOn()       { return this._isOn('sentry_mode'); }
  _frontDefrostOn() { return this._isOn('front_defrost'); }
  _rearDefrostOn()  { return this._isOn('rear_defrost'); }
  _wheelHeatOn()    { return this._isOn('steering_wheel_heat'); }

  _targetTemp() {
    const t = this._attr('climate', 'temperature');
    return t !== null ? Math.round(t) : null;
  }

  _timeToFull() {
    const s = this._state('time_to_full_charge');
    if (!s || s === 'unavailable' || s === '0.0') return null;
    const hrs = parseFloat(s);
    if (isNaN(hrs) || hrs <= 0) return null;
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  _tirePsi(key)  { return this._num(key, 0); }
  _tireWarn(key) {
    const v = this._tirePsi(key);
    return v !== null && v < this._config.tire_warn_psi;
  }

  _hasTires() {
    return ['tire_pressure_fl','tire_pressure_fr','tire_pressure_rl','tire_pressure_rr']
      .some(k => this._available(k));
  }

  // Seat heat: handles select entities (Off/Low/Medium/High or 0/1/2/3)
  // and number entities. Returns { level: 0-3, label: string }
  _seatHeat(key) {
    const e = this._e(key);
    if (!e) return null;
    const s = e.state;
    if (!s || s === 'unavailable' || s === 'unknown') return null;
    // Numeric
    const n = parseInt(s);
    if (!isNaN(n)) {
      const labels = ['Off', 'Level 1', 'Level 2', 'Level 3'];
      return { level: Math.min(3, Math.max(0, n)), label: labels[Math.min(3, n)] || 'Off' };
    }
    // String state
    const map = { 'off': 0, 'low': 1, 'medium': 2, 'high': 3, 'level 1': 1, 'level 2': 2, 'level 3': 3 };
    const level = map[s.toLowerCase()] ?? 0;
    return { level, label: level === 0 ? 'Off' : `Level ${level}` };
  }

  _lastUpdated() {
    const e = this._e('battery_level') || this._e('charging_state') || this._e('door_lock');
    if (!e) return null;
    const d = new Date(e.last_updated || e.last_changed);
    if (isNaN(d)) return null;
    const diff = Math.round((Date.now() - d) / 60000);
    if (diff < 1)   return 'just now';
    if (diff === 1) return '1 min ago';
    if (diff < 60)  return `${diff} min ago`;
    return `${Math.round(diff / 60)}h ago`;
  }

  // ── Service calls ────────────────────────────────────────────────────────────

  async _callService(domain, service, data, lockKey) {
    if (this._callInProgress[lockKey]) return;
    this._callInProgress[lockKey] = true;
    try {
      await this._hass.callService(domain, service, data);
    } catch (e) {
      console.warn('tesla-card: service call failed', e);
    }
    setTimeout(() => { this._callInProgress[lockKey] = false; }, 2000);
  }

  _toggleLock() {
    const id = this._config.entities.door_lock;
    if (!id) return;
    this._callService('lock', this._isLocked() ? 'unlock' : 'lock', { entity_id: id }, 'lock');
  }

  _toggleClimate() {
    const id = this._config.entities.climate;
    if (!id) return;
    this._callService('climate', this._climateOn() ? 'turn_off' : 'turn_on', { entity_id: id }, 'climate');
  }

  _adjustTemp(delta) {
    const id = this._config.entities.climate;
    if (!id) return;
    const current = this._targetTemp();
    if (current === null) return;
    const unit = this._config.temp_unit.toUpperCase();
    const min  = unit === 'C' ? 15 : 60;
    const max  = unit === 'C' ? 30 : 85;
    this._callService('climate', 'set_temperature', {
      entity_id: id, temperature: Math.min(max, Math.max(min, current + delta))
    }, 'climate_temp');
  }

  _toggleChargePort() {
    const id = this._config.entities.charge_port;
    if (!id) return;
    // charge port is typically a cover or switch
    const e = this._e('charge_port');
    if (!e) return;
    if (e.entity_id?.startsWith('cover.')) {
      this._callService('cover', this._chargePortOpen() ? 'close_cover' : 'open_cover', { entity_id: id }, 'port');
    } else {
      this._callService('switch', this._chargePortOpen() ? 'turn_off' : 'turn_on', { entity_id: id }, 'port');
    }
  }

  _toggleTrunk() {
    const id = this._config.entities.trunk;
    if (!id) return;
    this._callService('cover', this._trunkOpen() ? 'close_cover' : 'open_cover', { entity_id: id }, 'trunk');
  }

  _toggleSwitch(key, lockKey) {
    const id = this._config.entities[key];
    if (!id) return;
    this._callService('switch', this._isOn(key) ? 'turn_off' : 'turn_on', { entity_id: id }, lockKey);
  }

  _cycleSeatHeat(key, lockKey) {
    const id = this._config.entities[key];
    if (!id) return;
    const current = this._seatHeat(key);
    const level   = current ? current.level : 0;
    const next    = (level + 1) % 4;
    const e       = this._e(key);
    if (!e) return;

    // select entity — use select.select_option
    if (e.attributes.options) {
      const opts   = e.attributes.options;
      const labels = ['Off','Low','Medium','High','Level 1','Level 2','Level 3'];
      // find option matching next level
      const nextLabel = next === 0 ? (opts.find(o => o.toLowerCase() === 'off') || opts[0])
        : (opts.find(o => o.toLowerCase().includes(String(next))) || opts[next] || opts[0]);
      this._callService('select', 'select_option', { entity_id: id, option: nextLabel }, lockKey);
    } else {
      // number entity
      this._callService('number', 'set_value', { entity_id: id, value: next }, lockKey);
    }
  }

  // ── SVG icon library ─────────────────────────────────────────────────────────

  get _icons() {
    return {
      lockClosed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      lockOpen:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
      climate:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
      trunk:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="9" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
      defrostFront:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6l3 6-3 6M21 6l-3 6 3 6"/></svg>`,
      defrostRear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h18M3 12h18M3 16h18"/></svg>`,
      wheel:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/></svg>`,
      steeringWheel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="15" y1="11" x2="22" y2="9"/><line x1="9" y1="11" x2="2" y2="9"/></svg>`,
      seat:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6m-3-3v3M5 10c0-4 2-7 7-7s7 3 7 7v3H5v-3z"/></svg>`,
      plug:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12H3m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm16 0h-2m0 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0M8 7v2m8-2v2M8 15v2m8-2v2"/></svg>`,
      sentry:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      odometer:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
    };
  }

  // ── Tile HTML builder ─────────────────────────────────────────────────────────

  _tile({ icon, state, label, color, bg, border, id }) {
    return `
      <div class="tile" id="${id || ''}" style="background:${bg};border:1px solid ${border}">
        <div class="tile-icon" style="color:${color}">${icon}</div>
        <div>
          <div class="tile-state" style="color:${color}">${state}</div>
          <div class="tile-lbl">${label}</div>
        </div>
      </div>`;
  }

  _tileOff({ icon, state, label, id }) {
    return this._tile({
      icon, state, label, id,
      color:  'rgba(255,255,255,0.35)',
      bg:     'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.1)',
    });
  }

  _tileColored({ icon, state, label, r, g, b, id }) {
    return this._tile({
      icon, state, label, id,
      color:  `rgb(${r},${g},${b})`,
      bg:     `rgba(${r},${g},${b},0.12)`,
      border: `rgba(${r},${g},${b},0.35)`,
    });
  }

  // seat level color helpers
  _seatColor(level) {
    if (level === 0) return null;
    if (level === 3) return { r: 248, g: 113, b: 113 }; // red-ish for max
    return { r: 249, g: 115, b: 22 };                   // orange for 1+2
  }

  // ── Popup ────────────────────────────────────────────────────────────────────

  _openPopup() {
    const overlay = this.shadowRoot.getElementById('tc-overlay');
    const popup   = this.shadowRoot.getElementById('tc-popup');
    if (!overlay || !popup) return;

    const unit       = this._config.temp_unit.toUpperCase();
    const pct        = this._batteryPct();
    const battColor  = this._battColor(pct);
    const range      = this._num('battery_range');
    const charging   = this._isCharging();
    const chargeRate = this._num('charge_rate');
    const ttf        = this._timeToFull();
    const locked     = this._isLocked();
    const trunkOpen  = this._trunkOpen();
    const portOpen   = this._chargePortOpen();
    const sentryOn   = this._sentryOn();
    const climateOn  = this._climateOn();
    const targetTemp = this._targetTemp();
    const frontDef   = this._frontDefrostOn();
    const rearDef    = this._rearDefrostOn();
    const wheelHeat  = this._wheelHeatOn();
    const odometer   = this._num('odometer');
    const hasTires   = this._hasTires();
    const icons      = this._icons;

    const interiorTemp = this._num('interior_temperature');
    const exteriorTemp = this._num('exterior_temperature');

    // ── Battery section ───────────────────────────────────────────────────
    const batterySection = `
      <div class="pop-section">
        <div class="pop-section-lbl">Battery</div>
        <div class="pop-grid-2">
          ${pct !== null ? `<div class="pop-stat"><div class="pop-stat-val" style="color:${battColor}">${pct}<span class="pop-stat-unit">%</span></div><div class="pop-stat-lbl">Charge level</div></div>` : ''}
          ${range !== null ? `<div class="pop-stat"><div class="pop-stat-val">${range}<span class="pop-stat-unit">mi</span></div><div class="pop-stat-lbl">Est. range</div></div>` : ''}
          ${charging && chargeRate !== null ? `<div class="pop-stat"><div class="pop-stat-val" style="color:#60a5fa">+${chargeRate}<span class="pop-stat-unit">mi/hr</span></div><div class="pop-stat-lbl">Charge rate</div></div>` : ''}
          ${charging && ttf ? `<div class="pop-stat"><div class="pop-stat-val" style="color:#4ade80">${ttf}</div><div class="pop-stat-lbl">Full charge ETA</div></div>` : ''}
        </div>
      </div>`;

    // ── Tire section ──────────────────────────────────────────────────────
    const tireSection = hasTires ? `
      <div class="pop-section">
        <div class="pop-section-lbl">Tire Pressure</div>
        <div class="pop-grid-4">
          ${['tire_pressure_fl','tire_pressure_fr','tire_pressure_rl','tire_pressure_rr'].map((k,i) => {
            const v = this._tirePsi(k);
            const w = this._tireWarn(k);
            const lbl = ['FL','FR','RL','RR'][i];
            return `<div class="pop-stat"><div class="pop-stat-val${w?' warn':''}">${v ?? '—'}<span class="pop-stat-unit">psi</span></div><div class="pop-stat-lbl">${lbl}</div></div>`;
          }).join('')}
        </div>
      </div>` : '';

    // ── Temperature section ───────────────────────────────────────────────
    const hasTemps = interiorTemp !== null || exteriorTemp !== null;
    const tempSection = hasTemps ? `
      <div class="pop-section">
        <div class="pop-section-lbl">Temperature</div>
        <div class="pop-grid-2">
          ${interiorTemp !== null ? `<div class="pop-stat"><div class="pop-stat-val">${interiorTemp}<span class="pop-stat-unit">°${unit}</span></div><div class="pop-stat-lbl">Interior</div></div>` : ''}
          ${exteriorTemp !== null ? `<div class="pop-stat"><div class="pop-stat-val">${exteriorTemp}<span class="pop-stat-unit">°${unit}</span></div><div class="pop-stat-lbl">Exterior</div></div>` : ''}
        </div>
      </div>` : '';

    // ── Climate controls section ──────────────────────────────────────────
    const climateItems = [];

    if (this._available('climate')) {
      const tempStr = targetTemp !== null ? `On · ${targetTemp}°${unit}` : 'On';
      climateItems.push(climateOn
        ? this._tileColored({ icon: icons.climate, state: tempStr,  label: 'Climate',       r:249,g:115,b:22,  id:'pop-climate' })
        : this._tileOff({     icon: icons.climate, state: 'Off',    label: 'Climate',                          id:'pop-climate' }));
    }
    if (this._available('front_defrost')) {
      climateItems.push(frontDef
        ? this._tileColored({ icon: icons.defrostFront, state: 'On', label: 'Front defrost', r:96,g:165,b:250, id:'pop-front-defrost' })
        : this._tileOff({     icon: icons.defrostFront, state: 'Off',label: 'Front defrost',                   id:'pop-front-defrost' }));
    }
    if (this._available('rear_defrost')) {
      climateItems.push(rearDef
        ? this._tileColored({ icon: icons.defrostRear, state: 'On', label: 'Rear defrost',  r:96,g:165,b:250,  id:'pop-rear-defrost' })
        : this._tileOff({     icon: icons.defrostRear, state: 'Off',label: 'Rear defrost',                     id:'pop-rear-defrost' }));
    }
    if (this._available('steering_wheel_heat')) {
      climateItems.push(wheelHeat
        ? this._tileColored({ icon: icons.steeringWheel, state: 'On', label: 'Steering heat', r:251,g:191,b:36, id:'pop-wheel' })
        : this._tileOff({     icon: icons.steeringWheel, state: 'Off',label: 'Steering heat',                   id:'pop-wheel' }));
    }

    const climateSection = climateItems.length > 0 ? `
      <div class="pop-section">
        <div class="pop-section-lbl">Climate</div>
        <div class="pop-tiles">${climateItems.join('')}</div>
      </div>` : '';

    // ── Seat heating section ──────────────────────────────────────────────
    const seatItems = [];
    [
      { key: 'seat_heat_driver',    label: 'Driver seat',    id: 'pop-seat-driver' },
      { key: 'seat_heat_passenger', label: 'Passenger seat', id: 'pop-seat-passenger' },
    ].forEach(({ key, label, id }) => {
      if (!this._available(key)) return;
      const s = this._seatHeat(key);
      const level = s ? s.level : 0;
      const lbl   = s ? s.label : 'Off';
      const sc    = this._seatColor(level);
      seatItems.push(sc
        ? this._tileColored({ icon: icons.seat, state: lbl, label, r: sc.r, g: sc.g, b: sc.b, id })
        : this._tileOff({ icon: icons.seat, state: 'Off', label, id }));
    });

    const seatSection = seatItems.length > 0 ? `
      <div class="pop-section">
        <div class="pop-section-lbl">Seat Heating</div>
        <div class="pop-tiles">${seatItems.join('')}</div>
      </div>` : '';

    // ── Vehicle status section ────────────────────────────────────────────
    const vehicleItems = [];

    if (this._available('door_lock')) {
      vehicleItems.push(locked
        ? this._tileColored({ icon: icons.lockClosed, state: 'Locked',   label: 'Doors', r:74,g:222,b:128, id:'pop-lock' })
        : this._tileColored({ icon: icons.lockOpen,   state: 'Unlocked', label: 'Doors', r:251,g:146,b:60,  id:'pop-lock' }));
    }
    if (this._available('trunk')) {
      vehicleItems.push(trunkOpen
        ? this._tileColored({ icon: icons.trunk, state: 'Open',   label: 'Trunk', r:96,g:165,b:250, id:'pop-trunk' })
        : this._tileOff({     icon: icons.trunk, state: 'Closed', label: 'Trunk',                   id:'pop-trunk' }));
    }
    if (this._available('charge_port')) {
      vehicleItems.push(portOpen
        ? this._tileColored({ icon: icons.plug, state: 'Open',   label: 'Charge port', r:96,g:165,b:250, id:'pop-port' })
        : this._tileOff({     icon: icons.plug, state: 'Closed', label: 'Charge port',                   id:'pop-port' }));
    }
    if (this._available('sentry_mode')) {
      vehicleItems.push(sentryOn
        ? this._tileColored({ icon: icons.sentry, state: 'On',  label: 'Sentry mode', r:248,g:113,b:113, id:'pop-sentry' })
        : this._tileOff({     icon: icons.sentry, state: 'Off', label: 'Sentry mode',                    id:'pop-sentry' }));
    }
    if (odometer !== null) {
      vehicleItems.push(this._tile({
        icon: icons.odometer, state: `${Math.round(odometer).toLocaleString()} mi`,
        label: 'Odometer',
        color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)',
      }));
    }

    const vehicleSection = vehicleItems.length > 0 ? `
      <div class="pop-section">
        <div class="pop-section-lbl">Vehicle</div>
        <div class="pop-tiles">${vehicleItems.join('')}</div>
      </div>` : '';

    // ── Assemble popup ────────────────────────────────────────────────────
    popup.innerHTML = `
      <div id="tc-handle"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-size:17px;font-weight:700;color:var(--primary-text-color,white);line-height:1.2">${this._config.name}</div>
          <div style="font-size:11px;color:var(--secondary-text-color,rgba(255,255,255,0.4));margin-top:3px">Vehicle details</div>
        </div>
        <button id="tc-close" style="background:rgba(255,255,255,0.08);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--secondary-text-color,rgba(255,255,255,0.5));font-size:14px;line-height:1;font-family:inherit">✕</button>
      </div>
      <div style="height:1px;background:var(--divider-color,rgba(255,255,255,0.08));margin-bottom:14px"></div>
      ${batterySection}
      ${tireSection}
      ${tempSection}
      ${climateSection}
      ${seatSection}
      ${vehicleSection}
    `;

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this._popupOpen = true;

    popup.querySelector('#tc-close')?.addEventListener('click', () => this._closePopup());
    // Delay attaching the outside-click listener so the tap that opened the
    // popup doesn't immediately bubble up and close it again
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this._closePopup();
    });

    // Lock toggle
    popup.querySelector('#pop-lock')?.addEventListener('click', () => {
      this._toggleLock();
      setTimeout(() => this._refreshPopup(), 300);
    });

    // Trunk toggle
    popup.querySelector('#pop-trunk')?.addEventListener('click', () => {
      this._toggleTrunk();
      setTimeout(() => this._refreshPopup(), 300);
    });

    // Charge port toggle
    popup.querySelector('#pop-port')?.addEventListener('click', () => {
      this._toggleChargePort();
      setTimeout(() => this._refreshPopup(), 300);
    });

    // Climate toggle
    popup.querySelector('#pop-climate')?.addEventListener('click', () => {
      this._toggleClimate();
      setTimeout(() => this._refreshPopup(), 300);
    });

    // Defrost / wheel heat toggles
    popup.querySelector('#pop-front-defrost')?.addEventListener('click', () => {
      this._toggleSwitch('front_defrost', 'front_defrost');
      setTimeout(() => this._refreshPopup(), 300);
    });
    popup.querySelector('#pop-rear-defrost')?.addEventListener('click', () => {
      this._toggleSwitch('rear_defrost', 'rear_defrost');
      setTimeout(() => this._refreshPopup(), 300);
    });
    popup.querySelector('#pop-wheel')?.addEventListener('click', () => {
      this._toggleSwitch('steering_wheel_heat', 'wheel_heat');
      setTimeout(() => this._refreshPopup(), 300);
    });

    // Seat heat cycle
    popup.querySelector('#pop-seat-driver')?.addEventListener('click', () => {
      this._cycleSeatHeat('seat_heat_driver', 'seat_driver');
      setTimeout(() => this._refreshPopup(), 300);
    });
    popup.querySelector('#pop-seat-passenger')?.addEventListener('click', () => {
      this._cycleSeatHeat('seat_heat_passenger', 'seat_passenger');
      setTimeout(() => this._refreshPopup(), 300);
    });

    // Sentry toggle
    popup.querySelector('#pop-sentry')?.addEventListener('click', () => {
      this._toggleSwitch('sentry_mode', 'sentry');
      setTimeout(() => this._refreshPopup(), 300);
    });
  }

  _refreshPopup() {
    if (this._popupOpen) this._openPopup();
  }

  _closePopup() {
    this._popupOpen = false;
    const overlay = this.shadowRoot.getElementById('tc-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  _patch() {
    if (!this._config) return;
    const pct       = this._batteryPct();
    const battColor = this._battColor(pct);
    const range     = this._num('battery_range');
    const charging  = this._isCharging();
    const locked    = this._isLocked();
    const climateOn = this._climateOn();
    const trunkOpen = this._trunkOpen();
    const ttf       = this._timeToFull();

    // Battery fill + pct
    const fill   = this.shadowRoot.querySelector('.batt-fill');
    const pctEl  = this.shadowRoot.querySelector('.batt-pct');
    const rangeEl = this.shadowRoot.querySelector('.batt-range');
    const etaEl  = this.shadowRoot.querySelector('.eta');
    if (fill)    { fill.style.width = `${pct ?? 0}%`; fill.style.background = battColor; }
    if (pctEl)   { pctEl.textContent = `${pct}%`; pctEl.style.color = battColor; }
    if (rangeEl) rangeEl.textContent = range !== null ? `${range} mi` : '';

    // Badges — just update text/visibility
    const lockBadge   = this.shadowRoot.querySelector('.badge-locked, .badge-unlocked');
    const chargeBadge = this.shadowRoot.querySelector('.badge-charging');
    if (lockBadge) {
      lockBadge.className = `badge ${locked ? 'badge-locked' : 'badge-unlocked'}`;
      lockBadge.textContent = locked ? 'LOCKED' : 'UNLOCKED';
    }

    // Buttons
    const OFF_STYLE  = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12)';
    const OFF_COLOR  = 'rgba(255,255,255,0.28)';
    const OFF_LCOLOR = 'rgba(255,255,255,0.38)';

    const lockBtn = this.shadowRoot.getElementById('tc-lock');
    if (lockBtn) {
      lockBtn.style.cssText = locked ? 'background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.6)' : OFF_STYLE;
      const ico = lockBtn.querySelector('.btn-icon'), lbl = lockBtn.querySelector('.btn-label');
      if (ico) { ico.style.color = locked ? '#4ade80' : OFF_COLOR; ico.innerHTML = this._icons[locked ? 'lockClosed' : 'lockOpen']; }
      if (lbl) { lbl.style.color = locked ? '#4ade80' : OFF_LCOLOR; lbl.textContent = locked ? 'Locked' : 'Unlocked'; }
    }
    const climateBtn = this.shadowRoot.getElementById('tc-climate');
    if (climateBtn) {
      climateBtn.style.cssText = climateOn ? 'background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.6)' : OFF_STYLE;
      const ico = climateBtn.querySelector('.btn-icon'), lbl = climateBtn.querySelector('.btn-label');
      if (ico) ico.style.color = climateOn ? '#f97316' : OFF_COLOR;
      if (lbl) { lbl.style.color = climateOn ? '#f97316' : OFF_LCOLOR; lbl.textContent = climateOn ? 'Climate on' : 'Climate'; }
    }
    const trunkBtn = this.shadowRoot.getElementById('tc-trunk');
    if (trunkBtn) {
      trunkBtn.style.cssText = trunkOpen ? 'background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.6)' : OFF_STYLE;
      const ico = trunkBtn.querySelector('.btn-icon'), lbl = trunkBtn.querySelector('.btn-label');
      if (ico) ico.style.color = trunkOpen ? '#60a5fa' : OFF_COLOR;
      if (lbl) { lbl.style.color = trunkOpen ? '#60a5fa' : OFF_LCOLOR; lbl.textContent = trunkOpen ? 'Trunk open' : 'Trunk'; }
    }

    // If popup is open, patch it too
    if (this._popupOpen) this._renderPopup();
  }

  _render() {
    if (!this._config) return;

    const cfg        = this._config;
    const ents       = cfg.entities;
    const pct        = this._batteryPct();
    const battColor  = this._battColor(pct);
    const range      = this._num('battery_range');
    const charging   = this._isCharging();
    const locked     = this._isLocked();
    const climateOn  = this._climateOn();
    const targetTemp = this._targetTemp();
    const trunkOpen  = this._trunkOpen();
    const ttf        = this._timeToFull();
    const updated    = this._lastUpdated();
    const unit       = cfg.temp_unit.toUpperCase();
    const tempDisplay = targetTemp !== null ? `${targetTemp}°${unit}` : '—';
    const icons      = this._icons;

    // ── Battery + range + ETA (top-right) ────────────────────────────────
    const battLine = pct !== null ? `
      <div class="batt-range-row">
        <div class="batt-wrap">
          <div class="batt-shell">
            <div class="batt-fill" style="width:${pct}%;background:${battColor}"></div>
          </div>
          <div class="batt-nub"></div>
        </div>
        <div class="batt-pct" style="color:${battColor}">${pct}%</div>
        ${range !== null ? `<div class="sep">·</div><div class="batt-range">${range} mi</div>` : ''}
        ${charging && ttf ? `<div class="sep">·</div><div class="eta">${ttf}</div>` : ''}
      </div>` : '';

    // ── Badges ────────────────────────────────────────────────────────────
    const lockBadge = ents.door_lock && this._available('door_lock')
      ? `<span class="badge ${locked ? 'badge-locked' : 'badge-unlocked'}">${locked ? 'LOCKED' : 'UNLOCKED'}</span>` : '';
    const chargeBadge = ents.charging_state && charging
      ? `<span class="badge badge-charging">CHARGING</span>` : '';
    const badgesHtml = (lockBadge || chargeBadge)
      ? `<div class="badges">${lockBadge}${chargeBadge}</div>` : '';

    // ── Control buttons ───────────────────────────────────────────────────
    const OFF_STYLE  = `background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12)`;
    const OFF_COLOR  = `rgba(255,255,255,0.28)`;
    const OFF_LCOLOR = `rgba(255,255,255,0.38)`;

    const lockBtn = ents.door_lock ? `
      <button class="action-btn" id="tc-lock" style="${locked ? 'background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.6)' : OFF_STYLE}">
        <div class="btn-icon" style="color:${locked ? '#4ade80' : OFF_COLOR}">${icons[locked ? 'lockClosed' : 'lockOpen']}</div>
        <div class="btn-label" style="color:${locked ? '#4ade80' : OFF_LCOLOR}">${locked ? 'Locked' : 'Unlocked'}</div>
      </button>` : '';

    const climateBtn = ents.climate ? `
      <button class="action-btn" id="tc-climate" style="${climateOn ? 'background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.6)' : OFF_STYLE}">
        <div class="btn-icon" style="color:${climateOn ? '#f97316' : OFF_COLOR}">${icons.climate}</div>
        <div class="btn-label" style="color:${climateOn ? '#f97316' : OFF_LCOLOR}">${climateOn ? 'Climate on' : 'Climate'}</div>
      </button>` : '';

    const trunkBtn = ents.trunk ? `
      <button class="action-btn" id="tc-trunk" style="${trunkOpen ? 'background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.6)' : OFF_STYLE}">
        <div class="btn-icon" style="color:${trunkOpen ? '#60a5fa' : OFF_COLOR}">${icons.trunk}</div>
        <div class="btn-label" style="color:${trunkOpen ? '#60a5fa' : OFF_LCOLOR}">${trunkOpen ? 'Trunk open' : 'Trunk'}</div>
      </button>` : '';

    const showActions  = cfg.show_actions !== false;
    const controlBtns  = showActions ? [lockBtn, climateBtn, trunkBtn].filter(Boolean) : [];
    const controlsHtml = controlBtns.length > 0
      ? `<div class="actions" style="grid-template-columns:repeat(${controlBtns.length},1fr)">${controlBtns.join('')}</div>` : '';

    const climateExtra = (showActions && ents.climate && climateOn && targetTemp !== null) ? `
      <div class="climate-extra">
        <div class="temp-lbl">Target temp</div>
        <div class="temp-stepper">
          <button class="temp-btn" id="tc-temp-down">−</button>
          <div class="temp-val">${tempDisplay}</div>
          <button class="temp-btn" id="tc-temp-up">+</button>
        </div>
      </div>` : '';

    // ── Full render ───────────────────────────────────────────────────────
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 12px 14px 16px;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
          color: var(--primary-text-color);
        }

        /* ── Top row — full area tappable ── */
        .top-row {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          margin-bottom: 12px;
          cursor: pointer; border-radius: 10px; padding: 6px 8px; margin: -6px -8px 6px;
          transition: background 0.12s; -webkit-tap-highlight-color: transparent;
        }
        .top-row:active { background: rgba(255,255,255,0.06); }
        .car-name  { font-size: 17px; font-weight: 600; color: var(--primary-text-color); line-height: 1.1; letter-spacing: -0.2px; }
        .car-sub   { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; font-weight: 500; opacity: 0.7; }
        .top-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

        /* ── Battery row ── */
        .batt-range-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
        .batt-wrap  { display: flex; align-items: center; }
        .batt-shell {
          width: 64px; height: 8px; border-radius: 99px;
          background: var(--divider-color, rgba(255,255,255,0.08));
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          position: relative; overflow: hidden; flex-shrink: 0;
        }
        .batt-fill  { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; transition: width 0.6s ease; }
        .batt-nub   { width: 5px; height: 14px; background: var(--divider-color, rgba(255,255,255,0.15)); border-radius: 0 2px 2px 0; margin-left: -1px; flex-shrink: 0; }
        .batt-pct   { font-size: 13px; font-weight: 700; white-space: nowrap; }
        .sep        { font-size: 11px; color: var(--secondary-text-color); opacity: 0.35; }
        .batt-range { font-size: 13px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; opacity: 0.7; }
        .eta        { font-size: 13px; font-weight: 600; color: #4ade80; white-space: nowrap; }

        /* ── Badges ── */
        .badges { display: flex; flex-direction: row; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
        .badge  { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; padding: 3px 8px; border-radius: 99px; border: 1px solid; white-space: nowrap; }
        .badge-locked   { color: #4ade80; border-color: rgba(74,222,128,0.45);  background: rgba(74,222,128,0.08); }
        .badge-unlocked { color: #fb923c; border-color: rgba(251,146,60,0.45);  background: rgba(251,146,60,0.08); }
        .badge-charging { color: #60a5fa; border-color: rgba(96,165,250,0.45);  background: rgba(96,165,250,0.08); }

        /* ── Action buttons ── */
        .actions { display: grid; gap: 8px; }
        .action-btn {
          border-radius: 12px; padding: 10px 8px;
          cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 7px;
          outline: none; -webkit-tap-highlight-color: transparent;
          transition: filter 0.15s, transform 0.1s; width: 100%;
        }
        .action-btn:active { transform: scale(0.96); filter: brightness(0.92); }
        .btn-icon  { width: 20px; height: 20px; flex-shrink: 0; }
        .btn-icon svg { width: 100%; height: 100%; }
        .btn-label { font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }

        /* ── Climate temp adjuster ── */
        .climate-extra { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--divider-color, rgba(255,255,255,0.07)); }
        .temp-stepper  { display: flex; align-items: center; }
        .temp-btn {
          width: 44px; height: 44px; border-radius: 10px;
          border: 1px solid var(--divider-color, rgba(255,255,255,0.1));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          color: var(--primary-text-color); font-size: 20px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          outline: none; -webkit-tap-highlight-color: transparent; transition: background 0.12s;
        }
        .temp-btn:active { background: rgba(255,255,255,0.15); transform: scale(0.95); }
        .temp-val { font-size: 17px; font-weight: 600; color: #f97316; min-width: 54px; text-align: center; letter-spacing: -0.5px; }
        .temp-lbl { font-size: 10px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.65; }

        /* ── Popup — bottom sheet mobile, centered modal desktop ── */
        #tc-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          align-items: flex-end; justify-content: center;
          z-index: 9999; box-sizing: border-box; padding: 0;
        }
        #tc-popup {
          background: var(--card-background-color, #1e1e1e);
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 16px 16px 0 0; border-bottom: none;
          padding: 20px; box-sizing: border-box;
          overflow-y: auto; max-height: 85vh;
          width: 100%; max-width: 100%;
          touch-action: pan-y; overscroll-behavior: contain;
        }
        #tc-handle {
          width: 36px; height: 4px;
          background: rgba(255,255,255,0.15); border-radius: 2px;
          margin: 0 auto 16px;
        }
        @media (min-width: 768px) {
          #tc-overlay { align-items: center; justify-content: center; padding: 24px; }
          #tc-popup { width: 100%; max-width: 440px; border-radius: 16px; border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12)); }
          #tc-handle { display: none; }
        }

        /* ── Popup internals ── */
        .pop-section { margin-bottom: 16px; }
        .pop-section:last-child { margin-bottom: 0; }
        .pop-section-lbl {
          font-size: 9px; font-weight: 700; color: var(--secondary-text-color);
          text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; margin-bottom: 8px;
        }
        .pop-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pop-grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
        .pop-stat {
          background: var(--secondary-background-color, rgba(255,255,255,0.04));
          border: 1px solid var(--divider-color, rgba(255,255,255,0.07));
          border-radius: 10px; padding: 10px 10px 8px;
        }
        .pop-stat-val { font-size: 18px; font-weight: 600; color: var(--primary-text-color); letter-spacing: -0.5px; line-height: 1; }
        .pop-stat-val.warn { color: #facc15; }
        .pop-stat-unit { font-size: 10px; font-weight: 500; opacity: 0.55; margin-left: 1px; }
        .pop-stat-lbl { font-size: 9px; font-weight: 600; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; opacity: 0.6; }

        /* ── Tiles ── */
        .pop-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .tile {
          border-radius: 10px; padding: 12px;
          display: flex; align-items: center; gap: 10px;
          min-height: 60px; cursor: pointer;
          transition: filter 0.15s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
        }
        .tile:active { transform: scale(0.96); filter: brightness(0.9); }
        .tile-icon { width: 20px; height: 20px; flex-shrink: 0; }
        .tile-icon svg { width: 100%; height: 100%; }
        .tile-state { font-size: 13px; font-weight: 600; line-height: 1.2; }
        .tile-lbl   { font-size: 10px; font-weight: 500; color: var(--secondary-text-color); margin-top: 2px; opacity: 0.6; }
      </style>

      <ha-card>
        <div class="top-row" id="tc-stats-tap">
          <div>
            <div class="car-name">${cfg.name}</div>
            ${updated ? `<div class="car-sub">Updated ${updated}</div>` : ''}
          </div>
          <div class="top-right">
            ${battLine}
            ${badgesHtml}
          </div>
        </div>

        ${controlsHtml}
        ${climateExtra}
      </ha-card>

      <div id="tc-overlay">
        <div id="tc-popup"></div>
      </div>`;

    // ── Event listeners ───────────────────────────────────────────────────
    this.shadowRoot.getElementById('tc-stats-tap')
      ?.addEventListener('click', () => this._openPopup());
    this.shadowRoot.getElementById('tc-lock')
      ?.addEventListener('click', () => this._toggleLock());
    this.shadowRoot.getElementById('tc-climate')
      ?.addEventListener('click', () => this._toggleClimate());
    this.shadowRoot.getElementById('tc-trunk')
      ?.addEventListener('click', () => this._toggleTrunk());
    this.shadowRoot.getElementById('tc-temp-down')
      ?.addEventListener('click', (e) => { e.stopPropagation(); this._adjustTemp(-1); });
    this.shadowRoot.getElementById('tc-temp-up')
      ?.addEventListener('click', (e) => { e.stopPropagation(); this._adjustTemp(1); });

    // Restore popup if a state update fired while it was open
    if (this._popupOpen) {
      this._openPopup();
    }
  }
}

customElements.define('tesla-card', TeslaCard);