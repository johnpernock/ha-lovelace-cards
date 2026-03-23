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
export const COLORS = {
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
export function colorTheme(name, bgOpacity = 0.08, borderOpacity = 0.25) {
  const rgb = COLORS.rgb[name];
  const hex = COLORS[name];
  if (!rgb) return { bg: 'transparent', border: 'rgba(255,255,255,0.12)', text: '#fff' };
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
export function getState(hass, entityId) {
  if (!hass || !entityId) return null;
  return hass.states[entityId] || null;
}

/** Returns the entity's state string, or null. */
export function getVal(hass, entityId) {
  return getState(hass, entityId)?.state ?? null;
}

/** Returns an attribute value from an entity, or null. */
export function getAttr(hass, entityId, key) {
  return getState(hass, entityId)?.attributes?.[key] ?? null;
}

/** Returns the entity state parsed as a float, or null. */
export function getNum(hass, entityId) {
  const v = parseFloat(getVal(hass, entityId));
  return isNaN(v) ? null : v;
}

/** Returns true if entity state is 'on' or 'true'. */
export function isOn(hass, entityId) {
  const v = getVal(hass, entityId);
  return v === 'on' || v === 'true';
}

/** Returns true if entity state is 'unavailable' or entity doesn't exist. */
export function isUnavailable(hass, entityId) {
  const e = getState(hass, entityId);
  return !e || e.state === 'unavailable' || e.state === 'unknown';
}

/** Returns the entity's friendly_name, falling back to entity ID. */
export function getFriendlyName(hass, entityId) {
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
export function fmtTime(hours) {
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
export function fmtRelative(dateStr) {
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
export function fmtNum(val) {
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
export function resolveFanSpeeds(hass, entityId, configSpeeds = null) {
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
export function getFanPipIndex(hass, entityId, speeds) {
  const e = getState(hass, entityId);
  if (!e || e.state === 'off' || e.state === 'unavailable') return 0;
  const pct = parseFloat(e.attributes.percentage ?? 0);
  return Math.max(1, Math.min(speeds - 1, Math.round((pct / 100) * (speeds - 1))));
}

// ─────────────────────────────────────────────────────────────────────────────
// HVAC / climate helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Preferred mode cycle order. */
export const HVAC_ORDER = ['heat_cool', 'auto', 'heat', 'cool', 'fan_only', 'dry', 'off'];

/** Visual metadata per HVAC mode. */
export const HVAC_META = {
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
    label: 'Off',         split: false, dotColor: 'rgba(255,255,255,0.25)',
    border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.45)',
  },
};

/** Get HVAC meta for a mode key, falling back to 'off'. */
export function getHvacMeta(modeKey) {
  return HVAC_META[modeKey] || HVAC_META['off'];
}

/**
 * Returns the list of supported modes for an entity in preferred display order.
 * Reads hvac_modes directly from the live entity — never hardcoded.
 */
export function getSupportedModes(hass, entityId) {
  const raw = getAttr(hass, entityId, 'hvac_modes') || [];
  return HVAC_ORDER.filter(m => raw.includes(m));
}

/**
 * Returns the next HVAC mode to cycle to.
 * Returns null if the entity has fewer than 2 modes.
 */
export function getNextHvacMode(hass, entityId) {
  const supported = getSupportedModes(hass, entityId);
  if (supported.length < 2) return null;
  const current = (getVal(hass, entityId) || '').toLowerCase();
  const idx = supported.indexOf(current);
  return supported[(idx + 1) % supported.length];
}

/** Render the HVAC mode dot HTML (split dot for heat_cool/auto). */
export function hvacDotHtml(meta) {
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
export function getCoverTheme(state) {
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
export function attachSlider(wrap, initial, onDrag, debounceMs = 150) {
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
