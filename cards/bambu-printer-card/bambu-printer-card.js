/**
 * bambu-printer-card.js  —  v11
 *
 * Unified Bambu Lab P1S dashboard card.
 * Shows printer status, progress, temperatures, speed/layer,
 * and AMS slots or external spool depending on which is active.
 *
 * HOW ENTITY LOOKUP WORKS:
 * The Bambu Lab HA integration exposes entities like:
 *   sensor.p1s_01p09a3a1100648_current_stage
 *   binary_sensor.p1s_01p09a3a1100648_ams_1_active
 * The `printer` config value is the prefix (everything before the last underscore
 * group). _state(suffix) tries common HA domains automatically — you never need
 * to specify domains in config.
 *
 * CONFIG:
 * type: custom:bambu-printer-card
 * printer: p1s_01p09a3a1100648   # your printer's entity prefix
 */

class BambuPrinterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  setConfig(c) {
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.card') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 6; }

  _pfx()      { return this._config.printer || ''; }
  _eid(s)     { return `${this._pfx()}_${s}`; }
  _state(s) {
    if (!this._hass) return null;
    const suffix = this._eid(s);
    // Try common domains first for speed
    const domains = ['sensor', 'binary_sensor', 'select', 'switch', 'number', 'button', 'camera'];
    for (const d of domains) {
      const e = this._hass.states[`${d}.${suffix}`];
      if (e) return e;
    }
    // Fallback: scan all states for a key ending with the suffix
    return Object.values(this._hass.states).find(e => e.entity_id.endsWith(`.${suffix}`)) || null;
  }
  _val(s)          { return this._state(s)?.state ?? null; }
  _attr(s, k)      { return this._state(s)?.attributes?.[k] ?? null; }
  _num(s)          { const v = parseFloat(this._val(s)); return isNaN(v) ? null : v; }
  _isOn(s)         { const v = this._val(s); return v === 'on' || v === 'true'; }

