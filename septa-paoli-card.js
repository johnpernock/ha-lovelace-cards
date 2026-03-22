/**
 * septa-paoli-card.js
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
    this._render();
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
    const statusBorder = isDelayed ? 'rgba(239,68,68,0.5)'  : 'rgba(74,222,128,0.25)';
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
            <div style="font-size:17px;font-weight:700;color:var(--primary-text-color,white);line-height:1.2;">${type === 'inbound' ? 'Inbound' : 'Outbound'}</div>
            <div style="font-size:11px;color:var(--secondary-text-color,rgba(255,255,255,0.45));margin-top:3px;">Paoli/Thorndale Line</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <div style="font-size:11px;font-weight:700;color:${statusColor};background:${statusBg};border:1px solid ${statusBorder};border-radius:6px;padding:4px 10px;">${statusText}</div>
          <button id="sp-close" style="background:rgba(255,255,255,0.08);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--secondary-text-color,rgba(255,255,255,0.5));font-size:14px;line-height:1;font-family:inherit;">✕</button>
        </div>
      </div>

      <div style="height:1px;background:var(--divider-color,rgba(255,255,255,0.08));margin-bottom:14px;"></div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:1px;color:var(--secondary-text-color,rgba(255,255,255,0.4));opacity:0.5;">${clockIcon}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1;">
            <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px;">
              <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${depLabel}</div>
              <div style="font-size:18px;font-weight:600;color:var(--primary-text-color,white);">${data.departs}</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px;">
              <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${arrLabelFull}</div>
              <div style="font-size:18px;font-weight:600;color:${arrColor};">${arrTime}</div>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:1px;color:var(--secondary-text-color,rgba(255,255,255,0.4));opacity:0.5;">${pinIcon}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1;">
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--primary-text-color,white);">${type === 'inbound' ? 'Current Station' : 'Origin'}</div>
              <div style="font-size:12px;color:var(--secondary-text-color,rgba(255,255,255,0.5));margin-top:2px;">${data.extra || '—'}</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--primary-text-color,white);">Service</div>
              <div style="font-size:12px;color:var(--secondary-text-color,rgba(255,255,255,0.5));margin-top:2px;">${data.isdirect === 'true' ? 'Direct' : 'Local'}</div>
            </div>
          </div>
        </div>

      </div>`;

    this._activePopup = { data, type };
    overlay.style.display = 'flex';

    popup.querySelector('#sp-close')?.addEventListener('click', () => this._closePopup());
    setTimeout(() => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this._closePopup();
      }, { once: true });
    }, 50);
  }

  _closePopup() {
    this._activePopup = null;
    const overlay = this.shadowRoot.getElementById('sp-overlay');
    if (overlay) overlay.style.display = 'none';
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

    const outTrains = outboundSensors.map(id => this._getTrainData(id)).filter(Boolean);
    const inTrain   = this._getTrainData(inboundSensors[0]);

    let nextStation = null;
    if (nextStationSensors[0]) {
      const ns = this._state(nextStationSensors[0]);
      if (ns && ns.state && !['unavailable', 'unknown', '—'].includes(ns.state)) {
        nextStation = ns.state;
      }
    }

    // ── Outbound hero ─────────────────────────────────────────────────────────
    const heroOut = outTrains[0];
    let heroOutHtml = '';

    if (heroOut) {
      const isDelayed    = heroOut.delay && heroOut.delay !== 'On time' && heroOut.delay !== 'N/A';
      const delayed      = isDelayed ? this._calcDelayedArrival(heroOut.arrives, heroOut.delay) : null;
      const mins         = isDelayed ? parseInt(heroOut.delay.replace(/[^0-9]/g, '')) : 0;
      const cardBg       = isDelayed ? 'rgba(239,68,68,0.1)'  : 'rgba(74,222,128,0.07)';
      const cardBorder   = isDelayed ? 'rgba(239,68,68,0.4)'  : 'rgba(74,222,128,0.25)';
      const dividerColor = isDelayed ? 'rgba(239,68,68,0.2)'  : 'rgba(74,222,128,0.15)';
      const statusColor  = isDelayed ? '#fca5a5' : '#4ade80';
      const statusBg     = isDelayed ? 'rgba(239,68,68,0.2)'  : 'rgba(74,222,128,0.15)';
      const statusBorder = isDelayed ? 'rgba(239,68,68,0.5)'  : 'rgba(74,222,128,0.35)';
      const statusText   = isDelayed ? `${mins}m late` : 'On Time';
      const arrLabel     = isDelayed ? 'Est. Arrives' : 'Arrives';
      const arrTime      = delayed ? delayed.time : heroOut.arrives;
      const arrColor     = isDelayed ? '#f87171' : 'white';

      const laterTrains = outTrains.slice(1);
      let pillsHtml = '';
      if (laterTrains.length > 0) {
        const pills = laterTrains.map(t => {
          const tDelayed    = t.delay && t.delay !== 'On time' && t.delay !== 'N/A';
          const tDelayedArr = tDelayed ? this._calcDelayedArrival(t.arrives, t.delay) : null;
          const tMins       = tDelayed ? parseInt(t.delay.replace(/[^0-9]/g, '')) : 0;
          const tArrTime    = tDelayedArr ? tDelayedArr.time : t.arrives;
          const pillBg      = tDelayed ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)';
          const pillBorder  = tDelayed ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)';
          const statusEl    = tDelayed
            ? `<span class="pill-late">+${tMins}m</span>`
            : this._checkmark();

          return `<div class="pill" style="background:${pillBg};border:1px solid ${pillBorder};" data-train='${JSON.stringify({ ...t, extra: t.origin })}' data-type="outbound">
            <div>
              <div class="pill-time">${t.departs}</div>
              <div class="pill-arr">Arr ${tArrTime}</div>
            </div>
            ${statusEl}
          </div>`;
        }).join('');

        pillsHtml = `<div class="pills" style="border-top:1px solid ${dividerColor};">${pills}</div>`;
      }

      heroOutHtml = `
        <div class="hero" style="background:${cardBg};border:1px solid ${cardBorder};" data-train='${JSON.stringify({ ...heroOut, extra: heroOut.origin })}' data-type="outbound">
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
              <div class="status-badge" style="color:${statusColor};background:${statusBg};border:1px solid ${statusBorder};">${statusText}</div>
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
      const cardBg       = isDelayed ? 'rgba(239,68,68,0.1)'  : 'rgba(74,222,128,0.07)';
      const cardBorder   = isDelayed ? 'rgba(239,68,68,0.4)'  : 'rgba(74,222,128,0.25)';
      const statusColor  = isDelayed ? '#fca5a5' : '#4ade80';
      const statusBg     = isDelayed ? 'rgba(239,68,68,0.2)'  : 'rgba(74,222,128,0.15)';
      const statusBorder = isDelayed ? 'rgba(239,68,68,0.5)'  : 'rgba(74,222,128,0.35)';
      const statusText   = isDelayed ? `${mins}m late` : 'On Time';
      const arrTime      = delayed ? delayed.time : inTrain.arrives;

      const footerParts = [];
      if (nextStation) footerParts.push(`At ${nextStation}`);
      footerParts.push(`Updated ${timeStr}`);

      heroInHtml = `
        <div class="hero" style="background:${cardBg};border:1px solid ${cardBorder};" data-train='${JSON.stringify({ ...inTrain, extra: nextStation || '—' })}' data-type="inbound">
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
              <div class="status-badge" style="color:${statusColor};background:${statusBg};border:1px solid ${statusBorder};">${statusText}</div>
            </div>
          </div>
          <div class="hero-footer">${footerParts.join(' · ')}</div>
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
        }
        .hero:active { opacity: 0.85; }

        .hero-neutral {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
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
          color: var(--primary-text-color, white);
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
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 6px 0;
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
          border: 1px solid rgba(239,68,68,0.45);
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
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 16px 16px 0 0;
          border-bottom: none;
          padding: 20px;
          box-sizing: border-box;
          overflow-y: auto;
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
            max-width: 420px;
            border-radius: 16px;
            border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          }
          #sp-handle { display: none; }
        }
      </style>

      <ha-card>
        ${heroOutHtml}
        <div class="div"></div>
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
}

customElements.define('septa-paoli-card', SeptaPaoliCard);
