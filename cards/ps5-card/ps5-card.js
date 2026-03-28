/**
 * ps5-card.js  —  v2
 * PlayStation 5 status card for Home Assistant Lovelace.
 *
 * Shows power state, current game, session indicator, and wake/power buttons.
 * Uses the PS5 HACS integration (ha-playstation).
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Install ha-playstation via HACS
 * 2. Copy to /config/www/cards/ps5-card/ps5-card.js
 * 3. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/ps5-card/ps5-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:ps5-card
 * media_player: media_player.playstation_5   # ha-playstation media_player entity
 * name: PlayStation 5                        # optional display name
 */

import { COLORS, getVal, getAttr } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_BADGE } from '../../shared/ha-styles.js';

class Ps5Card extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
  }

  static getStubConfig() {
    return { media_player: 'media_player.playstation_5', name: 'PlayStation 5' };
  }
  static getConfigForm() {
    return {
      schema: [
      { name: 'media_player', label: 'PS5 media_player entity', selector: { entity: { domain: 'media_player' } } },
      { name: 'name',         label: 'Display name',            selector: { text: {} } },
    ],
      assertCustomElement: 'ps5-card',
    };
  }


  setConfig(c) {
    if (!c.media_player) throw new Error('ps5-card: media_player required');
    this._config = { name: 'PlayStation 5', ...c };
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 3; }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _entity()    { return this._hass?.states[this._config.media_player]; }
  _state()     { return this._entity()?.state || 'unavailable'; }
  _isOn()      { return this._state() === 'playing' || this._state() === 'on' || this._state() === 'idle'; }
  _isOff()     { return this._state() === 'off' || this._state() === 'standby'; }
  _game()      { return this._entity()?.attributes?.media_title || null; }
  _app()       { return this._entity()?.attributes?.app_name || null; }

  _stateLabel() {
    const s = this._state();
    if (s === 'playing' || s === 'on') return 'On';
    if (s === 'idle')    return 'Idle';
    if (s === 'off' || s === 'standby') return 'Off';
    return 'Unavailable';
  }

  _stateMeta() {
    if (this._isOn())  return { color: '#4ade80', bg: 'rgba(74,222,128,.08)',  border: 'rgba(74,222,128,.25)' };
    if (this._isOff()) return { color: 'rgba(255,255,255,.35)', bg: 'rgba(255,255,255,.05)', border: 'rgba(255,255,255,.12)' };
    return { color: 'rgba(255,255,255,.2)', bg: 'rgba(255,255,255,.03)', border: 'rgba(255,255,255,.08)' };
  }

  // ── Service calls ─────────────────────────────────────────────────────────

  async _call(service, lockKey) {
    if (this._busy[lockKey]) return;
    this._busy[lockKey] = true;
    try {
      await this._hass.callService('media_player', service, { entity_id: this._config.media_player });
    } catch(e) { console.warn('ps5-card:', service, e); }
    setTimeout(() => { this._busy[lockKey] = false; }, 2000);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _css() {
    return `${CSS_RESET}${CSS_TAPPABLE}${CSS_BADGE}
      ha-card { padding: 0; }
      .wrap { border-radius: 10px; border: 1px solid rgba(255,255,255,.12); overflow: hidden; }
      .hdr  { font-size: 17px; font-weight: 700; color: white; letter-spacing: -.2px;
              padding: 10px 14px 9px; border-bottom: 1.5px solid rgba(255,255,255,.28); }
      .body { padding: 12px 14px; }
      /* Console header row */
      .console-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .ps-logo { width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0;
                 background: rgba(0,48,135,.4); border: 1px solid rgba(96,165,250,.25);
                 display: flex; align-items: center; justify-content: center;
                 font-size: 12px; font-weight: 800; color: #60a5fa; letter-spacing: -.5px; }
      .console-info { flex: 1; }
      .console-name { font-size: 13px; font-weight: 700; color: #e2e8f0; }
      .console-sub  { font-size: 10px; color: rgba(255,255,255,.4); margin-top: 2px; }
      .status-badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 4px;
                      text-transform: uppercase; letter-spacing: .05em; flex-shrink: 0; }
      /* Game tile */
      .game { display: flex; align-items: center; gap: 10px; padding: 10px 12px;
              background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10);
              border-radius: 10px; margin-bottom: 10px; min-height: 52px; }
      .game-icon { width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0;
                   background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10);
                   display: flex; align-items: center; justify-content: center; font-size: 20px; }
      .game-info { flex: 1; min-width: 0; }
      .game-title { font-size: 13px; font-weight: 700; color: #e2e8f0;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .game-sub   { font-size: 10px; color: rgba(255,255,255,.4); margin-top: 2px; }
      .game-empty { font-size: 12px; color: rgba(255,255,255,.3); font-style: italic; }
      /* Action buttons */
      .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .action-btn { height: 44px; border-radius: 8px; display: flex; align-items: center;
                    justify-content: center; gap: 7px; font-size: 12px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: .05em;
                    cursor: pointer; -webkit-tap-highlight-color: transparent;
                    user-select: none; transition: transform .1s, filter .12s; }
      .action-btn:active { transform: scale(.96); filter: brightness(.88); }
      .action-btn.wake { background: rgba(74,222,128,.06); border: 1px solid rgba(74,222,128,.25); color: #4ade80; }
      .action-btn.off  { background: rgba(248,113,113,.06); border: 1px solid rgba(248,113,113,.25); color: #f87171; }
      .action-btn.disabled { opacity: .4; pointer-events: none; }
    `;
  }

  // ── Render / Patch ─────────────────────────────────────────────────────────

  _render() {
    const on      = this._isOn();
    const off     = this._isOff();
    const game    = this._game();
    const app     = this._app();
    const meta    = this._stateMeta();
    const label   = this._stateLabel();

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap">
          <div class="hdr">${this._config.name}</div>
          <div class="body">
            <div class="console-row">
              <div class="ps-logo">PS5</div>
              <div class="console-info">
                <div class="console-name" id="con-name">${this._config.name}</div>
                <div class="console-sub"  id="con-sub">${on ? 'Active' : off ? 'Standby' : 'Unavailable'}</div>
              </div>
              <div class="status-badge" id="status-badge"
                   style="color:${meta.color};background:${meta.bg};border:1px solid ${meta.border}">
                ${label}
              </div>
            </div>
            <div class="game" id="game-tile">
              <div class="game-icon">🎮</div>
              <div class="game-info">
                <div class="game-title" id="game-title">${game || app || (on ? 'Home screen' : '—')}</div>
                <div class="game-sub"   id="game-sub">${on && (game||app) ? 'Playing now' : ''}</div>
              </div>
            </div>
            <div class="btn-row">
              <div class="action-btn wake ha-tappable${!off ? ' disabled' : ''}" id="btn-wake">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Wake
              </div>
              <div class="action-btn off ha-tappable${!on ? ' disabled' : ''}" id="btn-off">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/>
                  <line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                Turn Off
              </div>
            </div>
          </div>
        </div>
      </ha-card>`;
    this._attachListeners();
  }

  _attachListeners() {
    this.shadowRoot.getElementById('btn-wake')?.addEventListener('click', () => this._call('turn_on', 'wake'));
    this.shadowRoot.getElementById('btn-off')?.addEventListener('click',  () => this._call('turn_off', 'off'));
  }

  _patch() {
    const root   = this.shadowRoot;
    const on     = this._isOn();
    const off    = this._isOff();
    const game   = this._game();
    const app    = this._app();
    const meta   = this._stateMeta();
    const label  = this._stateLabel();

    const badge   = root.getElementById('status-badge');
    const sub     = root.getElementById('con-sub');
    const gameEl  = root.getElementById('game-title');
    const gameSub = root.getElementById('game-sub');
    const wakeBtn = root.getElementById('btn-wake');
    const offBtn  = root.getElementById('btn-off');

    if (badge) {
      badge.textContent = label;
      badge.style.cssText = `color:${meta.color};background:${meta.bg};border:1px solid ${meta.border}`;
    }
    if (sub)     sub.textContent     = on ? 'Active' : off ? 'Standby' : 'Unavailable';
    if (gameEl)  gameEl.textContent  = game || app || (on ? 'Home screen' : '—');
    if (gameSub) gameSub.textContent = on && (game||app) ? 'Playing now' : '';
    if (wakeBtn) wakeBtn.classList.toggle('disabled', !off);
    if (offBtn)  offBtn.classList.toggle('disabled', !on);
  }
}

customElements.define('ps5-card', Ps5Card);