  _fmtTime(hours) {
    if (hours == null || isNaN(hours)) return null;
    const m = Math.round(hours * 60);
    if (m < 1) return '< 1m';
    const h = Math.floor(m / 60), mm = m % 60;
    if (h === 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
  }

  _statusInfo(stage, status) {
    const s = (stage !== 'unavailable' && stage) ? stage : (status || 'unknown');
    if (s === 'printing')                      return { label:'Printing',     color:'#60a5fa', rgb:'96,165,250' };
    if (s === 'idle' || s === 'finish')        return { label: s === 'finish' ? 'Finished' : 'Idle', color:'#4ade80', rgb:'74,222,128' };
    if (s === 'pause' || s?.startsWith('paused')) return { label:'Paused',   color:'#fbbf24', rgb:'251,191,36' };
    if (s === 'failed')                        return { label:'Error',        color:'#f87171', rgb:'239,68,68'  };
    if (['changing_filament','filament_loading','filament_unloading'].includes(s))
                                               return { label:'Changing Filament', color:'#a78bfa', rgb:'167,139,250' };
    if (['heatbed_preheating','heating_hotend','heating_chamber'].includes(s))
                                               return { label:'Heating',      color:'#fb923c', rgb:'251,146,60' };
    if (s?.includes('calibrat') || s?.includes('scanning') || s === 'auto_bed_leveling')
                                               return { label:'Calibrating',  color:'#a78bfa', rgb:'167,139,250' };
    if (s === 'offline' || s === 'unavailable' || !s)
                                               return { label:'Offline',      color:'rgba(255,255,255,.35)', rgb:'100,100,100' };
    return                                            { label:'Preparing',    color:'#60a5fa', rgb:'96,165,250' };
  }

  _trayInfo(n) {
    const s = this._state(`ams_1_tray_${n}`);
    if (!s || s.state === 'unavailable') return null;
    const a = s.attributes || {};
    return {
      name:  a.name || a.color_name || `Slot ${n}`,
      type:  a.type || a.filament_type || '',
      color: a.color ? `#${a.color.replace('#','')}` : null,
      empty: !!a.empty,
    };
  }

  _extInfo() {
    const s = this._state('externalspool_external_spool');
    if (!s || s.state === 'unavailable') return null;
    const a = s.attributes || {};
    return {
      name:  a.name || a.color_name || 'External Spool',
      type:  a.type || a.filament_type || '',
      color: a.color ? `#${a.color.replace('#','')}` : null,
    };
  }

  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .layout{display:grid;grid-template-columns:1.35fr 1fr;gap:10px;align-items:start}
    @media(max-width:600px){.layout{grid-template-columns:1fr}}
    .card { overflow: hidden; }
    .card-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.3);padding:10px 14px 6px}
    .sec{padding:8px 14px 12px;display:flex;flex-direction:column;gap:8px}

    .sbanner{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1.5px solid rgba(255,255,255,.28)}
    .sdot{width:13px;height:13px;border-radius:50%;flex-shrink:0}
    .slabel{font-size:20px;font-weight:700;line-height:1}
    .ssub{font-size:12px;color:rgba(255,255,255,.45);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}

    .prog-wrap{padding:10px 14px 12px;border-bottom:1.5px solid rgba(255,255,255,.28)}
    .prog-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
    .prog-pct{font-size:28px;font-weight:700;color:#e2e8f0}
    .prog-time{font-size:12px;color:rgba(255,255,255,.4)}
    .prog-bg{height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .prog-bar{height:100%;border-radius:99px;transition:width .3s}

    .tgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .titem{background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30);border-radius:8px;padding:9px 11px}
    .tlbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3);margin-bottom:4px}
    .tval{font-size:18px;font-weight:700;color:#e2e8f0}
    .tunit{font-size:12px;color:rgba(255,255,255,.35);margin-left:1px}
    .ttgt{font-size:11px;color:rgba(255,255,255,.25);margin-top:2px}

    .irow{display:flex;gap:6px}
    .iitem{flex:1;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.30);border-radius:8px;padding:8px 11px;display:flex;align-items:center;justify-content:space-between}
    .ilbl{font-size:11px;color:rgba(255,255,255,.35)}
    .ival{font-size:13px;font-weight:700;color:#e2e8f0}

    .aslots{display:flex;flex-direction:column;gap:5px}
    .aslot{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;border:1.5px solid rgba(255,255,255,.30);background:rgba(255,255,255,0);position:relative;overflow:hidden}
    .aslot.on{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,0)}
    .anum{font-size:11px;font-weight:700;color:rgba(255,255,255,.2);width:14px;text-align:center;flex-shrink:0}
    .aswatch{width:26px;height:26px;border-radius:5px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.40)}
    .ainfo{flex:1;min-width:0}
    .aname{font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .atype{font-size:11px;color:rgba(255,255,255,.38);margin-top:1px}
    .abadge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(74,222,128,.15);color:#4ade80;flex-shrink:0}

    .extslot{display:flex;align-items:center;gap:12px;padding:12px 14px}
    .extswatch{width:36px;height:36px;border-radius:8px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.40)}
    .extname{font-size:15px;font-weight:700;color:#e2e8f0}
    .exttype{font-size:12px;color:rgba(255,255,255,.38);margin-top:2px}
    .abadge-ext{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(74,222,128,.15);color:#4ade80;margin-left:auto;flex-shrink:0}

    .humrow{display:flex;align-items:center;justify-content:space-between;padding-top:7px;margin-top:2px;border-top:1.5px solid rgba(255,255,255,.18)}
    .humlbl{font-size:11px;color:rgba(255,255,255,.28)}
    .humval{font-size:12px;font-weight:700;color:rgba(255,255,255,.45)}
  `; }

  _patch() {
    const stage    = this._val('current_stage');
    const status   = this._val('print_status');
    const progress = this._num('print_progress');
    const remaining= this._num('remaining_time');
    const nozzle   = this._num('nozzle_temperature');
    const bed      = this._num('bed_temperature');
    const layer    = this._val('current_layer');
    const totalLayer = this._val('total_layer_count');
    const st  = this._statusInfo(stage, status);
    const pct = progress != null ? Math.round(progress) : 0;

    // If status color changed (idle→printing etc.), full re-render
    const dot = this.shadowRoot.querySelector('.sdot');
    if (dot && dot.style.background !== st.color) { this._render(); return; }

    const slabel   = this.shadowRoot.querySelector('.slabel');
    const progPct  = this.shadowRoot.querySelector('.prog-pct');
    const progBar  = this.shadowRoot.querySelector('.prog-bar');
    const progTime = this.shadowRoot.querySelector('.prog-time');
    const nozzleEl = this.shadowRoot.querySelector('.nozzle-val');
    const bedEl    = this.shadowRoot.querySelector('.bed-val');
    const layerEl  = this.shadowRoot.querySelector('.layer-val');
    const tF = v => v != null ? `${Math.round(v)}` : '—';

    if (dot)      dot.style.background = st.color;
    if (slabel)   { slabel.textContent = st.label; slabel.style.color = st.color; }
    if (progPct)  progPct.textContent  = `${pct}%`;
    if (progBar)  { progBar.style.width = `${pct}%`; progBar.style.background = st.color; }
    if (progTime) progTime.textContent = this._fmtTime(remaining) ? `${this._fmtTime(remaining)} remaining` : '';
    if (nozzleEl) nozzleEl.textContent = tF(nozzle);
    if (bedEl)    bedEl.textContent    = tF(bed);
    if (layerEl && layer && totalLayer) layerEl.textContent = `${layer} / ${totalLayer}`;
  }

  _buildPrinter() {
    const stage    = this._val('current_stage');
    const status   = this._val('print_status');
    const progress = this._num('print_progress');
    const remaining= this._num('remaining_time');
    const taskName = this._val('task_name') || this._val('gcode_filename');
    const nozzle   = this._num('nozzle_temperature');
    const nozzleTgt= this._num('nozzle_target_temperature');
    const bed      = this._num('bed_temperature');
    const bedTgt   = this._num('target_bed_temperature');
    const layer    = this._val('current_layer');
    const totalLayer = this._val('total_layer_count');
    const speed    = this._val('speed_profile');

    const st = this._statusInfo(stage, status);
    const pct = progress != null ? Math.round(progress) : 0;
    const remStr = this._fmtTime(remaining);
    const showProgress = pct > 0 || stage === 'printing';

    const tF = (v) => v != null ? `${Math.round(v)}` : '—';
    const layerStr = (layer && totalLayer && layer !== 'unavailable' && totalLayer !== 'unavailable')
      ? `${layer} / ${totalLayer}` : '—';
    const speedStr = speed && speed !== 'unavailable'
      ? speed.charAt(0).toUpperCase() + speed.slice(1) : '—';
    const name = taskName && taskName !== 'unavailable' ? taskName : '';

    return `<div class="card">
      <div class="sbanner" style="background:rgba(255,255,255,0);border-bottom:1.5px solid rgba(${st.rgb},.45)">
        <div class="sdot" style="background:${st.color}"></div>
        <div style="flex:1;min-width:0">
          <div class="slabel" style="color:${st.color}">${st.label}</div>
          ${name ? `<div class="ssub">${name}</div>` : ''}
        </div>
      </div>

      ${showProgress ? `
      <div class="prog-wrap">
        <div class="prog-row">
          <div class="prog-pct">${pct}%</div>
          ${remStr ? `<div class="prog-time">${remStr} remaining</div>` : ''}
        </div>
        <div class="prog-bg"><div class="prog-bar" style="width:${pct}%;background:${st.color}"></div></div>
      </div>` : ''}

      <div class="sec">
        <div class="tgrid">
          <div class="titem">
            <div class="tlbl">Nozzle</div>
            <div><span class="tval">${tF(nozzle)}</span><span class="tunit">°C</span></div>
            ${nozzleTgt && nozzleTgt > 0 ? `<div class="ttgt">→ ${tF(nozzleTgt)}°C</div>` : ''}
          </div>
          <div class="titem">
            <div class="tlbl">Bed</div>
            <div><span class="tval">${tF(bed)}</span><span class="tunit">°C</span></div>
            ${bedTgt && bedTgt > 0 ? `<div class="ttgt">→ ${tF(bedTgt)}°C</div>` : ''}
          </div>
        </div>
        <div class="irow">
          <div class="iitem"><span class="ilbl">Speed</span><span class="ival">${speedStr}</span></div>
          <div class="iitem"><span class="ilbl">Layer</span><span class="ival">${layerStr}</span></div>
        </div>
      </div>
    </div>`;
  }

  _buildFilament() {
    const amsActive = this._isOn('ams_1_active');
    const extActive = this._isOn('externalspool_active');
    const activeTray = this._val('active_tray');

    if (extActive && !amsActive) {
      const info = this._extInfo();
      const bg   = info?.color || 'rgba(255,255,255,.1)';
      return `<div class="card">
        <div class="card-hdr">External Spool</div>
        <div class="extslot">
          <div class="extswatch" style="background:${bg}"></div>
          <div>
            <div class="extname">${info?.name || 'External Spool'}</div>
            ${info?.type ? `<div class="exttype">${info.type}</div>` : ''}
          </div>
          <div class="abadge-ext">Active</div>
        </div>
      </div>`;
    }

    // Default: show AMS
    const humidity    = this._num('ams_1_humidity');
    const humidityIdx = this._num('ams_1_humidity_index');

    const slots = [1,2,3,4].map(n => {
      const info = this._trayInfo(n);
      const isActive = activeTray === String(n)
        || activeTray === `AMS1/${n}`
        || activeTray === `0${n-1}`
        || activeTray === String(n-1);
      const bg = info?.color || 'rgba(255,255,255,.08)';
      const accentColor = info?.color || '#4ade80';

      return `<div class="aslot${isActive ? ' on' : ''}">
        ${isActive ? `<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${accentColor}"></div>` : ''}
        <div class="anum">${n}</div>
        <div class="aswatch" style="background:${bg}"></div>
        <div class="ainfo">
          <div class="aname">${info?.empty ? `<span style="color:rgba(255,255,255,.22)">Empty</span>` : (info?.name || `Slot ${n}`)}</div>
          ${info?.type ? `<div class="atype">${info.type}</div>` : ''}
        </div>
        ${isActive ? '<div class="abadge">Active</div>' : ''}
      </div>`;
    }).join('');

    const humHtml = humidity != null ? `
      <div class="humrow">
        <span class="humlbl">AMS humidity</span>
        <span class="humval">${Math.round(humidity)}%${humidityIdx != null ? ` · Index ${Math.round(humidityIdx)}` : ''}</span>
      </div>` : '';

    return `<div class="card">
      <div class="card-hdr">AMS · Unit 1</div>
      <div class="sec">
        <div class="aslots">${slots}</div>
        ${humHtml}
      </div>
    </div>`;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${this._css()}
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
        <div class="layout">
          ${this._buildPrinter()}
          ${this._buildFilament()}
        </div>
      </ha-card>`;
  }
}

customElements.define('bambu-printer-card', BambuPrinterCard);