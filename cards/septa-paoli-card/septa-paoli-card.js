/**
 * septa-paoli-card.js  —  v39
 * Home Assistant Lovelace card for SEPTA Paoli/Thorndale line departures.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/septa-paoli-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/septa-paoli-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:septa-paoli-card
 * outbound:
 *   - sensor.paoli_outbound_1
 *   - sensor.paoli_outbound_2
 *   - sensor.paoli_outbound_3
 * inbound:
 *   - sensor.paoli_inbound_1
 *   - sensor.paoli_inbound_2
 *   - sensor.paoli_inbound_3
 * inbound_next_station:
 *   - sensor.paoli_inbound_next_station_1
 *   - sensor.paoli_inbound_next_station_2
 *   - sensor.paoli_inbound_next_station_3
 * alert: sensor.paoli_line_alert
 * show_next_trains: true    # optional — show up to 3 subsequent trains as pills (compact mode only, default false)
 */

class SeptaPaoliCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config      = {};
    this._hass        = null;
    this._tick        = null;
    this._activePopup = null;
  }

  static getStubConfig() {
    return {
      outbound: [
        'sensor.paoli_outbound_1',
        'sensor.paoli_outbound_2',
        'sensor.paoli_outbound_3',
      ],
      inbound: [
        'sensor.paoli_inbound_1',
        'sensor.paoli_inbound_2',
        'sensor.paoli_inbound_3',
      ],
      inbound_next_station: [
        'sensor.paoli_inbound_next_station_1',
        'sensor.paoli_inbound_next_station_2',
        'sensor.paoli_inbound_next_station_3',
      ],
      alert: 'sensor.paoli_line_alert',
    };
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Initial render only — the 60s interval handles all subsequent updates.
    // Avoids full 940-line re-render on every HA state push from unrelated entities.
    if (!this.shadowRoot.querySelector('ha-card')) this._render();
  }

  connectedCallback() {
    this._tick = setInterval(() => this._render(), 60000);
  }

  disconnectedCallback() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  }

  getCardSize() { return 5; }

  _state(entityId) {
    if (!this._hass || !entityId) return null;
    return this._hass.states[entityId] || null;
  }

  _calcDelayedArrival(arrives, delayStr) {
    if (!arrives || !delayStr || delayStr === 'On time') return null;
    const mins = parseInt(delayStr.replace(/[^0-9]/g, ''));
    if (isNaN(mins) || mins === 0) return null;

    const upper = arrives.toUpperCase();
    const isPM  = upper.includes('PM');
    const isAM  = upper.includes('AM');
    const clean = upper.replace('AM', '').replace('PM', '').trim();
    const parts = clean.split(':');
    let h       = parseInt(parts[0]);
    const m     = parseInt(parts[1]);

    let h24 = h;
    if (isPM && h !== 12) h24 = h + 12;
    if (isAM && h === 12) h24 = 0;

    const total  = h24 * 60 + m + mins;
    const newH24 = Math.floor(total / 60) % 24;
    const newM   = total % 60;
    const period = newH24 < 12 ? 'AM' : 'PM';
    let newH12   = newH24 % 12;
    if (newH12 === 0) newH12 = 12;

    return { time: `${newH12}:${String(newM).padStart(2, '0')}${period}`, mins };
  }

  // Convert a time string like "10:22AM" or "10:22 PM" to minutes since midnight.
  // Used to sort trains by estimated arrival regardless of sensor order.
  _parseTimeToMins(timeStr) {
    if (!timeStr || timeStr === '—') return Infinity;
    const upper = timeStr.toUpperCase().replace(/\s/g, '');
    const isPM  = upper.includes('PM');
    const isAM  = upper.includes('AM');
    const clean = upper.replace('AM','').replace('PM','');
    const parts = clean.split(':');
    let h = parseInt(parts[0]);
    const m = parseInt(parts[1] || '0');
    if (isNaN(h) || isNaN(m)) return Infinity;
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  }

  // Parse delay string "18 min" / "On time" / "N/A" → integer minutes
  _delayMins(delayStr) {
    if (!delayStr || delayStr === 'On time' || delayStr === 'N/A') return 0;
    const n = parseInt(delayStr.replace(/[^0-9]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  // Estimated arrival time in minutes = scheduled arrival + delay.
  // This is the true physical arrival order at the platform.
  _estimatedArrivalMins(data) {
    return this._parseTimeToMins(data.arrives) + this._delayMins(data.delay);
  }

  // Current time in minutes since midnight.
  _nowMins() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  // Returns true if this train has already passed and should be removed.
  //   outbound (useArrival=false): compares estimated departure from Paoli
  //   inbound  (useArrival=true):  compares estimated arrival  at Paoli
  // A 2-minute grace window prevents hiding a train you could still sprint for.
  // Midnight crossover: any train more than 6 hours in the past is stale.
  _isStale(data, useArrival = false) {
    const scheduledStr = useArrival ? data.arrives : data.departs;
    const sched = this._parseTimeToMins(scheduledStr);
    if (sched === Infinity) return false;
    const est = sched + this._delayMins(data.delay);
    const now = this._nowMins();
    if (now - est > 360) return true;   // >6 hrs ago — always stale
    return est < now - 2;               // 2-min grace period
  }

  // Sort an array of train data objects by estimated arrival at destination.
  // Trains that will physically arrive first come first — regardless of their
  // scheduled departure order or which sensor index they came from.
  _sortByEstimatedArrival(trains) {
    return [...trains].sort((a, b) =>
      this._estimatedArrivalMins(a) - this._estimatedArrivalMins(b)
    );
  }

  _getTrainData(entityId) {
    const s = this._state(entityId);
    if (!s || s.state === 'unavailable') return null;
    return {
      train:    s.attributes.orig_train       || '—',
      departs:  s.state                        || '—',
      arrives:  s.attributes.orig_arrival_time || '—',
      delay:    s.attributes.orig_delay        || null,
      origin:   s.attributes.orig_line         || null,
      isdirect: s.attributes.isdirect          || null,
    };
  }

  _checkmark() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  }

  // ── Popup ────────────────────────────────────────────────────────────────────

  _openPopup(data, type) {
    const overlay = this.shadowRoot.getElementById('sp-overlay');
    const popup   = this.shadowRoot.getElementById('sp-popup');
    if (!overlay || !popup) return;

    const isDelayed    = data.delay && data.delay !== 'On time' && data.delay !== 'N/A';
    const delayed      = isDelayed ? this._calcDelayedArrival(data.arrives, data.delay) : null;
    const mins         = isDelayed ? parseInt(data.delay.replace(/[^0-9]/g, '')) : 0;
    const statusColor  = isDelayed ? '#f87171'              : '#4ade80';
    const statusBg     = isDelayed ? 'rgba(239,68,68,0.2)'  : 'rgba(74,222,128,0.1)';
    const statusBorder = isDelayed ? 'rgba(239,68,68,0.65)' : 'rgba(74,222,128,0.55)';
    const statusText   = isDelayed ? `${mins}m late`        : 'On Time';

    const depLabel     = type === 'inbound' ? 'Departs 30th St' : 'Departs Paoli';
    const arrLabel     = type === 'inbound' ? 'Arrives Paoli'   : 'Arrives 30th St';
    const arrColor     = isDelayed ? '#f87171' : 'white';
    const arrTime      = delayed ? delayed.time : data.arrives;
    const arrLabelFull = isDelayed ? `Est. ${arrLabel}` : arrLabel;

    const trainIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8"/><path d="M12 3v4"/><circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none"/><path d="M7 11h10"/><path d="M7 14h6"/></svg>`;
    const clockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const pinIcon   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

    popup.innerHTML = `
      <div id="sp-handle"></div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:16px;">
        <div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0;">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:3px;color:#60a5fa;">${trainIcon}</div>
          <div style="min-width:0;">
            <div style="font-size:17px;font-weight:700;color:white;line-height:1.2;">${type === 'inbound' ? 'Inbound' : 'Outbound'}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:3px;">Paoli/Thorndale Line</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <div style="font-size:11px;font-weight:700;color:${statusColor};background:${statusBg};border:1.5px solid ${statusBorder};border-radius:6px;padding:4px 10px;">${statusText}</div>
          <button id="sp-close" style="background:rgba(255,255,255,0.18);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:rgba(255,255,255,0.5);font-size:14px;line-height:1;font-family:inherit;">✕</button>
        </div>
      </div>

      <div style="height:1px;background:rgba(255,255,255,0.18);margin-bottom:14px;"></div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:1px;color:rgba(255,255,255,0.4);opacity:0.5;">${clockIcon}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1;">
            <div style="background:rgba(255,255,255,0);border-radius:8px;padding:10px 12px;">
              <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${depLabel}</div>
              <div style="font-size:18px;font-weight:600;color:white;">${data.departs}</div>
            </div>
            <div style="background:rgba(255,255,255,0);border-radius:8px;padding:10px 12px;">
              <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${arrLabelFull}</div>
              <div style="font-size:18px;font-weight:600;color:${arrColor};">${arrTime}</div>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:1px;color:rgba(255,255,255,0.4);opacity:0.5;">${pinIcon}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1;">
            <div>
              <div style="font-size:11px;font-weight:600;color:white;">${type === 'inbound' ? 'Current Station' : 'Origin'}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">${data.extra || '—'}</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:600;color:white;">Service</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">${data.isdirect === 'true' ? 'Direct' : 'Local'}</div>
            </div>
          </div>
        </div>

      </div>`;

    this._activePopup = { data, type };
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    popup.querySelector('#sp-close')?.addEventListener('click', () => this._closePopup());
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this._closePopup();
    });
  }

  _closePopup() {
    this._activePopup = null;
    const overlay = this.shadowRoot.getElementById('sp-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  _render() {
    if (!this._config || !this._hass) return;

    const cfg                = this._config;
    const outboundSensors    = cfg.outbound             || [];
    const inboundSensors     = cfg.inbound              || [];
    const nextStationSensors = cfg.inbound_next_station || [];
    const alertEntity        = cfg.alert                || 'sensor.paoli_line_alert';

    const alertState = this._state(alertEntity);
    const alertMsg   = alertState &&
      alertState.state !== 'No alerts' &&
      alertState.state !== 'unavailable'
        ? alertState.state : null;

    const now     = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    // Gather all trains from all sensors, filter unavailable, then sort by
    // estimated arrival time (scheduled + delay). This ensures a late train
    // that was scheduled earlier doesn't block an on-time train that will
    // physically arrive first.
    const outTrains = this._sortByEstimatedArrival(
      outboundSensors.map(id => this._getTrainData(id))
        .filter(Boolean)
        .filter(t => !this._isStale(t, false))   // remove trains already departed
    );

    // Read ALL inbound sensors (not just [0]), filter stale, then sort.
    const allInTrains = this._sortByEstimatedArrival(
      inboundSensors.map(id => this._getTrainData(id))
        .filter(Boolean)
        .filter(t => !this._isStale(t, true))    // remove trains already arrived
    );
    const inTrain = allInTrains[0] || null;

    // Next station: find the one matching the hero inbound train by checking
    // which next-station sensor corresponds to the same sensor index.
    // After sorting, map back to the original sensor index for next station.
    let nextStation = null;
    if (inTrain && nextStationSensors.length) {
      // Find which inbound sensor index matched our hero train
      const heroIdx = inboundSensors.findIndex(id => {
        const d = this._getTrainData(id);
        return d && d.train === inTrain.train && d.departs === inTrain.departs;
      });
      const nsId = nextStationSensors[heroIdx >= 0 ? heroIdx : 0];
      if (nsId) {
        const ns = this._state(nsId);
        if (ns && ns.state && !['unavailable', 'unknown', '—'].includes(ns.state)) {
          nextStation = ns.state;
        }
      }
    }

    // ── Expanded mode ────────────────────────────────────────────────────────
    if (this._config.expanded) {
      const alertFooterHtmlExp = alertMsg
        ? `<div class="no-alert" style="background:rgba(239,68,68,.12);border:1.5px solid rgba(239,68,68,.55);border-radius:9px;padding:9px 13px;font-size:12px;font-weight:500;color:#fca5a5;margin:8px 10px 10px">${alertMsg}</div>`
        : `<div class="no-alert"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>No active service alerts</span></div>`;
      this.shadowRoot.innerHTML = `
        <style>${this._buildExpandedStyle()}</style>
        <ha-card>
          ${this._renderExpanded(outTrains, allInTrains, nextStation, alertFooterHtmlExp)}
        </ha-card>
        <div id="sp-overlay"><div id="sp-popup"></div></div>`;
      this.shadowRoot.querySelectorAll('[data-train]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const data = JSON.parse(el.dataset.train);
          const type = el.dataset.type;
          this._openPopup(data, type);
        });
      });
      if (this._activePopup) this._openPopup(this._activePopup.data, this._activePopup.type);
      return;
    }

    // ── Outbound hero ─────────────────────────────────────────────────────────
    const heroOut = outTrains[0];
    let heroOutHtml = '';

    if (heroOut) {
      const isDelayed    = heroOut.delay && heroOut.delay !== 'On time' && heroOut.delay !== 'N/A';
      const delayed      = isDelayed ? this._calcDelayedArrival(heroOut.arrives, heroOut.delay) : null;
      const mins         = isDelayed ? parseInt(heroOut.delay.replace(/[^0-9]/g, '')) : 0;
      const cardBg       = isDelayed ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.08)';
      const cardBorder   = isDelayed ? 'rgba(239,68,68,0.60)' : 'rgba(74,222,128,0.55)';
      const dividerColor = isDelayed ? 'rgba(239,68,68,0.45)' : 'rgba(74,222,128,0.35)';
      const statusColor  = isDelayed ? '#fca5a5' : '#4ade80';
      const statusBg     = isDelayed ? 'rgba(239,68,68,0.45)' : 'rgba(74,222,128,0.35)';
      const statusBorder = isDelayed ? 'rgba(239,68,68,0.65)' : 'rgba(74,222,128,0.55)';
      const statusText   = isDelayed ? `${mins}m late` : 'On Time';
      const arrLabel     = isDelayed ? 'Est. Arrives' : 'Arrives';
      const arrTime      = delayed ? delayed.time : heroOut.arrives;
      const arrColor     = isDelayed ? '#f87171' : 'white';

      const laterTrains = []; // compact mode: next train only
      let pillsHtml = '';
      if (laterTrains.length > 0) {
        const pills = laterTrains.map(t => {
          const tDelayed    = t.delay && t.delay !== 'On time' && t.delay !== 'N/A';
          const tDelayedArr = tDelayed ? this._calcDelayedArrival(t.arrives, t.delay) : null;
          const tMins       = tDelayed ? parseInt(t.delay.replace(/[^0-9]/g, '')) : 0;
          const tArrTime    = tDelayedArr ? tDelayedArr.time : t.arrives;
          const pillBg      = tDelayed ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.08)';
          const pillBorder  = tDelayed ? 'rgba(239,68,68,0.55)' : 'rgba(74,222,128,0.55)';
          const statusEl    = tDelayed
            ? `<span class="pill-late">+${tMins}m</span>`
            : this._checkmark();

          return `<div class="pill" style="background:${pillBg};border:1.5px solid ${pillBorder};" data-train='${JSON.stringify({ ...t, extra: t.origin })}' data-type="outbound">
            <div>
              <div class="pill-time">${t.departs}</div>
              <div class="pill-arr">Arr ${tArrTime}</div>
            </div>
            ${statusEl}
          </div>`;
        }).join('');

        pillsHtml = `<div class="pills" style="padding-top:6px;">${pills}</div>`;
      }

      heroOutHtml = `
        <div class="hero" style="background:${cardBg};border:1.5px solid ${cardBorder};" data-train='${JSON.stringify({ ...heroOut, extra: heroOut.origin })}' data-type="outbound">
          <div class="hero-label">Next Departure → Center City</div>
          <div class="hero-body">
            <div class="hero-left">
              <span class="hero-time">${heroOut.departs}</span>
            </div>
            <div class="hero-right">
              <div style="text-align:right;">
                <div class="hero-sublabel">${arrLabel}</div>
                <div class="hero-subtime" style="color:${arrColor};">${arrTime}</div>
              </div>
              <div class="status-badge" style="color:${statusColor};background:${statusBg};border:1.5px solid ${statusBorder};">${statusText}</div>
            </div>
          </div>
          ${pillsHtml}
        </div>`;
    } else {
      heroOutHtml = `
        <div class="hero hero-neutral">
          <div class="hero-label">Next Departure → Center City</div>
          <div class="no-service">No trains currently running</div>
        </div>`;
    }

    // ── Inbound hero ──────────────────────────────────────────────────────────
    let heroInHtml = '';

    if (inTrain) {
      const isDelayed    = inTrain.delay && inTrain.delay !== 'On time' && inTrain.delay !== 'N/A';
      const delayed      = isDelayed ? this._calcDelayedArrival(inTrain.arrives, inTrain.delay) : null;
      const mins         = isDelayed ? parseInt(inTrain.delay.replace(/[^0-9]/g, '')) : 0;
      const cardBg       = isDelayed ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.08)';
      const cardBorder   = isDelayed ? 'rgba(239,68,68,0.60)' : 'rgba(74,222,128,0.55)';
      const statusColor  = isDelayed ? '#fca5a5' : '#4ade80';
      const statusBg     = isDelayed ? 'rgba(239,68,68,0.45)' : 'rgba(74,222,128,0.35)';
      const statusBorder = isDelayed ? 'rgba(239,68,68,0.65)' : 'rgba(74,222,128,0.55)';
      const statusText   = isDelayed ? `${mins}m late` : 'On Time';
      const arrTime      = delayed ? delayed.time : inTrain.arrives;

      const footerParts = [];
      if (nextStation) footerParts.push(`At ${nextStation}`);
      footerParts.push(`Updated ${timeStr}`);

      // Subsequent inbound arrivals as pills (same pattern as outbound)
      const laterInTrains = []; // compact mode: next train only
      let inPillsHtml = '';
      if (laterInTrains.length > 0) {
        const dividerColor = isDelayed ? 'rgba(239,68,68,0.45)' : 'rgba(74,222,128,0.35)';
        const pills = laterInTrains.map(t => {
          const tDelayed    = t.delay && t.delay !== 'On time' && t.delay !== 'N/A';
          const tDelayedArr = tDelayed ? this._calcDelayedArrival(t.arrives, t.delay) : null;
          const tMins       = tDelayed ? parseInt(t.delay.replace(/[^0-9]/g, '')) : 0;
          const tArrTime    = tDelayedArr ? tDelayedArr.time : t.arrives;
          const pillBg      = tDelayed ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.08)';
          const pillBorder  = tDelayed ? 'rgba(239,68,68,0.55)' : 'rgba(74,222,128,0.55)';
          const statusEl    = tDelayed
            ? `<span class="pill-late">+${tMins}m</span>`
            : this._checkmark();
          return `<div class="pill" style="background:${pillBg};border:1.5px solid ${pillBorder};" data-train='${JSON.stringify({ ...t, extra: t.origin })}' data-type="inbound">
            <div>
              <div class="pill-time">${tArrTime}</div>
              <div class="pill-arr">Dep ${t.departs}</div>
            </div>
            ${statusEl}
          </div>`;
        }).join('');
        inPillsHtml = `<div class="pills" style="padding-top:6px;">${pills}</div>`;
      }

      heroInHtml = `
        <div class="hero" style="background:${cardBg};border:1.5px solid ${cardBorder};" data-train='${JSON.stringify({ ...inTrain, extra: nextStation || '—' })}' data-type="inbound">
          <div class="hero-label">Next Arrival ← Center City</div>
          <div class="hero-body">
            <div class="hero-left">
              <span class="hero-time">${arrTime}</span>
            </div>
            <div class="hero-right">
              <div style="text-align:right;">
                <div class="hero-sublabel">Departs 30th St</div>
                <div class="hero-subtime" style="color:${isDelayed ? '#f87171' : 'white'};">${inTrain.departs}</div>
              </div>
              <div class="status-badge" style="color:${statusColor};background:${statusBg};border:1.5px solid ${statusBorder};">${statusText}</div>
            </div>
          </div>
          <div class="hero-footer">${footerParts.join(' · ')}</div>
          ${inPillsHtml}
        </div>`;
    } else {
      heroInHtml = `
        <div class="hero hero-neutral">
          <div class="hero-label">Next Arrival ← Center City</div>
          <div class="no-service">No trains currently running · Updated ${timeStr}</div>
        </div>`;
    }

    // ── Alert / no-alert footer ───────────────────────────────────────────────
    const alertFooterHtml = alertMsg
      ? `<div class="alert-bar">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;">
             <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
             <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
           </svg>
           <span>${alertMsg}</span>
         </div>`
      : `<div class="no-alert">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
           <span>No active service alerts</span>
         </div>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 8px 14px 10px;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
        }

        .hero {
          border-radius: 10px;
          padding: 10px 12px 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: opacity 0.1s;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .hero:active { opacity: 0.85; }

        .hero-neutral {
          background: rgba(255,255,255,0);
          border: 1.5px solid rgba(255,255,255,0.40);
        }

        .hero-label {
          font-size: 9px;
          font-weight: 700;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }

        .hero-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .hero-left {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .hero-time {
          font-size: 26px;
          font-weight: 600;
          color: white;
          letter-spacing: -0.5px;
          line-height: 1;
        }

        .hero-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .hero-sublabel {
          font-size: 9px;
          font-weight: 700;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 2px;
          text-align: right;
        }

        .hero-subtime {
          font-size: 14px;
          font-weight: 600;
          text-align: right;
        }

        .hero-footer {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          margin-top: 6px;
        }

        .status-badge {
          font-size: 11px;
          font-weight: 700;
          border-radius: 6px;
          padding: 4px 9px;
          white-space: nowrap;
        }

        .pills {
          display: flex;
          gap: 7px;
          padding-top: 10px;
          margin-top: 10px;
        }

        .pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 8px;
          padding: 6px 10px;
          flex: 1;
          cursor: pointer;
          transition: opacity 0.1s;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .pill:active { opacity: 0.8; }

        .pill-time {
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .pill-arr {
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          margin-top: 1px;
        }

        .pill-late {
          font-size: 14px;
          font-weight: 700;
          color: #fca5a5;
        }

        .div {
          display: none;
        }

        .no-service {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          font-style: italic;
          padding: 4px 0;
        }

        .alert-bar {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          background: rgba(239,68,68,0.12);
          border: 1.5px solid rgba(239,68,68,0.60);
          border-radius: 9px;
          padding: 9px 13px;
          font-size: 12.5px;
          font-weight: 500;
          line-height: 1.5;
          color: #fca5a5;
          margin-top: 8px;
        }

        .no-alert {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
        }

        /* ── Expanded row mode ── */
        .exp-wrap{overflow:hidden}
        .exp-card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
        .exp-card-hdr-right{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.55)}
        .exp-sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.3);padding:10px 14px 0}
        .exp-train-row{margin:8px 10px;border-radius:8px;padding:12px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;transition:opacity .1s;-webkit-tap-highlight-color:transparent;user-select:none}
        .exp-train-row:active{opacity:.85}
        .exp-train-sub{margin:4px 10px;border-radius:8px;padding:9px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;transition:opacity .1s;-webkit-tap-highlight-color:transparent;user-select:none}
        .exp-train-sub:active{opacity:.85}
        .exp-row-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.55);margin-bottom:3px}
        .exp-time-hero{font-size:26px;font-weight:600;letter-spacing:-1px;line-height:1}
        .exp-ap{font-size:13px;font-weight:500;color:rgba(255,255,255,.60);margin-left:1px}
        .exp-time-sub{font-size:18px;font-weight:600;letter-spacing:-.5px;line-height:1}
        .exp-ap-sub{font-size:10px;font-weight:500;color:rgba(255,255,255,.55);margin-left:1px}
        .exp-row-meta{font-size:10px;color:rgba(255,255,255,.55);margin-top:4px}
        .exp-row-right{text-align:right;flex-shrink:0}
        .exp-arr-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.55);margin-bottom:2px}
        .exp-arr-hero{font-size:14px;font-weight:600}
        .exp-arr-sub{font-size:13px;font-weight:600}
        .exp-badge{font-size:10px;font-weight:700;border-radius:5px;padding:3px 7px;white-space:nowrap;margin-top:5px;display:inline-block}
        .exp-row-div{display:none}
        .exp-sec-div{height:2px;background:rgba(255,255,255,.22);margin:8px 14px 0}
        .exp-train-footer{font-size:11px;color:rgba(255,255,255,.55);margin-top:5px}
        .exp-no-alert{display:flex;align-items:center;gap:5px;padding:8px 14px 10px;margin-top:6px;font-size:11px;color:rgba(255,255,255,.55);border-top:1.5px solid rgba(255,255,255,.30)}
        .exp-no-service{font-size:12px;color:rgba(255,255,255,.55);font-style:italic;padding:10px 14px}

        /* ── Popup — mobile: bottom sheet, desktop ≥768px: centered modal ── */
        #sp-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 9999;
          box-sizing: border-box;
          align-items: flex-end;
          justify-content: center;
        }

        #sp-popup {
          background: var(--card-background-color, #1e1e1e);
          border: 1.5px solid rgba(255,255,255,0.40);
          border-radius: 16px 16px 0 0;
          border-bottom: none;
          padding: 20px;
          box-sizing: border-box;
          overflow-y: auto;
          overscroll-behavior: contain;
          touch-action: pan-y;
          max-height: 80vh;
          width: 100%;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        #sp-popup::-webkit-scrollbar { width: 4px; }
        #sp-popup::-webkit-scrollbar-track { background: transparent; }
        #sp-popup::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        #sp-handle {
          width: 36px;
          height: 4px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
          margin: 0 auto 16px;
        }

        @media (min-width: 768px) {
          #sp-overlay {
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          #sp-popup {
            max-width: 440px;
            border-radius: 16px;
            border-bottom: 1.5px solid rgba(255,255,255,0.40);
          }
          #sp-handle { display: none; }
        }

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
        ${heroOutHtml}
        ${heroInHtml}
        ${alertFooterHtml}
      </ha-card>

      <div id="sp-overlay">
        <div id="sp-popup"></div>
      </div>`;

    // ── Tap listeners ─────────────────────────────────────────────────────────
    this.shadowRoot.querySelectorAll('.hero[data-train]').forEach(el => {
      el.addEventListener('click', () => {
        const data = JSON.parse(el.dataset.train);
        const type = el.dataset.type;
        this._openPopup(data, type);
      });
    });

    this.shadowRoot.querySelectorAll('.pill[data-train]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const data = JSON.parse(el.dataset.train);
        const type = el.dataset.type;
        this._openPopup(data, type);
      });
    });

    // Restore popup if it was open before re-render
    if (this._activePopup) {
      this._openPopup(this._activePopup.data, this._activePopup.type);
    }
  }

  // ── Expanded row HTML helpers ─────────────────────────────────────────────

  _expTrainRow(train, type, isHero, nextStation) {
    const isDelayed = train.delay && train.delay !== 'On time' && train.delay !== 'N/A';
    const delayed   = isDelayed ? this._calcDelayedArrival(train.arrives, train.delay) : null;
    const delayMins = isDelayed ? parseInt(train.delay.replace(/[^0-9]/g, '')) : 0;
    const cardBg     = isDelayed ? 'rgba(239,68,68,.12)' : 'rgba(74,222,128,.08)';
    const cardBorder = isDelayed ? 'rgba(239,68,68,.60)' : 'rgba(74,222,128,.55)';
    const clr        = isDelayed ? '#fca5a5' : '#4ade80';
    const clrStrong  = isDelayed ? '#f87171' : 'white';
    const badgeBg    = isDelayed ? 'rgba(239,68,68,.2)'  : 'rgba(74,222,128,.15)';
    const badgeBdr   = isDelayed ? 'rgba(239,68,68,.65)' : 'rgba(74,222,128,.55)';
    const badgeTxt   = isDelayed ? `${delayMins}m late`  : 'On Time';
    const service    = train.isdirect === 'true' ? 'Direct' : 'Local';
    const trainNum   = train.train && train.train !== '—' ? `Train ${train.train} · ` : '';

    if (type === 'outbound') {
      const arrTime = delayed ? delayed.time : train.arrives;
      const arrLbl  = isDelayed ? 'Est. arrives 30th St' : 'Arrives 30th St';
      const timeClr = isHero ? (isDelayed ? '#fca5a5' : 'white') : (isDelayed ? 'rgba(252,165,165,.8)' : 'rgba(255,255,255,.75)');
      const rowCls  = isHero ? 'exp-train-row' : 'exp-train-sub';
      const timeCls = isHero ? 'exp-time-hero' : 'exp-time-sub';
      const apCls   = isHero ? 'exp-ap' : 'exp-ap-sub';
      const arrCls  = isHero ? 'exp-arr-hero' : 'exp-arr-sub';
      const bg      = isHero ? cardBg : (isDelayed ? 'rgba(239,68,68,.06)' : 'rgba(74,222,128,.06)');
      const bdr     = isHero ? cardBorder : (isDelayed ? 'rgba(239,68,68,.45)' : 'rgba(74,222,128,.55)');
      const parts   = train.departs.toUpperCase().replace(/\s/g,'');
      const depNum  = parts.replace('AM','').replace('PM','');
      const depAp   = parts.includes('PM') ? 'PM' : 'AM';
      return `<div class="${rowCls}" style="background:${bg};border:1.5px solid ${bdr}" data-train='${JSON.stringify({...train,extra:train.origin})}' data-type="outbound">
        <div>
          ${isHero ? `<div class="exp-row-lbl">Next departure</div>` : ''}
          <div class="${timeCls}" style="color:${timeClr}">${depNum}<span class="${apCls}">${depAp}</span></div>
          <div class="exp-row-meta">${trainNum}${service}</div>
        </div>
        <div class="exp-row-right">
          <div class="exp-arr-lbl">${arrLbl}</div>
          <div class="${arrCls}" style="color:${isDelayed ? '#f87171' : 'white'}">${arrTime}</div>
          <div class="exp-badge" style="background:${badgeBg};color:${clr};border:1.5px solid ${badgeBdr}">${badgeTxt}</div>
        </div>
      </div>`;
    } else {
      // inbound
      const arrTime = delayed ? delayed.time : train.arrives;
      const arrParts = arrTime.toUpperCase().replace(/\s/g,'');
      const arrNum   = arrParts.replace('AM','').replace('PM','');
      const arrAp    = arrParts.includes('PM') ? 'PM' : 'AM';
      const arrLbl   = isDelayed ? 'Est. arrival at Paoli' : 'Arrives at Paoli';
      const rowCls   = isHero ? 'exp-train-row' : 'exp-train-sub';
      const timeCls  = isHero ? 'exp-time-hero' : 'exp-time-sub';
      const apCls    = isHero ? 'exp-ap' : 'exp-ap-sub';
      const arrCls   = isHero ? 'exp-arr-hero' : 'exp-arr-sub';
      const bg       = isHero ? cardBg : (isDelayed ? 'rgba(239,68,68,.06)' : 'rgba(74,222,128,.06)');
      const bdr      = isHero ? cardBorder : (isDelayed ? 'rgba(239,68,68,.45)' : 'rgba(74,222,128,.55)');
      const timeClr  = isHero ? (isDelayed ? '#fca5a5' : 'white') : (isDelayed ? 'rgba(252,165,165,.8)' : 'rgba(255,255,255,.75)');
      const footer   = isHero && nextStation ? `<div class="exp-train-footer">At ${nextStation}</div>` : '';
      return `<div class="${rowCls}" style="background:${bg};border:1.5px solid ${bdr}" data-train='${JSON.stringify({...train,extra:nextStation||'—'})}' data-type="inbound">
        <div>
          ${isHero ? `<div class="exp-row-lbl">Next arrival at Paoli</div>` : ''}
          <div class="${timeCls}" style="color:${timeClr}">${arrNum}<span class="${apCls}">${arrAp}</span></div>
          <div class="exp-row-meta">${trainNum}${service}</div>
          ${footer}
        </div>
        <div class="exp-row-right">
          <div class="exp-arr-lbl">Departs 30th St</div>
          <div class="${arrCls}" style="color:${isDelayed ? '#f87171' : 'white'}">${train.departs}</div>
          <div class="exp-badge" style="background:${badgeBg};color:${clr};border:1.5px solid ${badgeBdr}">${badgeTxt}</div>
        </div>
      </div>`;
    }
  }

  _buildExpandedStyle() {
    return `
      :host{display:block}
      ha-card{background:transparent!important;box-shadow:none!important;padding:0;font-family:var(--primary-font-family,sans-serif)}
      *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
      .exp-wrap{overflow:hidden}
      .exp-card-hdr{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px;padding:12px 14px 8px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
      .exp-card-hdr-right{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.55)}
      .exp-sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.55);padding:10px 14px 0}
      .exp-train-row{margin:8px 10px;border-radius:8px;padding:12px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;transition:opacity .1s;-webkit-tap-highlight-color:transparent;user-select:none}
      .exp-train-row:active{opacity:.85}
      .exp-train-sub{margin:4px 10px;border-radius:8px;padding:9px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;transition:opacity .1s;-webkit-tap-highlight-color:transparent;user-select:none}
      .exp-train-sub:active{opacity:.85}
      .exp-row-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.55);margin-bottom:3px}
      .exp-time-hero{font-size:26px;font-weight:600;letter-spacing:-1px;line-height:1}
      .exp-ap{font-size:13px;font-weight:500;color:rgba(255,255,255,.60);margin-left:1px}
      .exp-time-sub{font-size:18px;font-weight:600;letter-spacing:-.5px;line-height:1}
      .exp-ap-sub{font-size:10px;font-weight:500;color:rgba(255,255,255,.55);margin-left:1px}
      .exp-row-meta{font-size:10px;color:rgba(255,255,255,.55);margin-top:4px}
      .exp-row-right{text-align:right;flex-shrink:0}
      .exp-arr-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.55);margin-bottom:2px}
      .exp-arr-hero{font-size:14px;font-weight:600}
      .exp-arr-sub{font-size:13px;font-weight:600}
      .exp-badge{font-size:10px;font-weight:700;border-radius:5px;padding:3px 7px;white-space:nowrap;margin-top:5px;display:inline-block}
      .exp-row-div{display:none}
      .exp-sec-div{height:2px;background:rgba(255,255,255,.22);margin:8px 14px 0}
      .exp-train-footer{font-size:11px;color:rgba(255,255,255,.55);margin-top:5px}
      .exp-no-alert{display:flex;align-items:center;gap:5px;padding:8px 14px 10px;margin-top:6px;font-size:11px;color:rgba(255,255,255,.55);border-top:1.5px solid rgba(255,255,255,.25)}
      .exp-no-service{font-size:12px;color:rgba(255,255,255,.55);font-style:italic;padding:10px 14px}
      .no-alert{display:flex;align-items:center;gap:5px;padding:8px 14px 10px;margin-top:6px;font-size:11px;color:rgba(255,255,255,.55);border-top:1.5px solid rgba(255,255,255,.25)}
      #sp-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;box-sizing:border-box;align-items:flex-end;justify-content:center}
      #sp-popup{background:#1a1a1a;border:1.5px solid rgba(255,255,255,.40);border-radius:16px 16px 0 0;border-bottom:none;padding:20px;box-sizing:border-box;overflow-y:auto;max-height:80vh;width:100%}
      #sp-handle{width:36px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin:0 auto 16px}
      @media(min-width:768px){#sp-overlay{align-items:center;justify-content:center;padding:24px}#sp-popup{max-width: 440px;border-radius:16px;border-bottom:1.5px solid rgba(255,255,255,.35)}#sp-handle{display:none}}
    `;
  }


  _renderExpanded(outTrains, allInTrains, nextStation, alertFooterHtml) {
    const outRows = outTrains.map((t, i) =>
      (i > 0 ? '<div class="exp-row-div"></div>' : '') + this._expTrainRow(t, 'outbound', i === 0, null)
    ).join('') || `<div class="exp-no-service">No outbound trains</div>`;

    const inRows = allInTrains.map((t, i) =>
      (i > 0 ? '<div class="exp-row-div"></div>' : '') + this._expTrainRow(t, 'inbound', i === 0, i === 0 ? nextStation : null)
    ).join('') || `<div class="exp-no-service">No inbound trains</div>`;

    const alertExpHtml = alertFooterHtml.replace('class="no-alert"', 'class="exp-no-alert"');

    return `
      <div class="exp-wrap">
        <div class="exp-card-hdr">
          Paoli / Thorndale
          <div class="exp-card-hdr-right">Paoli Station</div>
        </div>
        <div class="exp-sec-lbl">Outbound → Center City</div>
        ${outRows}
        <div class="exp-sec-div"></div>
        <div class="exp-sec-lbl">Inbound ← Center City</div>
        ${inRows}
        ${alertExpHtml}
      </div>`;
  }



}
customElements.define('septa-paoli-card', SeptaPaoliCard);