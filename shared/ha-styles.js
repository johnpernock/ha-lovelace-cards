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
export const CSS_RESET = `
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
export const CSS_POPUP = `
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
    border: 1px solid rgba(255,255,255,0.12);
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
      border-bottom: 1px solid rgba(255,255,255,0.12);
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
    color: var(--primary-text-color, #e2e8f0);
    line-height: 1.2;
  }
  .ha-popup-sub {
    font-size: 11px;
    font-weight: 600;
    margin-top: 3px;
    color: rgba(255,255,255,0.45);
  }
  .ha-popup-close {
    background: rgba(255,255,255,0.08);
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--secondary-text-color, rgba(255,255,255,0.5));
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
export const CSS_BADGE = `
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
  .ha-badge-gray   { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.45); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Unavailable / offline state
// Used when an entity is missing or state === 'unavailable'.
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_UNAVAIL = `
  .ha-unavail {
    font-size: 12px;
    color: var(--secondary-text-color, rgba(255,255,255,0.4));
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
export const CSS_SECTION = `
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
    background: rgba(255,255,255,0.07);
    margin: 8px 0;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Drag slider
// Custom brightness / position slider — no <input type="range">.
// Wrap element needs touch-action: none and data-entity attribute.
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_SLIDER = `
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
    background: rgba(255,255,255,0.10);
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
export const CSS_TAPPABLE = `
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
export const CSS_PILL = `
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
    background: rgba(255,255,255,0.08);
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
export const CSS_GRIDS = `
  .ha-grid-2 { display: grid; grid-template-columns: 1fr 1fr;         gap: 8px; }
  .ha-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr);  gap: 8px; }
  .ha-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr);  gap: 6px; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Convenience bundle — most cards need all of the above
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_ALL = `
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
