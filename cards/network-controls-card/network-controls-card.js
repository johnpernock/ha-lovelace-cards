/**
 * network-controls-card.js  —  v3
 * Network device restart / control card — pill button grid layout (3 across).
 * Buttons arranged in configurable sections. Danger/warn buttons show a
 * confirmation overlay before firing. Five colour variants, six icon types.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/network-controls-card/network-controls-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/network-controls-card/network-controls-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:network-controls-card
 * title: Network Controls          # optional card header
 * sections:
 *   - title: Access Points         # optional section label
 *     buttons:
 *       - name: Hallway AP
 *         entity: button.ap_hallway_restart
 *         icon: wifi                           # wifi|ap|restart|power|server|info|router
 *         color: neutral                       # neutral|danger|warn|info|success
 *         confirm: true                        # show confirm dialog (auto-true for danger/warn)
 *         confirm_message: "Custom message."   # optional
 *
 * ── LEGACY CONFIG (still supported) ───────────────────────────────────────────
 * restart_buttons:
 *   - name: Hallway AP
 *     entity: button.ap_hallway_restart
 *     danger: false
 */

class NetworkControlsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config  = {};
    this._hass    = null;
    this._busy    = {};
    this._pending = null;
  }

  static getStubConfig() {
    return {
      title: 'Network Controls',
      sections: [
        {
          title: 'Access Points',
          buttons: [
            { name: 'Hallway AP',     entity: 'button.ap_hallway_restart',     icon: 'wifi',    color: 'neutral' },
            { name: 'Family Room AP', entity: 'button.family_room_ap_restart', icon: 'wifi',    color: 'neutral' },
            { name: 'Garage AP',      entity: 'button.garage_ap_restart',      icon: 'ap',      color: 'neutral' },
          ],
        },
        {
          title: 'Server',
          buttons: [
            { name: 'Restart Unraid', entity: 'button.unraid_restart', icon: 'restart', color: 'danger' },
            { name: 'Restart UDM',    entity: 'button.udm_restart',    icon: 'restart', color: 'warn'   },
            { name: 'UDM Status',                                       icon: 'info',    color: 'info'   },
          ],
        },
      ],
    };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: 'title', label: 'Card title', selector: { text: {} } },
      ],
      assertCustomElement: 'network-controls-card',
    };
  }

  setConfig(c) {
    this._config = this._normalise(c);
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) this._render();
    // No live state patching needed — pills don't reflect entity state
  }

  getCardSize() {
    return (this._config.sections ?? []).reduce(
      (acc, s) => acc + Math.ceil((s.buttons?.length ?? 0) / 3) + 1, 2
    );
  }

  // ── Normalise legacy restart_buttons flat list ───────────────────────────────

  _normalise(c) {
    if (c.sections) return c;
    if (c.restart_buttons?.length) {
      return {
        ...c,
        sections: [{
          buttons: c.restart_buttons.map(b => ({
            name:            b.name,
            entity:          b.entity,
            icon:            'restart',
            color:           b.danger ? 'danger' : 'neutral',
            confirm_message: b.subtitle ?? null,
          })),
        }],
      };
    }
    return c;
  }

  // ── Colour map ───────────────────────────────────────────────────────────────

  _colorStyles(color) {
    const map = {
      neutral: { bg: 'rgba(255,255,255,.05)',  border: 'rgba(255,255,255,.1)',   text: 'rgba(255,255,255,.55)' },
      danger:  { bg: 'rgba(248,113,113,.07)',  border: 'rgba(248,113,113,.22)',  text: '#f87171'               },
      warn:    { bg: 'rgba(251,191,36,.07)',   border: 'rgba(251,191,36,.2)',    text: '#fbbf24'               },
      info:    { bg: 'rgba(96,165,250,.07)',   border: 'rgba(96,165,250,.2)',    text: '#60a5fa'               },
      success: { bg: 'rgba(74,222,128,.07)',   border: 'rgba(74,222,128,.2)',    text: '#4ade80'               },
    };
    return map[color] ?? map.neutral;
  }

  // ── Icon paths ────────────────────────────────────────────────────────────────

  _iconPath(icon) {
    const icons = {
      restart: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
      wifi:    '<path d="M1.5 8.5a13 13 0 0 1 21 0M5 12a10 10 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01"/>',
      ap:      '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
      power:   '<path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/>',
      server:  '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
      info:    '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
      router:  '<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="10" cy="12" r="1" fill="currentColor"/><circle cx="14" cy="12" r="1" fill="currentColor"/>',
    };
    return icons[icon] ?? icons.restart;
  }

  _ico(icon, color, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${this._iconPath(icon)}</svg>`;
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────

  _css() { return `
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .wrap{border-radius:10px;overflow:hidden;position:relative}
    .card-hdr{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.2px;padding:10px 14px 9px;border-bottom:1.5px solid rgba(255,255,255,.28)}
    .sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28);padding:8px 14px 4px}
    .divider{height:1px;background:rgba(255,255,255,.07)}
    .pill-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:5px 14px 10px}
    .pbtn{border-radius:10px;padding:11px 8px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;transition:transform .1s,filter .12s;min-height:66px}
    .pbtn:active{transform:scale(.95);filter:brightness(.82)}
    .pbtn.no-entity{opacity:.35;pointer-events:none}
    .pbtn-lbl{font-size:10px;font-weight:700;text-align:center;line-height:1.3}
    .ov{display:none;position:absolute;inset:0;background:rgba(0,0,0,.72);align-items:flex-end;justify-content:center;z-index:10;border-radius:10px}
    .ov.open{display:flex}
    .sheet{background:var(--card-background-color,#1a1a2e);border:1px solid rgba(255,255,255,.15);border-radius:12px 12px 0 0;border-bottom:none;padding:14px 14px 16px;width:100%}
    @media(min-width:480px){
      .ov{align-items:center;justify-content:center;padding:14px}
      .sheet{border-radius:12px;border:1px solid rgba(255,255,255,.15);max-width:320px}
      .sh-handle{display:none}
    }
    .sh-handle{width:32px;height:3px;background:rgba(255,255,255,.15);border-radius:2px;margin:0 auto 11px}
    .sh-title{font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:4px}
    .sh-sub{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:13px;line-height:1.5}
    .sh-btns{display:flex;gap:7px}
    .sh-yes{flex:1;height:38px;border-radius:7px;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#f87171;font-size:13px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:filter .12s}
    .sh-yes:active{filter:brightness(.82)}
    .sh-no{flex:1;height:38px;border-radius:7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.45);font-size:13px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:filter .12s}
    .sh-no:active{filter:brightness(.82)}
  `; }

  // ── Build HTML ───────────────────────────────────────────────────────────────

  _buildSections() {
    return (this._config.sections ?? []).map((sec, si) => {
      const btns = (sec.buttons ?? []).map((b, bi) => {
        const { bg, border, text } = this._colorStyles(b.color ?? 'neutral');
        const needsConfirm = b.confirm ?? (b.color === 'danger' || b.color === 'warn');
        const hasEntity    = !!b.entity;
        return `
          <div class="pbtn${hasEntity ? '' : ' no-entity'}"
               style="background:${bg};border:1px solid ${border}"
               data-si="${si}" data-bi="${bi}"
               data-confirm="${needsConfirm ? '1' : '0'}"
               data-entity="${b.entity ?? ''}"
               data-name="${b.name ?? ''}"
               data-msg="${b.confirm_message ?? ''}">
            ${this._ico(b.icon ?? 'restart', text)}
            <div class="pbtn-lbl" style="color:${text}">${b.name ?? ''}</div>
          </div>`;
      }).join('');

      const divider = si > 0 ? '<div class="divider"></div>' : '';
      const label   = sec.title ? `<div class="sec-lbl">${sec.title}</div>` : '';
      return `${divider}${label}<div class="pill-grid">${btns}</div>`;
    }).join('');
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  _render() {
    const title = this._config.title ?? 'Network Controls';
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card><div class="wrap">
        <div class="card-hdr">${title}</div>
        ${this._buildSections()}
        <div class="ov" id="ov">
          <div class="sheet">
            <div class="sh-handle"></div>
            <div class="sh-title" id="ov-title"></div>
            <div class="sh-sub"   id="ov-sub"></div>
            <div class="sh-btns">
              <button class="sh-yes" id="ov-yes">Confirm</button>
              <button class="sh-no"  id="ov-no">Cancel</button>
            </div>
          </div>
        </div>
      </div></ha-card>`;
    this._listen();
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  _listen() {
    const sr    = this.shadowRoot;
    const ov    = sr.getElementById('ov');
    const close = () => { ov?.classList.remove('open'); this._pending = null; };

    sr.getElementById('ov-no')?.addEventListener('click', close);
    ov?.addEventListener('click', e => { if (e.target === ov) close(); });

    sr.getElementById('ov-yes')?.addEventListener('click', () => {
      const p = this._pending;
      if (p?.entity && !this._busy[p.entity]) {
        this._busy[p.entity] = true;
        setTimeout(() => { this._busy[p.entity] = false; }, 1500);
        this._hass?.callService('button', 'press', { entity_id: p.entity });
      }
      close();
    });

    sr.querySelectorAll('.pbtn:not(.no-entity)').forEach(btn => {
      btn.addEventListener('click', () => {
        const entity  = btn.dataset.entity;
        const name    = btn.dataset.name;
        const msg     = btn.dataset.msg;
        const confirm = btn.dataset.confirm === '1';
        if (!entity || this._busy[entity]) return;
        if (confirm) {
          this._pending = { entity, name };
          const t = sr.getElementById('ov-title');
          const s = sr.getElementById('ov-sub');
          if (t) t.textContent = `${name}?`;
          if (s) s.textContent = msg || `This will restart ${name}. Make sure it's safe to proceed.`;
          ov?.classList.add('open');
        } else {
          this._busy[entity] = true;
          setTimeout(() => { this._busy[entity] = false; }, 1500);
          this._hass?.callService('button', 'press', { entity_id: entity });
        }
      });
    });
  }
}

customElements.define('network-controls-card', NetworkControlsCard);
