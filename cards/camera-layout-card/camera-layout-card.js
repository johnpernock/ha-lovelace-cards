/**
 * camera-layout-card.js  —  v4
 *
 * Portrait doorbell on the left, dynamic 2×N grid of cameras on the right.
 * Designed for a 1200×800 wall display — fills the full card width,
 * height is configurable (default 680px).
 *
 * Grid rows are derived automatically from the number of cameras configured:
 *   1–2 cameras → 2×1 (1 row)
 *   3–4 cameras → 2×2 (2 rows)   ← original behaviour
 *   5–6 cameras → 2×3 (3 rows)
 *
 * CONFIG:
 * type: custom:camera-layout-card
 * height: 680          # optional, default 680px
 * doorbell:
 *   entity: camera.g6_entry
 *   name: Front Door   # optional label
 * cameras:             # up to 6 — empty trailing slots show a placeholder
 *   - entity: camera.driveway
 *     name: Driveway
 *   - entity: camera.back_garden
 *     name: Back Garden
 *   - entity: camera.back_yard
 *     name: Back Yard
 *   - entity: camera.garage_side_yard
 *     name: Garage Side
 *   - entity: camera.utility_side_yard
 *     name: Utility Side
 */

class CameraLayoutCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config   = {};
    this._hass     = null;
    this._rendered = false;
  }

  /* ── Config ──────────────────────────────────────────────────── */

  static getStubConfig() {
    return {
      height: 680,
      doorbell: { entity: 'camera.g6_entry', name: 'Front Door' },
      cameras: [
        { entity: 'camera.driveway',         name: 'Driveway'     },
        { entity: 'camera.back_garden',       name: 'Back Garden'  },
        { entity: 'camera.back_yard',         name: 'Back Yard'    },
        { entity: 'camera.garage_side_yard',  name: 'Garage Side'  },
        { entity: 'camera.utility_side_yard', name: 'Utility Side' },
      ],
    };
  }

  setConfig(config) {
    if (!config.doorbell?.entity) {
      throw new Error('camera-layout-card: doorbell.entity is required');
    }
    this._config   = config;
    this._rendered = false;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) { this._render(); return; }
    this._patchStreams();
  }

  getCardSize() { return 8; }

  /* ── Render ──────────────────────────────────────────────────── */

  _render() {
    if (!this._config.doorbell) return;

    const height  = this._config.height || 680;
    const gap     = 3;
    const pad     = 3;
    const cameras = this._config.cameras || [];

    // Derive row count from number of cameras — always 2 columns
    const rows  = Math.max(2, Math.ceil(cameras.length / 2));
    const slots = cameras.slice();
    // Pad to fill the grid so empty cells render as placeholders
    while (slots.length < rows * 2) slots.push(null);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: #08080f !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 12px !important;
          overflow: hidden;
          padding: 0;
        }
        .layout {
          display: flex;
          flex-wrap: wrap;
          gap: ${gap}px;
          padding: ${pad}px;
          min-height: min(${height}px, 100vw);
          box-sizing: border-box;
          background: #08080f;
        }

        /* ── Doorbell column — portrait, slightly narrower for 3-row grid ── */
        .doorbell-col {
          flex: 0 0 auto;
          width: 26%;
          min-width: 120px;
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          background: #050509;
        }

        /* ── Camera grid — fills remaining width ── */
        .grid-col {
          flex: 1;
          min-width: 200px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(${rows}, 1fr);
          gap: ${gap}px;
        }

        /* ── Narrow screens: stack doorbell above cameras ── */
        @media (max-width: 700px) {
          .layout { flex-direction: column; min-height: unset; }
          .doorbell-col { width: 100%; height: 200px; }
          .grid-col { min-width: unset; grid-template-rows: auto; }
        }

        /* ── Individual camera cell ── */
        .cam-cell {
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          background: #050509;
        }

        /* ── Camera stream fills cell ── */
        ha-camera-stream {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ── Name label ── */
        .cam-name {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 20px 8px 6px;
          background: linear-gradient(transparent, rgba(0,0,0,.72));
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,.88);
          pointer-events: none;
          z-index: 2;
        }

        /* ── Placeholder slot ── */
        .cam-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px dashed rgba(255,255,255,.08);
          border-radius: 6px;
          box-sizing: border-box;
        }
        .cam-placeholder span {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: rgba(255,255,255,.12);
        }

        /* ── Scan line texture ── */
        .cam-cell::before,
        .doorbell-col::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,.04) 2px,
            rgba(0,0,0,.04) 4px
          );
          pointer-events: none;
          z-index: 1;
        }
      </style>

      <ha-card>
        <div class="layout">

          <!-- Doorbell — portrait left -->
          <div class="doorbell-col" id="doorbell-cell">
            ${this._cellInner(this._config.doorbell)}
          </div>

          <!-- 2×${rows} grid right -->
          <div class="grid-col">
            ${slots.map((cam, i) => `
              <div class="cam-cell" id="cam-cell-${i}">
                ${cam
                  ? this._cellInner(cam)
                  : '<div class="cam-placeholder"><span>+ Camera</span></div>'}
              </div>
            `).join('')}
          </div>

        </div>
      </ha-card>`;

    this._rendered = true;
    this._patchStreams();
  }

  /* ── Build cell inner HTML ───────────────────────────────────── */

  _cellInner(cam) {
    const name = cam.name || this._friendlyName(cam.entity);
    return `
      <ha-camera-stream
        id="stream-${cam.entity.replace(/\./g, '_')}"
        data-entity="${cam.entity}"
        muted
        playsinline
      ></ha-camera-stream>
      <div class="cam-name">${name}</div>`;
  }

  /* ── Keep streams alive on hass updates ─────────────────────── */

  _patchStreams() {
    if (!this._hass) return;
    this.shadowRoot.querySelectorAll('ha-camera-stream').forEach(el => {
      const state = this._hass.states[el.dataset.entity];
      if (!state) return;
      el.hass     = this._hass;
      el.stateObj = state;
    });
  }

  /* ── Helper ──────────────────────────────────────────────────── */

  _friendlyName(entityId) {
    return this._hass?.states[entityId]?.attributes?.friendly_name
      || entityId.replace('camera.', '').replace(/_/g, ' ');
  }
}

customElements.define('camera-layout-card', CameraLayoutCard);
