/**
 * calendar-card.js
 * Custom Home Assistant Lovelace calendar card.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/calendar-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/calendar-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 *
 * type: custom:calendar-card
 *
 * calendars:                            # required — at least one entry
 *   - entity: calendar.personal
 *     color: '#60a5fa'                  # dot / accent color
 *     name: Personal                    # display name shown in popup
 *   - entity: calendar.work
 *     color: '#a78bfa'
 *     name: Work
 *   - entity: calendar.family
 *     color: '#4ade80'
 *     name: Family
 *
 * # ── Optional settings ────────────────────────────────────────────────────
 * days_ahead: 14              # how far ahead to fetch events (default 14)
 * max_events: 30              # hard cap on total events fetched (default 30)
 * refresh_interval: 5         # minutes between background refreshes (default 5)
 * grid_rows: 8               # HA grid rows the card occupies (default 8)
 * show_past_events: true      # show earlier-today events dimmed (default true)
 * today_color: '#60a5fa'      # accent colour for today
 * show_legend: false          # show calendar colour legend below card (default false)
 *
 * mobile_expand: true          # when true: card grows with content on mobile (< 768px)
 *                             #   so stacked dashboard columns scroll naturally
 *                             #   on wall/desktop (>= 768px) always stays grid height
 *                             #   default: true
 *
 * google_maps_api_key: !secret google_maps_api_key
 *                             # stored in secrets.yaml
 *                             # required for map thumbnails in popup
 *                             # if omitted, a tasteful placeholder is shown instead
 *
 * ── secrets.yaml ──────────────────────────────────────────────────────────────
 * google_maps_api_key: YOUR_KEY_HERE
 *
 * ── FEATURES ──────────────────────────────────────────────────────────────────
 * • Scrollable fixed-height card — no events ever hidden
 * • Events grouped by day with day abbr / number / month
 * • ×N count badge on date column for days with 2+ events
 * • Today's date column vertical bar pulses slowly
 * • Pulsing dot on every upcoming event today
 * • Globally-next event bolded across the whole card
 * • Past events today shown dimmed (opacity 0.38)
 * • Start time + duration: 9:00am (1hr 30m) · ALL DAY for all-day events
 * • Multi-day events shown on start day only
 * • Countdown badge: today / tmrw / +Nd
 * • Tap any event → detail popup
 * • Popup: title, calendar name, date + time range, location, description
 * • Static map thumbnail in popup when location present + API key configured
 * • No API key → tasteful "map requires API key" placeholder (no broken images)
 * • No location → location section hidden entirely
 * • Popup dismisses by tapping outside or ✕ button
 * • Fade gradient hint at bottom of scroll area
 * • Optional calendar colour legend
 */

class CalendarCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._events    = [];
    this._loading   = false;
    this._tick      = null;
    this._lastFetch = 0;
  }

  static getStubConfig() {
    return {
      calendars: [
        { entity: 'calendar.personal', color: '#60a5fa', name: 'Personal' },
        { entity: 'calendar.work',     color: '#a78bfa', name: 'Work'     },
        { entity: 'calendar.family',   color: '#4ade80', name: 'Family'   },
      ],
      days_ahead:          14,
      max_events:          30,
      refresh_interval:    5,
      grid_rows:           8,
      show_past_events:    true,
      today_color:         '#60a5fa',
      show_legend:         false,
      google_maps_api_key: '',
      mobile_expand:       true,
    };
  }

  // ── Normalise calendar entries ────────────────────────────────────────────

  _normCals() {
    return (this._config.calendars || []).map(c =>
      typeof c === 'string'
        ? { entity: c, color: null, name: null }
        : { entity: c.entity, color: c.color || null, name: c.name || null }
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  setConfig(config) {
    if (!config.calendars?.length) throw new Error('calendar-card: define at least one calendar');
    this._config = {
      days_ahead:          14,
      max_events:          30,
      refresh_interval:    5,
      grid_rows:           8,
      show_past_events:    true,
      today_color:         '#60a5fa',
      show_legend:         false,
      google_maps_api_key: '',
      mobile_expand:       true,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (Date.now() - this._lastFetch > this._config.refresh_interval * 60000) {
      this._fetchEvents();
    }
  }

  connectedCallback() {
    const ms = (this._config.refresh_interval || 5) * 60000;
    this._tick = setInterval(() => this._fetchEvents(), ms);
  }

  disconnectedCallback() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  }

  getCardSize() { return parseInt(this._config.grid_rows) || 8; }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async _fetchEvents() {
    if (!this._hass || this._loading) return;
    this._loading   = true;
    this._lastFetch = Date.now();

    const now  = new Date();
    const end  = new Date(now.getTime() + this._config.days_ahead * 86400000);
    const cals = this._normCals();

    try {
      const results = await Promise.all(
        cals.map(cal =>
          this._hass.callApi('GET',
            `calendars/${cal.entity}?start=${now.toISOString()}&end=${end.toISOString()}`)
            .then(evs => evs.map(ev => ({
              ...ev,
              _calColor: cal.color,
              _calName:  cal.name,
            })))
            .catch(() => [])
        )
      );

      const all = results.flat();
      all.sort((a, b) => {
        const aT = a.start?.dateTime || a.start?.date || '';
        const bT = b.start?.dateTime || b.start?.date || '';
        return aT.localeCompare(bT);
      });
      this._events = all.slice(0, this._config.max_events);
    } catch (e) {
      console.warn('calendar-card: fetch error', e);
    }

    this._loading = false;
    this._render();
  }

  // ── Date / time helpers ───────────────────────────────────────────────────

  _parseDate(str, isAllDay) {
    if (isAllDay) {
      const [y, mo, d] = str.split('-').map(Number);
      return new Date(y, mo - 1, d);
    }
    return new Date(str);
  }

  _dateKey(str, isAllDay) {
    const d = this._parseDate(str, isAllDay);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  _isToday(str, isAllDay) {
    const t = new Date();
    const d = this._parseDate(str, isAllDay);
    return d.getDate()     === t.getDate()  &&
           d.getMonth()    === t.getMonth() &&
           d.getFullYear() === t.getFullYear();
  }

  _isPast(startStr) {
    return new Date(startStr) < new Date();
  }

  _countdown(str, isAllDay) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d     = this._parseDate(str, isAllDay); d.setHours(0, 0, 0, 0);
    const diff  = Math.round((d - today) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tmrw';
    return `+${diff}d`;
  }

  _formatTime(str) {
    return new Date(str).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).replace(' ', '').toLowerCase();
  }

  _duration(startStr, endStr, isAllDay) {
    if (!endStr) return '';
    if (isAllDay) {
      const days = Math.round(
        (this._parseDate(endStr, true) - this._parseDate(startStr, true)) / 86400000
      );
      return days > 1 ? `(${days} days)` : '';
    }
    const mins = Math.round((new Date(endStr) - new Date(startStr)) / 60000);
    if (mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0)  return `(${m}m)`;
    if (m === 0)  return `(${h}hr)`;
    return `(${h}hr ${m}m)`;
  }

  // ── Group + annotate events ───────────────────────────────────────────────

  _buildGroups() {
    const MONTHS   = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const grouped  = [];
    const keyIndex = {};

    this._events.forEach(ev => {
      const isAllDay = !ev.start?.dateTime;
      const startStr = ev.start?.dateTime || ev.start?.date || '';
      const endStr   = ev.end?.dateTime   || ev.end?.date   || '';
      const key      = this._dateKey(startStr, isAllDay);
      const d        = this._parseDate(startStr, isAllDay);
      const isPast   = !isAllDay && this._isPast(startStr);

      if (keyIndex[key] === undefined) {
        keyIndex[key] = grouped.length;
        grouped.push({
          abbr:    d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
          num:     d.getDate(),
          mon:     MONTHS[d.getMonth()],
          isToday: this._isToday(startStr, isAllDay),
          cd:      this._countdown(startStr, isAllDay),
          events:  [],
        });
      }

      grouped[keyIndex[key]].events.push({
        title:       ev.summary || ev.title || 'Untitled',
        timeDisplay: isAllDay ? 'ALL DAY' : this._formatTime(startStr),
        duration:    this._duration(startStr, endStr, isAllDay),
        timeRange:   isAllDay
          ? 'All day'
          : (endStr
              ? `${this._formatTime(startStr)} – ${this._formatTime(endStr)}`
              : this._formatTime(startStr)),
        startStr,
        endStr,
        isAllDay,
        isPast,
        color:       ev._calColor   || null,
        calName:     ev._calName    || null,
        location:    ev.location    || '',
        description: ev.description || '',
        isNextUp:    false,
        isPulse:     false,
      });
    });

    // Pulsing dot — every upcoming timed event today
    grouped.forEach(g => {
      if (!g.isToday) return;
      g.events.forEach(ev => {
        if (!ev.isAllDay && !ev.isPast) ev.isPulse = true;
      });
    });

    // Bold — single globally-next event
    let found = false;
    for (const g of grouped) {
      for (const ev of g.events) {
        if (found) break;
        if (!ev.isAllDay && ev.isPast) continue;
        ev.isNextUp = true;
        found = true;
      }
      if (found) break;
    }

    return grouped;
  }

  // ── Popup ─────────────────────────────────────────────────────────────────

  _openPopup(ev, dayInfo) {
    const root   = this.shadowRoot;
    const overlay = root.getElementById('cc-overlay');
    const box     = root.getElementById('cc-popup');
    const apiKey  = this._config.google_maps_api_key || '';

    // Map section — three states:
    // 1. No location → hidden entirely
    // 2. Location + API key → static map image
    // 3. Location but no API key → tasteful placeholder
    let mapHtml = '';
    if (ev.location) {
      if (apiKey) {
        const q   = encodeURIComponent(ev.location);
        const hex = (ev.color || '#60a5fa').replace('#', '');
        const src = `https://maps.googleapis.com/maps/api/staticmap`
          + `?center=${q}&zoom=15&size=360x140&scale=2`
          + `&markers=color:0x${hex}|${q}`
          + `&style=feature:all|element:geometry|color:0x1a1a2e`
          + `&style=feature:road|element:geometry|color:0x2d2d44`
          + `&key=${apiKey}`;
        mapHtml = `
          <div style="margin-top:14px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
            <img src="${src}" style="width:100%;display:block" alt="Map of ${ev.location}" loading="lazy"/>
          </div>`;
      } else {
        mapHtml = `
          <div style="margin-top:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);padding:12px 14px;display:flex;align-items:center;gap:10px">
            <div style="width:14px;height:14px;flex-shrink:0;opacity:0.3;color:var(--secondary-text-color)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <span style="font-size:11px;color:var(--secondary-text-color);opacity:0.45;font-style:italic">
              Add google_maps_api_key to your config to enable map previews
            </span>
          </div>`;
      }
    }

    const locIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const calIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const noteIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>`;

    box.innerHTML = `
      <div id="cc-handle"></div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:16px">
        <div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0">
          ${ev.color ? `<div style="width:10px;height:10px;border-radius:50%;background:${ev.color};flex-shrink:0;margin-top:4px"></div>` : ''}
          <div style="min-width:0">
            <div style="font-size:17px;font-weight:700;color:var(--primary-text-color);line-height:1.25;word-break:break-word">${ev.title}</div>
            ${ev.calName ? `<div style="font-size:11px;font-weight:700;color:${ev.color || 'var(--secondary-text-color)'};opacity:0.85;text-transform:uppercase;letter-spacing:0.06em;margin-top:3px">${ev.calName}</div>` : ''}
          </div>
        </div>
        <button id="cc-close" style="background:rgba(255,255,255,0.08);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--secondary-text-color);font-size:14px;line-height:1;font-family:inherit">✕</button>
      </div>

      <div style="height:1px;background:var(--divider-color,rgba(255,255,255,0.08));margin-bottom:14px"></div>

      <div style="display:flex;flex-direction:column;gap:12px">

        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:1px;color:var(--secondary-text-color);opacity:0.5">${calIcon}</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--primary-text-color)">${dayInfo.abbr} ${dayInfo.mon} ${dayInfo.num}</div>
            <div style="font-size:12px;color:var(--secondary-text-color);margin-top:2px">${ev.timeRange}</div>
          </div>
        </div>

        ${ev.location ? `
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:1px;color:var(--secondary-text-color);opacity:0.5">${locIcon}</div>
          <div style="font-size:13px;font-weight:500;color:var(--primary-text-color);opacity:0.8;line-height:1.4">${ev.location}</div>
        </div>
        ${mapHtml}` : ''}

        ${ev.description ? `
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:16px;height:16px;flex-shrink:0;margin-top:2px;color:var(--secondary-text-color);opacity:0.5">${noteIcon}</div>
          <div style="font-size:13px;font-weight:500;color:var(--secondary-text-color);line-height:1.55">${ev.description}</div>
        </div>` : ''}

      </div>`;

    root.getElementById('cc-close').addEventListener('click', () => this._closePopup());
    overlay.style.display = 'flex';
  }

  _closePopup() {
    const ol = this.shadowRoot.getElementById('cc-overlay');
    if (ol) ol.style.display = 'none';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _render() {
    if (!this._config) return;

    const todayColor   = this._config.today_color   || '#60a5fa';
    const showPast     = this._config.show_past_events !== false;
    const showLegend   = this._config.show_legend === true;
    const mobileExpand = this._config.mobile_expand !== false;
    const hasColors    = this._normCals().some(c => c.color);
    const grouped      = this._buildGroups();

    // ── Legend ────────────────────────────────────────────────────────────
    const legendHtml = (showLegend && hasColors)
      ? `<div class="legend">
           ${this._normCals().filter(c => c.color).map(c => `
             <div class="leg-item">
               <div class="leg-dot" style="background:${c.color}"></div>
               <span>${c.name || c.entity.split('.')[1]}</span>
             </div>`).join('')}
         </div>`
      : '';

    // ── Groups ────────────────────────────────────────────────────────────
    const groupsHtml = grouped.length === 0
      ? `<div class="empty">${this._loading ? 'Loading…' : 'No upcoming events'}</div>`
      : grouped.map((g, gi) => {

          const evRows = g.events.map((ev, ei) => {
            const dim   = showPast && ev.isPast && g.isToday;
            const alpha = dim ? '0.38' : '1';

            const dot = hasColors
              ? `<span class="dot${ev.isPulse ? ' dot--pulse' : ''}"
                       style="background:${ev.color || 'rgba(255,255,255,0.2)'}"></span>`
              : '';

            const timeStr = ev.isAllDay
              ? `<span class="ev-time">ALL DAY</span>`
              : `<span class="ev-time">${ev.timeDisplay}</span>${ev.duration
                  ? ` <span class="ev-dur">${ev.duration}</span>` : ''}`;

            const cdEl = ei === 0
              ? `<div class="ev-cd${g.cd === 'today' ? ' cd-today' : g.cd === 'tmrw' ? ' cd-tmrw' : ''}"
                      style="${g.cd !== 'today' && g.cd !== 'tmrw' ? 'color:rgba(255,255,255,0.35)' : ''}"
                  >${g.cd}</div>`
              : `<div class="ev-cd-blank"></div>`;

            return `
              <div class="ev-item${ei > 0 ? ' ev-item--next' : ''}${ev.isNextUp ? ' ev-item--nextup' : ''}"
                   data-gi="${gi}" data-ei="${ei}"
                   style="opacity:${alpha}">
                ${dot}
                <div class="ev-left">
                  <div class="ev-title">${ev.title}</div>
                  <div class="ev-sub">${timeStr}</div>
                </div>
                ${cdEl}
              </div>`;
          }).join('');

          // Today's date col: absolutely-positioned pulsing bar instead of static border
          const dateColInner = g.isToday
            ? `<div class="date-bar date-bar--pulse" style="background:${todayColor}"></div>`
            : `<div class="date-bar"></div>`;

          const countBadge = g.events.length > 1
            ? `<span class="day-count"
                     style="${g.isToday
                       ? `color:${todayColor};background:${todayColor}22;border-color:${todayColor}44`
                       : 'color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12)'}">
                 ×${g.events.length}
               </span>`
            : '';

          return `
            <div class="day-group"
                 style="${gi > 0 ? 'border-top:1px solid var(--divider-color,rgba(255,255,255,0.07))' : ''}">
              <div class="group-row">
                <div class="date-col">
                  ${dateColInner}
                  <span class="day-abbr" style="${g.isToday ? `color:${todayColor}` : ''}">${g.abbr}</span>
                  <span class="day-num"  style="${g.isToday ? `color:${todayColor}` : ''}">${g.num}</span>
                  <span class="day-mon">${g.mon}</span>
                  ${countBadge}
                </div>
                <div class="events-col">${evRows}</div>
              </div>
            </div>`;
        }).join('');

    // ── Shadow DOM ────────────────────────────────────────────────────────
    this.shadowRoot.innerHTML = `
      <style>
        /* Desktop/wall: fill the grid row height exactly */
        :host { display: block; height: 100%; }
        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0;
          box-sizing: border-box;
          font-family: var(--primary-font-family, sans-serif);
          position: relative;
          height: 100%;
        }
        .scroll-wrap {
          height: 100%;
          overflow-y: auto;
          padding: 12px 20px 16px;
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .scroll-wrap::-webkit-scrollbar { width: 4px; }
        .scroll-wrap::-webkit-scrollbar-track { background: transparent; }
        .scroll-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        ${mobileExpand ? `
        /* Mobile: grow with content — no fixed height */
        @media (max-width: 767px) {
          :host   { height: auto; }
          ha-card { height: auto; }
          .scroll-wrap {
            height: auto;
            overflow-y: visible;
          }
          .fade-hint { display: none; }
        }` : ''}

        /* ── Fade hint ── */
        .fade-hint {
          height: 28px;
          margin-top: -28px;
          background: linear-gradient(to bottom, transparent, var(--card-background-color, rgba(0,0,0,0.9)));
          pointer-events: none;
          position: relative;
          z-index: 1;
          border-radius: 0 0 var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px);
        }

        /* ── Group row ── */
        .group-row {
          display: grid;
          grid-template-columns: 62px 1fr;
          align-items: start;
          gap: 14px;
          padding: 10px 0;
        }

        /* ── Date column ── */
        .date-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-right: 12px;
          padding-top: 2px;
          position: relative;
          height: 100%;
        }

        /* Vertical bar — replaces border-right so we can animate just the bar */
        .date-bar {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--divider-color, rgba(255,255,255,0.1));
          border-radius: 1px;
        }
        .date-bar--pulse {
          animation: bar-pulse 2s ease-in-out infinite;
        }
        @keyframes bar-pulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }

        .day-abbr {
          font-size: 11px;
          font-weight: 700;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1;
        }
        .day-num {
          font-size: 30px;
          font-weight: 700;
          color: var(--primary-text-color);
          line-height: 1;
          letter-spacing: -0.5px;
          margin: 1px 0;
        }
        .day-mon {
          font-size: 10px;
          font-weight: 700;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.5;
          line-height: 1;
        }
        .day-count {
          font-size: 12px;
          font-weight: 800;
          border-radius: 5px;
          border: 1px solid;
          padding: 2px 7px;
          margin-top: 5px;
          letter-spacing: 0.02em;
          line-height: 1.3;
        }

        /* ── Events column ── */
        .events-col { display: flex; flex-direction: column; }

        .ev-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 3px 4px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .ev-item:active { background: rgba(255,255,255,0.06); }
        .ev-item--next {
          border-top: 1px solid var(--divider-color, rgba(255,255,255,0.05));
          padding-top: 7px;
          margin-top: 4px;
        }
        .ev-item--nextup .ev-title {
          font-weight: 700 !important;
          color: var(--primary-text-color) !important;
        }

        /* ── Dot ── */
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          align-self: flex-start;
          margin-top: 5px;
        }
        .dot--pulse {
          animation: dot-pulse 1.8s ease-in-out infinite;
        }
        @keyframes dot-pulse {
          0%,100% { opacity: 1;   transform: scale(1);   }
          50%      { opacity: 0.4; transform: scale(1.6); }
        }

        /* ── Event text ── */
        .ev-left { min-width: 0; flex: 1; }
        .ev-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--primary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .ev-sub {
          font-size: 12px;
          font-weight: 500;
          color: var(--secondary-text-color);
          margin-top: 3px;
          line-height: 1;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .ev-time { text-transform: uppercase; letter-spacing: 0.05em; }
        .ev-dur  { font-size: 11px; opacity: 0.55; }

        /* ── Countdown ── */
        .ev-cd {
          font-size: 13px;
          font-weight: 700;
          text-align: right;
          white-space: nowrap;
          min-width: 40px;
          align-self: flex-start;
          padding-top: 2px;
        }
        .ev-cd.cd-today { color: ${todayColor}; }
        .ev-cd.cd-tmrw  { color: #a3e635; }
        .ev-cd-blank    { min-width: 40px; }

        /* ── Empty ── */
        .empty {
          font-size: 13px;
          color: var(--secondary-text-color);
          font-style: italic;
          padding: 8px 0;
          opacity: 0.6;
        }

        /* ── Legend ── */
        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 10px 20px 12px;
          border-top: 1px solid var(--divider-color, rgba(255,255,255,0.07));
        }
        .leg-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--secondary-text-color);
        }
        .leg-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* ── Popup overlay ── */
        #cc-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 9999;
          box-sizing: border-box;
          /* Mobile default: bottom sheet */
          align-items: flex-end;
          justify-content: center;
          padding: 0;
        }

        /* Mobile: bottom sheet */
        #cc-popup {
          background: var(--card-background-color, #1e1e1e);
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          padding: 20px;
          box-sizing: border-box;
          overflow-y: auto;
          max-height: 80vh;
          /* Mobile shape */
          width: 100%;
          max-width: 100%;
          border-radius: 16px 16px 0 0;
          border-bottom: none;
        }

        /* Mobile: drag handle pill */
        #cc-handle {
          width: 36px;
          height: 4px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
          margin: 0 auto 16px;
        }

        /* Desktop/wall: centered modal ≥ 768px */
        @media (min-width: 768px) {
          #cc-overlay {
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          #cc-popup {
            width: 100%;
            max-width: 420px;
            border-radius: 16px;
            border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          }
          #cc-handle { display: none; }
        }
      </style>

      <ha-card>
        <div class="scroll-wrap">${groupsHtml}</div>
        <div class="fade-hint"></div>
        ${legendHtml}
        <div id="cc-overlay">
          <div id="cc-popup"></div>
        </div>
      </ha-card>`;

    // ── Tap listeners ────────────────────────────────────────────────────────
    this.shadowRoot.querySelectorAll('.ev-item').forEach(el => {
      el.addEventListener('click', () => {
        const gi = parseInt(el.dataset.gi);
        const ei = parseInt(el.dataset.ei);
        const g  = grouped[gi];
        if (g?.events[ei]) this._openPopup(g.events[ei], g);
      });
    });

    this.shadowRoot.getElementById('cc-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'cc-overlay') this._closePopup();
    });
  }
}

customElements.define('calendar-card', CalendarCard);