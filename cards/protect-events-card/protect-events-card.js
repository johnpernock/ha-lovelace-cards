/**
 * protect-events-card.js  —  v1
 * Real-time UniFi Protect smart detection event feed for Home Assistant Lovelace.
 *
 * Displays a live-updating list of detection events (person, vehicle, animal,
 * package) from UniFi Protect cameras. Tapping a row opens a detail popup with
 * the event thumbnail and clip/live-view actions.
 *
 * ── SHARED MODULES ────────────────────────────────────────────────────────────
 *   ha-utils.js   — COLORS, colorTheme, fmtRelative, isUnavailable, getFriendlyName
 *   ha-styles.js  — CSS_RESET, CSS_TAPPABLE, CSS_BADGE, CSS_UNAVAIL
 *   ha-popup.js   — createPopupPortal, openPopup, closePopup, destroyPopupPortal,
 *                   popupHeaderHtml
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy cards/protect-events-card/ and shared/ to /config/www/
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/protect-events-card/protect-events-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:protect-events-card
 * cameras:
 *   - camera.front_door
 *   - camera.driveway
 *   - camera.backyard
 * max_events: 8             # rows shown, default 8
 * show_motion: false        # include plain motion (no smart detection), default false
 * confidence_threshold: 0   # hide events below this %, default 0 (show all)
 * cameras_view: /cameras    # path to navigate on "All →" tap, optional
 *
 * ── ENTITY NAMING CONVENTION ─────────────────────────────────────────────────
 * For a camera entity  camera.front_door  the card looks for:
 *   binary_sensor.front_door_person_detected
 *   binary_sensor.front_door_vehicle_detected
 *   binary_sensor.front_door_animal_detected
 *   binary_sensor.front_door_package_detected
 *   binary_sensor.front_door_motion_detected   (if show_motion: true)
 *
 * The event_id attribute on those sensors is used to fetch HA thumbnails.
 */

import { COLORS, colorTheme, fmtRelative, isUnavailable, getFriendlyName }
  from '../../shared/ha-utils.js?v=2';
import { CSS_RESET, CSS_TAPPABLE, CSS_BADGE, CSS_UNAVAIL }
  from '../../shared/ha-styles.js?v=2';
import { createPopupPortal, openPopup, closePopup, destroyPopupPortal, popupHeaderHtml }
  from '../../shared/ha-popup.js?v=2';

// ─────────────────────────────────────────────────────────────────────────────
// Detection type metadata
// Maps detection type → color token, label
// ─────────────────────────────────────────────────────────────────────────────
const DETECT_TYPES = ['person', 'vehicle', 'animal', 'package'];

const TYPE_META = {
  person:  { colorName: 'amber',  label: 'Person'  },
  vehicle: { colorName: 'blue',   label: 'Vehicle' },
  animal:  { colorName: 'teal',   label: 'Animal'  },
  package: { colorName: 'purple', label: 'Package' },
  motion:  { colorName: null,     label: 'Motion'  },
};

