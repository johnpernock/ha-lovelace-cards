/**
 * now-playing-card.js  —  v11
 * Compact now-playing widget for Home Assistant Lovelace.
 * Shows active media players. Collapses to nothing when all are idle.
 *
 * CONFIG:
 * type: custom:now-playing-card
 * players:
 *   - entity: media_player.family_room
 *     name: Family Room
 *   - entity: media_player.master_bedroom
 *     name: Master Bedroom
 *   - entity: media_player.office
 *     name: Office
 */

class NowPlayingCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  static getStubConfig() { return { players: [{ entity: 'media_player.living_room', name: 'Living Room' }] }; }

  setConfig(c) {
    if (!c.players?.length) throw new Error('now-playing-card: define at least one player');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 2; }

  // ── Helpers ────────────────────────────────────────────────────────────────
  _estate(id)  { return this._hass?.states[id] || null; }
  _eattr(id,k) { return this._estate(id)?.attributes?.[k] ?? null; }

  _isActive(state) {
    return state === 'playing' || state === 'paused' || state === 'buffering';
  }

  _isPlaying(state) { return state === 'playing' || state === 'buffering'; }

  _mediaTitle(id) {
    const a = this._estate(id)?.attributes;
    if (!a) return null;
    if (a.media_series_title && a.media_episode) {
      return `${a.media_series_title} · S${String(a.media_season_number||'').padStart(2,'0')} E${String(a.media_episode_number||'').padStart(2,'0')}`;
    }
    return a.media_title || a.friendly_name || null;
  }

  _mediaSource(id) {
    const a = this._estate(id)?.attributes;
    if (!a) return null;
    return a.app_name || a.media_content_type || a.source || null;
  }

  // ── Fire more-info ─────────────────────────────────────────────────────────
  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      bubbles: true, composed: true, detail: { entityId },
    }));
  }

  _patch() {
    if (!this._config.players) return;
    const players = this._config.players;
    const active  = players.filter(p => this._isActive(this._estate(p.entity)?.state));
    // If active count changed the structure changes — full re-render
    const current = this.shadowRoot.querySelectorAll('.active-row').length;
    if (active.length !== current) { this._render(); return; }
    // Also re-render if visibility changed (was empty, now has content or vice-versa)
    if (!this.shadowRoot.querySelector('.wrap')) { this._render(); return; }

    players.forEach(p => {
      const state   = this._estate(p.entity)?.state;
      const playing = this._isPlaying(state);
      const isActive = this._isActive(state);
      const safeId  = p.entity.replace(/\./g, '_');
      const row     = this.shadowRoot.getElementById(`np-${safeId}`);
      if (!row) return;
      const title   = this._mediaTitle(p.entity) || 'Unknown';
      const source  = this._mediaSource(p.entity) || '';
      const titleEl = row.querySelector('.media-title');
      const srcEl   = row.querySelector('.media-source');
      const stateEl = row.querySelector('.media-state');
      const artEl   = row.querySelector('.media-art');
      if (titleEl) titleEl.textContent = title;
      if (srcEl)   srcEl.textContent   = source;
      if (stateEl) {
        stateEl.textContent   = playing ? 'Playing' : 'Paused';
        stateEl.style.color   = playing ? '#60a5fa' : '#fbbf24';
      }
      if (artEl) {
        artEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${playing ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}</svg>`;
      }
    });
  }

  _render() {
    if (!this._config.players) return;

    const players = this._config.players;
    const active  = players.filter(p => this._isActive(this._estate(p.entity)?.state));

    // Collapse to invisible when all idle — same pattern as printer-status-card
    if (!active.length) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block}ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0;margin:0}</style>
        <ha-card></ha-card>`;
      return;
    }

    const idle = players.filter(p => !this._isActive(this._estate(p.entity)?.state));

    const activeHtml = active.map((p, i) => {
      const state   = this._estate(p.entity)?.state;
      const playing = this._isPlaying(state);
      const title   = this._mediaTitle(p.entity) || 'Unknown';
      const source  = this._mediaSource(p.entity) || '';
      const name    = p.name || p.entity.split('.').pop().replace(/_/g,' ');
      const border  = i > 0 ? 'border-top:1.5px solid rgba(255,255,255,.30);' : '';

      return `<div class="active-row" id="np-${p.entity.replace(/\./g,'_')}" data-entity="${p.entity}" style="${border}cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none">
        <div class="media-art">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            ${playing
              ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
              : '<polygon points="5 3 19 12 5 21 5 3"/>'}
          </svg>
        </div>
        <div class="media-info">
          <div class="media-title">${title}</div>
          ${source ? `<div class="media-source">${source}</div>` : ''}
          <div class="media-room">${name}</div>
        </div>
        <div class="media-state" style="color:${playing ? '#60a5fa' : '#fbbf24'}">
          ${playing ? 'Playing' : 'Paused'}
        </div>
      </div>`;
    }).join('');

    const idleHtml = idle.map(p => {
      const name = p.name || p.entity.split('.').pop().replace(/_/g,' ');
      return `<div class="idle-row">
        <div class="idle-dot"></div>
        <div class="idle-lbl">${name}</div>
        <div class="idle-state">Idle</div>
      </div>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
        *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
        .wrap{border-radius:10px;border:1.5px solid rgba(255,255,255,.40);overflow:hidden}
        .card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px;border-bottom:1.5px solid rgba(255,255,255,.28)}
        .active-row{display:flex;align-items:center;gap:12px;padding:11px 14px;transition:filter .1s}
        .active-row:active{filter:brightness(.85)}
        .media-art{width:44px;height:44px;border-radius:7px;background:rgba(96,165,250,.1);border:1.5px solid rgba(96,165,250,.40);flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .media-info{flex:1;min-width:0}
        .media-title{font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
        .media-source{font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .media-room{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#60a5fa;margin-top:3px}
        .media-state{font-size:10px;font-weight:700;flex-shrink:0;text-transform:uppercase;letter-spacing:.04em}
        .idle-row{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1.5px solid rgba(255,255,255,.30);opacity:.35}
        .idle-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.75);flex-shrink:0}
        .idle-lbl{font-size:11px;color:rgba(255,255,255,.5);flex:1}
        .idle-state{font-size:10px;color:rgba(255,255,255,.3);font-weight:600}

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
        <div class="wrap">
          <div class="card-hdr">Now playing</div>
          ${activeHtml}
          ${idleHtml}
        </div>
      </ha-card>`;

    // Attach tap → more-info on active rows
    this.shadowRoot.querySelectorAll('.active-row').forEach(row => {
      row.addEventListener('click', () => this._moreInfo(row.dataset.entity));
    });
  }
}

customElements.define('now-playing-card', NowPlayingCard);
