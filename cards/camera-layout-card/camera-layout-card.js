/**
 * camera-layout-card.js
 *
 * Portrait doorbell on the left, 2×2 grid of cameras on the right.
 * Designed for a 1200×800 wall display — fills the full card width,
 * height is configurable (default 680px).
 *
 * CONFIG:
 * type: custom:camera-layout-card
 * height: 680          # optional, default 680px
 * doorbell:
 *   entity: camera.front_doorbell
 *   name: Front Door   # optional label
 * cameras:             # up to 4 — empty slots show a placeholder
 *   - entity: camera.driveway_camera
 *     name: Driveway
 *   - entity: camera.back_left_camera
 *     name: Back Left
 *   - entity: camera.back_right_camera
 *     name: Back Right
 */

class CameraLayoutCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._rendered  = false;
    this._streams   = {};   // entityId → <ha-camera-stream>
  }

  /* ── Config ─────────────────────────────────────────────────── */

  setConfig(config) {
    if (!config.doorbell?.entity) throw new Error('camera-layout-card: doorbell.entity is required');
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

  /* ── Render ─────────────────────────────────────────────────── */

  _render() {
    if (!this._config.doorbell) return;
    const height = this._config.height || 680;
    const gap    = 3;
    const pad    = 3;
    const cameras = this._config.cameras || [];
    // pad cameras array to 4 slots
    const slots  = [...cameras, null, null, null, null].slice(0, 4);

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
          gap: ${gap}px;
          padding: ${pad}px;
          height: ${height}px;
          box-sizing: border-box;
          background: #08080f;
        }

        /* ── Doorbell column ── */
        .doorbell-col {
          flex: 0 0 auto;
          width: 29%;
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          background: #050509;
        }

        /* ── Grid column ── */
        .grid-col {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: ${gap}px;
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

        /* ── Fallback img (snapshot) ── */
        .cam-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* ── Name label ── */
        .cam-name {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 20px 10px 7px;
          background: linear-gradient(transparent, rgba(0,0,0,.72));
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 12px;
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
          font-size: 11px;
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

          <!-- 2×2 grid right -->
          <div class="grid-col">
            ${slots.map((cam, i) => `
              <div class="cam-cell" id="cam-cell-${i}">
                ${cam ? this._cellInner(cam) : `<div class="cam-placeholder"><span>+ Camera</span></div>`}
              </div>
            `).join('')}
          </div>

        </div>
      </ha-card>`;

    this._rendered = true;
    this._attachStreams();
  }

  /* ── Build cell inner HTML ───────────────────────────────────── */

  _cellInner(cam) {
    const name = cam.name || this._friendlyName(cam.entity);
    return `
      <ha-camera-stream
        id="stream-${cam.entity.replace(/\./g,'_')}"
        data-entity="${cam.entity}"
        muted
        playsinline
      ></ha-camera-stream>
      <div class="cam-name">${name}</div>`;
  }

  /* ── Attach hass + stateObj to each stream ───────────────────── */

  _attachStreams() {
    if (!this._hass) return;
    const sr = this.shadowRoot;
    sr.querySelectorAll('ha-camera-stream').forEach(el => {
      const entityId = el.dataset.entity;
      const state    = this._hass.states[entityId];
      if (!state) return;
      el.hass     = this._hass;
      el.stateObj = state;
    });
  }

  _patchStreams() {
    if (!this._hass) return;
    const sr = this.shadowRoot;
    sr.querySelectorAll('ha-camera-stream').forEach(el => {
      const entityId = el.dataset.entity;
      const state    = this._hass.states[entityId];
      if (!state) return;
      el.hass     = this._hass;
      el.stateObj = state;
    });
  }

  /* ── Helper ─────────────────────────────────────────────────── */

  _friendlyName(entityId) {
    if (this._hass?.states[entityId]) {
      return this._hass.states[entityId].attributes.friendly_name || entityId;
    }
    return entityId.replace('camera.','').replace(/_/g,' ');
  }
}

customElements.define('camera-layout-card', CameraLayoutCard);