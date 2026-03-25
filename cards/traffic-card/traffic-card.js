/**
 * traffic-card.js  —  v15
 * Commute traffic card for Home Assistant Lovelace.
 * Uses Waze Travel Time sensors for live travel time data.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Add Waze Travel Time sensors to configuration.yaml (see ha-config/waze-sensors.yaml)
 * 2. Copy to /config/www/cards/traffic-card/traffic-card.js
 * 3. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/traffic-card/traffic-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:traffic-card
 * incident_threshold: 10        # optional — minutes over typical to show alert (default 10)
 * hide_to_work_after: 12        # optional — hour (24h) to dim "to work" row (default 12)
 * hide_home_before: 14          # optional — hour (24h) before which to dim "home" row (default none)
 * to_work:
 *   label: "1030 Continental Dr"
 *   entity: sensor.commute_to_work
 *   route_label: US-202 N       # fallback if Waze route attribute is empty
 * home_routes:
 *   - label: "21 Beryl Rd"
 *     entity: sensor.commute_home_via_202
 *     route_label: US-202 S
 */

class TrafficCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  setConfig(c) {
    if (!c.to_work?.entity)      throw new Error('traffic-card: to_work.entity is required');
    if (!c.home_routes?.length)  throw new Error('traffic-card: home_routes must have at least one entry');
    this._config = {
      incident_threshold: 10,
      hide_to_work_after: 12,
      ...c,
    };
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.card') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 4; }

  // ── Entity helpers ────────────────────────────────────────────────────────
  _estate(id)    { return this._hass?.states[id] || null; }
  _eattr(id, k)  { return this._estate(id)?.attributes?.[k] ?? null; }

  _routeData(entityId, fallbackLabel) {
    const e = this._estate(entityId);
    if (!e || e.state === 'unavailable' || e.state === 'unknown') return null;
    const current  = parseFloat(e.state);
    const typical  = parseFloat(e.attributes.duration ?? e.attributes.duration_in_traffic ?? current);
    const distance = parseFloat(e.attributes.distance ?? 0);
    const route    = e.attributes.route || fallbackLabel || '';
    const updated  = e.last_updated || e.last_changed;
    if (isNaN(current)) return null;
    return {
      current:  Math.round(current),
      typical:  Math.round(isNaN(typical) ? current : typical),
      delay:    Math.round(current - (isNaN(typical) ? current : typical)),
      distance: isNaN(distance) ? null : Math.round(distance * 10) / 10,
      route,
      updated,
    };
  }

  // ── Delay → theme ─────────────────────────────────────────────────────────
  _delayTheme(delay, threshold) {
    if (delay <= 2)                return { color: '#4ade80', rgb: '74,222,128',   label: 'On time'        };
    if (delay < threshold)         return { color: '#fbbf24', rgb: '251,191,36',   label: `+${delay} min`  };
    return                                { color: '#f87171', rgb: '248,113,113',  label: `+${delay} min`  };
  }

