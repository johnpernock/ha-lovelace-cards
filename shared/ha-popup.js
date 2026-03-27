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
export function createPopupPortal(id, innerHtml = '', onClose = null, options = {}) {
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
        background: rgba(0,0,0,0.85);
        pointer-events: all;
        align-items: flex-end;
        justify-content: center;
        z-index: 1;
      }
      #${id} .portal-overlay.open { display: flex; }
      #${id} .portal-sheet {
        background: #000000;
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
        #${id} .portal-overlay {
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        #${id} .portal-sheet {
          max-width: ${maxWidth};
          border-radius: 16px;
          border: 1.5px solid rgba(255,255,255,0.20);
          border-bottom: 1.5px solid rgba(255,255,255,0.20);
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
        color: var(--primary-text-color, #e2e8f0);
        line-height: 1.2;
      }
      #${id} .portal-sub {
        font-size: 11px; font-weight: 600;
        margin-top: 3px;
        color: rgba(255,255,255,0.45);
      }
      #${id} .portal-close {
        background: rgba(255,255,255,0.08);
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
export function openPopup(portal) {
  portal?.open();
}

/**
 * Close a portal returned by createPopupPortal.
 * Convenience wrapper — equivalent to portal.close().
 */
export function closePopup(portal) {
  portal?.close();
}

/**
 * Destroy a portal — removes it from the DOM entirely.
 * Call in disconnectedCallback.
 */
export function destroyPopupPortal(portal) {
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
export function popupHeaderHtml(title, sub = '', subColor = '') {
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
