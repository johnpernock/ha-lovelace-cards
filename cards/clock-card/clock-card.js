/**
 * clock-card.js  —  v3
 * Home Assistant Lovelace clock + date card with optional calendar popup.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/clock-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/clock-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:clock-card
 *
 * # All options are optional — the card works with no config at all.
 *
 * calendar_entities:             # attach one or more calendar entities
 *   - entity: calendar.personal  # event dots appear on matching days
 *     color: '#60a5fa'           # dot color (default #60a5fa)
 *   - entity: calendar.work
 *     color: '#a78bfa'
 *   - entity: calendar.family
 *     color: '#4ade80'
 *
 * show_next_event: true          # show next upcoming event below the time
 *                                # (default true when calendar_entities set)
 *
 * today_color: '#60a5fa'         # accent color for today in the calendar
 *                                # (default #60a5fa)
 *
 * ── BEHAVIOUR ─────────────────────────────────────────────────────────────────
 * • Time ticks every second — hours:minutes displayed large, seconds + AM/PM small
 * • Date side shows day-of-week, month abbreviation, day number
 * • Tapping the date side opens a calendar popup
 * • Calendar popup: full month grid, ← → month navigation
 * • Today highlighted with today_color dot + ring
 * • Days with events show colored dots (one per calendar, up to 3)
 * • If show_next_event is true and calendar_entities set, the next upcoming
 *   event title + countdown appears in a small strip below the time row
 * • Popup dismisses by tapping outside or the ✕ button
 * • Mobile: bottom sheet   •   Desktop ≥768px: centered modal
 */

class ClockCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config     = {};
    this._hass       = null;
    this._tick       = null;
    this._popupOpen  = false;
    this._calMonth   = null; // null = current month
    this._calYear    = null;
    this._events     = {};   // keyed by 'YYYY-M-D' → array of {color}
    this._nextEvent  = null; // { title, countdown, color }
    this._lastFetch  = 0;
  }

  static getStubConfig() {
    return {
      calendar_entities: [
        { entity: 'calendar.personal', color: '#60a5fa' },
        { entity: 'calendar.work',     color: '#a78bfa' },
      ],
      show_next_event: true,
      today_color: '#60a5fa',
    };
  }

  setConfig(config) {
    this._config = config;
    this._render();
    this._startTick();
  }

  set hass(hass) {
    this._hass = hass;
    // Fetch calendar events once per 5 minutes
    if (Date.now() - this._lastFetch > 5 * 60 * 1000) {
      this._fetchEvents();
    }
  }

  connectedCallback()    { this._startTick(); }
  disconnectedCallback() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
    this._popupOpen = false;
  }

  getCardSize() { return 2; }

  // ── Clock tick ───────────────────────────────────────────────────────────────

  _startTick() {
    if (this._tick) return;
    this._tick = setInterval(() => this._update(), 1000);
    this._update();
  }

  _pad(n) { return String(n).padStart(2, '0'); }

  _update() {
    const root = this.shadowRoot;
    if (!root) return;

    const now  = new Date();
    const h    = now.getHours();
    const m    = now.getMinutes();
    const s    = now.getSeconds();
    const h12  = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';

    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const set = (id, val) => { const el = root.getElementById(id); if (el) el.textContent = val; };

    set('hm',  this._pad(h12) + ':' + this._pad(m));
    set('ss',  this._pad(s));
    set('ap',  ampm);
    set('dn',  DAYS[now.getDay()]);
    set('mo',  MONTHS[now.getMonth()]);
    set('day', now.getDate());
  }

  // ── Calendar event fetching ───────────────────────────────────────────────────

  async _fetchEvents() {
    const cals = this._config.calendar_entities;
    if (!cals?.length || !this._hass) return;

    this._lastFetch = Date.now();
    const now = new Date();
    // Fetch 60 days ahead so the popup calendar has dots for next month too
    const end = new Date(now.getTime() + 60 * 86400000);

    const newEvents   = {};
    let   nextEvent   = null;
    let   nextEventTs = Infinity;

    try {
      await Promise.all(cals.map(async cal => {
        const color = cal.color || '#60a5fa';
        let evs = [];
        try {
          evs = await this._hass.callApi('GET',
            `calendars/${cal.entity}?start=${now.toISOString()}&end=${end.toISOString()}`
          );
        } catch (_) { return; }

        (evs || []).forEach(ev => {
          const isAllDay  = !ev.start?.dateTime;
          const startStr  = ev.start?.dateTime || ev.start?.date || '';
          if (!startStr) return;

          // Build date key
          const d   = isAllDay
            ? (() => { const [y,mo,dd] = startStr.split('-').map(Number); return new Date(y, mo-1, dd); })()
            : new Date(startStr);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

          if (!newEvents[key]) newEvents[key] = [];
          // Store up to 3 distinct colors per day
          if (!newEvents[key].find(e => e.color === color)) {
            newEvents[key].push({ color });
          }

          // Track next upcoming event for the strip
          if (!isAllDay) {
            const ts = d.getTime();
            if (ts > now.getTime() && ts < nextEventTs) {
              nextEventTs = ts;
              const diff   = Math.round((ts - now.getTime()) / 60000);
              let   countdown;
              if (diff < 60)        countdown = `${diff}m`;
              else if (diff < 1440) countdown = `${Math.round(diff/60)}h`;
              else                  countdown = `${Math.round(diff/1440)}d`;
              nextEvent = {
                title:     ev.summary || ev.title || 'Untitled',
                countdown,
                color,
              };
            }
          }
        });
      }));
    } catch (e) {
      console.warn('clock-card: event fetch error', e);
    }

    this._events    = newEvents;
    this._nextEvent = nextEvent;
    this._render();
  }

  // ── Calendar popup ────────────────────────────────────────────────────────────

  _openPopup() {
    const overlay = this.shadowRoot.getElementById('cc-overlay');
    if (!overlay) return;
    this._popupOpen = true;
    // Default popup to current month
    const now = new Date();
    if (this._calMonth === null) {
      this._calMonth = now.getMonth();
      this._calYear  = now.getFullYear();
    }
    overlay.style.display = 'flex';
    this._renderPopup();
    setTimeout(() => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this._closePopup();
      }, { once: true });
    }, 50);
  }

  _closePopup() {
    this._popupOpen = false;
    const overlay = this.shadowRoot.getElementById('cc-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  _shiftMonth(dir) {
    this._calMonth += dir;
    if (this._calMonth > 11) { this._calMonth = 0;  this._calYear++; }
    if (this._calMonth < 0)  { this._calMonth = 11; this._calYear--; }
    this._renderPopup();
  }

  _renderPopup() {
    const popup = this.shadowRoot.getElementById('cc-popup');
    if (!popup) return;

    const today      = new Date();
    const todayY     = today.getFullYear();
    const todayM     = today.getMonth();
    const todayD     = today.getDate();
    const todayColor = this._config.today_color || '#60a5fa';
    const cals       = this._config.calendar_entities || [];

    const MNAMES = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const DOWS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    const y   = this._calYear;
    const mo  = this._calMonth;
    const firstDow    = new Date(y, mo, 1).getDay();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const daysInPrev  = new Date(y, mo, 0).getDate();

    // Legend dots
    const legendHtml = cals.filter(c => c.color).map(c => `
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--secondary-text-color)">
        <div style="width:7px;height:7px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
        <span>${c.name || (this._hass?.states[c.entity]?.attributes?.friendly_name) || c.entity.split('.')[1]}</span>
      </div>`).join('');

    // Build grid cells
    let cells = '';

    // Prev month trailing days
    for (let i = 0; i < firstDow; i++) {
      const d = daysInPrev - firstDow + 1 + i;
      cells += `<div class="cal-day other-month">${d}</div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = y === todayY && mo === todayM && d === todayD;
      const key     = `${y}-${mo}-${d}`;
      const dots    = this._events[key] || [];

      const dotHtml = dots.slice(0, 3).map(e =>
        `<div style="width:4px;height:4px;border-radius:50%;background:${e.color};flex-shrink:0"></div>`
      ).join('');

      const dotsRow = dots.length
        ? `<div style="display:flex;gap:2px;justify-content:center;margin-top:2px">${dotHtml}</div>`
        : '';

      if (isToday) {
        cells += `<div class="cal-day today" style="background:${todayColor}22;color:${todayColor}">
          <div>${d}</div>${dotsRow}
        </div>`;
      } else {
        cells += `<div class="cal-day${dots.length ? ' has-event' : ''}">
          <div>${d}</div>${dotsRow}
        </div>`;
      }
    }

    // Next month leading days
    const totalCells = firstDow + daysInMonth;
    const rem        = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= rem; i++) {
      cells += `<div class="cal-day other-month">${i}</div>`;
    }

    popup.innerHTML = `
      <div id="cc-handle"></div>
      <div class="pop-head">
        <div>
          <div class="pop-title">${MNAMES[mo]} ${y}</div>
          ${legendHtml ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:5px">${legendHtml}</div>` : ''}
        </div>
        <button id="cc-close">✕</button>
      </div>
      <div class="pop-divider"></div>
      <div class="cal-nav">
        <button class="cal-nav-btn" id="cal-prev">&#8249;</button>
        <div class="cal-month-lbl">${MNAMES[mo]} ${y}</div>
        <button class="cal-nav-btn" id="cal-next">&#8250;</button>
      </div>
      <div class="cal-grid">
        ${DOWS.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>`;

    popup.querySelector('#cc-close')?.addEventListener('click', () => this._closePopup());
    popup.querySelector('#cal-prev')?.addEventListener('click', () => this._shiftMonth(-1));
    popup.querySelector('#cal-next')?.addEventListener('click', () => this._shiftMonth(1));
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  _render() {
    const todayColor  = this._config.today_color || '#60a5fa';
    const showNext    = this._config.show_next_event !== false
                        && (this._config.calendar_entities?.length > 0);
    const next        = this._nextEvent;

    const nextStripHtml = showNext && next
      ? `<div class="next-strip">
          <div class="next-dot" style="background:${next.color}"></div>
          <div class="next-title">${next.title}</div>
          <div class="next-cd">${next.countdown}</div>
        </div>`
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 18px 20px;
          box-sizing: border-box;
        }

        /* ── Time + date row ── */
        .row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .clock-group {
          display: flex;
          align-items: flex-start;
          line-height: 1;
        }
        .clock-digits {
          font-size: 56px;
          font-weight: 700;
          color: var(--primary-text-color);
          letter-spacing: -1.5px;
          line-height: 1;
        }
        .clock-stack {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 56px;
          margin-left: 6px;
          padding: 2px 0;
          box-sizing: border-box;
        }
        .lbl {
          font-size: 16px;
          font-weight: 700;
          color: var(--secondary-text-color);
          letter-spacing: 0.04em;
          line-height: 1;
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* Date side — tappable */
        .date-group {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          border-radius: 8px;
          padding: 2px 4px;
          margin: -2px -4px;
          transition: background .15s;
        }
        .date-group:hover { background: rgba(255,255,255,0.06); }
        .date-group:active { background: rgba(255,255,255,0.1); }
        .date-labels {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 56px;
          align-items: flex-end;
          padding: 2px 0;
          box-sizing: border-box;
        }
        .date-daynum {
          font-size: 56px;
          font-weight: 700;
          color: var(--primary-text-color);
          letter-spacing: -1.5px;
          line-height: 1;
          transition: color .15s;
        }
        .date-group:hover .date-daynum,
        .date-group:hover .lbl { color: ${todayColor}; }

        /* ── Next event strip ── */
        .next-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          padding: 7px 10px;
          background: rgba(255,255,255,0.04);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.07);
        }
        .next-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .next-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--primary-text-color);
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .next-cd {
          font-size: 11px;
          font-weight: 700;
          color: ${todayColor};
          flex-shrink: 0;
        }

        /* ── Popup overlay ── */
        #cc-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 9999;
          box-sizing: border-box;
          align-items: flex-end;
          justify-content: center;
        }
        #cc-popup {
          background: var(--card-background-color, #1e1e2a);
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 16px 16px 0 0;
          border-bottom: none;
          padding: 20px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          box-sizing: border-box;
        }
        @media (min-width: 768px) {
          #cc-overlay { align-items: center; justify-content: center; padding: 24px; }
          #cc-popup {
            max-width: 380px;
            border-radius: 16px;
            border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          }
          #cc-handle { display: none !important; }
        }

        /* ── Popup internals ── */
        #cc-handle {
          width: 36px; height: 4px;
          background: rgba(255,255,255,0.15); border-radius: 2px;
          margin: 0 auto 16px;
        }
        .pop-head {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 14px;
        }
        .pop-title {
          font-size: 17px; font-weight: 700;
          color: var(--primary-text-color); line-height: 1.2;
        }
        #cc-close {
          background: rgba(255,255,255,0.08); border: none; border-radius: 50%;
          width: 28px; height: 28px; cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          color: var(--secondary-text-color); font-size: 14px;
          line-height: 1; font-family: inherit; flex-shrink: 0;
        }
        .pop-divider {
          height: 1px;
          background: var(--divider-color, rgba(255,255,255,0.09));
          margin-bottom: 14px;
        }

        /* Calendar nav */
        .cal-nav {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 14px;
        }
        .cal-nav-btn {
          background: rgba(255,255,255,0.06); border: none;
          border-radius: 8px; width: 30px; height: 30px;
          cursor: pointer; color: var(--primary-text-color);
          font-size: 20px; display: flex; align-items: center;
          justify-content: center; font-family: inherit;
          transition: background .12s;
        }
        .cal-nav-btn:hover { background: rgba(255,255,255,0.12); }
        .cal-month-lbl {
          font-size: 15px; font-weight: 700;
          color: var(--primary-text-color);
        }

        /* Calendar grid */
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 3px;
        }
        .cal-dow {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          color: var(--secondary-text-color); text-align: center;
          padding: 4px 0; letter-spacing: .05em; opacity: .5;
        }
        .cal-day {
          min-height: 34px; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600;
          color: var(--secondary-text-color);
          border-radius: 8px; cursor: default;
          padding: 3px 0;
        }
        .cal-day.other-month { color: var(--secondary-text-color); opacity: .28; }
        .cal-day.today       { font-weight: 800; }
        .cal-day.has-event   { color: var(--primary-text-color); }
      </style>

      <ha-card>
        <div class="row">
          <div class="clock-group">
            <span class="clock-digits" id="hm">--:--</span>
            <div class="clock-stack">
              <span class="lbl" id="ss">--</span>
              <span class="lbl" id="ap">--</span>
            </div>
          </div>

          <div class="date-group" id="date-tap">
            <div class="date-labels">
              <span class="lbl" id="dn">---</span>
              <span class="lbl" id="mo">---</span>
            </div>
            <span class="date-daynum" id="day">--</span>
          </div>
        </div>

        ${nextStripHtml}
      </ha-card>

      <div id="cc-overlay">
        <div id="cc-popup"></div>
      </div>`;

    this._update();

    // Tap date → open calendar popup
    this.shadowRoot.getElementById('date-tap')
      ?.addEventListener('click', () => this._openPopup());

    // Restore popup after re-render
    if (this._popupOpen) {
      const overlay = this.shadowRoot.getElementById('cc-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        this._renderPopup();
      }
    }
  }
}

customElements.define('clock-card', ClockCard);