/**
 * network-speed-card.js  —  v2
 * Speedtest results with sparkline history.
 * Extracted from technology-card. Standalone — use independently anywhere.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/network-speed-card/network-speed-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/network-speed-card/network-speed-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:network-speed-card
 * entities:
  speedtest_download: sensor.speedtest_download     # required
  speedtest_upload:   sensor.speedtest_upload
  speedtest_ping:     sensor.speedtest_ping         # optional
 */

import { COLORS, getVal, getAttr, getNum } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_SECTION } from '../../shared/ha-styles.js';

class NetworkSpeedCardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
    this._history = {};  // sparkline history buffer
  }

  static getStubConfig() { return { entities: {
        speedtest_download: 'sensor.speedtest_download',
        speedtest_upload:   'sensor.speedtest_upload',
        speedtest_ping:     'sensor.speedtest_ping',
      } }; }
  static getConfigForm() {
    return {
      schema: { name: 'entities', type: 'grid', schema: [
      { name: 'speedtest_download', label: 'Download (sensor)', selector: { entity: { domain: 'sensor' } } },
      { name: 'speedtest_upload',   label: 'Upload (sensor)',   selector: { entity: { domain: 'sensor' } } },
      { name: 'speedtest_ping',     label: 'Ping (sensor)',     selector: { entity: { domain: 'sensor' } } },
    ] },
      assertCustomElement: 'network-speed-card',
    };
  }


  setConfig(c) {
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    // Speed card buffers history on each update
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 3; }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  _e(k)   { const id = this._config.entities?.[k]; return id || null; }

_e(k)      { return this._config.entities?.[k]; }

_num(id)   {
    const s = this._val(id);
    if (!s || s === 'unavailable' || s === 'unknown') return null;
    const v = parseFloat(s); return isNaN(v) ? null : v;
  }

