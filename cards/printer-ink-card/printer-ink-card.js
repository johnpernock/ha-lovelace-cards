/**
 * printer-ink-card.js  —  v1
 * Compact Epson printer ink level display for Home Assistant Lovelace.
 * Extracted from technology-card (section: ink).
 *
 * CONFIG:
 * type: custom:printer-ink-card
 * entities:
 *   ink_black:   sensor.epson_et_5170_series_black_ink
 *   ink_cyan:    sensor.epson_et_5170_series_cyan_ink
 *   ink_magenta: sensor.epson_et_5170_series_magenta_ink
 *   ink_yellow:  sensor.epson_et_5170_series_yellow_ink
 */

class PrinterInkCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  static getStubConfig() {
    return {
      entities: {
        ink_black:   'sensor.epson_black_ink',
        ink_cyan:    'sensor.epson_cyan_ink',
        ink_magenta: 'sensor.epson_magenta_ink',
        ink_yellow:  'sensor.epson_yellow_ink',
      }
    };
  }

  setConfig(c) {
    if (!c.entities) throw new Error('printer-ink-card: entities required');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 2; }

  _e(k)   { return this._config.entities?.[k]; }
  _num(id) {
    if (!id || !this._hass) return null;
    const v = parseFloat(this._hass.states[id]?.state);
    return isNaN(v) ? null : v;
  }

  _inks() {
    return [
      { k: 'ink_black',   lbl: 'Black', short: 'K', color: '#aaaaaa' },
      { k: 'ink_cyan',    lbl: 'Cyan',  short: 'C', color: '#06b6d4' },
      { k: 'ink_magenta', lbl: 'Magenta', short: 'M', color: '#ec4899' },
      { k: 'ink_yellow',  lbl: 'Yellow', short: 'Y', color: '#eab308' },
    ];
  }

  _render() {
    const inks = this._inks();
    const bars = inks.map(ink => {
      const pct = this._num(this._e(ink.k));
      const low = pct != null && pct < 20;
      const h   = pct != null ? Math.max(4, pct) : 0;
      return `<div class="ink-item" id="ink-${ink.k}">
        <div class="ink-bar-wrap">
          <div class="ink-bar" style="height:${h}%;background:${ink.color}"></div>
        </div>
        <div class="ink-pct" style="${low ? 'color:#fbbf24' : ''}">${pct != null ? Math.round(pct) + '%' : '—'}</div>
        <div class="ink-lbl">${ink.short}</div>
        ${low ? '<div class="ink-warn">Low</div>' : ''}
      </div>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0;
          font-family: var(--primary-font-family, sans-serif);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .wrap {
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.12);
          overflow: hidden;
        }
        .hdr {
          font-size: 17px; font-weight: 700; color: white;
          letter-spacing: -.2px; padding: 10px 14px 9px;
          border-bottom: 1.5px solid rgba(255,255,255,.28);
        }
        .body { padding: 12px 14px; }
        .ink-row { display: flex; gap: 8px; }
        .ink-item {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 4px;
        }
        .ink-bar-wrap {
          width: 100%; height: 60px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 6px; overflow: hidden;
          display: flex; flex-direction: column; justify-content: flex-end;
        }
        .ink-bar { width: 100%; transition: height .3s; }
        .ink-pct { font-size: 12px; font-weight: 700; color: #e2e8f0; }
        .ink-lbl {
          font-size: 10px; font-weight: 700;
          color: rgba(255,255,255,.3); text-transform: uppercase;
        }
        .ink-warn {
          font-size: 9px; font-weight: 700; color: #fbbf24;
          text-transform: uppercase; letter-spacing: .05em;
        }
      </style>
      <ha-card>
        <div class="wrap">
          <div class="hdr">Printer Ink</div>
          <div class="body">
            <div class="ink-row">${bars}</div>
          </div>
        </div>
      </ha-card>`;
  }

  _patch() {
    const inks = this._inks();
    inks.forEach(ink => {
      const item = this.shadowRoot.querySelector(`#ink-${ink.k}`);
      if (!item) return;
      const pct = this._num(this._e(ink.k));
      const low = pct != null && pct < 20;
      const h   = pct != null ? Math.max(4, pct) : 0;

      const bar  = item.querySelector('.ink-bar');
      const pctEl = item.querySelector('.ink-pct');
      const warn  = item.querySelector('.ink-warn');

      if (bar)   bar.style.height = `${h}%`;
      if (pctEl) {
        pctEl.textContent = pct != null ? Math.round(pct) + '%' : '—';
        pctEl.style.color = low ? '#fbbf24' : '';
      }
      if (low && !warn) {
        const w = document.createElement('div');
        w.className = 'ink-warn';
        w.textContent = 'Low';
        item.appendChild(w);
      } else if (!low && warn) {
        warn.remove();
      }
    });
  }
}

customElements.define('printer-ink-card', PrinterInkCard);
