/**
 * garage-door-card.js  —  v7
 * Compact garage door toggle card for Home Assistant Lovelace.
 *
 * ── SHARED MODULES ────────────────────────────────────────────────────────────
 * This card uses the shared utility modules in shared/:
 *   ha-utils.js   — COLORS, getVal, isUnavailable
 *   ha-styles.js  — CSS_RESET, CSS_TAPPABLE, CSS_UNAVAIL
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy cards/garage-door-card/ and shared/ to /config/www/
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/garage-door-card/garage-door-card.js  —  v4
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:garage-door-card
 * entity: cover.garage_door
 * name: Garage              # optional
 */

import { COLORS, getVal, isUnavailable } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_UNAVAIL } from '../../shared/ha-styles.js?v=2';

function getTheme(state) {
  switch (state) {
    case 'closed':  return { btnBg:'rgba(74,222,128,0.12)',  btnBorder:'rgba(74,222,128,0.55)',  iconColor:COLORS.green,  textColor:COLORS.green,  label:'Closed',   subLabel:'Tap to open',  canToggle:true,  service:'open_cover'  };
    case 'open':    return { btnBg:'rgba(96,165,250,0.12)',  btnBorder:'rgba(96,165,250,0.55)',  iconColor:COLORS.blue,   textColor:COLORS.blue,   label:'Open',     subLabel:'Tap to close', canToggle:true,  service:'close_cover' };
    case 'opening': return { btnBg:'rgba(251,191,36,0.08)',  btnBorder:'rgba(251,191,36,0.35)',  iconColor:COLORS.amber,  textColor:'rgba(251,191,36,0.6)',  label:'Opening…', subLabel:'In progress',  canToggle:false, service:null          };
    case 'closing': return { btnBg:'rgba(251,146,60,0.08)',  btnBorder:'rgba(251,146,60,0.35)',  iconColor:COLORS.orange, textColor:'rgba(251,146,60,0.6)', label:'Closing…', subLabel:'In progress',  canToggle:false, service:null          };
    default:        return { btnBg:'rgba(255,255,255,0.04)', btnBorder:'rgba(255,255,255,0.12)', iconColor:'rgba(255,255,255,0.3)', textColor:'rgba(255,255,255,0.35)', label: state.charAt(0).toUpperCase()+state.slice(1), subLabel:'Tap to toggle', canToggle:true, service:'toggle' };
  }
}

