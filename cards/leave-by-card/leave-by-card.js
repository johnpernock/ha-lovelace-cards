/**
 * leave-by-card.js  —  v4
 * "Leave by" card for Home Assistant Lovelace.
 *
 * Reads outbound SEPTA train departure times and a Waze Travel Time sensor,
 * then computes when you need to leave home to catch each train. Urgency
 * is colour-coded: red = leave now, amber = leave soon, green = comfortable.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/leave-by-card/leave-by-card.js  —  v2
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/leave-by-card/leave-by-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:leave-by-card
 * waze_entity: sensor.commute_to_work   # Waze Travel Time sensor (state = minutes)
 * station: Paoli Station                # optional label shown in header badge
 * outbound:                             # outbound SEPTA sensors — same list as septa-paoli-card
 *   - sensor.paoli_outbound_1
 *   - sensor.paoli_outbound_2
 *   - sensor.paoli_outbound_3
 */

class LeaveByCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._tick   = null;
  }

  static getStubConfig() {
    return {
      waze_entity: 'sensor.commute_to_work',
      station: 'Paoli Station',
      outbound: [
        'sensor.paoli_outbound_1',
        'sensor.paoli_outbound_2',
        'sensor.paoli_outbound_3',
      ],
    };
  }

  setConfig(config) {
    if (!config.waze_entity) throw new Error('leave-by-card: waze_entity is required');
    if (!config.outbound?.length) throw new Error('leave-by-card: outbound sensors required');
    this._config = { station: 'Station', ...config };
    this._render();
  }

  set hass(h) {
    this._hass = h;
    // Only do initial render from hass; interval handles subsequent refreshes
    if (!this.shadowRoot.querySelector('.wrap')) this._render();
    else this._patch();
  }
  getCardSize() { return 3; }

  connectedCallback()    { this._tick = setInterval(() => this._render(), 30000); }
  disconnectedCallback() { if (this._tick) { clearInterval(this._tick); this._tick = null; } }

  // ── Time helpers ──────────────────────────────────────────────────────────

  _parseTimeToMins(str) {
    if (!str || str === '—') return null;
    const s = str.toUpperCase().replace(/\s/g, '');
    const isPM = s.includes('PM'), isAM = s.includes('AM');
    const clean = s.replace('AM', '').replace('PM', '');
    const [hStr, mStr] = clean.split(':');
    let h = parseInt(hStr), m = parseInt(mStr || '0');
    if (isNaN(h) || isNaN(m)) return null;
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  }

  _minsToTimeStr(mins) {
    // Handle midnight crossover
    const m = ((mins % 1440) + 1440) % 1440;
    const h24 = Math.floor(m / 60);
    const mm  = m % 60;
    const period = h24 < 12 ? 'AM' : 'PM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
  }

  _fmtUrgency(mins) {
    if (mins < 0)   return { label: 'Now', cls: 'lb-now' };
    if (mins < 60)  return { label: `${mins} min`, cls: mins < 15 ? 'lb-now' : 'lb-soon' };
    const h = Math.floor(mins / 60), m = mins % 60;
    return { label: m > 0 ? `${h}h ${m}m` : `${h}h`, cls: 'lb-ok' };
  }

  _delayMins(delayStr) {
    if (!delayStr || delayStr === 'On time' || delayStr === 'N/A') return 0;
    const n = parseInt(delayStr.replace(/[^0-9]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _patch() {
    if (!this._config.waze_entity || !this._hass) return;
    // Leave-by times depend on current clock time + Waze duration — rows can fully change
    // so we re-render the rows HTML only, not the full card
    const wazeState = this._hass.states[this._config.waze_entity];
    const wazeMins  = wazeState && wazeState.state !== 'unavailable'
      ? Math.round(parseFloat(wazeState.state)) : null;
    const station   = this._config.station || 'Station';
    const driveNote = wazeMins !== null ? `${wazeMins} min drive to ${station}` : 'Drive time unavailable';
    const hdrRight  = this.shadowRoot.querySelector('.hdr-right');
    if (hdrRight) hdrRight.textContent = driveNote;
    // Row content changes every minute — delegate to _render for row rebuilds
    this._render();
  }

  _render() {
    if (!this._config.waze_entity || !this._hass) return;

    const wazeState = this._hass.states[this._config.waze_entity];
    const wazeMins  = wazeState && wazeState.state !== 'unavailable'
      ? Math.round(parseFloat(wazeState.state)) : null;

    const nowMins   = new Date().getHours() * 60 + new Date().getMinutes();
    const station   = this._config.station || 'Station';

    // Gather train data from outbound sensors
    const trains = this._config.outbound.map(id => {
      const s = this._hass.states[id];
      if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
      const dep     = s.state;
      const delay   = this._delayMins(s.attributes.orig_delay);
      const depMins = this._parseTimeToMins(dep);
      if (depMins === null) return null;
      const estDepMins = depMins + delay;
      // Stale: estimated departure more than 2 minutes ago
      // Handle midnight crossover: if diff > 720 mins (6h) treat as future
      const diff = nowMins - estDepMins;
      if (diff > 2 && diff < 720) return null;
      return {
        dep,
        depMins,
        estDepMins,
        delay,
        arrives:  s.attributes.orig_arrival_time || '—',
        train:    s.attributes.orig_train || '',
        isdirect: s.attributes.isdirect || 'false',
        isDelayed: delay > 0,
      };
    }).filter(Boolean);

    // Sort by estimated departure
    trains.sort((a, b) => {
      // Handle midnight crossover
      let am = a.estDepMins, bm = b.estDepMins;
      if (nowMins > 720) { // After noon
        if (am < nowMins - 720) am += 1440;
        if (bm < nowMins - 720) bm += 1440;
      }
      return am - bm;
    });

    const rowsHtml = trains.length === 0
      ? `<div class="lb-empty">No upcoming outbound trains</div>`
      : trains.map((t, i) => {
          const leaveByMins = wazeMins !== null
            ? t.estDepMins - wazeMins
            : null;
          const urgency     = leaveByMins !== null
            ? this._fmtUrgency(Math.round(leaveByMins - nowMins))
            : null;
          const leaveByStr  = leaveByMins !== null
            ? this._minsToTimeStr(leaveByMins)
            : '—';
          const service     = t.isdirect === 'true' ? 'Direct' : 'Local';
          const trainLabel  = t.train && t.train !== '—' ? `Train ${t.train} · ` : '';
          const delayLabel  = t.isDelayed ? ` · +${t.delay}m late` : '';

          // Row color: first train uses urgency color, others neutral unless urgent
          let rowBg, rowBdr;
          if (urgency && urgency.cls === 'lb-now') {
            rowBg  = 'rgba(248,113,113,.07)';
            rowBdr = 'rgba(248,113,113,.22)';
          } else if (urgency && urgency.cls === 'lb-soon') {
            rowBg  = 'rgba(251,191,36,.06)';
            rowBdr = 'rgba(251,191,36,.18)';
          } else {
            rowBg  = 'rgba(255,255,255,.03)';
            rowBdr = 'rgba(255,255,255,.07)';
          }

          const opacity = !urgency || urgency.cls === 'lb-ok' ? ' style="opacity:.65"' : '';

          return `<div class="lb-row" style="background:${rowBg};border:1px solid ${rowBdr}"${opacity}>
            <div class="lb-left">
              <div class="lb-dep-arr">${t.dep} → ${t.arrives}</div>
              <div class="lb-meta">${trainLabel}${service}${delayLabel}</div>
            </div>
            <div class="lb-right">
              <div class="lb-time">${leaveByStr}</div>
              ${urgency ? `<div class="lb-chip ${urgency.cls}">${urgency.label}</div>` : ''}
            </div>
          </div>`;
        }).join('');

    const driveNote = wazeMins !== null
      ? `${wazeMins} min drive to ${station}`
      : `Drive time unavailable`;

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
        *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
        .wrap{border-radius:10px;border:1px solid rgba(255,255,255,.10);overflow:hidden}
        .card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between}
        .hdr-right{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:rgba(96,165,250,.5)}
        .drive-note{font-size:11px;color:rgba(255,255,255,.3);padding:8px 14px 4px}
        .lb-row{margin:4px 10px;border-radius:8px;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;-webkit-tap-highlight-color:transparent}
        .lb-row:last-child{margin-bottom:10px}
        .lb-left{min-width:0}
        .lb-dep-arr{font-size:12px;font-weight:600;color:rgba(255,255,255,.6)}
        .lb-meta{font-size:10px;color:rgba(255,255,255,.3);margin-top:2px}
        .lb-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
        .lb-time{font-size:22px;font-weight:700;color:white;letter-spacing:-.5px}
        .lb-chip{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 7px;border-radius:5px;white-space:nowrap}
        .lb-now {background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.35);color:#f87171}
        .lb-soon{background:rgba(251,191,36,.12); border:1px solid rgba(251,191,36,.3); color:#fbbf24}
        .lb-ok  {background:rgba(74,222,128,.08); border:1px solid rgba(74,222,128,.2); color:#4ade80}
        .lb-empty{font-size:12px;color:rgba(255,255,255,.3);font-style:italic;padding:12px 14px}
      </style>
      <ha-card>
        <div class="wrap">
          <div class="card-hdr">
            Leave by
            <div class="hdr-right">${driveNote}</div>
          </div>
          ${rowsHtml}
        </div>
      </ha-card>`;
  }
}

customElements.define('leave-by-card', LeaveByCard);
