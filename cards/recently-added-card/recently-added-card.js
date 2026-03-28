/**
 * recently-added-card.js  —  v2
 * Standalone recently-added media card for Home Assistant Lovelace.
 * Extracted from technology-card (section: recently_added).
 *
 * Shows the N most recently imported movies and TV episodes from
 * Radarr and Sonarr REST sensors, sorted by import date.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/recently-added-card/recently-added-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/recently-added-card/recently-added-card.js
 *      Type: JavaScript Module
 *
 * ── SONARR REST SENSOR (configuration.yaml) ────────────────────────────────
 * rest:
 *   - resource: "http://RADARR_IP:7878/api/v3/history?pageSize=10&includeMovie=true"
 *     headers:
 *       X-Api-Key: !secret radarr_api_key
 *     scan_interval: 300
 *     sensor:
 *       - name: "Radarr Recent"
 *         value_template: "{{ value_json.records | length }}"
 *         json_attributes_path: "$"
 *         json_attributes: ["records"]
 *   - resource: "http://SONARR_IP:8989/api/v3/history?pageSize=10&includeSeries=true&includeEpisode=true"
 *     headers:
 *       X-Api-Key: !secret sonarr_api_key
 *     scan_interval: 300
 *     sensor:
 *       - name: "Sonarr Recent"
 *         value_template: "{{ value_json.records | length }}"
 *         json_attributes_path: "$"
 *         json_attributes: ["records"]
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:recently-added-card
 * sonarr_sensor: sensor.sonarr_recent        # optional — default shown
 * radarr_sensor: sensor.radarr_recent        # optional — default shown
 * max_items: 5                               # optional — default 5
 */

import { getAttr } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE } from '../../shared/ha-styles.js';

class RecentlyAddedCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._last   = null;   // cache key to avoid pointless re-renders
  }

  static getStubConfig() {
    return {
      sonarr_sensor: 'sensor.sonarr_recent',
      radarr_sensor: 'sensor.radarr_recent',
      max_items: 5,
    };
  }
  static getConfigForm() {
    return {
      schema: [
      { name: 'sonarr_sensor', label: 'Sonarr Recent sensor', selector: { entity: { domain: 'sensor' } } },
      { name: 'radarr_sensor', label: 'Radarr Recent sensor', selector: { entity: { domain: 'sensor' } } },
      { name: 'max_items',     label: 'Max items to show',    selector: { number: { min: 1, max: 20, mode: 'box' } } },
    ],
      assertCustomElement: 'recently-added-card',
    };
  }


  setConfig(c) {
    this._config = {
      sonarr_sensor: 'sensor.sonarr_recent',
      radarr_sensor: 'sensor.radarr_recent',
      max_items: 5,
      ...c,
    };
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    // Only patch when sensor values actually change
    const key = this._cacheKey();
    if (key !== this._last) { this._last = key; this._patchList(); }
  }

  getCardSize() { return 4; }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _cacheKey() {
    const s = this._hass?.states[this._config.sonarr_sensor]?.last_updated;
    const r = this._hass?.states[this._config.radarr_sensor]?.last_updated;
    return `${s}|${r}`;
  }

  _attr(id, key) {
    return this._hass?.states[id]?.attributes?.[key] ?? null;
  }

  _timeAgo(dateStr) {
    if (!dateStr) return '';
    const d    = new Date(dateStr);
    if (isNaN(d)) return '';
    const diff = Math.round((Date.now() - d) / 60000);
    if (diff < 1)   return 'just now';
    if (diff < 60)  return `${diff}m ago`;
    if (diff < 1440) return `${Math.round(diff/60)}h ago`;
    const days = Math.round(diff / 1440);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  }

  _buildItems() {
    const sId = this._config.sonarr_sensor;
    const rId = this._config.radarr_sensor;
    const sRecords = this._attr(sId, 'records') || [];
    const rRecords = this._attr(rId, 'records') || [];
    const seen = new Set();
    const max  = this._config.max_items || 5;

    const tvItems = sRecords
      .filter(r => r.series?.title || r.seriesTitle || r.title || r.data?.importedPath || r.sourceTitle)
      .map(r => {
        let title = r.series?.title || r.seriesTitle || '';
        if (!title && r.title && !/\.mkv|\.mp4|\.avi/i.test(r.title)) title = r.title;
        if (!title && r.data?.importedPath) {
          const parts = r.data.importedPath.replace(/\\/g,'/').split('/').filter(Boolean);
          const file  = parts[parts.length-1] || '';
          const ep    = file.match(/S(\d+)E(\d+)/i);
          const show  = parts.length >= 3 ? parts[parts.length-3] : (parts[parts.length-2] || '');
          title = show + (ep ? ` S${ep[1].padStart(2,'0')}E${ep[2].padStart(2,'0')}` : '');
        }
        if (!title && r.sourceTitle) {
          title = (r.sourceTitle || '')
            .replace(/\.[^.]+$/, '')
            .replace(/\.?(\d{3,4}p|BluRay|WEB-?DL|WEBRip|HDTV|x264|x265|HEVC|AAC|AC3|DTS|REMUX|PROPER|REPACK)[^.]*/gi, '')
            .replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
        }
        // Sonarr v3: r.episode (singular)
        const ep   = r.episode || r.episodes?.[0];
        const sNum = r.seasonNumber ?? ep?.seasonNumber;
        const eNum = r.episodeNumber ?? ep?.episodeNumber;
        const epStr = (sNum != null && eNum != null)
          ? ` S${String(sNum).padStart(2,'0')}E${String(eNum).padStart(2,'0')}` : '';
        return { title: title + epStr, type: 'tv', date: r.date || r.airDateUtc };
      });

    const movieItems = rRecords
      .filter(r => r.movie?.title)
      .map(r => ({
        title: r.movie.title + (r.movie.year ? ` (${r.movie.year})` : ''),
        type: 'movie', date: r.date,
      }));

    return [...tvItems, ...movieItems]
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .filter(item => { if (seen.has(item.title)) return false; seen.add(item.title); return true; })
      .slice(0, max);
  }

  _itemsHtml(items) {
    if (!items.length) {
      return `<div class="empty">No recent additions — confirm REST sensors are active</div>`;
    }
    return items.map(item => {
      const movie = item.type === 'movie';
      return `<div class="item">
        <div class="poster">${movie ? 'MOV' : 'TV'}</div>
        <div class="info">
          <div class="title">${item.title}</div>
          <div class="meta">${this._timeAgo(item.date)}</div>
        </div>
        <div class="badge badge-${movie ? 'movie' : 'tv'}">${movie ? 'Movie' : 'TV'}</div>
      </div>`;
    }).join('');
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _css() {
    return `${CSS_RESET}
      ha-card { padding: 0; }
      .wrap  { border-radius: 10px; overflow: hidden; }
      .hdr   { font-size: 17px; font-weight: 700; color: white; letter-spacing: -.2px;
               padding: 10px 14px 9px; border-bottom: 1.5px solid rgba(255,255,255,.28); }
      .list  { padding: 4px 0; }
      .item  { display: flex; align-items: center; gap: 10px; padding: 8px 14px; }
      .item + .item { border-top: 1.5px solid rgba(255,255,255,.07); }
      .poster { width: 30px; height: 44px; border-radius: 4px; background: rgba(255,255,255,.08);
                flex-shrink: 0; display: flex; align-items: center; justify-content: center;
                font-size: 8px; font-weight: 700; color: rgba(255,255,255,.25); text-transform: uppercase; }
      .info   { flex: 1; min-width: 0; }
      .title  { font-size: 13px; font-weight: 700; color: #e2e8f0;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .meta   { font-size: 11px; color: rgba(255,255,255,.35); margin-top: 2px; }
      .badge  { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
                text-transform: uppercase; letter-spacing: .05em; flex-shrink: 0; }
      .badge-movie { background: rgba(96,165,250,.12);  color: #60a5fa; border: 1px solid rgba(96,165,250,.25); }
      .badge-tv    { background: rgba(167,139,250,.12); color: #a78bfa; border: 1px solid rgba(167,139,250,.25); }
      .empty  { padding: 16px 14px; font-size: 12px; color: rgba(255,255,255,.35); font-style: italic; }
    `;
  }

  // ── Render / Patch ─────────────────────────────────────────────────────────

  _render() {
    const items = this._buildItems();
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap">
          <div class="hdr">Recently Added</div>
          <div class="list" id="list">${this._itemsHtml(items)}</div>
        </div>
      </ha-card>`;
    this._last = this._cacheKey();
  }

  _patchList() {
    const list = this.shadowRoot.getElementById('list');
    if (!list) return;
    list.innerHTML = this._itemsHtml(this._buildItems());
  }
}

customElements.define('recently-added-card', RecentlyAddedCard);
