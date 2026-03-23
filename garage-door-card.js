/**
 * garage-door-card.js
 * Compact garage door toggle card for Home Assistant Lovelace.
 * Matches the tesla-card button design language.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/garage-door-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/garage-door-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:garage-door-card
 * entity: cover.garage_door       # required — must be a cover.* entity
 * name: Garage                    # optional — overrides friendly_name
 *
 * ── STATES ────────────────────────────────────────────────────────────────────
 * closed   → green   — button sends open_cover
 * open     → blue    — button sends close_cover
 * opening  → amber   — button disabled
 * closing  → orange  — button disabled
 * stopped  → gray    — button sends toggle
 */

class GarageDoorCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = false;
  }

  static getStubConfig() {
    return { entity: 'cover.garage_door', name: 'Garage' };
  }

  setConfig(config) {
    if (!config.entity) throw new Error('garage-door-card: please define an entity');
    this._config = { name: null, ...config };
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

  _coverState() {
    const e = this._entity();
    if (!e) return 'unknown';
    return (e.state || 'unknown').toLowerCase();
  }

  // ── State → visual theme ─────────────────────────────────────────────────────

  _theme(state) {
    switch (state) {
      case 'closed':
        return {
          badge:       'CLOSED',
          badgeCss:    'color:#4ade80;border-color:rgba(74,222,128,0.45);background:rgba(74,222,128,0.08)',
          btnBg:       'rgba(74,222,128,0.12)',
          btnBorder:   'rgba(74,222,128,0.55)',
          iconColor:   '#4ade80',
          textColor:   '#4ade80',
          label:       'Closed',
          subLabel:    'Tap to open',
          canToggle:   true,
          service:     'open_cover',
        };
      case 'open':
        return {
          badge:       'OPEN',
          badgeCss:    'color:#60a5fa;border-color:rgba(96,165,250,0.45);background:rgba(96,165,250,0.08)',
          btnBg:       'rgba(96,165,250,0.12)',
          btnBorder:   'rgba(96,165,250,0.55)',
          iconColor:   '#60a5fa',
          textColor:   '#60a5fa',
          label:       'Open',
          subLabel:    'Tap to close',
          canToggle:   true,
          service:     'close_cover',
        };
      case 'opening':
        return {
          badge:       'OPENING',
          badgeCss:    'color:#fbbf24;border-color:rgba(251,191,36,0.45);background:rgba(251,191,36,0.08)',
          btnBg:       'rgba(251,191,36,0.08)',
          btnBorder:   'rgba(251,191,36,0.35)',
          iconColor:   '#fbbf24',
          textColor:   'rgba(251,191,36,0.6)',
          label:       'Opening…',
          subLabel:    'In progress',
          canToggle:   false,
          service:     null,
        };
      case 'closing':
        return {
          badge:       'CLOSING',
          badgeCss:    'color:#fb923c;border-color:rgba(251,146,60,0.45);background:rgba(251,146,60,0.08)',
          btnBg:       'rgba(251,146,60,0.08)',
          btnBorder:   'rgba(251,146,60,0.35)',
          iconColor:   '#fb923c',
          textColor:   'rgba(251,146,60,0.6)',
          label:       'Closing…',
          subLabel:    'In progress',
          canToggle:   false,
          service:     null,
        };
      default: // stopped / unknown / unavailable
        return {
          badge:       state.toUpperCase(),
          badgeCss:    'color:rgba(255,255,255,0.4);border-color:rgba(255,255,255,0.15);background:rgba(255,255,255,0.05)',
          btnBg:       'rgba(255,255,255,0.04)',
          btnBorder:   'rgba(255,255,255,0.12)',
          iconColor:   'rgba(255,255,255,0.3)',
          textColor:   'rgba(255,255,255,0.35)',
          label:       state.charAt(0).toUpperCase() + state.slice(1),
          subLabel:    'Tap to toggle',
          canToggle:   true,
          service:     'toggle',
        };
    }
  }

  // ── SVG icon ─────────────────────────────────────────────────────────────────

  _icon(state) {
    const s = `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;

    if (state === 'closed') {
      // Garage with horizontal panel lines — door shut
      return `<svg viewBox="0 0 24 24" fill="none" ${s}>
        <path d="M2 10 L12 3 L22 10"/>
        <rect x="2" y="10" width="20" height="11" rx="1.5"/>
        <line x1="6" y1="15" x2="18" y2="15"/>
        <line x1="6" y1="18" x2="18" y2="18"/>
      </svg>`;
    }

    if (state === 'open') {
      // Garage with opening (dark void) visible — door raised
      return `<svg viewBox="0 0 24 24" fill="none" ${s}>
        <path d="M2 10 L12 3 L22 10"/>
        <rect x="2" y="10" width="20" height="11" rx="1.5"/>
        <rect x="6" y="13" width="12" height="6" rx="0.5"
              fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="1"/>
      </svg>`;
    }

    // opening — arrow up
    if (state === 'opening') {
      return `<svg viewBox="0 0 24 24" fill="none" ${s}>
        <path d="M2 10 L12 3 L22 10"/>
        <rect x="2" y="10" width="20" height="11" rx="1.5"/>
        <line x1="12" y1="22" x2="12" y2="14"/>
        <polyline points="8 17 12 13 16 17"/>
      </svg>`;
    }

    // closing — arrow down
    if (state === 'closing') {
      return `<svg viewBox="0 0 24 24" fill="none" ${s}>
        <path d="M2 10 L12 3 L22 10"/>
        <rect x="2" y="10" width="20" height="11" rx="1.5"/>
        <line x1="12" y1="13" x2="12" y2="21"/>
        <polyline points="8 18 12 22 16 18"/>
      </svg>`;
    }

    // fallback / stopped
    return `<svg viewBox="0 0 24 24" fill="none" ${s}>
      <path d="M2 10 L12 3 L22 10"/>
      <rect x="2" y="10" width="20" height="11" rx="1.5"/>
      <line x1="7" y1="15" x2="17" y2="15"/>
    </svg>`;
  }

  // ── Last-changed label ────────────────────────────────────────────────────────

  _lastChanged() {
    const e = this._entity();
    if (!e) return null;
    const d = new Date(e.last_changed || e.last_updated);
    if (isNaN(d)) return null;
    const diff = Math.round((Date.now() - d) / 60000);
    if (diff < 1)   return 'just now';
    if (diff === 1) return '1 min ago';
    if (diff < 60)  return `${diff} min ago`;
    const hrs = Math.round(diff / 60);
    return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
  }

  // ── Service call ─────────────────────────────────────────────────────────────

  async _toggle() {
    if (this._busy) return;
    const e = this._entity();
    if (!e) return;

    const state   = this._coverState();
    const { canToggle, service } = this._theme(state);
    if (!canToggle || !service) return;

    this._busy = true;
    try {
      await this._hass.callService('cover', service, {
        entity_id: this._config.entity,
      });
    } catch (err) {
      console.warn('garage-door-card: service call failed', err);
    }
    setTimeout(() => { this._busy = false; }, 800);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  _render() {
    const e       = this._entity();
    const unavail = !e || e.state === 'unavailable';
    const state   = this._coverState();
    const theme   = this._theme(unavail ? 'unknown' : state);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 12px 16px 14px;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
          color: var(--primary-text-color);
        }

        .action-btn {
          width: 100%;
          border-radius: 12px;
          padding: 20px 8px 14px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.1s, filter 0.12s;
          user-select: none;
        }

        .action-btn.can-toggle:active {
          transform: scale(0.96);
          filter: brightness(0.9);
        }

        .action-btn.disabled {
          cursor: default;
        }

        .btn-icon {
          width: 30px;
          height: 30px;
          flex-shrink: 0;
        }

        .btn-icon svg { width: 100%; height: 100%; }

        .btn-label {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.03em;
          line-height: 1;
        }

        .btn-sub {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.04em;
          margin-top: -4px;
          opacity: 0.75;
        }

        .prog-wrap {
          width: 80%;
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 99px;
          overflow: hidden;
        }

        .prog-bar {
          height: 100%;
          border-radius: 99px;
          animation: indeterminate 1.6s ease-in-out infinite;
        }

        @keyframes indeterminate {
          0%   { width: 15%; margin-left: 0; }
          50%  { width: 55%; margin-left: 25%; }
          100% { width: 15%; margin-left: 85%; }
        }

        .unavail {
          font-size: 12px;
          color: var(--secondary-text-color);
          text-align: center;
          padding: 16px 0;
          opacity: 0.5;
          font-style: italic;
        }
      </style>

      <ha-card>

        ${unavail ? `<div class="unavail">unavailable</div>` : `

          <button class="action-btn ${theme.canToggle ? 'can-toggle' : 'disabled'}"
                  id="gd-btn"
                  style="background:${theme.btnBg};border:1px solid ${theme.btnBorder}"
                  ${theme.canToggle ? '' : 'disabled'}>
            <div class="btn-icon" style="color:${theme.iconColor}">
              ${this._icon(state)}
            </div>
            <div class="btn-label" style="color:${theme.textColor}">${theme.label}</div>
            <div class="btn-sub"   style="color:${theme.textColor}">${theme.subLabel}</div>
            ${!theme.canToggle ? `
              <div class="prog-wrap">
                <div class="prog-bar" style="background:${theme.iconColor}"></div>
              </div>` : ''}
          </button>

        `}

      </ha-card>`;

    this.shadowRoot.getElementById('gd-btn')
      ?.addEventListener('click', ev => { ev.stopPropagation(); this._toggle(); });
  }
}

customElements.define('garage-door-card', GarageDoorCard);