function doorIcon(state) {
  const s = `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
  if (state==='closed')  return `<svg viewBox="0 0 24 24" fill="none" ${s}><path d="M2 10 L12 3 L22 10"/><rect x="2" y="10" width="20" height="11" rx="1.5"/><line x1="6" y1="15" x2="18" y2="15"/><line x1="6" y1="18" x2="18" y2="18"/></svg>`;
  if (state==='open')    return `<svg viewBox="0 0 24 24" fill="none" ${s}><path d="M2 10 L12 3 L22 10"/><rect x="2" y="10" width="20" height="11" rx="1.5"/><rect x="6" y="13" width="12" height="6" rx="0.5" fill="currentColor" fill-opacity="0.15"/></svg>`;
  if (state==='opening') return `<svg viewBox="0 0 24 24" fill="none" ${s}><path d="M2 10 L12 3 L22 10"/><rect x="2" y="10" width="20" height="11" rx="1.5"/><line x1="12" y1="22" x2="12" y2="14"/><polyline points="8 17 12 13 16 17"/></svg>`;
  if (state==='closing') return `<svg viewBox="0 0 24 24" fill="none" ${s}><path d="M2 10 L12 3 L22 10"/><rect x="2" y="10" width="20" height="11" rx="1.5"/><line x1="12" y1="13" x2="12" y2="21"/><polyline points="8 18 12 22 16 18"/></svg>`;
  return `<svg viewBox="0 0 24 24" fill="none" ${s}><path d="M2 10 L12 3 L22 10"/><rect x="2" y="10" width="20" height="11" rx="1.5"/><line x1="7" y1="15" x2="17" y2="15"/></svg>`;
}

class GarageDoorCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = false;
  }

  static getStubConfig() { return { entity: 'cover.garage_door', name: 'Garage' }; }

  setConfig(config) {
    if (!config.entity) throw new Error('garage-door-card: please define an entity');
    this._config = { name: null, ...config };
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.btn') || !prev) { this._render(); return; }
    this._patch();
  }
  getCardSize()   { return 3; }

  async _toggle() {
    if (this._busy) return;
    const state = (getVal(this._hass, this._config.entity) || 'unknown').toLowerCase();
    const { canToggle, service } = getTheme(state);
    if (!canToggle || !service) return;
    this._busy = true;
    try { await this._hass.callService('cover', service, { entity_id: this._config.entity }); }
    catch (err) { console.warn('garage-door-card: service call failed', err); }
    setTimeout(() => { this._busy = false; }, 800);
  }

  _patch() {
    const unavail = isUnavailable(this._hass, this._config.entity);
    const state   = (getVal(this._hass, this._config.entity) || 'unknown').toLowerCase();
    const t       = getTheme(unavail ? 'unknown' : state);
    const btn     = this.shadowRoot.querySelector('.btn');
    const ico     = this.shadowRoot.querySelector('.ico');
    const lbl     = this.shadowRoot.querySelector('.label');
    const sub     = this.shadowRoot.querySelector('.sub-label');
    const prog    = this.shadowRoot.querySelector('.prog-indeterminate');
    if (!btn) return;
    btn.style.background   = t.btnBg;
    btn.style.borderColor  = t.btnBorder;
    btn.disabled           = !t.canToggle || this._busy;
    if (ico)  ico.style.color  = t.iconColor;
    if (ico)  ico.innerHTML    = doorIcon(state);
    if (lbl)  { lbl.textContent = t.label; lbl.style.color = t.textColor; }
    if (sub)  { sub.textContent = t.subLabel; sub.style.color = t.textColor; }
    if (prog) prog.style.display = t.canToggle ? 'none' : 'block';
  }

  _render() {
    const unavail = isUnavailable(this._hass, this._config.entity);
    const state   = (getVal(this._hass, this._config.entity) || 'unknown').toLowerCase();
    const theme   = getTheme(unavail ? 'unknown' : state);

    this.shadowRoot.innerHTML = `
      <style>
        ${CSS_RESET}
        ${CSS_TAPPABLE}
        ${CSS_UNAVAIL}
        ha-card { padding: 0 14px; }
        .card { border-radius:10px; border:1px solid rgba(255,255,255,.10); overflow:hidden; }
        .action-btn {
          width:100%; border-radius:0; padding:20px 8px 14px; border:none;
          display:flex; flex-direction:column; align-items:center; gap:10px;
        }
        .action-btn.disabled { cursor:default; }
        .btn-icon  { width:30px; height:30px; flex-shrink:0; }
        .btn-icon svg { width:100%; height:100%; }
        .btn-label { font-size:13px; font-weight:600; letter-spacing:0.03em; line-height:1; }
        .btn-sub   { font-size:10px; font-weight:500; letter-spacing:0.04em; margin-top:-4px; opacity:.75; }
        .prog-wrap { width:80%; height:3px; background:rgba(255,255,255,.08); border-radius:99px; overflow:hidden; }
        .prog-bar  { height:100%; border-radius:99px; animation:indeterminate 1.6s ease-in-out infinite; }
        @keyframes indeterminate {
          0%   { width:15%; margin-left:0 }
          50%  { width:55%; margin-left:25% }
          100% { width:15%; margin-left:85% }
        }
      </style>
      <ha-card>
        <div class="card">
        ${unavail
          ? `<div class="ha-unavail">unavailable</div>`
          : `<button class="action-btn ha-tappable ${theme.canToggle ? '' : 'disabled'}" id="gd-btn"
               style="background:${theme.btnBg};border:1px solid ${theme.btnBorder}"
               ${theme.canToggle ? '' : 'disabled'}>
             <div class="btn-icon" style="color:${theme.iconColor}">${doorIcon(state)}</div>
             <div class="btn-label" style="color:${theme.textColor}">${theme.label}</div>
             <div class="btn-sub"   style="color:${theme.textColor}">${theme.subLabel}</div>
             ${!theme.canToggle ? `<div class="prog-wrap"><div class="prog-bar" style="background:${theme.iconColor}"></div></div>` : ''}
           </button>`
        }
        </div>
      </ha-card>`;

    this.shadowRoot.getElementById('gd-btn')
      ?.addEventListener('click', ev => { ev.stopPropagation(); this._toggle(); });
  }
}

customElements.define('garage-door-card', GarageDoorCard);