function typeMeta(type) {
  const meta = TYPE_META[type] || TYPE_META.motion;
  if (meta.colorName) {
    const t = colorTheme(meta.colorName, 0.10, 0.30);
    return { ...meta, color: t.text, bg: t.bg, border: t.border };
  }
  return {
    ...meta,
    color:  'rgba(255,255,255,0.4)',
    bg:     'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.12)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — normalise a cameras: entry to { entity, sensorBase }
//
// Each entry in config.cameras may be either:
//   - a plain string:  "camera.driveway"
//   - an object:       { entity: "camera.g6_entry_high_resolution_channel",
//                        sensor_base: "g6_entry" }
//
// sensor_base is only needed when the stream entity ID does not match the
// device-level sensor prefix (e.g. the G6 Entry whose stream entities have
// _high_resolution_channel / _package_camera suffixes but whose detection
// sensors are binary_sensor.g6_entry_*).
// ─────────────────────────────────────────────────────────────────────────────
function normaliseCam(entry) {
  if (typeof entry === 'string') {
    return { entity: entry, sensorBase: entry.replace(/^camera\./, '') };
  }
  return {
    entity:     entry.entity,
    sensorBase: (entry.sensor_base ?? entry.entity.replace(/^camera\./, '')),
  };
}

function sensorId(sensorBase, type) {
  return `binary_sensor.${sensorBase}_${type}_detected`;
}

function motionSensorId(sensorBase) {
  return `binary_sensor.${sensorBase}_motion_detected`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail URL from HA UniFi Protect integration
// ─────────────────────────────────────────────────────────────────────────────
function thumbnailUrl(eventId) {
  if (!eventId) return null;
  return `/api/unifiprotect/thumbnail/${eventId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera placeholder SVG — shown while thumbnail loads
// ─────────────────────────────────────────────────────────────────────────────
const CAMERA_SVG = `<svg width="28" height="18" viewBox="0 0 80 50" fill="none" style="opacity:.22">
  <rect x="24" y="6" width="32" height="26" rx="5" fill="white"/>
  <ellipse cx="40" cy="46" rx="22" ry="10" fill="white"/>
</svg>`;

const CAMERA_SVG_LG = `<svg width="56" height="36" viewBox="0 0 80 50" fill="none" style="opacity:.18">
  <rect x="24" y="6" width="32" height="26" rx="5" fill="white"/>
  <ellipse cx="40" cy="46" rx="22" ry="10" fill="white"/>
</svg>`;

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────
class ProtectEventsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config     = {};
    this._hass       = null;
    this._portal     = null;
    this._unsub      = null;       // unsubscribe fn for state_changed
    this._events     = [];         // ring buffer — newest first
    this._filter     = 'all';      // current pill filter
    this._todayCount = 0;
    this._rendered   = false;
  }

  static getStubConfig() {
    return {
      cameras: ['camera.front_door', 'camera.driveway'],
      max_events: 8,
      show_motion: false,
      confidence_threshold: 0,
    };
  }

  setConfig(config) {
    if (!config.cameras?.length) {
      throw new Error('protect-events-card: define at least one camera entity under cameras:');
    }
    this._config = {
      max_events:           8,
      show_motion:          false,
      confidence_threshold: 0,
      cameras_view:         null,
      ...config,
    };
    this._rendered = false;
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;

    if (!this._rendered) {
      this._render();
      return;
    }

    // First hass update — subscribe to live state_changed events
    if (!prev && hass) {
      this._subscribe();
    }

    this._patch();
  }

  getCardSize() { return 4; }

  disconnectedCallback() {
    this._unsub?.();
    this._unsub = null;
    destroyPopupPortal(this._portal);
    this._portal = null;
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  _subscribe() {
    if (this._unsub || !this._hass?.connection) return;

    this._hass.connection.subscribeEvents(
      (event) => this._onStateChanged(event),
      'state_changed',
    ).then(unsub => {
      this._unsub = unsub;
    }).catch(err => {
      console.warn('protect-events-card: failed to subscribe to state_changed', err);
    });
  }

  _onStateChanged(event) {
    const entityId = event.data?.entity_id || '';
    const newState = event.data?.new_state;
    const oldState = event.data?.old_state;

    if (!newState) return;

    // Only handle sensors that belong to our configured cameras
    const camera = this._cameraForSensor(entityId);
    if (!camera) return;

    // Only fire on off → on transitions
    if (oldState?.state !== 'off' || newState.state !== 'on') return;

    // Determine detection type
    let type = null;
    for (const t of DETECT_TYPES) {
      if (entityId === sensorId(camera.sensorBase, t)) { type = t; break; }
    }
    if (!type && this._config.show_motion && entityId === motionSensorId(camera.sensorBase)) {
      type = 'motion';
    }
    if (!type) return;

    // Confidence from attributes
    const conf = newState.attributes?.confidence ?? newState.attributes?.score ?? null;
    const confPct = conf != null ? Math.round(conf * (conf <= 1 ? 100 : 1)) : null;

    if (confPct !== null && confPct < this._config.confidence_threshold) return;

    // event_id for thumbnail
    const eventId = newState.attributes?.event_id ?? null;

    const entry = {
      id:          crypto.randomUUID(),
      camera:      camera.entity,
      cameraName:  getFriendlyName(this._hass, camera.entity),
      type,
      conf:        confPct,
      eventId,
      thumbUrl:    null,
      startedAt:   Date.now(),
      isNew:       true,
    };

    this._events.unshift(entry);
    this._events = this._events.slice(0, Math.max(this._config.max_events, 50));
    this._todayCount++;

    this._patchList();

    // Async thumbnail fetch
    if (eventId) {
      setTimeout(() => this._fetchThumb(entry), 1500);
    }

    // Clear new-event flash after animation
    setTimeout(() => { entry.isNew = false; }, 700);
  }

  _cameraForSensor(entityId) {
    for (const raw of this._config.cameras) {
      const cam = normaliseCam(raw);
      if (entityId.startsWith(`binary_sensor.${cam.sensorBase}_`)) return cam;
    }
    return null;
  }

  async _fetchThumb(entry) {
    if (!entry.eventId) return;
    try {
      const url = thumbnailUrl(entry.eventId);
      // Verify image is accessible — HA will 404 if not ready yet
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return;
      entry.thumbUrl = url;
      // Re-render thumb in list if visible
      this._updateThumbInList(entry);
    } catch (_) {
      // Silently ignore — thumbnail just stays as placeholder
    }
  }

  _updateThumbInList(entry) {
    const el = this.shadowRoot.querySelector(`[data-event-id="${entry.id}"] .pe-thumb-img`);
    if (!el) return;
    el.innerHTML = this._thumbHtml(entry, 60, 38);
  }

  // ── Render (first time only) ─────────────────────────────────────────────

  _render() {
    this._rendered = true;

    // Create popup portal — content set dynamically on open
    if (this._portal) destroyPopupPortal(this._portal);
    this._portal = createPopupPortal(
      'protect-events-popup',
      '',
      () => {},
      {
        maxWidth: '440px',
        extraCss: this._portalCss(),
      },
    );

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap">
          <div class="card-hdr">
            Protect events
            <div class="live-ind">
              <div class="live-dot"></div>
              <div class="live-lbl">Live</div>
            </div>
          </div>
          <div class="filter-row" id="pe-filters">
            ${this._filterPillsHtml()}
          </div>
          <div class="event-list" id="pe-list"></div>
          <div class="card-footer">
            <div class="footer-stats">
              <div class="footer-stat">Today <em id="pe-today">0</em></div>
              <div class="footer-stat">Active <em id="pe-active">—</em></div>
            </div>
            <div class="footer-link ha-tappable" id="pe-all-link">All →</div>
          </div>
        </div>
      </ha-card>`;

    this._attachListeners();
    this._patchList();
    this._subscribe();
  }

  _filterPillsHtml() {
    const all = ['all', ...DETECT_TYPES, ...(this._config.show_motion ? ['motion'] : [])];
    return all.map(f => {
      const active = this._filter === f;
      const label  = f === 'all' ? 'All' : TYPE_META[f]?.label ?? f;
      return `<div class="pe-pill ha-tappable${active ? ' active-' + f : ''}" data-filter="${f}">${label}</div>`;
    }).join('');
  }

  _attachListeners() {
    // Filter pills
    this.shadowRoot.getElementById('pe-filters')?.addEventListener('click', e => {
      const pill = e.target.closest('.pe-pill');
      if (!pill) return;
      this._filter = pill.dataset.filter;
      // Update active classes
      this.shadowRoot.querySelectorAll('.pe-pill').forEach(p => {
        p.className = `pe-pill ha-tappable${p.dataset.filter === this._filter ? ' active-' + this._filter : ''}`;
      });
      this._patchList();
    });

    // All → link
    this.shadowRoot.getElementById('pe-all-link')?.addEventListener('click', () => {
      if (this._config.cameras_view) {
        history.pushState(null, '', this._config.cameras_view);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  }

  // ── Patch (hass updates) ────────────────────────────────────────────────

  _patch() {
    // Count currently-active motion sensors
    let active = 0;
    for (const raw of this._config.cameras) {
      const cam = normaliseCam(raw);
      const motId = motionSensorId(cam.sensorBase);
      if (this._hass?.states[motId]?.state === 'on') active++;
    }
    const activeEl = this.shadowRoot.getElementById('pe-active');
    if (activeEl) activeEl.textContent = active || '—';
  }

  // ── List rendering ──────────────────────────────────────────────────────

  _patchList() {
    const list = this.shadowRoot.getElementById('pe-list');
    if (!list) return;

    const shown = this._visibleEvents();
    const max   = this._config.max_events;

    if (!shown.length) {
      list.innerHTML = `<div class="pe-empty">No ${this._filter === 'all' ? '' : this._filter + ' '}events yet</div>`;
    } else {
      list.innerHTML = shown.slice(0, max).map(ev => this._rowHtml(ev)).join('');
      // Attach row tap listeners
      list.querySelectorAll('.pe-row').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.eventId;
          const ev = this._events.find(e => e.id === id);
          if (ev) this._openPopup(ev);
        });
      });
    }

    const todayEl = this.shadowRoot.getElementById('pe-today');
    if (todayEl) todayEl.textContent = this._todayCount;
  }

  _visibleEvents() {
    if (this._filter === 'all') return this._events;
    return this._events.filter(e => e.type === this._filter);
  }

  _rowHtml(ev) {
    const m   = typeMeta(ev.type);
    const rel = fmtRelative(new Date(ev.startedAt).toISOString()) ?? 'just now';

    return `
      <div class="pe-row ha-tappable${ev.isNew ? ' pe-new' : ''}" data-event-id="${ev.id}">
        <div class="pe-accent" style="background:${m.color}"></div>
        <div class="pe-thumb" style="background:${m.bg};border:1px solid ${m.border}">
          <div class="pe-thumb-img">${this._thumbHtml(ev, 60, 38)}</div>
          <div class="pe-thumb-badge ha-badge" style="background:${m.bg};border:1px solid ${m.border};color:${m.color}">
            ${m.label[0]}
          </div>
        </div>
        <div class="pe-info">
          <div class="pe-camera">${ev.cameraName}</div>
          <div class="pe-meta">
            <span class="ha-badge" style="background:${m.bg};border:1px solid ${m.border};color:${m.color}">${m.label}</span>
            <span class="pe-time">${rel}</span>
          </div>
        </div>
        <div class="pe-right">
          ${ev.conf != null ? `<div class="pe-conf">${ev.conf}%</div>` : ''}
          <div class="pe-chevron">›</div>
        </div>
      </div>`;
  }

  _thumbHtml(ev, w, h) {
    if (ev.thumbUrl) {
      return `<img src="${ev.thumbUrl}" width="${w}" height="${h}"
                   style="object-fit:cover;border-radius:5px;display:block" loading="lazy">`;
    }
    return CAMERA_SVG;
  }

  // ── Popup ────────────────────────────────────────────────────────────────

  _openPopup(ev) {
    const m   = typeMeta(ev.type);
    const rel = fmtRelative(new Date(ev.startedAt).toISOString()) ?? 'just now';

    const thumbHtml = ev.thumbUrl
      ? `<img src="${ev.thumbUrl}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;margin-bottom:14px">`
      : `<div class="pe-popup-thumb-ph">
           ${CAMERA_SVG_LG}
           <div class="pe-popup-thumb-label">${ev.conf != null ? `${ev.conf}% confidence · ` : ''}${rel}</div>
         </div>`;

    const content = `
      ${popupHeaderHtml(ev.cameraName, m.label, m.color)}
      ${thumbHtml}
      <div class="pe-popup-meta">
        <div class="pe-meta-box">
          <div class="pe-meta-label">Camera</div>
          <div class="pe-meta-value" style="font-size:12px">${ev.cameraName}</div>
        </div>
        <div class="pe-meta-box">
          <div class="pe-meta-label">Type</div>
          <div class="pe-meta-value" style="color:${m.color}">${m.label}</div>
        </div>
        <div class="pe-meta-box">
          <div class="pe-meta-label">Confidence</div>
          <div class="pe-meta-value">${ev.conf != null ? ev.conf + '%' : '—'}</div>
        </div>
      </div>
      <div class="pe-popup-actions">
        <button class="pe-popup-btn ha-tappable" id="pe-btn-clip">Open clip</button>
        <button class="pe-popup-btn primary ha-tappable" id="pe-btn-live">Live view →</button>
      </div>`;

    this._portal.setContent(content);
    openPopup(this._portal);

    // Wire popup action buttons after content is set
    setTimeout(() => {
      this._portal.content.querySelector('#pe-btn-clip')?.addEventListener('click', () => {
        // Navigate to HA media browser for this camera's events
        const event = new CustomEvent('hass-more-info', {
          composed: true, bubbles: true,
          detail: { entityId: ev.camera },
        });
        this.dispatchEvent(event);
        closePopup(this._portal);
      });

      this._portal.content.querySelector('#pe-btn-live')?.addEventListener('click', () => {
        const event = new CustomEvent('hass-more-info', {
          composed: true, bubbles: true,
          detail: { entityId: ev.camera },
        });
        this.dispatchEvent(event);
        closePopup(this._portal);
      });
    }, 0);
  }

  // ── CSS ─────────────────────────────────────────────────────────────────

  _css() {
    return `
      ${CSS_RESET}
      ${CSS_TAPPABLE}
      ${CSS_BADGE}
      ${CSS_UNAVAIL}

      ha-card { padding: 0; }

      /* ── Outer wrap ── */
      .wrap {
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.10);
        overflow: hidden;
      }

      /* ── Card header ── */
      .card-hdr {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: rgba(255,255,255,.3);
        padding: 9px 14px 6px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .live-ind { display: flex; align-items: center; gap: 5px; }
      .live-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: ${COLORS.green};
        animation: pe-blink 2s ease-in-out infinite;
      }
      @keyframes pe-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      .live-lbl {
        font-size: 9px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .06em;
        color: ${COLORS.green};
      }

      /* ── Filter pills ── */
      .filter-row {
        display: flex; gap: 6px;
        padding: 8px 14px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        flex-wrap: wrap;
      }
      .pe-pill {
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .05em;
        padding: 3px 8px; border-radius: 5px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.04);
        color: rgba(255,255,255,.4);
      }
      .pe-pill.active-all     { background:rgba(255,255,255,.12); border-color:rgba(255,255,255,.28); color:var(--primary-text-color,#e2e8f0); }
      .pe-pill.active-person  { background:rgba(${COLORS.rgb?.amber  ?? '251,191,36'},.12);  border-color:rgba(${COLORS.rgb?.amber  ?? '251,191,36'},.35);  color:${COLORS.amber};  }
      .pe-pill.active-vehicle { background:rgba(${COLORS.rgb?.blue   ?? '96,165,250'},.12);  border-color:rgba(${COLORS.rgb?.blue   ?? '96,165,250'},.35);  color:${COLORS.blue};   }
      .pe-pill.active-animal  { background:rgba(${COLORS.rgb?.teal   ?? '45,212,191'},.12);  border-color:rgba(${COLORS.rgb?.teal   ?? '45,212,191'},.35);  color:${COLORS.teal};   }
      .pe-pill.active-package { background:rgba(${COLORS.rgb?.purple ?? '167,139,250'},.12); border-color:rgba(${COLORS.rgb?.purple ?? '167,139,250'},.35); color:${COLORS.purple}; }
      .pe-pill.active-motion  { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.22); color:rgba(255,255,255,.6); }

      /* ── Event list ── */
      .event-list { padding: 4px 0; }
      .pe-empty {
        font-size: 12px; font-style: italic;
        color: rgba(255,255,255,.3);
        text-align: center; padding: 16px 0;
      }

      /* ── Event row ── */
      .pe-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 14px;
        position: relative;
      }
      .pe-row + .pe-row { border-top: 1px solid rgba(255,255,255,.06); }

      @keyframes pe-flash { from { background:rgba(251,191,36,.10); } to { background:transparent; } }
      .pe-row.pe-new { animation: pe-flash .6s ease-out; }

      /* Accent bar — flat left, rounded right (per style guide) */
      .pe-accent {
        position: absolute; left: 0; top: 6px; bottom: 6px;
        width: 3px; border-radius: 0 8px 8px 0;
      }

      /* Thumbnail */
      .pe-thumb {
        width: 60px; height: 38px; border-radius: 7px;
        flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        position: relative; overflow: hidden;
      }
      .pe-thumb-img { display:flex; align-items:center; justify-content:center; width:100%; height:100%; }
      .pe-thumb-badge {
        position: absolute; bottom: 2px; right: 2px;
        font-size: 8px !important; padding: 1px 4px !important; border-radius: 3px !important;
        border: 1px solid;
      }

      /* Info */
      .pe-info { flex: 1; min-width: 0; }
      .pe-camera {
        font-size: 13px; font-weight: 700;
        color: var(--primary-text-color, #e2e8f0);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        line-height: 1.2;
      }
      .pe-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
      .pe-time { font-size: 11px; color: rgba(255,255,255,.4); white-space: nowrap; }

      /* Right side */
      .pe-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
      .pe-conf { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.35); }
      .pe-chevron { font-size: 16px; color: rgba(255,255,255,.25); line-height: 1; }

      /* ── Footer ── */
      .card-footer {
        display: flex; justify-content: space-between; align-items: center;
        padding: 7px 14px 9px;
        border-top: 1px solid rgba(255,255,255,.07);
        gap: 8px;
      }
      .footer-stats { display: flex; gap: 12px; min-width: 0; overflow: hidden; }
      .footer-stat {
        font-size: 9px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .06em; color: rgba(255,255,255,.3);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .footer-stat em { color: rgba(255,255,255,.6); font-style: normal; }
      .footer-link {
        font-size: 10px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .05em; color: ${COLORS.blue}; flex-shrink: 0;
      }
    `;
  }

  /** Extra CSS injected into the portal — popup-specific styles. */
  _portalCss() {
    return `
      /* Thumbnail placeholder */
      .pe-popup-thumb-ph {
        width: 100%; aspect-ratio: 16/9;
        background: rgba(0,0,0,.45);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 14px; position: relative;
      }
      .pe-popup-thumb-label {
        position: absolute; bottom: 8px; left: 8px;
        font-size: 9px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .05em;
        color: rgba(255,255,255,.4);
        background: rgba(0,0,0,.4); padding: 2px 6px; border-radius: 4px;
      }
      /* 3-col meta strip */
      .pe-popup-meta {
        display: grid; grid-template-columns: repeat(3,1fr);
        gap: 8px; margin-bottom: 14px;
      }
      .pe-meta-box {
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 8px; padding: 10px 12px; text-align: center;
      }
      .pe-meta-label {
        font-size: 9px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .08em; color: rgba(255,255,255,.35); margin-bottom: 4px;
      }
      .pe-meta-value {
        font-size: 14px; font-weight: 700;
        color: var(--primary-text-color, #e2e8f0); line-height: 1.2;
      }
      /* Action buttons */
      .pe-popup-actions { display: flex; gap: 8px; }
      .pe-popup-btn {
        flex: 1; padding: 10px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05);
        color: var(--primary-text-color, #e2e8f0);
        font-size: 12px; font-weight: 700; letter-spacing: .02em;
        cursor: pointer; text-align: center;
        -webkit-tap-highlight-color: transparent;
        transition: transform .1s, filter .12s;
        font-family: var(--primary-font-family, -apple-system, sans-serif);
      }
      .pe-popup-btn:active { transform: scale(.96); filter: brightness(.9); }
      .pe-popup-btn.primary {
        background: rgba(96,165,250,.15);
        border-color: rgba(96,165,250,.35);
        color: #60a5fa;
      }
    `;
  }
}

customElements.define('protect-events-card', ProtectEventsCard);
