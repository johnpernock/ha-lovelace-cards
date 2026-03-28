/**
 * jellyseerr-card.js  —  v2
 * Jellyseerr search + request card for Home Assistant Lovelace.
 *
 * Search for movies and TV shows via the Jellyseerr API, view request status,
 * and submit new requests — all from the dashboard.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/jellyseerr-card/jellyseerr-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/jellyseerr-card/jellyseerr-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:jellyseerr-card
 * url:     http://192.168.1.x:5055       # Jellyseerr base URL (no trailing slash)
 * api_key: YOUR_JELLYSEERR_API_KEY       # Settings → General → API Key
 * power_entity: switch.unraid_seerr      # optional — shows server status
 * max_results: 5                         # optional — search results to show (default 5)
 *
 * ── API KEY ───────────────────────────────────────────────────────────────────
 * Get your API key from Jellyseerr: Settings → General → API Key
 * Note: the API key is stored in YAML — use a secrets.yaml entry in production.
 *
 * ── REQUEST STATUS BADGES ─────────────────────────────────────────────────────
 * Jellyseerr status codes:
 *   1 = Unknown   2 = Pending   3 = Processing   4 = Partially Available
 *   5 = Available
 */

import { COLORS } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_BADGE } from '../../shared/ha-styles.js';

const STATUS_META = {
  1: { label: 'Unknown',     color: 'rgba(255,255,255,.35)',  bg: 'rgba(255,255,255,.06)',  border: 'rgba(255,255,255,.15)' },
  2: { label: 'Pending',     color: '#fbbf24',                bg: 'rgba(251,191,36,.08)',   border: 'rgba(251,191,36,.25)' },
  3: { label: 'Processing',  color: '#60a5fa',                bg: 'rgba(96,165,250,.08)',   border: 'rgba(96,165,250,.25)' },
  4: { label: 'Partial',     color: '#a78bfa',                bg: 'rgba(167,139,250,.08)',  border: 'rgba(167,139,250,.25)' },
  5: { label: 'Available',   color: '#4ade80',                bg: 'rgba(74,222,128,.08)',   border: 'rgba(74,222,128,.25)' },
};

class JellyseerrCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._results   = [];
    this._loading   = false;
    this._error     = null;
    this._requesting = {};   // result mediaId → true while requesting
    this._searchTimer = null;
  }

  static getStubConfig() {
    return {
      url:     'http://192.168.1.x:5055',
      api_key: 'your_api_key_here',
    };
  }
  static getConfigForm() {
    return {
      schema: [
      { name: 'url',           label: 'Jellyseerr URL',        selector: { text: {} } },
      { name: 'api_key',       label: 'API Key',               selector: { text: {} } },
      { name: 'power_entity',  label: 'Server power entity',   selector: { entity: {} } },
      { name: 'max_results',   label: 'Max search results',    selector: { number: { min: 1, max: 10, mode: 'box' } } },
    ],
      assertCustomElement: 'jellyseerr-card',
    };
  }


  setConfig(c) {
    if (!c.url)     throw new Error('jellyseerr-card: url required');
    if (!c.api_key) throw new Error('jellyseerr-card: api_key required');
    this._config = { max_results: 5, ...c };
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    // Update server status badge only
    if (this._config.power_entity) this._patchStatus();
  }

  getCardSize() { return 4; }

  disconnectedCallback() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }

  // ── API ────────────────────────────────────────────────────────────────────

  _headers() {
    return {
      'X-Api-Key': this._config.api_key,
      'Content-Type': 'application/json',
    };
  }

  async _search(query) {
    if (!query.trim()) { this._results = []; this._patchResults(); return; }
    this._loading = true;
    this._error   = null;
    this._patchResults();
    try {
      const res = await fetch(
        `${this._config.url}/api/v1/search?query=${encodeURIComponent(query)}&page=1`,
        { headers: this._headers() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._results = (data.results || []).slice(0, this._config.max_results);
    } catch(e) {
      this._error   = 'Search failed — check URL and API key';
      this._results = [];
      console.warn('jellyseerr-card: search error', e);
    }
    this._loading = false;
    this._patchResults();
  }

  async _request(result) {
    const id  = result.id;
    const key = `${result.mediaType}_${id}`;
    if (this._requesting[key]) return;
    this._requesting[key] = true;
    this._patchResultItem(result);
    try {
      const body = result.mediaType === 'movie'
        ? { mediaType: 'movie', mediaId: id }
        : { mediaType: 'tv',    mediaId: id, seasons: 'all' };
      const res = await fetch(`${this._config.url}/api/v1/request`, {
        method:  'POST',
        headers: this._headers(),
        body:    JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh this result's status by re-searching or patching status to pending
      result.mediaInfo = { status: 2 };  // Pending
    } catch(e) {
      console.warn('jellyseerr-card: request error', key, e);
    }
    this._requesting[key] = false;
    this._patchResultItem(result);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _css() {
    return `${CSS_RESET}${CSS_TAPPABLE}${CSS_BADGE}
      ha-card { padding: 0; }
      .wrap { border-radius: 10px; border: 1px solid rgba(255,255,255,.12); overflow: hidden; }
      .hdr  { font-size: 17px; font-weight: 700; color: white; letter-spacing: -.2px;
              padding: 10px 14px 9px; border-bottom: 1.5px solid rgba(255,255,255,.28);
              display: flex; align-items: center; gap: 8px; }
      .hdr-title { flex: 1; }
      .srv-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      /* Search */
      .search-wrap { padding: 10px 14px 8px; }
      .search-box  { display: flex; align-items: center; gap: 8px; height: 38px;
                     background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
                     border-radius: 8px; padding: 0 10px; }
      .search-input { flex: 1; background: transparent; border: none; outline: none;
                      color: #e2e8f0; font-size: 13px; font-family: inherit; }
      .search-input::placeholder { color: rgba(255,255,255,.25); }
      .search-icon { color: rgba(255,255,255,.3); font-size: 13px; flex-shrink: 0; }
      .search-clear { color: rgba(255,255,255,.3); font-size: 16px; cursor: pointer;
                      -webkit-tap-highlight-color: transparent; line-height: 1; padding: 2px; }
      /* Divider */
      .divider { height: 1px; background: rgba(255,255,255,.07); }
      /* Results */
      .results { }
      .result  { display: flex; align-items: center; gap: 10px; padding: 8px 14px; min-height: 52px; }
      .result + .result { border-top: 1px solid rgba(255,255,255,.07); }
      .r-poster { width: 30px; height: 44px; border-radius: 4px; flex-shrink: 0;
                  display: flex; align-items: center; justify-content: center; font-size: 16px; }
      .r-poster.movie { background: rgba(96,165,250,.10); border: 1px solid rgba(96,165,250,.20); }
      .r-poster.tv    { background: rgba(167,139,250,.10); border: 1px solid rgba(167,139,250,.20); }
      .r-info  { flex: 1; min-width: 0; }
      .r-title { font-size: 12px; font-weight: 700; color: #e2e8f0;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .r-sub   { font-size: 10px; color: rgba(255,255,255,.35); margin-top: 2px; }
      .r-btn   { font-size: 10px; font-weight: 700; padding: 5px 10px; border-radius: 6px;
                 cursor: pointer; -webkit-tap-highlight-color: transparent;
                 user-select: none; transition: transform .1s, filter .12s;
                 flex-shrink: 0; white-space: nowrap; text-transform: uppercase; letter-spacing: .04em; }
      .r-btn:active { transform: scale(.96); filter: brightness(.88); }
      .r-btn.request { background: rgba(74,222,128,.08); border: 1px solid rgba(74,222,128,.25); color: #4ade80; }
      .r-btn.loading  { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.3); pointer-events: none; }
      /* Status badges (for already-requested items) */
      .r-status { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px;
                  text-transform: uppercase; letter-spacing: .04em; flex-shrink: 0; }
      /* Loading / empty / error states */
      .state-msg { padding: 14px; font-size: 12px; color: rgba(255,255,255,.35); font-style: italic; text-align: center; }
      .state-msg.error { color: #f87171; font-style: normal; }
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    const power  = this._config.power_entity;
    const online = power ? this._hass?.states[power]?.state === 'on' : true;
    const dotClr = online ? '#4ade80' : '#f87171';

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap">
          <div class="hdr">
            <span class="hdr-title">Request</span>
            ${power ? `<div class="srv-dot" id="srv-dot" style="background:${dotClr}"></div>` : ''}
          </div>
          <div class="search-wrap">
            <div class="search-box">
              <span class="search-icon">⌕</span>
              <input class="search-input" id="search-input"
                     type="text" placeholder="Search movies &amp; shows…"
                     autocomplete="off" spellcheck="false" />
              <span class="search-clear" id="search-clear" style="display:none">✕</span>
            </div>
          </div>
          <div class="divider"></div>
          <div class="results" id="results"></div>
        </div>
      </ha-card>`;
    this._attachListeners();
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  _attachListeners() {
    const root  = this.shadowRoot;
    const input = root.getElementById('search-input');
    const clear = root.getElementById('search-clear');

    input?.addEventListener('input', () => {
      const q = input.value.trim();
      clear.style.display = q ? '' : 'none';
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this._search(q), 400);
    });

    clear?.addEventListener('click', () => {
      input.value = '';
      clear.style.display = 'none';
      this._results = [];
      this._patchResults();
      input.focus();
    });
  }

  // ── Patch ──────────────────────────────────────────────────────────────────

  _patchStatus() {
    const dot    = this.shadowRoot.getElementById('srv-dot');
    if (!dot) return;
    const online = this._hass?.states[this._config.power_entity]?.state === 'on';
    dot.style.background = online ? '#4ade80' : '#f87171';
  }

  _patchResults() {
    const container = this.shadowRoot.getElementById('results');
    if (!container) return;

    if (this._loading) {
      container.innerHTML = `<div class="state-msg">Searching…</div>`;
      return;
    }
    if (this._error) {
      container.innerHTML = `<div class="state-msg error">${this._error}</div>`;
      return;
    }
    if (!this._results.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = this._results.map(r => this._resultHtml(r)).join('');
    // Re-attach result click listeners
    container.querySelectorAll('[data-req]').forEach(btn => {
      const idx = parseInt(btn.dataset.req, 10);
      const result = this._results[idx];
      if (result) btn.addEventListener('click', () => this._request(result));
    });
  }

  _resultHtml(result) {
    const idx     = this._results.indexOf(result);
    const movie   = result.mediaType === 'movie';
    const title   = result.title || result.name || 'Unknown';
    const year    = result.releaseDate?.slice(0,4) || result.firstAirDate?.slice(0,4) || '';
    const status  = result.mediaInfo?.status;
    const key     = `${result.mediaType}_${result.id}`;
    const loading = this._requesting[key];
    const icon    = movie ? '🎬' : '📺';

    let actionHtml;
    if (loading) {
      actionHtml = `<div class="r-btn loading">…</div>`;
    } else if (status && status > 1) {
      const meta = STATUS_META[status] || STATUS_META[1];
      actionHtml = `<div class="r-status" style="color:${meta.color};background:${meta.bg};border:1px solid ${meta.border}">${meta.label}</div>`;
    } else {
      actionHtml = `<div class="r-btn request ha-tappable" data-req="${idx}">Request</div>`;
    }

    return `<div class="result" id="res-${result.id}-${result.mediaType}">
      <div class="r-poster ${movie?'movie':'tv'}">${icon}</div>
      <div class="r-info">
        <div class="r-title">${title}</div>
        <div class="r-sub">${[year, movie?'Movie':'TV Series'].filter(Boolean).join(' · ')}</div>
      </div>
      ${actionHtml}
    </div>`;
  }

  _patchResultItem(result) {
    const container = this.shadowRoot.getElementById('results');
    if (!container) return;
    const el = container.querySelector(`#res-${result.id}-${result.mediaType}`);
    if (!el) return;
    el.outerHTML = this._resultHtml(result);
    // Re-attach click if it's a Request button
    const btn = container.querySelector(`#res-${result.id}-${result.mediaType} [data-req]`);
    if (btn) {
      const idx = parseInt(btn.dataset.req, 10);
      const r   = this._results[idx];
      if (r) btn.addEventListener('click', () => this._request(r));
    }
  }
}

customElements.define('jellyseerr-card', JellyseerrCard);
