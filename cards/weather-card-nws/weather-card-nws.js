/**
 * weather-card-nws.js  —  v10
 * Home Assistant Lovelace weather card — NWS / any weather entity.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/weather-card-nws.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/weather-card-nws.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:weather-card-nws
 * entity: weather.home           # required
 * name: Home                     # optional — overrides friendly_name
 * unit: °F                       # optional — overrides entity unit
 * alert_entity: sensor.nws_alert # optional — shows alert row when active
 * tap_action: popup              # popup (default) | none
 *
 * ── FEATURES ──────────────────────────────────────────────────────────────────
 * • Current conditions: icon, condition label, temperature, feels-like
 * • Metrics row: rain chance, wind speed/direction, alert status
 * • Alert banner when alert_entity is active
 * • 7-day forecast strip (collapsed to twice_daily subscription)
 * • Tap → detail popup with:
 *     - Current conditions grid (humidity, dewpoint, UV, visibility, pressure, cloud cover)
 *     - Hourly forecast strip (scrollable, 12 hours)
 *     - 7-day extended with hi/lo and precipitation bar
 * • Mobile: bottom sheet popup  •  Desktop ≥768px: centered modal
 */

class WeatherCardUnified extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config      = {};
    this._hass        = null;
    this._unsub       = null;
    this._forecast    = null;
    this._subscribed  = false;
    this._popupOpen   = false;
    // hourly subscription
    this._unsubHourly = null;
    this._forecastHourly = null;
    this._subscribedHourly = false;
  }

  static getStubConfig() { return { entity: 'weather.home' }; }

  setConfig(config) {
    if (!config.entity) throw new Error('Please define a weather entity');
    this._config = config;
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this._subscribed) {
      this._subscribed = true;
      this._subscribe();
    }
    if (!this._subscribedHourly) {
      this._subscribedHourly = true;
      this._subscribeHourly();
    }
    if (!this.shadowRoot.querySelector('.cur') || !prev) { this._render(); return; }
    this._patch();
  }

  disconnectedCallback() {
    if (this._unsub)       { try { this._unsub();       } catch (_) {} this._unsub       = null; }
    if (this._unsubHourly) { try { this._unsubHourly(); } catch (_) {} this._unsubHourly = null; }
    this._subscribed       = false;
    this._subscribedHourly = false;
    this._popupOpen        = false;
  }

  // ── Forecast subscriptions ───────────────────────────────────────────────────

  async _subscribe() {
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        msg => {
          if (!msg.forecast?.length) return;
          const byDate = {};
          msg.forecast.forEach(e => {
            const d = (e.datetime || '').slice(0, 10);
            if (!d) return;
            if (!byDate[d] || e.is_daytime === true) byDate[d] = e;
          });
          this._forecast = Object.values(byDate).slice(0, 7);
          this._render();
        },
        {
          type:          'weather/subscribe_forecast',
          forecast_type: 'twice_daily',
          entity_id:     this._config.entity,
        }
      );
    } catch (e) {
      console.warn('weather-card-nws: twice_daily subscription error', e);
    }
  }

  async _subscribeHourly() {
    try {
      this._unsubHourly = await this._hass.connection.subscribeMessage(
        msg => {
          if (!msg.forecast?.length) return;
          this._forecastHourly = msg.forecast.slice(0, 12);
          if (this._popupOpen) this._renderPopup();
        },
        {
          type:          'weather/subscribe_forecast',
          forecast_type: 'hourly',
          entity_id:     this._config.entity,
        }
      );
    } catch (e) {
      // hourly not available on all integrations — silently skip
      console.info('weather-card-nws: hourly forecast not available', e);
    }
  }

  getCardSize() { return 4; }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _compass(deg) {
    if (deg == null) return null;
    return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
  }

  _condition(state) {
    const s = (state || '').toLowerCase();
    if (s.includes('sunny') || s === 'clear-day')
      return { color: '#fbbf24', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>` };
    if (s.includes('clear-night') || s.includes('night'))
      return { color: '#818cf8', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>` };
    if (s.includes('partlycloudy') || s.includes('partly'))
      return { color: '#f59e0b', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2"/><circle cx="10" cy="10" r="3"/><path d="M19 13a4 4 0 0 0-4-4 5 5 0 0 0-5 5H5a3 3 0 0 0 0 6h14a3 3 0 0 0 0-6z"/></svg>` };
    if (s.includes('lightning') || s.includes('thunder'))
      return { color: '#facc15', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>` };
    if (s.includes('snow') || s.includes('sleet') || s.includes('hail'))
      return { color: '#7dd3fc', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="20" x2="8" y2="24"/><line x1="16" y1="20" x2="16" y2="24"/><line x1="12" y1="22" x2="12" y2="26"/></svg>` };
    if (s.includes('pouring') || s.includes('heavy') || s.includes('storm'))
      return { color: '#7c3aed', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/></svg>` };
    if (s.includes('rain') || s.includes('drizzle') || s.includes('shower'))
      return { color: '#60a5fa', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/></svg>` };
    if (s.includes('wind'))
      return { color: '#38bdf8', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>` };
    if (s.includes('fog') || s.includes('haze') || s.includes('mist'))
      return { color: '#cbd5e1', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="5" y1="16" x2="19" y2="16"/></svg>` };
    return { color: '#94a3b8', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>` };
  }

  _label(state) {
    if (!state) return 'Unknown';
    return state.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  _dayName(dateStr, i) {
    if (i === 0) return 'Today';
    if (i === 1) return 'Tmrw';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  }

  _fmt(v) { return v != null ? `${Math.round(v)}` : '—'; }

  _getAlert() {
    const ae = this._config.alert_entity;
    if (!ae || !this._hass) return null;
    const e = this._hass.states[ae];
    if (!e) return null;
    const s = e.state;
    if (!s || ['off','none','clear','unknown','unavailable','0'].includes(s.toLowerCase())) return null;
    return e.attributes.message || e.attributes.event || e.attributes.title || s;
  }

  _formatHour(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric', hour12: true,
    }).replace(' ', '').toLowerCase();
  }

  // ── Popup ────────────────────────────────────────────────────────────────────

  _openPopup() {
    if ((this._config.tap_action || 'popup') === 'none') return;
    const overlay = this.shadowRoot.getElementById('wc-overlay');
    if (!overlay) return;
    this._popupOpen = true;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this._renderPopup();
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this._closePopup();
    });
  }

  _closePopup() {
    this._popupOpen = false;
    const overlay = this.shadowRoot.getElementById('wc-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  _renderPopup() {
    const popup = this.shadowRoot.getElementById('wc-popup');
    if (!popup) return;

    const entity = this._hass?.states[this._config.entity];
    if (!entity) return;

    const attr      = entity.attributes;
    const state     = entity.state;
    const name      = this._config.name || attr.friendly_name || 'Weather';
    const tempUnit  = attr.temperature_unit || this._config.unit || '°F';
    const alert     = this._getAlert();

    // ── Current conditions grid ──────────────────────────────────────────────
    const condItems = [
      { label: 'Humidity',     val: attr.humidity      != null ? `${Math.round(attr.humidity)}%`         : '—' },
      { label: 'Dewpoint',     val: attr.dew_point     != null ? `${Math.round(attr.dew_point)}${tempUnit}` : '—' },
      { label: 'UV Index',     val: attr.uv_index      != null ? `${Math.round(attr.uv_index)}`          : '—' },
      { label: 'Visibility',   val: attr.visibility    != null ? `${Math.round(attr.visibility)} ${attr.visibility_unit || 'mi'}` : '—' },
      { label: 'Pressure',     val: attr.pressure      != null ? `${Math.round(attr.pressure * 10) / 10} ${attr.pressure_unit || 'inHg'}` : '—' },
      { label: 'Cloud Cover',  val: attr.cloud_coverage != null ? `${Math.round(attr.cloud_coverage)}%`  : '—' },
    ];

    const condGrid = condItems.map(c => `
      <div class="pop-stat">
        <div class="pop-stat-val">${c.val}</div>
        <div class="pop-stat-lbl">${c.label}</div>
      </div>`).join('');

    // ── Hourly strip ─────────────────────────────────────────────────────────
    let hourlyHtml = '';
    const hourly = this._forecastHourly;
    if (hourly?.length) {
      hourlyHtml = `
        <div class="pop-sec-lbl">Hourly</div>
        <div class="pop-hourly">
          ${hourly.map(h => {
            const { svg, color } = this._condition(h.condition || state);
            const t    = h.temperature ?? h.temp ?? null;
            const rain = h.precipitation_probability ?? null;
            const time = this._formatHour(h.datetime);
            return `<div class="hr-cell">
              <div class="hr-time">${time}</div>
              <div class="hr-ico" style="color:${color}">${svg}</div>
              <div class="hr-temp">${this._fmt(t)}°</div>
              ${rain != null ? `<div class="hr-rain">${Math.round(rain)}%</div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
    }

    // ── 7-day extended ───────────────────────────────────────────────────────
    let extHtml = '';
    const forecast = this._forecast || [];
    if (forecast.length) {
      extHtml = `
        <div class="pop-sec-lbl">7-day forecast</div>
        <div class="pop-extended">
          ${forecast.map((day, i) => {
            const hi   = day.temperature ?? null;
            const lo   = day.templow ?? day.temperature_low ?? null;
            const rain = day.precipitation_probability ?? null;
            const { svg, color } = this._condition(day.condition || state);
            return `<div class="ext-row">
              <div class="ext-day">${this._dayName(day.datetime, i)}</div>
              <div class="ext-ico" style="color:${color}">${svg}</div>
              <div class="ext-precip">
                ${rain != null ? `<span class="ext-rain">${Math.round(rain)}%</span>
                <div class="ext-bar-bg"><div class="ext-bar-fill" style="width:${Math.round(rain)}%"></div></div>` : ''}
              </div>
              <div class="ext-temps">
                <span class="ext-hi">${this._fmt(hi)}°</span>
                ${lo != null ? `<span class="ext-lo">${this._fmt(lo)}°</span>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>`;
    }

    // ── Alert banner ─────────────────────────────────────────────────────────
    const alertHtml = alert ? `
      <div class="pop-alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0;margin-top:1px">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        ${alert}
      </div>` : '';

    popup.innerHTML = `
      <div id="wc-handle"></div>
      <div class="pop-head">
        <div>
          <div class="pop-title">Detailed Forecast</div>
          <div class="pop-sub">${name}</div>
        </div>
        <button id="wc-close">✕</button>
      </div>
      <div class="pop-divider"></div>
      ${alertHtml}
      <div class="pop-sec-lbl">Current conditions</div>
      <div class="pop-cond-grid">${condGrid}</div>
      ${hourlyHtml}
      ${extHtml}`;

    popup.querySelector('#wc-close')?.addEventListener('click', () => this._closePopup());
  }

  // ── Main card render ──────────────────────────────────────────────────────────

  _patch() {
    if (!this._config || !this._hass) return;
    const entity = this._hass.states[this._config.entity];
    if (!entity) { this._render(); return; }

    const attr      = entity.attributes;
    const state     = entity.state;
    const temp      = attr.temperature;
    const feelsLike = attr.apparent_temperature ?? attr.feels_like ?? attr.wind_chill ?? null;
    const tempUnit  = attr.temperature_unit || this._config.unit || '°F';
    const windSpeed = attr.wind_speed;
    const windDir   = this._compass(attr.wind_bearing);
    const windUnit  = attr.wind_speed_unit || attr.wind_speed_units || 'mph';
    const alert     = this._getAlert();
    const { svg: mainSvg, color: mainColor } = this._condition(state);

    // Temperature
    const tempEl = this.shadowRoot.querySelector('.temp');
    if (tempEl) tempEl.textContent = temp != null ? `${this._fmt(temp)}${tempUnit}` : '—';

    // Condition icon + text
    const icoEl  = this.shadowRoot.querySelector('.ico');
    const condEl = this.shadowRoot.querySelector('.cond');
    if (icoEl)  icoEl.innerHTML = `<svg ...>${mainSvg}</svg>`;
    if (condEl) { condEl.textContent = this._label(state); condEl.style.color = mainColor; }

    // Feels like
    const feelsEl = this.shadowRoot.querySelector('.feels span');
    if (feelsEl && feelsLike != null) feelsEl.textContent = `${this._fmt(feelsLike)}${tempUnit}`;

    // Wind
    const windEl = this.shadowRoot.querySelector('.wind-val');
    if (windEl && windSpeed != null) windEl.textContent = `${Math.round(windSpeed)} ${windUnit} ${windDir}`;

    // Alert banner — show/hide
    const alertEl = this.shadowRoot.querySelector('.alert');
    const hasAlert = !!alert;
    if (hasAlert && !alertEl) { this._render(); return; }  // structure change
    if (!hasAlert && alertEl) { this._render(); return; }
    if (alertEl && alert) alertEl.querySelector('span') && (alertEl.querySelector('span').textContent = alert);

    // Forecast strip (forecast data comes from subscription, update separately)
    const forecast = this._forecast || [];
    const fcstEl   = this.shadowRoot.querySelector('.fcst');
    if (fcstEl && forecast.length) {
      fcstEl.innerHTML = forecast.map((day, i) => {
        const hi = day.temperature ?? null;
        const lo = day.templow ?? day.temperature_low ?? null;
        const { svg, color } = this._condition(day.condition || state);
        return `<div class="dc">
          <div class="dn">${this._dayName(day.datetime, i)}</div>
          <div class="di" style="color:${color}">${svg}</div>
          <div class="dhi">${this._fmt(hi)}°</div>
          ${lo != null ? `<div class="dlo">${this._fmt(lo)}°</div>` : ''}
        </div>`;
      }).join('');
    }
  }

  _render() {
    if (!this._config || !this._hass) return;

    const entity = this._hass.states[this._config.entity];
    if (!entity) {
      this.shadowRoot.innerHTML = `<div style="padding:16px;font-size:13px;color:var(--secondary-text-color)">Entity not found: ${this._config.entity}</div>`;
      return;
    }

    const attr     = entity.attributes;
    const state    = entity.state;
    const name     = this._config.name || attr.friendly_name || 'Weather';
    const temp     = attr.temperature;
    const feelsLike = attr.apparent_temperature ?? attr.feels_like ?? attr.wind_chill ?? null;
    const tempUnit  = attr.temperature_unit || this._config.unit || '°F';
    const windSpeed = attr.wind_speed;
    const windDir   = this._compass(attr.wind_bearing);
    const windUnit  = attr.wind_speed_unit || attr.wind_speed_units || 'mph';
    const alert     = this._getAlert();
    const tapAction = this._config.tap_action ?? 'popup';

    const { svg: mainSvg, color: mainColor } = this._condition(state);
    const forecast = this._forecast || [];

    const rainChance = attr.precipitation_probability
      ?? forecast[0]?.precipitation_probability
      ?? null;

    const forecastHtml = forecast.length > 0
      ? forecast.map((day, i) => {
          const hi = day.temperature ?? null;
          const lo = day.templow ?? day.temperature_low ?? null;
          const { svg, color } = this._condition(day.condition || state);
          return `<div class="dc">
            <div class="dn">${this._dayName(day.datetime, i)}</div>
            <div class="di" style="color:${color}">${svg}</div>
            <div class="dhi">${this._fmt(hi)}°</div>
            ${lo != null ? `<div class="dlo">${this._fmt(lo)}°</div>` : ''}
          </div>`;
        }).join('')
      : `<div class="no-fc">Loading…</div>`;

    const tapCursor  = tapAction !== 'none' ? '-webkit-tap-highlight-color:transparent;cursor:pointer' : '';
    const tapHint    = '';  // hint label removed

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 18px 14px 14px;
          box-sizing: border-box;
          ${tapCursor}
        }
        .cur { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px }
        .cur-l { display:flex;align-items:center;gap:13px }
        .ico { width:42px;height:42px;flex-shrink:0 }
        .ico svg { width:100%;height:100% }
        .cond { font-size:22px;font-weight:500;color:var(--primary-text-color);letter-spacing:-0.3px;line-height:1.1 }
        .loc  { font-size:12px;font-weight:500;color:var(--secondary-text-color);margin-top:2px }
        .cur-r { text-align:right }
        .temp  { font-size:38px;font-weight:400;letter-spacing:-1.5px;color:var(--primary-text-color);line-height:1 }
        .feels { font-size:12px;font-weight:500;color:var(--secondary-text-color);margin-top:4px }
        .feels span { color:var(--primary-text-color) }
        .mets { display:flex;align-items:center;margin-bottom:16px }
        .met  { flex:1;display:flex;align-items:center;gap:9px }
        .met+.met { border-left:1px solid var(--divider-color,rgba(255,255,255,0.18));padding-left:14px;margin-left:10px }
        .mi { width:18px;height:18px;flex-shrink:0 }
        .mi svg { width:100%;height:100% }
        .mv  { font-size:14px;font-weight:600;line-height:1.15;color:var(--primary-text-color) }
        .mv.dim { color:var(--secondary-text-color);font-weight:500 }
        .mv.red { color:#f87171 }
        .ml  { font-size:10px;font-weight:500;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:0.06em;opacity:0.65;margin-top:1px }
        .alert { margin-bottom:16px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.45);border-radius:9px;padding:9px 13px;display:flex;align-items:flex-start;gap:9px;font-size:12.5px;font-weight:500;line-height:1.5;color:#fca5a5 }
        .alert svg { width:15px;height:15px;flex-shrink:0;margin-top:1px;stroke:#f87171 }
        .div  { height:1px;background:var(--divider-color,rgba(255,255,255,0.09));margin-bottom:16px }
        .fcst { display:grid;grid-template-columns:repeat(7,1fr);gap:2px }
        .dc   { display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 2px }
        .dc+.dc { border-left:1px solid var(--divider-color,rgba(255,255,255,0.18)) }
        .dn   { font-size:10.5px;font-weight:600;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:0.06em }
        .di   { width:20px;height:20px }
        .di svg { width:100%;height:100% }
        .dhi  { font-size:14px;font-weight:600;color:var(--primary-text-color) }
        .dlo  { font-size:12px;font-weight:500;color:var(--secondary-text-color) }
        .no-fc { font-size:11px;color:var(--secondary-text-color);grid-column:1/-1;padding:4px 0 }
        .tap-hint { font-size:10.5px;font-weight:500;color:var(--secondary-text-color);opacity:0.4;text-align:center;margin-top:12px;letter-spacing:0.04em }

        /* ── Popup overlay ── */
        #wc-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 9999;
          box-sizing: border-box;
          align-items: flex-end;
          justify-content: center;
        }
        #wc-popup {
          background: var(--card-background-color, #1e1e2a);
          border: 1px solid var(--divider-color, rgba(255,255,255,0.22));
          border-radius: 16px 16px 0 0;
          border-bottom: none;
          padding: 20px;
          width: 100%;
          max-height: 82vh;
          overflow-y: auto;
          overscroll-behavior: contain;
          touch-action: pan-y;
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        #wc-popup::-webkit-scrollbar { width: 4px; }
        #wc-popup::-webkit-scrollbar-track { background: transparent; }
        #wc-popup::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        @media (min-width: 768px) {
          #wc-overlay { align-items: center; justify-content: center; padding: 24px; }
          #wc-popup {
            max-width: 440px; border-radius: 16px;
            border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.22));
          }
          #wc-handle { display: none !important; }
        }

        /* ── Popup internals ── */
        #wc-handle {
          width: 36px; height: 4px;
          background: rgba(255,255,255,0.15); border-radius: 2px;
          margin: 0 auto 16px;
        }
        .pop-head {
          display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;
        }
        .pop-title { font-size:17px;font-weight:700;color:var(--primary-text-color);line-height:1.2 }
        .pop-sub   { font-size:11px;color:var(--secondary-text-color);margin-top:3px }
        #wc-close {
          background:rgba(255,255,255,0.18);border:none;border-radius:50%;
          width:28px;height:28px;cursor:pointer;display:flex;align-items:center;
          justify-content:center;color:var(--secondary-text-color);font-size:14px;
          line-height:1;font-family:inherit;flex-shrink:0;
        }
        .pop-divider { height:1px;background:var(--divider-color,rgba(255,255,255,0.09));margin-bottom:14px }
        .pop-sec-lbl {
          font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;
          color:var(--secondary-text-color);opacity:0.5;margin-bottom:9px;
        }

        /* Conditions grid */
        .pop-cond-grid { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px }
        .pop-stat { background:rgba(255,255,255,0.04);border-radius:10px;padding:11px }
        .pop-stat-val { font-size:18px;font-weight:700;color:var(--primary-text-color);line-height:1 }
        .pop-stat-lbl { font-size:10px;font-weight:600;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.06em;margin-top:4px;opacity:.7 }

        /* Alert in popup */
        .pop-alert {
          display:flex;align-items:flex-start;gap:9px;
          background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.45);
          border-radius:9px;padding:9px 13px;margin-bottom:14px;
          font-size:12.5px;font-weight:500;line-height:1.5;color:#fca5a5;
        }

        /* Hourly strip */
        .pop-hourly {
          display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;
          margin-bottom:18px;scrollbar-width:none;
        }
        .pop-hourly::-webkit-scrollbar { display:none }
        .hr-cell {
          display:flex;flex-direction:column;align-items:center;gap:4px;
          padding:9px 9px;background:rgba(255,255,255,0.04);
          border-radius:9px;flex-shrink:0;min-width:50px;
        }
        .hr-time { font-size:10px;font-weight:600;color:var(--secondary-text-color);text-transform:uppercase }
        .hr-ico  { width:16px;height:16px }
        .hr-ico svg { width:100%;height:100% }
        .hr-temp { font-size:14px;font-weight:700;color:var(--primary-text-color) }
        .hr-rain { font-size:10px;font-weight:600;color:#60a5fa }

        /* 7-day extended */
        .pop-extended { display:flex;flex-direction:column }
        .ext-row {
          display:flex;align-items:center;gap:10px;
          padding:8px 0;
          border-bottom:1px solid var(--divider-color,rgba(255,255,255,0.06));
        }
        .ext-row:last-child { border-bottom:none }
        .ext-day  { width:38px;font-size:11px;font-weight:700;color:var(--secondary-text-color);text-transform:uppercase;flex-shrink:0 }
        .ext-ico  { width:17px;height:17px;flex-shrink:0 }
        .ext-ico svg { width:100%;height:100% }
        .ext-precip { flex:1;display:flex;align-items:center;gap:6px }
        .ext-rain { font-size:11px;font-weight:600;color:#60a5fa;min-width:26px }
        .ext-bar-bg  { flex:1;height:3px;background:rgba(255,255,255,0.18);border-radius:2px;overflow:hidden }
        .ext-bar-fill { height:100%;background:#60a5fa;border-radius:2px }
        .ext-temps { text-align:right;min-width:58px;flex-shrink:0 }
        .ext-hi { font-size:13px;font-weight:700;color:var(--primary-text-color) }
        .ext-lo { font-size:12px;font-weight:500;color:var(--secondary-text-color);margin-left:5px }
      </style>

      <ha-card id="wc-card">
        <div class="cur">
          <div class="cur-l">
            <div class="ico" style="color:${mainColor}">${mainSvg}</div>
            <div>
              <div class="cond">${this._label(state)}</div>
              <div class="loc">${name}</div>
            </div>
          </div>
          <div class="cur-r">
            <div class="temp">${this._fmt(temp)}${tempUnit}</div>
            ${feelsLike != null
              ? `<div class="feels">Feels like <span>${this._fmt(feelsLike)}${tempUnit}</span></div>`
              : `<div style="height:18px"></div>`}
          </div>
        </div>

        <div class="mets">
          <div class="met">
            <div class="mi" style="color:#60a5fa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
                <line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/>
                <line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/>
                <line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/>
              </svg>
            </div>
            <div>
              <div class="mv" style="color:#60a5fa">${rainChance != null ? `${Math.round(rainChance)}%` : '—'}</div>
              <div class="ml">Rain chance</div>
            </div>
          </div>
          <div class="met">
            <div class="mi" style="color:#94a3b8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
              </svg>
            </div>
            <div>
              <div class="mv">${windSpeed != null ? `${this._fmt(windSpeed)} ${windUnit}${windDir ? ` · ${windDir}` : ''}` : '—'}</div>
              <div class="ml">Wind</div>
            </div>
          </div>
          <div class="met">
            <div class="mi" style="color:${alert ? '#f87171' : '#4ade80'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                ${alert
                  ? `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                     <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`
                  : `<polyline points="20 6 9 17 4 12"/>`}
              </svg>
            </div>
            <div>
              <div class="mv ${alert ? 'red' : 'dim'}">${alert ? 'Alert active' : 'All clear'}</div>
              <div class="ml">Alerts</div>
            </div>
          </div>
        </div>

        ${alert ? `
          <div class="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            ${alert}
          </div>` : ''}

        <div class="div"></div>
        <div class="fcst">${forecastHtml}</div>
        ${tapHint}
      </ha-card>

      <div id="wc-overlay">
        <div id="wc-popup"></div>
      </div>`;

    // Tap to open popup
    if (tapAction !== 'none') {
      this.shadowRoot.getElementById('wc-card')
        ?.addEventListener('click', () => this._openPopup());
    }

    // Restore popup after re-render
    if (this._popupOpen) {
      const overlay = this.shadowRoot.getElementById('wc-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        this._renderPopup();
      }
    }
  }
}

customElements.define('weather-card-nws', WeatherCardUnified);