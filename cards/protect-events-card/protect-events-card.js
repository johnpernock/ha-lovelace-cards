/**
 * protect-events-card.js  —  v5.1 (standalone — shared modules inlined)
 *
 * Shared modules (ha-utils, ha-styles, ha-popup) are inlined directly
 * so this file has no external import dependencies.
 */

// ── ha-utils.js (inlined) ────────────────────────────────────────────────────
/**
 * ha-utils.js
 * Shared utility functions and constants for all HA Lovelace cards.
 *
 * Usage in a card:
 *   import { COLORS, getState, getAttr, isOn, fmtTime,
 *            resolveFanSpeeds, HVAC_META, HVAC_ORDER } from '../../shared/ha-utils.js';
 *
 * HA resource path: /local/shared/ha-utils.js
 * (No need to register as a resource — imported directly by card modules)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Color palette
// Single source of truth for all semantic colors across the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  amber:  '#fbbf24',  // Lights on, active
  blue:   '#60a5fa',  // Fans, info, cool mode
  purple: '#a78bfa',  // Blinds, calibrating
  orange: '#fb923c',  // Heat mode, closing
  green:  '#4ade80',  // OK, closed, complete, on-time
  red:    '#f87171',  // Error, open, alert, delayed
  teal:   '#2dd4bf',  // Fan-only HVAC mode

  // RGB string equivalents for use in rgba()
  rgb: {
    amber:  '251,191,36',
    blue:   '96,165,250',
    purple: '167,139,250',
    orange: '251,146,60',
    green:  '74,222,128',
    red:    '248,113,113',
    teal:   '45,212,191',
  },
};

/** Build a themed background + border + text color set from a color name. */
function colorTheme(name, bgOpacity = 0.08, borderOpacity = 0.25) {
  const rgb = COLORS.rgb[name];
  const hex = COLORS[name];
  if (!rgb) return { bg: 'transparent', border: 'rgba(255,255,255,0.22)', text: '#fff' };
  return {
    bg:     `rgba(${rgb},${bgOpacity})`,
    border: `rgba(${rgb},${borderOpacity})`,
    text:   hex,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity state helpers
// All functions take hass as the first argument so they work as pure functions
// without needing access to `this`.
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the full entity state object, or null. */
function getState(hass, entityId) {
  if (!hass || !entityId) return null;
  return hass.states[entityId] || null;
}

/** Returns the entity's state string, or null. */
function getVal(hass, entityId) {
  return getState(hass, entityId)?.state ?? null;
}

/** Returns an attribute value from an entity, or null. */
function getAttr(hass, entityId, key) {
  return getState(hass, entityId)?.attributes?.[key] ?? null;
}

/** Returns the entity state parsed as a float, or null. */
function getNum(hass, entityId) {
  const v = parseFloat(getVal(hass, entityId));
  return isNaN(v) ? null : v;
}

/** Returns true if entity state is 'on' or 'true'. */
function isOn(hass, entityId) {
  const v = getVal(hass, entityId);
  return v === 'on' || v === 'true';
}

/** Returns true if entity state is 'unavailable' or entity doesn't exist. */
function isUnavailable(hass, entityId) {
  const e = getState(hass, entityId);
  return !e || e.state === 'unavailable' || e.state === 'unknown';
}

/** Returns the entity's friendly_name, falling back to entity ID. */
function getFriendlyName(hass, entityId) {
  return getAttr(hass, entityId, 'friendly_name')
    || entityId.split('.').pop().replace(/_/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a duration in hours to a human-readable string.
 * e.g. 1.5 → "1h 30m", 0.25 → "15m"
 */
function fmtTime(hours) {
  if (hours == null || isNaN(hours)) return null;
  const m = Math.round(hours * 60);
  if (m < 1) return '< 1m';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

/**
 * Format a relative time from a past Date/ISO string.
 * e.g. "just now", "4 min ago", "2 hrs ago"
 */
function fmtRelative(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = Math.round((Date.now() - d) / 60000);
  if (diff < 1)   return 'just now';
  if (diff === 1) return '1 min ago';
  if (diff < 60)  return `${diff} min ago`;
  const hrs = Math.round(diff / 60);
  return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
}

/**
 * Round a number and return as string, or '—' if null/NaN.
 */
function fmtNum(val) {
  if (val == null || isNaN(val)) return '—';
  return String(Math.round(val));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fan speed helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the number of speed steps for a fan entity.
 * Priority: YAML config → percentage_step attribute → speed_count attribute → default 4.
 * Always pass configSpeeds from YAML (fan.speeds) — Lutron Caseta fans need this.
 */
function resolveFanSpeeds(hass, entityId, configSpeeds = null) {
  if (configSpeeds != null) return configSpeeds;
  const e = getState(hass, entityId);
  if (!e) return 4;
  const step = e.attributes.percentage_step;
  if (step && step > 0) return Math.round(100 / step);
  const sc = e.attributes.speed_count;
  if (sc && sc > 1) return sc;
  return 4;
}

/**
 * Get the current active pip index (0 = off) for a fan.
 * speeds = total number of steps including off.
 */
function getFanPipIndex(hass, entityId, speeds) {
  const e = getState(hass, entityId);
  if (!e || e.state === 'off' || e.state === 'unavailable') return 0;
  const pct = parseFloat(e.attributes.percentage ?? 0);
  return Math.max(1, Math.min(speeds - 1, Math.round((pct / 100) * (speeds - 1))));
}

// ─────────────────────────────────────────────────────────────────────────────
// HVAC / climate helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Preferred mode cycle order. */
const HVAC_ORDER = ['heat_cool', 'auto', 'heat', 'cool', 'fan_only', 'dry', 'off'];

/** Visual metadata per HVAC mode. */
const HVAC_META = {
  heat_cool: {
    label: 'Heat / Cool', split: true,  dotColor: null,
    border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', text: '#fb923c',
  },
  auto: {
    label: 'Auto',        split: true,  dotColor: null,
    border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', text: '#fb923c',
  },
  heat: {
    label: 'Heat',        split: false, dotColor: '#fb923c',
    border: 'rgba(251,146,60,0.35)', bg: 'rgba(251,146,60,0.07)', text: '#fb923c',
  },
  cool: {
    label: 'Cool',        split: false, dotColor: '#60a5fa',
    border: 'rgba(96,165,250,0.35)',  bg: 'rgba(96,165,250,0.07)',  text: '#60a5fa',
  },
  fan_only: {
    label: 'Fan',         split: false, dotColor: '#2dd4bf',
    border: 'rgba(45,212,191,0.35)', bg: 'rgba(45,212,191,0.07)', text: '#2dd4bf',
  },
  dry: {
    label: 'Dry',         split: false, dotColor: '#fbbf24',
    border: 'rgba(251,191,36,0.35)', bg: 'rgba(251,191,36,0.07)', text: '#fbbf24',
  },
  off: {
    label: 'Off',         split: false, dotColor: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.22)', bg: 'rgba(255,255,255,0)', text: 'rgba(255,255,255,0.45)',
  },
};

/** Get HVAC meta for a mode key, falling back to 'off'. */
function getHvacMeta(modeKey) {
  return HVAC_META[modeKey] || HVAC_META['off'];
}

/**
 * Returns the list of supported modes for an entity in preferred display order.
 * Reads hvac_modes directly from the live entity — never hardcoded.
 */
function getSupportedModes(hass, entityId) {
  const raw = getAttr(hass, entityId, 'hvac_modes') || [];
  return HVAC_ORDER.filter(m => raw.includes(m));
}

/**
 * Returns the next HVAC mode to cycle to.
 * Returns null if the entity has fewer than 2 modes.
 */
function getNextHvacMode(hass, entityId) {
  const supported = getSupportedModes(hass, entityId);
  if (supported.length < 2) return null;
  const current = (getVal(hass, entityId) || '').toLowerCase();
  const idx = supported.indexOf(current);
  return supported[(idx + 1) % supported.length];
}

/** Render the HVAC mode dot HTML (split dot for heat_cool/auto). */
function hvacDotHtml(meta) {
  if (meta.split) {
    return `<div style="width:8px;height:8px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex">
      <div style="flex:1;background:#fb923c"></div>
      <div style="flex:1;background:#60a5fa"></div>
    </div>`;
  }
  return `<div style="width:8px;height:8px;border-radius:50%;background:${meta.dotColor};flex-shrink:0"></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover / blind helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns { color, rgb, label, subLabel } theme for a cover entity state.
 * state: 'open' | 'closed' | 'opening' | 'closing' | 'stopped' | other
 */
function getCoverTheme(state) {
  switch ((state || '').toLowerCase()) {
    case 'closed':
      return { color: COLORS.green,  rgb: COLORS.rgb.green,  label: 'Closed',    subLabel: 'Tap to open'  };
    case 'open':
      return { color: COLORS.amber,  rgb: COLORS.rgb.amber,  label: 'Open',      subLabel: 'Tap to close' };
    case 'opening':
      return { color: COLORS.blue,   rgb: COLORS.rgb.blue,   label: 'Opening…',  subLabel: 'In progress'  };
    case 'closing':
      return { color: COLORS.orange, rgb: COLORS.rgb.orange, label: 'Closing…',  subLabel: 'In progress'  };
    default:
      return { color: 'rgba(255,255,255,0.35)', rgb: '180,180,180', label: 'Unknown', subLabel: '' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag slider factory
// Creates a drag slider on a container element.
// The container must have CSS: position:relative; touch-action:none.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach drag slider behavior to a wrap element.
 *
 * @param {HTMLElement} wrap      - The slider container element
 * @param {number}      initial   - Initial value 0–100
 * @param {Function}    onDrag    - Called with (value, isFinal) during drag
 *                                  isFinal=true on mouseup/touchend → make HA call
 * @param {number}      debounceMs - Debounce for HA calls (default 150ms)
 * @returns {Function} cleanup - Call to remove all event listeners
 */
function attachSlider(wrap, initial, onDrag, debounceMs = 150) {
  let dragging = false;
  let debounceTimer = null;

  function pctFromX(clientX) {
    const rect = wrap.getBoundingClientRect();
    return Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }

  function update(clientX, isFinal) {
    const pct = pctFromX(clientX);
    // Always call immediately for visual update
    onDrag(pct, false);
    // Debounce the HA service call
    if (debounceTimer) clearTimeout(debounceTimer);
    if (isFinal) {
      onDrag(pct, true);
    } else {
      debounceTimer = setTimeout(() => onDrag(pct, true), debounceMs);
    }
  }

  const onMouseDown = e => { dragging = true; update(e.clientX, false); e.preventDefault(); };
  const onTouchStart = e => { dragging = true; update(e.touches[0].clientX, false); };
  const onMouseMove = e => { if (dragging) update(e.clientX, false); };
  const onTouchMove = e => { if (dragging) update(e.touches[0].clientX, false); };
  const onMouseUp = e => { if (dragging) { dragging = false; update(e.clientX, true); } };
  const onTouchEnd = e => {
    if (dragging) {
      dragging = false;
      if (e.changedTouches[0]) update(e.changedTouches[0].clientX, true);
    }
  };

  wrap.addEventListener('mousedown', onMouseDown);
  wrap.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchend', onTouchEnd);

  // Return cleanup function
  return () => {
    wrap.removeEventListener('mousedown', onMouseDown);
    wrap.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchend', onTouchEnd);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}


// ── ha-styles.js (inlined) ──────────────────────────────────────────────────
/**
 * ha-styles.js
 * Shared CSS string exports for all HA Lovelace cards.
 *
 * Usage in a card:
 *   import { CSS_RESET, CSS_POPUP, CSS_BADGE } from '../../shared/ha-styles.js';
 *
 *   _css() {
 *     return `${CSS_RESET}${CSS_POPUP}${CSS_BADGE}
 *       // card-specific styles here
 *     `;
 *   }
 *
 * HA resource path: /local/shared/ha-styles.js
 * (No need to register as a resource — imported directly by card modules)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Base card reset
// Applied to every card — resets ha-card to transparent and removes shadow/border.
// ─────────────────────────────────────────────────────────────────────────────
const CSS_RESET = `
  :host { display: block; }
  ha-card {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: var(--primary-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Popup overlay + sheet
// Used by any card that portals a popup to document.body.
// The portal container itself is set inline via JS — these styles cover the
// overlay backdrop and the popup sheet inside it.
// ─────────────────────────────────────────────────────────────────────────────
const CSS_POPUP = `
  .ha-popup-overlay {
    display: none;
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 1;
    align-items: flex-end;
    justify-content: center;
    pointer-events: all;
  }
  .ha-popup-overlay.open {
    display: flex;
  }
  .ha-popup-sheet {
    background: var(--card-background-color, #1e1e2a);
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 16px 16px 0 0;
    border-bottom: none;
    padding: 20px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
    position: relative;
    z-index: 2;
  }
  @media (min-width: 768px) {
    .ha-popup-overlay {
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .ha-popup-sheet {
      max-width: 440px;
      border-radius: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.22);
    }
    .ha-popup-handle { display: none !important; }
  }
  .ha-popup-handle {
    width: 36px;
    height: 4px;
    background: rgba(255,255,255,0.15);
    border-radius: 2px;
    margin: 0 auto 16px;
  }
  .ha-popup-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .ha-popup-title {
    font-size: 17px;
    font-weight: 700;
    color: #e2e8f0;
    line-height: 1.2;
  }
  .ha-popup-sub {
    font-size: 11px;
    font-weight: 600;
    margin-top: 3px;
    color: rgba(255,255,255,0.45);
  }
  .ha-popup-close {
    background: rgba(255,255,255,0.18);
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.5);
    font-size: 14px;
    line-height: 1;
    font-family: inherit;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .ha-popup-divider {
    height: 1px;
    background: rgba(255,255,255,0.09);
    margin-bottom: 14px;
  }
  .ha-popup-section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.3);
    margin-bottom: 8px;
    margin-top: 14px;
  }
  .ha-popup-section-label:first-child { margin-top: 0; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Badge / tag
// Small inline status chips used across all cards.
// Apply color via inline style: style="background:...; color:..."
// ─────────────────────────────────────────────────────────────────────────────
const CSS_BADGE = `
  .ha-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .ha-badge-green  { background: rgba(74,222,128,0.15);  color: #4ade80; }
  .ha-badge-red    { background: rgba(248,113,113,0.15); color: #f87171; }
  .ha-badge-blue   { background: rgba(96,165,250,0.15);  color: #60a5fa; }
  .ha-badge-amber  { background: rgba(251,191,36,0.15);  color: #fbbf24; }
  .ha-badge-purple { background: rgba(167,139,250,0.15); color: #a78bfa; }
  .ha-badge-gray   { background: rgba(255,255,255,0.18); color: rgba(255,255,255,0.45); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Unavailable / offline state
// Used when an entity is missing or state === 'unavailable'.
// ─────────────────────────────────────────────────────────────────────────────
const CSS_UNAVAIL = `
  .ha-unavail {
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    text-align: center;
    padding: 16px 0;
    opacity: 0.5;
    font-style: italic;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Section header + divider
// Used inside popup sheets and card sections.
// ─────────────────────────────────────────────────────────────────────────────
const CSS_SECTION = `
  .ha-section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.3);
    padding: 10px 14px 6px;
  }
  .ha-divider {
    height: 1px;
    background: rgba(255,255,255,0.18);
    margin: 8px 0;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Drag slider
// Custom brightness / position slider — no <input type="range">.
// Wrap element needs touch-action: none and data-entity attribute.
// ─────────────────────────────────────────────────────────────────────────────
const CSS_SLIDER = `
  .ha-slider-wrap {
    position: relative;
    height: 28px;
    display: flex;
    align-items: center;
    touch-action: none;
    cursor: pointer;
    user-select: none;
  }
  .ha-slider-track {
    width: 100%;
    height: 6px;
    border-radius: 99px;
    background: rgba(255,255,255,0.22);
    position: relative;
    overflow: visible;
  }
  .ha-slider-fill {
    height: 100%;
    border-radius: 99px;
    pointer-events: none;
    transition: width 0.08s;
  }
  .ha-slider-thumb {
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    top: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    pointer-events: none;
    transition: left 0.08s;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Interactive button tap states
// Apply .ha-tappable to any element that should react to press.
// ─────────────────────────────────────────────────────────────────────────────
const CSS_TAPPABLE = `
  .ha-tappable {
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.1s, filter 0.12s;
    cursor: pointer;
    user-select: none;
    outline: none;
  }
  .ha-tappable:active {
    transform: scale(0.96);
    filter: brightness(0.9);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Status pill (blinds, garage, covers)
// Left-accent-bar shape: flat left, rounded right.
// Color is applied via inline style.
// ─────────────────────────────────────────────────────────────────────────────
const CSS_PILL = `
  .ha-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 0 8px 8px 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: filter 0.12s;
  }
  .ha-pill:active { filter: brightness(0.9); }
  .ha-pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .ha-pill-label {
    font-size: 13px;
    font-weight: 700;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ha-pill-sub {
    font-size: 10px;
    opacity: 0.6;
    margin-top: 1px;
  }
  .ha-pill-chevron {
    font-size: 16px;
    opacity: 0.35;
    flex-shrink: 0;
  }
  .ha-pill-bar-bg {
    height: 3px;
    background: rgba(255,255,255,0.18);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 4px;
  }
  .ha-pill-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.3s;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Grid helpers
// ─────────────────────────────────────────────────────────────────────────────
const CSS_GRIDS = `
  .ha-grid-2 { display: grid; grid-template-columns: 1fr 1fr;         gap: 8px; }
  .ha-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr);  gap: 8px; }
  .ha-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr);  gap: 6px; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Convenience bundle — most cards need all of the above
// ─────────────────────────────────────────────────────────────────────────────
const CSS_ALL = `
  ${CSS_RESET}
  ${CSS_POPUP}
  ${CSS_BADGE}
  ${CSS_UNAVAIL}
  ${CSS_SECTION}
  ${CSS_SLIDER}
  ${CSS_TAPPABLE}
  ${CSS_PILL}
  ${CSS_GRIDS}
`;


// ── ha-popup.js (inlined) ───────────────────────────────────────────────────
/**
 * ha-popup.js
 * Portal popup utility for HA Lovelace cards.
 *
 * Popups are appended to document.body to escape HA's CSS transforms that
 * would clip or scale popups rendered inside shadow DOM.
 *
 * Usage:
 *   import { createPopupPortal, openPopup, closePopup } from '../../shared/ha-popup.js';
 *
 *   // In your card's _render() or constructor:
 *   this._portal = createPopupPortal('my-card-overlay', popupHtml, onClose);
 *
 *   // To open:
 *   openPopup(this._portal);
 *
 *   // To close:
 *   closePopup(this._portal);
 *
 *   // To update content without re-creating:
 *   this._portal.setContent(newHtml);
 *
 *   // In disconnectedCallback:
 *   destroyPopupPortal(this._portal);
 *
 * HA resource path: /local/shared/ha-popup.js
 */

/**
 * Create a popup portal appended to document.body.
 *
 * @param {string}   id         - Unique ID for the overlay element
 * @param {string}   innerHtml  - Initial popup content HTML
 * @param {Function} onClose    - Called when popup closes (backdrop tap or ✕ button)
 * @param {object}   options
 * @param {string}   options.maxWidth  - Max width of popup sheet. Default '440px'
 * @param {string}   options.extraCss  - Additional CSS injected into the portal <style>
 *
 * @returns {{ el: HTMLElement, overlay: HTMLElement, sheet: HTMLElement,
 *             open: Function, close: Function, setContent: Function, destroy: Function }}
 */
function createPopupPortal(id, innerHtml = '', onClose = null, options = {}) {
  const maxWidth = options.maxWidth || '440px';
  const extraCss = options.extraCss || '';

  // Remove any existing portal with the same ID
  document.getElementById(id)?.remove();

  const container = document.createElement('div');
  container.id = id;
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;font-size:16px';

  container.innerHTML = `
    <style>
      #${id} .portal-overlay {
        display: none;
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.55);
        pointer-events: all;
        align-items: flex-end;
        justify-content: center;
        z-index: 1;
      }
      #${id} .portal-overlay.open { display: flex; }
      #${id} .portal-sheet {
        background: var(--card-background-color, #1e1e2a);
        border: 1px solid rgba(255,255,255,0.22);
        border-radius: 16px 16px 0 0;
        border-bottom: none;
        padding: 20px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-sizing: border-box;
        position: relative;
        z-index: 2;
      }
      @media (min-width: 768px) {
        #${id} .portal-overlay {
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        #${id} .portal-sheet {
          max-width: ${maxWidth};
          border-radius: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.22);
        }
        #${id} .portal-handle { display: none !important; }
      }
      #${id} .portal-handle {
        width: 36px; height: 4px;
        background: rgba(255,255,255,0.15);
        border-radius: 2px;
        margin: 0 auto 16px;
      }
      #${id} .portal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      #${id} .portal-title {
        font-size: 17px; font-weight: 700;
        color: #e2e8f0;
        line-height: 1.2;
      }
      #${id} .portal-sub {
        font-size: 11px; font-weight: 600;
        margin-top: 3px;
        color: rgba(255,255,255,0.45);
      }
      #${id} .portal-close {
        background: rgba(255,255,255,0.18);
        border: none; border-radius: 50%;
        width: 28px; height: 28px;
        cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        color: rgba(255,255,255,0.5);
        font-size: 14px; line-height: 1;
        font-family: inherit; flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
      }
      #${id} .portal-divider {
        height: 1px;
        background: rgba(255,255,255,0.09);
        margin-bottom: 14px;
      }
      #${id} .portal-section-label {
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.08em;
        color: rgba(255,255,255,0.3);
        margin: 14px 0 8px;
      }
      #${id} .portal-section-label:first-child { margin-top: 0; }
      ${extraCss}

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
    <div class="portal-overlay">
      <div class="portal-sheet">
        <div class="portal-handle"></div>
        <div class="portal-content">${innerHtml}</div>
      </div>
    </div>`;

  document.body.appendChild(container);

  const overlay = container.querySelector('.portal-overlay');
  const sheet   = container.querySelector('.portal-sheet');
  const content = container.querySelector('.portal-content');

  // Backdrop tap closes
  overlay.addEventListener('click', e => {
    if (e.target === overlay) api.close();
  });

  // Delegate ✕ button inside content
  content.addEventListener('click', e => {
    if (e.target.closest('.portal-close')) api.close();
  });

  const api = {
    el:      container,
    overlay,
    sheet,
    content,

    open() {
      overlay.classList.add('open');
    },

    close() {
      overlay.classList.remove('open');
      if (onClose) onClose();
    },

    /** Replace the popup content HTML without re-creating the portal. */
    setContent(html) {
      content.innerHTML = html;
    },

    /** Remove the portal element from document.body entirely. */
    destroy() {
      container.remove();
    },

    /** True if the popup is currently open. */
    get isOpen() {
      return overlay.classList.contains('open');
    },
  };

  return api;
}

/**
 * Open a portal returned by createPopupPortal.
 * Convenience wrapper — equivalent to portal.open().
 */
function openPopup(portal) {
  portal?.open();
}

/**
 * Close a portal returned by createPopupPortal.
 * Convenience wrapper — equivalent to portal.close().
 */
function closePopup(portal) {
  portal?.close();
}

/**
 * Destroy a portal — removes it from the DOM entirely.
 * Call in disconnectedCallback.
 */
function destroyPopupPortal(portal) {
  portal?.destroy();
}

/**
 * Build standard popup header HTML.
 * Includes drag handle, title row with optional sub-label, close button, and divider.
 *
 * @param {string} title   - Primary heading
 * @param {string} sub     - Optional sub-label (color applied via inline style if subColor set)
 * @param {string} subColor - Optional color for the sub-label text
 */
function popupHeaderHtml(title, sub = '', subColor = '') {
  const subHtml = sub
    ? `<div class="portal-sub" style="${subColor ? `color:${subColor}` : ''}">${sub}</div>`
    : '';
  return `
    <div class="portal-handle"></div>
    <div class="portal-head">
      <div>
        <div class="portal-title">${title}</div>
        ${subHtml}
      </div>
      <button class="portal-close" aria-label="Close">✕</button>
    </div>
    <div class="portal-divider"></div>`;
}


// ── protect-events-card ─────────────────────────────────────────────────────
/**
 * protect-events-card.js  —  v5
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
    border: 'rgba(255,255,255,0.22)',
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
        border: 1px solid var(--divider-color, rgba(255,255,255,.22));
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
        border: 1px solid var(--divider-color, rgba(255,255,255,.22));
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
        border: 1px solid rgba(255,255,255,.18);
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
        border: 1px solid rgba(255,255,255,.18);
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
        border: 1px solid var(--divider-color, rgba(255,255,255,.22));
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