_spark(id, color) {
    const hist = this._history[id] || [];
    if (hist.length < 2) {
      if (id && this._hass && !this._fetchingHistory?.[id]) {
        this._fetchingHistory = this._fetchingHistory || {};
        this._fetchingHistory[id] = true;
        const end = new Date().toISOString();
        const start = new Date(Date.now() - 24*60*60*1000).toISOString();
        this._hass.callApi('GET', `history/period/${start}?filter_entity_id=${id}&end_time=${end}&minimal_response=true`)
          .then(data => {
            const series = Array.isArray(data) ? data[0] : null;
            if (series?.length) {
              this._history[id] = series.map(s => parseFloat(s.s ?? s.state)).filter(v => !isNaN(v));
              this._fetchingHistory[id] = false;
              this._render();
            }
          }).catch(() => { this._fetchingHistory[id] = false; });
      }
      return `<svg class="spark" viewBox="0 0 100 24"><line x1="0" y1="12" x2="100" y2="12" stroke="${color}" stroke-width="1.5" opacity=".35"/></svg>`;
    }
    const mn = Math.min(...hist), mx = Math.max(...hist), r = mx-mn||1;
    const pts = hist.map((v,i) => `${((i/(hist.length-1))*100).toFixed(1)},${(22-((v-mn)/r)*18).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────
  _css() {
    return `${CSS_RESET}${CSS_TAPPABLE}${CSS_SECTION}

    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card { overflow: hidden; }
    .card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px;border-bottom:1.5px solid rgba(255,255,255,.28)}
    .sec{padding:8px 14px 12px;display:flex;flex-direction:column;gap:8px}
    .placeholder{font-size:12px;color:rgba(255,255,255,.25);padding:4px 0;font-style:italic}
    .big-row{display:flex;align-items:center;gap:12px;padding:10px 14px}
    .big-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0}
    .big-label{font-size:18px;font-weight:700;line-height:1}
    .big-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:2px}
    .sdot{border-radius:50%;flex-shrink:0;display:inline-block}
    .green{background:#4ade80}.red{background:#f87171}.amber{background:#fbbf24}
    .chips{display:flex;gap:6px;flex-wrap:wrap}
    .chip{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:7px;border:1.5px solid rgba(255,255,255,.40);background:rgba(255,255,255,0)}
    .chip-lbl{font-size:11px;color:rgba(255,255,255,.45)}
    .chip-val{font-size:13px;font-weight:700;color:#e2e8f0;margin-left:2px}
    .speed-row{display:flex;gap:6px}
    .speed-item{flex:1;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30);border-radius:8px;padding:8px 10px}
    .speed-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3);margin-bottom:3px}
    .speed-val{font-size:17px;font-weight:700;color:#e2e8f0}
    .speed-unit{font-size:11px;color:rgba(255,255,255,.3);margin-left:2px}
    .spark{display:block;height:24px;width:100%;margin-top:5px}
    .ink-row{display:flex;gap:6px}
    .ink-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
    .ink-bar-wrap{width:100%;height:52px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.12);border-radius:6px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
    .ink-bar{width:100%;border-radius:0}
    .ink-pct{font-size:12px;font-weight:700;color:#e2e8f0}
    .ink-label{font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase}
    .ink-warn{font-size:9px;font-weight:700;color:#fbbf24}
    .rbtn{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-radius:8px;border:1.5px solid rgba(255,255,255,.40);background:rgba(255,255,255,0);cursor:pointer;user-select:none;transition:background .12s;-webkit-tap-highlight-color:transparent}
    .rbtn:active{background:rgba(255,255,255,.09)}
    .rbtn-left{display:flex;align-items:center;gap:9px}
    .rbtn-icon{width:30px;height:30px;border-radius:7px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.40);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .rbtn-name{font-size:13px;font-weight:700;color:#e2e8f0}
    .rbtn-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .rbtn.danger{border-color:rgba(239,68,68,.25);background:rgba(239,68,68,.05)}
    .ap-row{display:flex;align-items:center;justify-content:space-between}
    .ap-left{display:flex;align-items:center;gap:9px}
    .ap-name{font-size:13px;font-weight:700;color:#e2e8f0}
    .ap-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .services{display:flex;gap:6px;flex-wrap:wrap}
    .svc{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:6px;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30)}
    .svc-lbl{font-size:12px;font-weight:600}
    .media-item{display:flex;align-items:center;gap:10px;padding:7px 0}
    .media-item+.media-item{border-top:1.5px solid rgba(255,255,255,.28)}
    .media-poster{width:32px;height:46px;border-radius:4px;background:rgba(255,255,255,.08);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:rgba(255,255,255,.25);text-transform:uppercase}
    .media-info{flex:1;min-width:0}
    .media-title{font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .media-meta{font-size:11px;color:rgba(255,255,255,.35);margin-top:2px}
    .badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0}
    .badge-movie{background:rgba(96,165,250,.15);color:#60a5fa}
    .badge-tv{background:rgba(167,139,250,.15);color:#a78bfa}
    .storage-row{display:flex;align-items:center;gap:10px}
    .storage-lbl{font-size:12px;color:rgba(255,255,255,.4);width:52px;flex-shrink:0}
    .storage-bar-wrap{flex:1;height:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .storage-bar{height:100%;border-radius:99px;transition:width .3s}
    .storage-pct{font-size:12px;font-weight:700;color:rgba(255,255,255,.5);width:32px;text-align:right;flex-shrink:0}
    .storage-detail{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.22);margin-top:-3px}
    .stat-row{display:flex;align-items:center;justify-content:space-between}
    .stat-left{display:flex;align-items:center;gap:9px}
    .stat-name{font-size:14px;font-weight:700;color:#e2e8f0}
    .stat-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);align-items:flex-end;justify-content:center;z-index:9999}
    .overlay.open{display:flex}
    .sheet{background:var(--card-background-color,#1e1e1e);border:1.5px solid rgba(255,255,255,.40);border-radius:16px 16px 0 0;border-bottom:none;padding:0 0 16px;width:100%;max-width:100%}
    @media(min-width:768px){
      .overlay{align-items:center;justify-content:center;padding:24px}
      .sheet{max-width:420px;border-radius:16px;border-bottom:1.5px solid rgba(255,255,255,.40)}
      .sheet-handle{display:none!important}
    }
    .sheet-handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);margin:12px auto 8px}
    .sheet-head{display:flex;align-items:flex-start;justify-content:space-between;padding:0 16px 12px;border-bottom:1.5px solid rgba(255,255,255,.30)}
    .sheet-title{font-size:16px;font-weight:700;color:#e2e8f0;margin-bottom:3px}
    .sheet-sub{font-size:12px;color:rgba(255,255,255,.4);line-height:1.5}
    .sheet-close{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.08);cursor:pointer;color:rgba(255,255,255,.6);font-size:17px;display:flex;align-items:center;justify-content:center;border:none;flex-shrink:0}
    .sheet-body{padding:14px 16px 0}
    .sheet-btns{display:flex;gap:8px}
    .btn-yes{flex:1;height:40px;border-radius:8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;font-size:14px;font-weight:700;cursor:pointer}
    .btn-yes:active{background:rgba(239,68,68,.25)}
    .btn-no{flex:1;height:40px;border-radius:8px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.40);color:rgba(255,255,255,.5);font-size:14px;font-weight:700;cursor:pointer}
    .btn-no:active{background:rgba(255,255,255,.12)}
  `; }

  _ico(path, c, s) {
    return `<svg width="${s||14}" height="${s||14}" viewBox="0 0 24 24" fill="none" stroke="${c||'rgba(255,255,255,.5)'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>    `;
  }

  // ── Render / Patch ──────────────────────────────────────────────────────────
  _render() {
    const inner = this._buildSpeed();
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><ha-card>${inner}</ha-card>`;
    this._listen();
  }

  _patch() {
    const inner = this._buildSpeed();
    const haCard = this.shadowRoot.querySelector('ha-card');
    if (!haCard) { this._render(); return; }
    haCard.innerHTML = inner;
    this._listen();
  }

  // ── Section builder (from technology-card) ───────────────────────────────────
  _buildSpeed() {
    const dlId   = this._e('speedtest_download') || 'sensor.speedtest_download';
    const ulId   = this._e('speedtest_upload')   || 'sensor.speedtest_upload';
    const pingId = this._e('speedtest_ping')      || 'sensor.speedtest_ping';
    const dl = this._num(dlId), ul = this._num(ulId), ping = this._num(pingId);
    if (dl != null) {
      if (!this._history[dlId]) this._history[dlId] = [];
      const h = this._history[dlId];
      if (!h.length || h[h.length-1] !== dl) { h.push(dl); if (h.length > 20) h.shift(); }
    }
    if (ul != null) {
      if (!this._history[ulId]) this._history[ulId] = [];
      const h = this._history[ulId];
      if (!h.length || h[h.length-1] !== ul) { h.push(ul); if (h.length > 20) h.shift(); }
    }
    return `<div class="card">
      <div class="card-hdr">Internet Speed${ping!=null?` <span style="font-weight:400;color:rgba(255,255,255,.3);font-size:9px;margin-left:6px">${Math.round(ping)} ms</span>`:''}</div>
      <div class="sec">
        <div class="speed-row">
          <div class="speed-item">
            <div class="speed-lbl">Download</div>
            <div><span class="speed-val">${dl!=null?Math.round(dl):'—'}</span>${dl!=null?'<span class="speed-unit">Mbps</span>':''}</div>
            ${this._spark(dlId,'#47cfea')}
          </div>
          <div class="speed-item">
            <div class="speed-lbl">Upload</div>
            <div><span class="speed-val">${ul!=null?Math.round(ul):'—'}</span>${ul!=null?'<span class="speed-unit">Mbps</span>':''}</div>
            ${this._spark(ulId,'#fa880d')}
          </div>
        </div>
      </div>
    </div>`;
  }
}

customElements.define('network-speed-card', NetworkSpeedCardCard);
