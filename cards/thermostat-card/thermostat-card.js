/**
 * thermostat-card.js  —  v5
 * Compact Home Assistant Lovelace thermostat card.
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
 * ── MODES ─────────────────────────────────────────────────────────────────────
 * The mode button cycles only through modes reported in the entity's
 * hvac_modes attribute — so each thermostat shows only what it supports:
 *   heat_cool / auto  →  orange+blue split dot
 *   heat              →  orange
 *   cool              →  blue
 *   fan_only          →  teal
 *   dry               →  amber
 *   off               →  gray
 *
 * If the entity only has one mode the button is shown but non-interactive.
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
    this._hass = hass;
    this._render();
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

  // ── Mode helpers ─────────────────────────────────────────────────────────────

  // Preferred display order — entity's hvac_modes is filtered to this order.
  static get MODE_ORDER() {
    return ['heat_cool', 'auto', 'heat', 'cool', 'fan_only', 'dry', 'off'];
  }

  static get MODE_META() {
    return {
      heat_cool: {
        label: 'Heat / Cool', split: true,
        dotColor: null,
        border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', textColor: '#fb923c',
      },
      auto: {
        label: 'Auto', split: true,
        dotColor: null,
        border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', textColor: '#fb923c',
      },
      heat: {
        label: 'Heat', split: false,
        dotColor: '#fb923c',
        border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', textColor: '#fb923c',
      },
      cool: {
        label: 'Cool', split: false,
        dotColor: '#60a5fa',
        border: 'rgba(96,165,250,0.35)', bg: 'rgba(96,165,250,0.07)', textColor: '#60a5fa',
      },
      fan_only: {
        label: 'Fan', split: false,
        dotColor: '#2dd4bf',
        border: 'rgba(45,212,191,0.35)', bg: 'rgba(45,212,191,0.07)', textColor: '#2dd4bf',
      },
      dry: {
        label: 'Dry', split: false,
        dotColor: '#fbbf24',
        border: 'rgba(251,191,36,0.35)', bg: 'rgba(251,191,36,0.07)', textColor: '#fbbf24',
      },
      off: {
        label: 'Off', split: false,
        dotColor: 'rgba(255,255,255,0.25)',
        border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)', textColor: 'rgba(255,255,255,0.45)',
      },
    };
  }

  // Supported modes for this entity, in preferred display order.
  _supportedModes() {
    const raw = this._attr('hvac_modes') || [];
    return ThermostatCard.MODE_ORDER.filter(m => raw.includes(m));
  }

  _meta(modeKey) {
    return ThermostatCard.MODE_META[modeKey] || ThermostatCard.MODE_META['off'];
  }

  // ── Service calls ────────────────────────────────────────────────────────────

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
        entity_id:   this._config.entity,
        temperature: newTemp,
      });
    } catch (err) {
      console.warn('thermostat-card: set_temperature failed', err);
    }
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
        entity_id: this._config.entity,
        hvac_mode: next,
      });
    } catch (err) {
      console.warn('thermostat-card: set_hvac_mode failed', err);
    }
    setTimeout(() => { this._busy = false; }, 600);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  _render() {
    const e       = this._entity();
    const unavail = !e || e.state === 'unavailable';
    const name    = this._config.name || e?.attributes?.friendly_name || this._config.entity;
    const curTemp = this._fmt(this._attr('current_temperature'));
    const tgtTemp = this._fmt(this._attr('temperature') ?? this._attr('target_temp_high'));
    const unit    = this._attr('temperature_unit') || '°F';

    const currentMode = (e?.state || 'off').toLowerCase();
    const meta        = this._meta(currentMode);
    const supported   = this._supportedModes();
    const canCycle    = supported.length > 1;

    const dotHtml = meta.split
      ? `<div style="width:8px;height:8px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex">
           <div style="flex:1;background:#fb923c"></div>
           <div style="flex:1;background:#60a5fa"></div>
         </div>`
      : `<div style="width:8px;height:8px;border-radius:50%;background:${meta.dotColor};flex-shrink:0"></div>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 12px 14px 10px;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
        }

        .room {
          font-size: 12px;
          font-weight: 700;
          color: var(--secondary-text-color);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 0.6;
        }

        .cur-wrap {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          line-height: 1;
        }
        .cur-temp {
          font-size: 34px;
          font-weight: 700;
          color: var(--primary-text-color);
          letter-spacing: -1.5px;
          line-height: 1;
        }
        .cur-unit {
          font-size: 12px;
          font-weight: 600;
          color: var(--secondary-text-color);
          margin-top: 5px;
          margin-left: 2px;
        }

        .sep {
          width: 28px;
          height: 1px;
          background: var(--divider-color, rgba(255,255,255,0.1));
          margin: 8px auto;
        }

        .tgt-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
        }

        .tgt-btn {
          flex: 1;
          height: 40px;
          border-radius: 8px;
          border: 0.5px solid var(--divider-color, rgba(255,255,255,0.18));
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          color: var(--primary-text-color);
          font-size: 22px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.12s, transform 0.1s;
          user-select: none;
        }
        .tgt-btn:active {
          background: rgba(255,255,255,0.14);
          transform: scale(0.93);
        }

        .tgt-temp {
          font-size: 24px;
          font-weight: 700;
          color: var(--primary-text-color);
          min-width: 34px;
          text-align: center;
          letter-spacing: -0.5px;
          line-height: 1;
          flex-shrink: 0;
        }

        .sep2 {
          width: 100%;
          height: 1px;
          background: var(--divider-color, rgba(255,255,255,0.07));
          margin: 10px 0 8px;
        }

        .mode-btn {
          width: 100%;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
          user-select: none;
        }
        .mode-btn.can-cycle {
          cursor: pointer;
        }
        .mode-btn.can-cycle:active {
          transform: scale(0.96);
        }

        .mode-text {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .unavail {
          font-size: 11px;
          color: var(--secondary-text-color);
          text-align: center;
          padding: 14px 0;
          opacity: 0.5;
          font-style: italic;
        }
      </style>

      <ha-card>
        <div class="room">${name}</div>

        ${unavail ? `<div class="unavail">unavailable</div>` : `

          <div class="cur-wrap">
            <span class="cur-temp">${curTemp}</span>
            <span class="cur-unit">${unit}</span>
          </div>

          <div class="sep"></div>

          <div class="tgt-row">
            <button class="tgt-btn" id="tc-down" aria-label="Decrease target temperature">−</button>
            <span class="tgt-temp">${tgtTemp}</span>
            <button class="tgt-btn" id="tc-up"   aria-label="Increase target temperature">+</button>
          </div>

          <div class="sep2"></div>

          <div class="mode-btn ${canCycle ? 'can-cycle' : ''}" id="tc-mode"
               style="border:0.5px solid ${meta.border};background:${meta.bg}"
               aria-label="Cycle HVAC mode">
            ${dotHtml}
            <span class="mode-text" style="color:${meta.textColor}">${meta.label}</span>
          </div>

        `}
      </ha-card>`;

    this.shadowRoot.getElementById('tc-down')
      ?.addEventListener('click', ev => { ev.stopPropagation(); this._adjustTemp(-1); });
    this.shadowRoot.getElementById('tc-up')
      ?.addEventListener('click', ev => { ev.stopPropagation(); this._adjustTemp(+1); });
    this.shadowRoot.getElementById('tc-mode')
      ?.addEventListener('click', ev => { ev.stopPropagation(); if (canCycle) this._cycleMode(); });
  }
}

customElements.define('thermostat-card', ThermostatCard);