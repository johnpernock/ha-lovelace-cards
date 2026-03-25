/**
 * temp-strip-card.js  —  v6
 * A single-row temperature strip for Home Assistant Lovelace.
 * Shows sensors in one compact bar — abbr above, value below.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/temp-strip-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/temp-strip-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:temp-strip-card
 * unit: °F          # optional — default °F
 * sensors:
 *   - entity: sensor.office_temperature
 *     abbr: Off
 *   - entity: sensor.bedroom_temperature
 *     abbr: Bed
 *   - entity: sensor.dining_room_temperature
 *     abbr: Din
 *   - entity: climate.family_room       # climate.* → reads current_temperature
 *     abbr: FR·T
 *   - entity: sensor.family_room_temperature
 *     abbr: FR·S
 *   - entity: climate.solarium
 *     abbr: Sol
 *
 * Any entity domain works:
 *   sensor.*   → uses state value directly
 *   climate.*  → uses attributes.current_temperature
 *   Any other  → attempts state as a number
 */

class TempStripCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  static getStubConfig() {
    return {
      unit: '°F',
      sensors: [
        { entity: 'sensor.office_temperature',        abbr: 'Off'  },
        { entity: 'sensor.bedroom_temperature',       abbr: 'Bed'  },
        { entity: 'sensor.dining_room_temperature',   abbr: 'Din'  },
        { entity: 'climate.family_room',              abbr: 'FR·T' },
        { entity: 'sensor.family_room_temperature',   abbr: 'FR·S' },
        { entity: 'climate.solarium',                 abbr: 'Sol'  },
      ],
    };
  }

  setConfig(config) {
    if (!config.sensors || !config.sensors.length) {
      throw new Error('temp-strip-card: please define at least one sensor');
    }
    this._config = { unit: '°F', ...config };
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.strip') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 1; }

  _readTemp(entityId) {
    if (!this._hass || !entityId) return null;
    const e = this._hass.states[entityId];
    if (!e || e.state === 'unavailable' || e.state === 'unknown') return null;

    if (entityId.startsWith('climate.')) {
      const t = e.attributes.current_temperature;
      return t != null ? Math.round(t) : null;
    }

    const v = parseFloat(e.state);
    return isNaN(v) ? null : Math.round(v);
  }


  _patch() {
    if (!this._config.sensors) return;
    const unit = this._config.unit || '°F';
    this._config.sensors.forEach((s, i) => {
      const el = this.shadowRoot.querySelector(`.cell-${i} .temp`);
      if (!el) return;
      const temp = this._readTemp(s.entity);
      el.innerHTML = temp != null
        ? `${temp}<span class="unit">${unit}</span>`
        : `<span class="na">—</span>`;
    });
  }

  _render() {
    if (!this._config.sensors) return;

    const unit    = this._config.unit || '°F';
    const sensors = this._config.sensors;

    const cellsHtml = sensors.map((s, i) => {
      const temp    = this._readTemp(s.entity);
      const display = temp != null
        ? `${temp}<span class="unit">${unit}</span>`
        : `<span class="na">—</span>`;
      return `<div class="cell cell-${i}">
        <div class="abbr">${s.abbr || '?'}</div>
        <div class="temp">${display}</div>
      </div>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
        }

        .strip {
          display: flex;
          align-items: center;
          padding: 0 14px;
        }

        .cell {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 0;
          min-width: 0;
        }

        .cell + .cell {
          border-left: 1px solid var(--divider-color, rgba(255,255,255,0.07));
        }

        .abbr {
          font-size: 9px;
          font-weight: 700;
          color: var(--secondary-text-color);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 4px;
          opacity: 0.6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .temp {
          font-size: 18px;
          font-weight: 700;
          color: var(--primary-text-color);
          letter-spacing: -0.5px;
          line-height: 1;
          white-space: nowrap;
        }

        .unit {
          font-size: 9px;
          font-weight: 600;
          color: var(--secondary-text-color);
          vertical-align: super;
          margin-left: 1px;
          opacity: 0.5;
        }

        .na {
          font-size: 14px;
          color: var(--secondary-text-color);
          opacity: 0.35;
        }

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
        <div class="strip">${cellsHtml}</div>
      </ha-card>`;
  }
}

customElements.define('temp-strip-card', TempStripCard);