/**
 * technology-card.js  —  v22
 *
 * One card, one section. Use multiple instances in a masonry view.
 *
 * SECTIONS: network · speed · ink · controls · access_points ·
 *           services · now_playing · recently_added · immich · storage
 */

class TechnologyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._history   = {};
    this._apiCache  = {};
    this._fetching  = {};
    this._CACHE_TTL = 60000;
  }

  setConfig(c) {
    if (!c.section) throw new Error('technology-card: section is required');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    // Update speedtest history buffer first
    ['speedtest_download','speedtest_upload'].forEach(k => {
      const id = this._e(k);
      if (!id) return;
      const v = this._num(id);
      if (v == null) return;
      if (!this._history[id]) this._history[id] = [];
      const arr = this._history[id];
      if (!arr.length || arr[arr.length-1] !== v) { arr.push(v); if (arr.length > 20) arr.shift(); }
    });
    if (!this.shadowRoot.querySelector('ha-card') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 3; }

  _e(k)      { return this._config.entities?.[k]; }
  _s(id)     { return id ? this._hass?.states[id] : null; }
  _val(id)   { return this._s(id)?.state; }
  _attr(id,k){ return this._s(id)?.attributes?.[k] ?? null; }
  _num(id)   {
    const s = this._val(id);
    if (!s || s === 'unavailable' || s === 'unknown') return null;
    const v = parseFloat(s); return isNaN(v) ? null : v;
  }
  _isOn(id)  {
    const v = this._val(id)?.toLowerCase();
    if (!v || v === 'unavailable' || v === 'unknown') return false;
    if (v === 'not_home' || v === 'off' || v === 'exited' || v === 'disconnected') return false;
    return ['on','online','home','playing','paused','running','started','connected'].includes(v);
  }
  _call(domain,svc,data) { this._hass?.callService(domain,svc,data||{}); }
  _fmtGB(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    if (n >= 1000) return (n/1000).toFixed(1)+' TB';
    return Math.round(n)+' GB';
  }

  async _fetch(key, url, headers) {
    const now = Date.now();
    if (this._apiCache[key] && now - this._apiCache[key].ts < this._CACHE_TTL)
      return this._apiCache[key].data;
    if (this._fetching[key]) return this._apiCache[key]?.data || null;
    this._fetching[key] = true;
    try {
      const res  = await fetch(url, { headers });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      this._apiCache[key] = { data, ts: now };
      this._fetching[key] = false;
      this._render();
      return data;
    } catch(e) {
      console.warn('technology-card fetch error:', key, e);
      this._fetching[key] = false;
      return this._apiCache[key]?.data || null;
    }
  }

  _timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff/60000);
    if (m < 60)  return m <= 1 ? 'Just now' : `${m}m ago`;
    const h = Math.floor(m/60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h/24);
    return `${d}d ago`;
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

  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card{border-radius:10px;border:1.5px solid rgba(255,255,255,.40);overflow:hidden}
    .card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px}
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
    .ink-bar-wrap{width:100%;height:52px;background:rgba(255,255,255,.06);border-radius:6px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
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
    return `<svg width="${s||14}" height="${s||14}" viewBox="0 0 24 24" fill="none" stroke="${c||'rgba(255,255,255,.5)'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  _buildNetwork() {
    const apIds = [this._e('ap_hallway'), this._e('ap_family_room')].filter(Boolean);
    const apsOn = !apIds.length || apIds.every(id => this._isOn(id));
    const apAny = apIds.some(id => this._isOn(id));
    const wanOn = apAny;
    const wC = wanOn ? '74,222,128' : '239,68,68';
    const aC = apsOn ? '74,222,128' : apAny ? '251,191,36' : '239,68,68';
    const wDot = wanOn?'green':'red', aDot = apsOn?'green':apAny?'amber':'red';
    const wTxt = wanOn?'Connected':'No internet';
    const aTxt = apsOn?'All access points online':apAny?'Some APs offline':'WiFi offline';
    const wLbl = wanOn?'#4ade80':'#f87171', aLbl = apsOn?'#4ade80':apAny?'#fbbf24':'#f87171';
    const main  = this._val(this._e('clients_main'))  || '—';
    const iot   = this._val(this._e('clients_iot'))   || '—';
    const guest = this._val(this._e('clients_guest')) || '—';
    return `<div class="card">
      <div class="card-hdr">Network</div>
      <div class="big-row" style="background:rgba(255,255,255,0);border-bottom:1.5px solid rgba(${wC},.45)">
        <div class="big-dot sdot ${wDot}" style="width:16px;height:16px"></div>
        <div><div class="big-label" style="color:${wLbl}">Internet</div><div class="big-sub">${wTxt}</div></div>
      </div>
      <div class="big-row" style="background:rgba(255,255,255,0);border-bottom:1.5px solid rgba(255,255,255,.30)">
        <div class="big-dot sdot ${aDot}" style="width:16px;height:16px"></div>
        <div><div class="big-label" style="color:${aLbl}">WiFi</div><div class="big-sub">${aTxt}</div></div>
      </div>
      <div class="sec" style="padding-top:10px">
        <div class="chips">
          <div class="chip"><span class="sdot green" style="width:9px;height:9px;margin-right:2px"></span><span class="chip-lbl">Main</span><span class="chip-val">${main}</span></div>
          <div class="chip"><span class="sdot amber" style="width:9px;height:9px;margin-right:2px"></span><span class="chip-lbl">IoT</span><span class="chip-val">${iot}</span></div>
          <div class="chip"><span class="sdot" style="width:9px;height:9px;margin-right:2px;background:#a78bfa"></span><span class="chip-lbl">Guest</span><span class="chip-val">${guest}</span></div>
        </div>
      </div>
    </div>`;
  }

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

  _buildInk() {
    const inks = [
      {k:'ink_black',  lbl:'K', c:'#aaa'},
      {k:'ink_cyan',   lbl:'C', c:'#06b6d4'},
      {k:'ink_magenta',lbl:'M', c:'#ec4899'},
      {k:'ink_yellow', lbl:'Y', c:'#eab308'},
    ];
    const bars = inks.map(ink => {
      const pct = this._num(this._e(ink.k));
      const low = pct != null && pct < 20;
      const h   = pct != null ? Math.max(4,pct) : 0;
      return `<div class="ink-item">
        <div class="ink-bar-wrap"><div class="ink-bar" style="height:${h}%;background:${ink.c}"></div></div>
        <div class="ink-pct" style="${low?'color:#fbbf24':''}">${pct!=null?Math.round(pct)+'%':'—'}</div>
        <div class="ink-label">${ink.lbl}</div>
        ${low?'<div class="ink-warn">Low</div>':''}
      </div>`;
    }).join('');
    return `<div class="card"><div class="card-hdr">Printer Ink</div><div class="sec"><div class="ink-row">${bars}</div></div></div>`;
  }

  _buildControls() {
    const btns = (this._config.restart_buttons||[]).map((b,i) => {
      const d  = b.danger===true;
      const ic = d?'#f87171':'rgba(255,255,255,.5)';
      const ib = d?'background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3)':'';
      const restartPath = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
      return `<div class="rbtn${d?' danger':''}" data-idx="${i}">
        <div class="rbtn-left">
          <div class="rbtn-icon" style="${ib}">${this._ico(restartPath,ic,14)}</div>
          <div><div class="rbtn-name"${d?' style="color:#f87171"':''}>${b.name}</div><div class="rbtn-sub">${b.subtitle||''}</div></div>
        </div>
        <div style="font-size:16px;color:${d?'#f87171':'rgba(255,255,255,.3)'}">›</div>
      </div>`;
    }).join('');
    return `<div class="card">
      <div class="card-hdr">WiFi Controls</div>
      <div class="sec">${btns}</div>
    </div>
    <div class="overlay" id="ov">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <div><div class="sheet-title" id="ov-title"></div><div class="sheet-sub" id="ov-sub"></div></div>
          <button class="sheet-close" id="ov-x">×</button>
        </div>
        <div class="sheet-body"><div class="sheet-btns">
          <button class="btn-yes" id="ov-yes">Yes, restart</button>
          <button class="btn-no"  id="ov-no">Cancel</button>
        </div></div>
      </div>
    </div>`;
  }

  _buildAccessPoints() {
    const rows = (this._config.access_points||[]).map(ap => {
      const on  = ap.entity ? this._isOn(ap.entity) : false;
      const sub = [ap.clients_entity?this._val(ap.clients_entity)+' clients':null, ap.bands||null].filter(Boolean).join(' · ');
      return `<div class="ap-row">
        <div class="ap-left">
          <span class="sdot ${on?'green':'red'}" style="width:10px;height:10px"></span>
          <div><div class="ap-name">${ap.name}</div>${sub?`<div class="ap-sub">${sub}</div>`:''}</div>
        </div>
      </div>`;
    }).join('');
    return `<div class="card"><div class="card-hdr">Access Points</div><div class="sec">${rows||'<div class="placeholder">No APs configured</div>'}</div></div>`;
  }

  _buildServices() {
    const svcs = (this._config.services||[]).map(s => {
      const on  = s.entity ? this._isOn(s.entity) : (s.assume_online !== false);
      const bg  = on ? 'rgba(74,222,128,.08)'  : 'rgba(239,68,68,.08)';
      const bc  = on ? 'rgba(74,222,128,.25)'  : 'rgba(239,68,68,.3)';
      const dc  = on ? '#4ade80' : '#f87171';
      const tc  = on ? 'rgba(255,255,255,.7)' : '#f87171';
      return `<div class="svc" style="background:${bg};border-color:${bc}">
        <span class="sdot" style="width:7px;height:7px;background:${dc}"></span>
        <span class="svc-lbl" style="color:${tc}">${s.name}</span>
      </div>`;
    }).join('');
    return `<div class="card"><div class="card-hdr">Services</div><div class="sec"><div class="services">${svcs||'<div class="placeholder">No services configured</div>'}</div></div></div>`;
  }

  _buildRecentlyAdded() {
    const sId = this._config.entities?.sonarr_recent || 'sensor.sonarr_recent';
    const rId = this._config.entities?.radarr_recent || 'sensor.radarr_recent';
    const sRecords = this._attr(sId,'records') || [];
    const rRecords = this._attr(rId,'records') || [];
    const seen = new Set();
    const items = [
      ...sRecords
        .filter(r => r.data?.importedPath || r.sourceTitle)
        .map(r => {
          let title = r.sourceTitle || '';
          if (r.data?.importedPath) {
            const parts = r.data.importedPath.replace(/\\/g,'/').split('/').filter(Boolean);
            const file = parts[parts.length-1] || '';
            const ep = file.match(/S(\d+)E(\d+)/i);
            const showName = parts.length >= 3 ? parts[parts.length-3] : (parts[parts.length-2] || '');
            title = showName + (ep ? ' S'+ep[1].padStart(2,'0')+'E'+ep[2].padStart(2,'0') : '');
          }
          return { title, type:'tv', date:r.date };
        }),
      ...rRecords
        .filter(r => r.movie?.title)
        .map(r => ({
          title: r.movie.title + (r.movie.year ? ' ('+r.movie.year+')' : ''),
          type:'movie', date:r.date,
        })),
    ]
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .filter(item => { if (seen.has(item.title)) return false; seen.add(item.title); return true; })
    .slice(0,3);
    const rows = items.length ? items.map(item=>`
      <div class="media-item">
        <div class="media-poster">${item.type==='movie'?'MOV':'TV'}</div>
        <div class="media-info">
          <div class="media-title">${item.title}</div>
          <div class="media-meta">${this._timeAgo(item.date)}</div>
        </div>
        <div class="badge badge-${item.type==='movie'?'movie':'tv'}">${item.type==='movie'?'Movie':'TV'}</div>
      </div>`).join('')
      : `<div class="placeholder">No recent additions — confirm REST sensors are active</div>`;
    return `<div class="card"><div class="card-hdr">Recently Added</div><div class="sec" style="gap:0">${rows}</div></div>`;
  }

  _buildImmich() {
    const onlineId = this._e('immich_status');
    const photosId = this._e('immich_photos');
    const videosId = this._e('immich_videos');
    const diskAvId = this._e('immich_disk_available');
    const diskSzId = this._e('immich_disk_size');
    const online = onlineId ? this._isOn(onlineId) : true;
    const photos = this._val(photosId);
    const videos = this._val(videosId);
    const avail  = this._val(diskAvId);
    const total  = this._val(diskSzId);
    const avN = parseFloat(avail), totN = parseFloat(total);
    const usedPct = (!isNaN(avN) && !isNaN(totN) && totN > 0) ? Math.round(((totN-avN)/totN)*100) : null;
    const warn = usedPct != null && usedPct > 85;
    return `<div class="card">
      <div class="card-hdr">Immich</div>
      <div class="sec">
        <div class="stat-row">
          <div class="stat-left">
            <span class="sdot ${online?'green':'red'}" style="width:10px;height:10px"></span>
            <div>
              <div class="stat-name">${photos!=null?Number(photos).toLocaleString()+' photos':'—'}</div>
              ${videos!=null?`<div class="stat-sub">${Number(videos).toLocaleString()} videos</div>`:''}
            </div>
          </div>
        </div>
        ${usedPct!=null?`<div class="storage-row">
          <div class="storage-lbl" style="width:40px">Disk</div>
          <div class="storage-bar-wrap"><div class="storage-bar" style="width:${usedPct}%;background:${warn?'#f87171':'#60a5fa'}"></div></div>
          <div class="storage-pct" style="${warn?'color:#f87171':''}">${usedPct}%</div>
        </div>
        <div class="storage-detail"><span>${this._fmtGB(parseFloat(avail))} free</span><span>${this._fmtGB(parseFloat(total))} total</span></div>`:''}
      </div>
    </div>`;
  }

  _buildStorage() {
    const drives = this._config.storage_drives || [];
    const rows   = drives.map(d => {
      if (d.free_space) {
        const freeGb = this._num(d.entity);
        return `<div class="storage-row"><div class="storage-lbl">${d.name}</div><div style="flex:1;font-size:13px;font-weight:700;color:#e2e8f0">${this._fmtGB(freeGb)} free</div></div>`;
      }
      const pct  = d.entity ? (this._num(d.entity)??null) : (d.percent??null);
      const used = d.used_entity ? this._val(d.used_entity) : d.used;
      const free = d.free_entity ? this._val(d.free_entity) : d.free;
      const w    = pct!=null ? Math.min(100,Math.round(pct)) : 0;
      const warn = pct!=null && pct > 85;
      return `<div class="storage-row">
        <div class="storage-lbl">${d.name}</div>
        <div class="storage-bar-wrap"><div class="storage-bar" style="width:${w}%;background:${warn?'#f87171':'#60a5fa'}"></div></div>
        <div class="storage-pct" style="${warn?'color:#f87171':''}">${pct!=null?Math.round(pct)+'%':'—'}</div>
      </div>
      ${(used||free)?`<div class="storage-detail"><span>${used?this._fmtGB(parseFloat(used))+' used':''}</span><span>${free?this._fmtGB(parseFloat(free))+' free':''}</span></div>`:''}`;
    }).join('');
    const parityId   = this._config.parity_entity;
    const parityProg = this._config.parity_progress_entity;
    const paritySpd  = this._config.parity_speed_entity;
    let parityHtml   = '';
    if (parityId) {
      const state = this._val(parityId);
      if (state === 'running' || state === 'paused') {
        const prog  = this._num(parityProg);
        const speed = this._num(paritySpd);
        const color = state === 'paused' ? '#fbbf24' : '#60a5fa';
        const label = state === 'paused' ? 'Paused' : 'Running';
        parityHtml = `<div style="border-top:1.5px solid rgba(255,255,255,.18);padding-top:8px;margin-top:2px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3);margin-bottom:6px">Parity · ${label}</div>
          <div class="storage-row">
            <div class="storage-lbl" style="font-size:11px">${prog!=null?Math.round(prog)+'%':'—'}</div>
            <div class="storage-bar-wrap"><div class="storage-bar" style="width:${prog??0}%;background:${color}"></div></div>
            ${speed!=null?'<div style="font-size:11px;color:rgba(255,255,255,.4);flex-shrink:0;width:64px;text-align:right">'+Math.round(speed)+' MB/s</div>':''}
          </div>
        </div>`;
      }
    }
    return `<div class="card"><div class="card-hdr">Storage</div><div class="sec">${rows||'<div class="placeholder">No drives configured</div>'}${parityHtml}</div></div>`;
  }

  _buildServerHealth() {
    const cpuPct  = this._num(this._e('cpu_usage')  || 'sensor.unraid_cpu_utilization');
    const cpuTemp = this._num(this._e('cpu_temp')   || 'sensor.unraid_cpu_temperature');
    const ramPct  = this._num(this._e('ram_usage')  || 'sensor.unraid_ram_usage');
    const disks   = this._config.disk_temps || [];
    const bar = (pct, color, warn) => `<div style="flex:1;height:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden">
      <div style="height:100%;width:${Math.min(100,Math.round(pct||0))}%;background:${warn?'#f87171':color};border-radius:99px"></div>
    </div>`;
    const statRow = (label, val, barHtml) => `<div style="display:flex;align-items:center;gap:8px;padding:2px 0">
      <div style="font-size:12px;color:rgba(255,255,255,.4);width:36px;flex-shrink:0">${label}</div>
      ${barHtml}
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.6);width:38px;text-align:right;flex-shrink:0">${val}</div>
    </div>`;
    const cpuWarn = cpuPct != null && cpuPct > 80;
    const ramWarn = ramPct != null && ramPct > 85;
    const statsHtml = `
      ${cpuPct!=null ? statRow('CPU', Math.round(cpuPct)+'%', bar(cpuPct,'#60a5fa',cpuWarn)) : ''}
      ${cpuTemp!=null ? `<div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:-2px;padding-left:44px">${Math.round(cpuTemp)}°C</div>` : ''}
      ${ramPct!=null ? statRow('RAM', Math.round(ramPct)+'%', bar(ramPct,'#a78bfa',ramWarn)) : ''}
    `;
    const diskPills = disks.map(d => {
      const t = this._num(d.entity);
      if (t == null) return '';
      const hot = t > 113;
      const c  = hot ? '#f87171' : 'rgba(255,255,255,.5)';
      const bc = hot ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.28)';
      const bg = hot ? 'rgba(239,68,68,.08)' : 'rgba(255,255,255,0)';
      return `<div style="display:flex;align-items:center;gap:4px;padding:4px 7px;border-radius:6px;border:1.5px solid ${bc};background:${bg};flex-shrink:0">
        <span style="font-size:10px;color:rgba(255,255,255,.35);font-weight:600">${d.name}</span>
        <span style="font-size:11px;font-weight:700;color:${c}">${Math.round(t)}°F</span>
      </div>`;
    }).filter(Boolean).join('');
    return `<div class="card">
      <div class="card-hdr">Server Health</div>
      <div class="sec">
        ${statsHtml}
        ${diskPills ? `<div style="border-top:1.5px solid rgba(255,255,255,.18);padding-top:7px;margin-top:2px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.25);margin-bottom:6px">Disk Temps</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">${diskPills}</div>
        </div>` : ''}
      </div>
    </div>`;
  }

  _patch() {
    if (!this._config.section) return;
    const map = {
      network:'_buildNetwork', speed:'_buildSpeed', ink:'_buildInk',
      controls:'_buildControls', access_points:'_buildAccessPoints',
      services:'_buildServices', recently_added:'_buildRecentlyAdded',
      immich:'_buildImmich', storage:'_buildStorage',
      server_health:'_buildServerHealth',
    };
    const method = map[this._config.section];
    if (!method) return;
    const inner = this[method]();
    const haCard = this.shadowRoot.querySelector('ha-card');
    if (!haCard) { this._render(); return; }
    haCard.innerHTML = inner;
    this._listen();
  }

  _render() {
    if (!this._config.section) return;
    const map = {
      network:'_buildNetwork', speed:'_buildSpeed', ink:'_buildInk',
      controls:'_buildControls', access_points:'_buildAccessPoints',
      services:'_buildServices', recently_added:'_buildRecentlyAdded',
      immich:'_buildImmich', storage:'_buildStorage',
      server_health:'_buildServerHealth',
    };
    const method = map[this._config.section];
    const inner  = method ? this[method]() : `<div class="card"><div class="sec">Unknown section: ${this._config.section}</div></div>`;
    this.shadowRoot.innerHTML = `<style>${this._css()}
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
</style><ha-card>${inner}</ha-card>`;
    this._listen();
  }

  _listen() {
    const sr = this.shadowRoot;
    const ov = sr.getElementById('ov');
    if (!ov) return;
    const close = () => ov.classList.remove('open');
    sr.getElementById('ov-x')?.addEventListener('click', close);
    sr.getElementById('ov-no')?.addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target===ov) close(); });
    sr.querySelectorAll('[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const b = (this._config.restart_buttons||[])[parseInt(btn.dataset.idx,10)];
        if (!b) return;
        sr.getElementById('ov-title').textContent = `Restart ${b.name}?`;
        sr.getElementById('ov-sub').textContent   = b.confirm_message || `This will restart ${b.name}.`;
        const yesBtn = sr.getElementById('ov-yes');
        const newYes = yesBtn.cloneNode(true);
        yesBtn.replaceWith(newYes);
        newYes.addEventListener('click', () => {
          if (b.entity) this._call('button','press',{entity_id:b.entity});
          close();
        });
        ov.classList.add('open');
      });
    });
  }
}

customElements.define('technology-card', TechnologyCard);