/**
 * door-sensor-card.js  —  v15
 * Compact door/window sensor summary banner for Home Assistant Lovelace.
 * Shows open count + which doors are open. Green when all clear.
 * Tap the banner to open a 3-column icon grid popup.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/door-sensor-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/door-sensor-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:door-sensor-card
 * doors:
 *   - entity: binary_sensor.front_door
 *     name: Front Door
 *   - entity: binary_sensor.patio_door
 *     name: Patio Slider
 *   - entity: binary_sensor.office_door
 *     name: Office
 *   - entity: binary_sensor.kitchen_door
 *     name: Kitchen Back
 *   - entity: binary_sensor.garage_entry
 *     name: Garage Entry
 *   - entity: binary_sensor.master_bedroom
 *     name: Master Bedroom
 *   - entity: binary_sensor.basement_door
 *     name: Basement
 *
 * ── POPUP ─────────────────────────────────────────────────────────────────────
 * Tapping the banner opens a 3-column icon grid showing every door.
 * Open doors sort to the top. Red tile = open, green tile = closed.
 * Mobile: bottom sheet  •  Desktop ≥768px: centered modal
 */

class DoorSensorCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._popupOpen = false;
  }

  static getStubConfig() {
    return {
      doors: [
        { entity: 'binary_sensor.front_door',   name: 'Front Door'   },
        { entity: 'binary_sensor.patio_door',   name: 'Patio Slider' },
        { entity: 'binary_sensor.office_door',  name: 'Office'       },
        { entity: 'binary_sensor.kitchen_door', name: 'Kitchen'      },
      ],
    };
  }

  setConfig(config) {
    if (!config.doors?.length) {
      throw new Error('door-sensor-card: please define at least one door');
    }
    this._config = config;
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.banner') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 1; }

  // ── State helpers ─────────────────────────────────────────────────────────────

  _isOpen(entityId) {
    if (!this._hass || !entityId) return false;
    const e = this._hass.states[entityId];
    return e ? e.state === 'on' : false;
  }

  // ── Icons — explicit stroke color so they always render ──────────────────────

  _closedIcon(color) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`;
  }

  _openIcon(color) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <line x1="3" y1="9" x2="1" y2="11"/>
    </svg>`;
  }

  _bannerIcon(anyOpen, color) {
    return anyOpen ? this._openIcon(color) : this._closedIcon(color);
  }

  // ── Popup ─────────────────────────────────────────────────────────────────────

  _openPopup() {
    const overlay = this.shadowRoot.getElementById('ds-overlay');
    if (!overlay) return;
    this._popupOpen = true;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this._renderPopup();
    // overlay tap-outside is wired in _render() permanently
  }

  _closePopup() {
    this._popupOpen = false;
    const overlay = this.shadowRoot.getElementById('ds-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  _renderPopup() {
    const popup = this.shadowRoot.getElementById('ds-popup');
    if (!popup) return;

    const doors     = this._config.doors;
    const openCount = doors.filter(d => this._isOpen(d.entity)).length;
    const anyOpen   = openCount > 0;
    const summaryColor = anyOpen ? '#f87171' : '#4ade80';
    const summaryText  = anyOpen
      ? `${openCount} door${openCount > 1 ? 's' : ''} open`
      : 'All doors closed';

    // Open doors first, then closed
    const sorted = [...doors].sort((a, b) =>
      this._isOpen(b.entity) - this._isOpen(a.entity)
    );

    const tilesHtml = sorted.map(d => {
      const open   = this._isOpen(d.entity);
      const color  = open ? '#f87171' : '#4ade80';
      const bg     = open ? 'rgba(248,113,113,0.1)'  : 'rgba(74,222,128,0.07)';
      const border = open ? 'rgba(248,113,113,0.28)' : 'rgba(74,222,128,0.18)';
      const label  = open ? 'Open' : 'Closed';
      const ico    = open ? this._openIcon(color) : this._closedIcon(color);

      // Shorten long names to fit 3-col grid
      const shortName = (d.name || d.entity)
        .replace('Master ', '')
        .replace(' Entry', '')
        .replace(' Slider', '')
        .replace(' Back', '')
        .replace(' Door', '');
      const displayName = shortName.length > 0 ? shortName : (d.name || d.entity);

      return `<div style="
          background:${bg};border:1px solid ${border};border-radius:10px;
          padding:12px 8px;display:flex;flex-direction:column;
          align-items:center;gap:6px">
        ${ico}
        <div style="
            font-size:11px;font-weight:700;color:var(--primary-text-color,#e2e8f0);
            text-align:center;line-height:1.3;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            max-width:100%">${displayName}</div>
        <div style="
            font-size:9.5px;font-weight:700;color:${color};
            text-transform:uppercase;letter-spacing:.05em">${label}</div>
      </div>`;
    }).join('');

    popup.innerHTML = `
      <div id="ds-handle"></div>
      <div class="pop-head">
        <div>
          <div class="pop-title">Door Sensors</div>
          <div class="pop-sub" style="color:${summaryColor}">${summaryText}</div>
        </div>
        <button id="ds-close">✕</button>
      </div>
      <div class="pop-divider"></div>
      <div class="door-grid">${tilesHtml}</div>`;

    popup.querySelector('#ds-close')?.addEventListener('click', () => this._closePopup());
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  _patch() {
    if (!this._config.doors) return;
    const doors     = this._config.doors;
    const openDoors = doors.filter(d => this._isOpen(d.entity));
    const count     = openDoors.length;
    const anyOpen   = count > 0;
    const GREEN = '#4ade80', RED = '#f87171';
    const bannerBg     = anyOpen ? 'rgba(239,68,68,0.10)'  : 'rgba(74,222,128,0.08)';
    const bannerBorder = anyOpen ? 'rgba(239,68,68,0.35)'  : 'rgba(74,222,128,0.25)';
    const bannerColor  = anyOpen ? RED : GREEN;
    const bannerTitle  = anyOpen ? `${count} door${count > 1 ? 's' : ''} open` : 'All doors closed';
    const bannerSub    = anyOpen ? openDoors.map(d => d.name).join(', ') : 'All doors are secure';

    const banner = this.shadowRoot.querySelector('.banner');
    if (!banner) return;
    banner.style.background   = bannerBg;
    banner.style.borderColor  = bannerBorder;
    const ico   = banner.querySelector('.banner-icon');
    const title = banner.querySelector('.banner-title');
    const sub   = banner.querySelector('.banner-sub');
    const chev  = banner.querySelector('.banner-chevron');
    if (ico)   ico.innerHTML = this._bannerIcon(anyOpen, bannerColor);
    if (title) { title.textContent = bannerTitle; title.style.color = bannerColor; }
    if (sub)   { sub.textContent   = bannerSub;   sub.style.color   = bannerColor; }
    if (chev)  chev.style.color    = bannerColor;
    if (this._popupOpen) this._renderPopup();
  }

  _render() {
    if (!this._config.doors) return;

    const doors     = this._config.doors;
    const openDoors = doors.filter(d => this._isOpen(d.entity));
    const count     = openDoors.length;
    const anyOpen   = count > 0;

    const GREEN = '#4ade80';
    const RED   = '#f87171';

    const bannerBg     = anyOpen ? 'rgba(239,68,68,0.10)'  : 'rgba(74,222,128,0.08)';
    const bannerBorder = anyOpen ? 'rgba(239,68,68,0.35)'  : 'rgba(74,222,128,0.25)';
    const bannerColor  = anyOpen ? RED : GREEN;
    const bannerTitle  = anyOpen
      ? `${count} door${count > 1 ? 's' : ''} open`
      : 'All doors closed';
    const bannerSub    = anyOpen
      ? openDoors.map(d => d.name).join(', ')
      : 'All doors are secure';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 14px;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
        }

        .banner {
          border-radius: 10px;
          padding: 11px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: filter .12s;
        }
        .banner:hover  { filter: brightness(1.08); }
        .banner:active { filter: brightness(0.92); }

        .banner-text { flex: 1; min-width: 0; }
        .banner-title {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
        }
        .banner-sub {
          font-size: 12px;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 0.7;
        }
        .banner-chevron {
          font-size: 18px;
          opacity: 0.35;
          flex-shrink: 0;
          line-height: 1;
        }

        /* ── Popup overlay ── */
        #ds-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 9999;
          align-items: flex-end;
          justify-content: center;
        }
        #ds-popup {
          background: var(--card-background-color, #1e1e2a);
          border: 1px solid var(--divider-color, rgba(255,255,255,0.22));
          border-radius: 16px 16px 0 0;
          border-bottom: none;
          padding: 20px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          overscroll-behavior: contain;
          touch-action: pan-y;
          box-sizing: border-box;
        }
        @media (min-width: 768px) {
          #ds-overlay { align-items: center; justify-content: center; padding: 24px; }
          #ds-popup {
            max-width: 440px;
            border-radius: 16px;
            border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.22));
          }
          #ds-handle { display: none !important; }
        }

        /* ── Popup internals ── */
        #ds-handle {
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
        .pop-sub { font-size: 11px; font-weight: 600; margin-top: 3px; }
        #ds-close {
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
        .door-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
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
        <div class="banner"
             id="ds-banner"
             style="background:${bannerBg};border:1px solid ${bannerBorder}">
          <span class="banner-icon">${this._bannerIcon(anyOpen, bannerColor)}</span>
          <div class="banner-text">
            <div class="banner-title" style="color:${bannerColor}">${bannerTitle}</div>
            <div class="banner-sub"   style="color:${bannerColor}">${bannerSub}</div>
          </div>
          <div class="banner-chevron" style="color:${bannerColor}">›</div>
        </div>
      </ha-card>

      <div id="ds-overlay">
        <div id="ds-popup"></div>
      </div>`;

    this.shadowRoot.getElementById('ds-banner')
      ?.addEventListener('click', () => this._openPopup());

    // Restore popup after re-render and always wire overlay tap-outside
    const overlay2 = this.shadowRoot.getElementById('ds-overlay');
    if (overlay2) {
      overlay2.addEventListener('click', e => {
        if (e.target === overlay2) this._closePopup();
      });
    }
    if (this._popupOpen) {
      if (overlay2) {
        overlay2.style.display = 'flex';
        this._renderPopup();
      }
    }
  }
}

customElements.define('door-sensor-card', DoorSensorCard);