  // ── Format last updated ───────────────────────────────────────────────────
  _fmtUpdated(iso) {
    if (!iso) return '';
    try {
      const d    = new Date(iso);
      const diff = Math.round((Date.now() - d) / 60000);
      if (diff < 1)  return 'just now';
      if (diff < 60) return `${diff} min ago`;
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  }

  // ── Incident detection ────────────────────────────────────────────────────
  // An incident is flagged when ANY route in a direction exceeds threshold.
  // The worst-delayed route is identified for the banner message.
  _detectIncident(routes, threshold) {
    let worst = null;
    for (const r of routes) {
      if (!r.data) continue;
      if (r.data.delay >= threshold) {
        if (!worst || r.data.delay > worst.delay) {
          worst = { label: r.routeLabel, delay: r.data.delay, route: r.data.route || r.routeLabel };
        }
      }
    }
    return worst;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card{border-radius:10px;border:1.5px solid rgba(255,255,255,.40);overflow:hidden}
    .card-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px}
    .card-hdr-title{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px}
    .updated{font-size:9px;color:rgba(255,255,255,.2)}
    .divider{height:1px;background:rgba(255,255,255,.07)}

    /* incident banner */
    .incident{display:flex;align-items:flex-start;gap:9px;padding:8px 14px;background:rgba(248,113,113,.07);border-bottom:1px solid rgba(248,113,113,.15)}
    .inc-dot{width:9px;height:9px;border-radius:50%;background:#f87171;flex-shrink:0;margin-top:3px;animation:blink 2s ease-in-out infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
    .inc-title{font-size:11px;font-weight:700;color:#f87171;line-height:1.3}
    .inc-sub{font-size:10px;color:rgba(248,113,113,.6);margin-top:2px;line-height:1.3}

    /* direction header */
    .dir-hdr{display:flex;align-items:center;gap:7px;padding:8px 14px 4px}
    .dir-ico{width:14px;height:14px;flex-shrink:0}
    .dir-ico svg{width:100%;height:100%}
    .dir-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.25)}

    /* route tile */
    .tile{display:flex;align-items:center;gap:10px;padding:9px 14px}
    .tile.dimmed{opacity:.60}
    .tile-left{flex:1;min-width:0}
    .best-badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:rgba(74,222,128,.12);color:#4ade80;display:inline-block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
    .route-name{font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .route-name.slow{color:rgba(255,255,255,.45)}
    .route-via{font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .route-dist{font-size:9px;color:rgba(255,255,255,.22);margin-top:2px}
    .tile-right{text-align:right;flex-shrink:0;min-width:76px}
    .time-big{font-size:26px;font-weight:700;letter-spacing:-1px;line-height:1}
    .time-big.secondary{font-size:20px}
    .time-unit{font-size:10px;color:rgba(255,255,255,.35);margin-left:1px}
    .delay-row{display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:4px}
    .delay-pill{font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap}
    .typical{font-size:9px;color:rgba(255,255,255,.22);margin-top:2px}

    /* unavailable */
    .unavail{font-size:11px;color:rgba(255,255,255,.25);font-style:italic;padding:10px 14px}

    /* ── expanded row mode ── */
    .sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.3);padding:10px 14px 0}
    .exp-hero-row{margin:8px 10px;border-radius:8px;padding:12px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;-webkit-tap-highlight-color:transparent}
    .exp-hero-row.dimmed{opacity:.60}
    .exp-sub-row{margin:4px 10px 8px;border-radius:8px;padding:9px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;-webkit-tap-highlight-color:transparent}
    .exp-row-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.3);margin-bottom:3px}
    .exp-row-route{font-size:15px;font-weight:600;line-height:1.2}
    .exp-row-via{font-size:10px;color:rgba(255,255,255,.3);margin-top:2px}
    .exp-row-right{text-align:right;flex-shrink:0}
    .exp-arr-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3);margin-bottom:2px}
    .exp-time-xl{font-size:24px;font-weight:700;letter-spacing:-.5px;line-height:1}
    .exp-time-sm{font-size:20px;font-weight:600;letter-spacing:-.3px;line-height:1}
    .exp-min{font-size:11px;font-weight:500;color:rgba(255,255,255,.35);margin-left:2px}
    .exp-badge{font-size:10px;font-weight:700;border-radius:5px;padding:3px 7px;white-space:nowrap;margin-top:5px;display:inline-block}
    .exp-row-div{height:1px;background:rgba(255,255,255,.05);margin:0 10px}
    .exp-sec-div{height:1px;background:rgba(255,255,255,.07);margin:8px 14px 0}
  `; }

  // ── Route tile HTML ───────────────────────────────────────────────────────
  _tileHtml(cfg, data, isBest, isDimmed, isPrimary) {
    if (!data) {
      return `<div class="tile">
        <div class="tile-left"><div class="route-name">${cfg.route_label || cfg.label}</div></div>
        <div class="unavail">Unavailable</div>
      </div>`;
    }
    const t    = this._delayTheme(data.delay, this._config.incident_threshold);
    const name = cfg.route_label || cfg.label || data.route;
    const via  = cfg.via_label || '';
    return `<div class="tile${isDimmed ? ' dimmed' : ''}">
      <div class="tile-left">
        ${isBest ? `<div class="best-badge">Fastest</div>` : ''}
        <div class="route-name${!isBest && !isPrimary ? ' slow' : ''}">${name}</div>
        ${via  ? `<div class="route-via">${via}</div>` : ''}
        ${data.distance ? `<div class="route-dist">${data.distance} mi</div>` : ''}
      </div>
      <div class="tile-right">
        <div class="time-big${isPrimary ? '' : ' secondary'}" style="color:${t.color}">
          ${data.current}<span class="time-unit">min</span>
        </div>
        <div class="delay-row">
          <div class="delay-pill" style="background:rgba(${t.rgb},.12);color:${t.color}">${t.label}</div>
        </div>
        ${data.typical !== data.current ? `<div class="typical">Typical ${data.typical} min</div>` : ''}
      </div>
    </div>`;
  }


  // ── Expanded row render ───────────────────────────────────────────────────
  _renderExpanded() {
    if (!this._hass) return;
    const cfg       = this._config;
    const threshold = cfg.incident_threshold || 10;
    const hour      = new Date().getHours();
    const dimToWork = hour >= (cfg.hide_to_work_after ?? 12);
    const dimHome   = cfg.hide_home_before != null && hour < cfg.hide_home_before;

    const toWorkData = this._routeData(cfg.to_work.entity, cfg.to_work.route_label);
    const homeRoutes = (cfg.home_routes || []).map(r => ({
      cfg: r,
      data: this._routeData(r.entity, r.route_label),
      routeLabel: r.route_label || r.label,
    }));

    let bestHomeIdx = 0;
    homeRoutes.forEach((r, i) => {
      if (r.data && homeRoutes[bestHomeIdx].data &&
          r.data.current < homeRoutes[bestHomeIdx].data.current) bestHomeIdx = i;
    });

    const homeIncident  = this._detectIncident(homeRoutes, threshold);
    const toWorkIncident = toWorkData && toWorkData.delay >= threshold
      ? { route: toWorkData.route || cfg.to_work.route_label, delay: toWorkData.delay } : null;

    const allUpdated = [toWorkData?.updated, ...homeRoutes.map(r => r.data?.updated)]
      .filter(Boolean).sort().pop();
    const updStr = this._fmtUpdated(allUpdated);

    let incidentHtml = '';
    const worstIncident = homeIncident || toWorkIncident;
    if (worstIncident) {
      incidentHtml = `<div class="incident">
        <div class="inc-dot"></div>
        <div>
          <div class="inc-title">Heavy traffic — ${worstIncident.route}</div>
          <div class="inc-sub">+${worstIncident.delay} min above normal</div>
        </div>
      </div>`;
    }

    const _heroRow = (data, cfg_route, label, isDimmed) => {
      if (!data) return `<div class="exp-hero-row" style="background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.40)">
        <div><div class="exp-row-lbl">${label}</div><div class="exp-row-route" style="color:rgba(255,255,255,.35)">${cfg_route.route_label||''}</div></div>
        <div class="exp-row-right"><div class="exp-time-xl" style="color:rgba(255,255,255,.25)">—</div></div>
      </div>`;
      const t    = this._delayTheme(data.delay, threshold);
      const name = cfg_route.route_label || cfg_route.label || data.route;
      const via  = cfg_route.via_label || '';
      return `<div class="exp-hero-row${isDimmed?' dimmed':''}" style="background:rgba(${t.rgb},.07);border:1px solid rgba(${t.rgb},.25)">
        <div>
          <div class="exp-row-lbl">${label}</div>
          <div class="exp-row-route" style="color:${t.color}">${name}</div>
          ${via ? `<div class="exp-row-via">${via}</div>` : ''}
        </div>
        <div class="exp-row-right">
          <div class="exp-arr-lbl">Travel time</div>
          <div class="exp-time-xl" style="color:${t.color}">${data.current}<span class="exp-min">min</span></div>
          <div class="exp-badge" style="background:rgba(${t.rgb},.12);color:${t.color};border:1px solid rgba(${t.rgb},.3)">${t.label}</div>
        </div>
      </div>`;
    };

    const _subRow = (data, cfg_route, isBest) => {
      if (!data) return '';
      const t    = this._delayTheme(data.delay, threshold);
      const name = cfg_route.route_label || cfg_route.label || data.route;
      const via  = cfg_route.via_label || '';
      return `<div class="exp-row-div"></div>
      <div class="exp-sub-row" style="background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,.40)">
        <div>
          <div class="exp-row-route" style="font-size:13px;color:rgba(255,255,255,.6)">${name}</div>
          ${via ? `<div class="exp-row-via">${via}</div>` : ''}
        </div>
        <div class="exp-row-right">
          <div class="exp-time-sm" style="color:rgba(255,255,255,.6)">${data.current}<span class="exp-min">min</span></div>
          <div class="exp-badge" style="background:rgba(${t.rgb},.10);color:${t.color};border:1px solid rgba(${t.rgb},.25)">${isBest ? 'Fastest' : t.label}</div>
        </div>
      </div>`;
    };

    const toWorkRow = _heroRow(toWorkData, cfg.to_work, 'Live travel time', false);

    const heroHome  = homeRoutes[bestHomeIdx];
    const heroHomeRow = _heroRow(heroHome.data, heroHome.cfg, 'Fastest route home', dimHome);

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="card">
          <div class="card-hdr">
            <div class="card-hdr-title">Commute</div>
            ${updStr ? `<div class="updated">Updated ${updStr}</div>` : ''}
          </div>
          <div class="divider"></div>
          ${incidentHtml}
          <div class="sec-lbl">→ To work · ${cfg.to_work.label || ''}</div>
          ${toWorkRow}
          <div class="exp-sec-div"></div>
          <div class="sec-lbl">← Home · ${heroHome.cfg?.label || ''}</div>
          ${heroHomeRow}
        </div>
      </ha-card>`;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  _patch() {
    if (!this._config.to_work) return;
    const cfg       = this._config;
    const threshold = cfg.incident_threshold || 10;

    const toWorkData = this._routeData(cfg.to_work.entity, cfg.to_work.route_label);
    const homeRoutes = (cfg.home_routes || []).map(r => ({
      cfg: r,
      data: this._routeData(r.entity, r.route_label),
    }));

    // Check if incident state changed — if so, full re-render (structure changes)
    const homeIncident = this._detectIncident(homeRoutes, threshold);
    const hadIncident  = !!this.shadowRoot.querySelector('.incident');
    if (!!homeIncident !== hadIncident) { this._render(); return; }

    // Update to-work time
    const twEl = this.shadowRoot.querySelector('.tw-time');
    if (twEl && toWorkData) twEl.textContent = `${toWorkData.current} min`;
    const twDelay = this.shadowRoot.querySelector('.tw-delay');
    if (twDelay && toWorkData) {
      twDelay.textContent = toWorkData.delay > 0 ? `+${toWorkData.delay} min` : 'On time';
      twDelay.style.color = toWorkData.delay > 0 ? '#f87171' : '#4ade80';
    }

    // Update home route times
    homeRoutes.forEach((r, i) => {
      const timeEl  = this.shadowRoot.querySelector(`.hr-time-${i}`);
      const delayEl = this.shadowRoot.querySelector(`.hr-delay-${i}`);
      if (timeEl  && r.data) timeEl.textContent  = `${r.data.current} min`;
      if (delayEl && r.data) {
        delayEl.textContent = r.data.delay > 0 ? `+${r.data.delay} min` : 'On time';
        delayEl.style.color = r.data.delay > 0 ? '#f87171' : '#4ade80';
      }
    });

    // Update last-updated timestamp
    const allUpdated = [toWorkData?.updated, ...homeRoutes.map(r => r.data?.updated)].filter(Boolean).sort().pop();
    const updEl = this.shadowRoot.querySelector('.last-upd');
    if (updEl) updEl.textContent = this._fmtUpdated(allUpdated);
  }

  _render() {
    if (!this._config.to_work) return;
    if (this._config.expanded) { this._renderExpanded(); return; }

    const cfg       = this._config;
    const threshold = cfg.incident_threshold || 10;
    const hour      = new Date().getHours();
    const dimToWork = hour >= (cfg.hide_to_work_after ?? 12);
    const dimHome   = cfg.hide_home_before != null && hour < cfg.hide_home_before;

    // Gather data
    const toWorkData   = this._routeData(cfg.to_work.entity, cfg.to_work.route_label);
    const homeRoutes   = (cfg.home_routes || []).map(r => ({
      cfg: r,
      data: this._routeData(r.entity, r.route_label),
      routeLabel: r.route_label || r.label,
    }));

    // Best home route = lowest current time
    let bestHomeIdx = 0;
    homeRoutes.forEach((r, i) => {
      if (r.data && homeRoutes[bestHomeIdx].data &&
          r.data.current < homeRoutes[bestHomeIdx].data.current) bestHomeIdx = i;
    });

    // Incident detection — home direction only (most relevant)
    const homeIncident = this._detectIncident(homeRoutes, threshold);
    // Also check to-work
    const toWorkIncident = toWorkData && toWorkData.delay >= threshold
      ? { route: toWorkData.route || cfg.to_work.route_label, delay: toWorkData.delay }
      : null;

    // Last updated — use the most recently updated entity
    const allUpdated = [
      toWorkData?.updated,
      ...homeRoutes.map(r => r.data?.updated),
    ].filter(Boolean).sort().pop();
    const updStr = this._fmtUpdated(allUpdated);

    // Build incident banner
    let incidentHtml = '';
    const worstIncident = homeIncident || toWorkIncident;
    if (worstIncident) {
      const altRoute = homeIncident && homeRoutes.length > 1
        ? homeRoutes.find((r, i) => i !== bestHomeIdx)?.routeLabel
        : null;
      incidentHtml = `<div class="incident">
        <div class="inc-dot"></div>
        <div>
          <div class="inc-title">Heavy traffic — ${worstIncident.route}</div>
          <div class="inc-sub">+${worstIncident.delay} min above normal${altRoute ? ` · ${altRoute} may be faster` : ''}</div>
        </div>
      </div>`;
    }

    // Build to-work section
    const toWorkTile = this._tileHtml(
      cfg.to_work, toWorkData,
      false,       // no "fastest" badge for single route
      false,       // never dim
      true,        // primary size
    );

    // Build home routes
    const homeTilesHtml = homeRoutes.map((r, i) => {
      const isBest    = i === bestHomeIdx;
      return this._tileHtml(r.cfg, r.data, isBest, dimHome, isBest);
    }).join('<div class="divider" style="margin:0 14px"></div>');

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
        <div class="card">
          <div class="card-hdr">
            <div class="card-hdr-title">Commute</div>
            ${updStr ? `<div class="updated">Updated ${updStr}</div>` : ''}
          </div>
          <div class="divider"></div>
          ${incidentHtml}

          <div class="dir-hdr">
            <div class="dir-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="5 12 19 12"/><polyline points="13 6 19 12 13 18"/>
              </svg>
            </div>
            <div class="dir-lbl">To work · ${cfg.to_work.label || '1030 Continental Dr'}</div>
          </div>
          ${toWorkTile}

          <div class="divider"></div>

          <div class="dir-hdr">
            <div class="dir-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="19 12 5 12"/><polyline points="11 18 5 12 11 6"/>
              </svg>
            </div>
            <div class="dir-lbl">Home · ${cfg.home_routes[0]?.label || ''}</div>
          </div>
          ${homeTilesHtml}
        </div>
      </ha-card>`;
  }
}

customElements.define('traffic-card', TrafficCard);
