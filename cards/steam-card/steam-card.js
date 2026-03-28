/**
 * steam-card.js  —  v2
 * Steam online status card for Home Assistant Lovelace.
 *
 * Shows online status and current game per Steam account using the
 * built-in HA Steam integration (no HACS needed).
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. HA → Settings → Integrations → Add → Steam
 *    Get a free API key at: https://steamcommunity.com/dev/apikey
 * 2. Copy to /config/www/cards/steam-card/steam-card.js
 * 3. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/steam-card/steam-card.js
 *      Type: JavaScript Module
 *
 * ── SENSOR ATTRIBUTES ─────────────────────────────────────────────────────────
 * Each Steam sensor exposes:
 *   state:          online | in_game | offline
 *   attributes:
 *     game:         current game title (when in_game)
 *     game_id:      Steam app ID
 *     profile_name: display name
 *     last_online:  ISO timestamp
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:steam-card
 * accounts:
 *   - entity: sensor.steam_123456789
 *     name: John           # optional — falls back to profile_name attribute
 *   - entity: sensor.steam_987654321
 *     name: Friend
 */

import { COLORS, getVal, getAttr } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_BADGE } from '../../shared/ha-styles.js';

const STATE_META = {
  in_game: { label: 'In Game', color: '#60a5fa', bg: 'rgba(96,165,250,.08)',   border: 'rgba(96,165,250,.25)' },
  online:  { label: 'Online',  color: '#4ade80', bg: 'rgba(74,222,128,.06)',   border: 'rgba(74,222,128,.20)' },
  offline: { label: 'Offline', color: 'rgba(255,255,255,.3)', bg: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.10)' },
};

class SteamCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  static getStubConfig() {
    return {
      accounts: [
        { entity: 'sensor.steam_123456789', name: 'Player 1' },
      ],
    };
  }
  static getConfigForm() {
    return {
      schema: [],
      assertCustomElement: 'steam-card',
    };
  }


  setConfig(c) {
    if (!c.accounts?.length) throw new Error('steam-card: accounts required');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 2 + Math.ceil(this._config.accounts.length / 1); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _accountState(entity) {
    const e = this._hass?.states[entity];
    if (!e) return null;
    const raw   = e.state || 'offline';
    const state = raw === 'playing' ? 'in_game' : raw;   // normalise HA variants
    return {
      state,
      meta:        STATE_META[state] || STATE_META.offline,
      game:        e.attributes.game || null,
      profileName: e.attributes.profile_name || null,
      lastOnline:  e.attributes.last_online || null,
    };
  }

  _timeAgo(iso) {
    if (!iso) return null;
    const d    = new Date(iso);
    if (isNaN(d)) return null;
    const diff = Math.round((Date.now() - d) / 60000);
    if (diff < 1)    return 'just now';
    if (diff < 60)   return `${diff}m ago`;
    if (diff < 1440) return `${Math.round(diff/60)}h ago`;
    return `${Math.round(diff/1440)}d ago`;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _css() {
    return `${CSS_RESET}${CSS_BADGE}
      ha-card { padding: 0; }
      .wrap { border-radius: 10px; overflow: hidden; }
      .hdr  { font-size: 17px; font-weight: 700; color: white; letter-spacing: -.2px;
              padding: 10px 14px 9px; border-bottom: 1.5px solid rgba(255,255,255,.28); }
      .account { display: flex; align-items: center; gap: 10px; padding: 10px 14px; min-height: 52px; }
      .account + .account { border-top: 1px solid rgba(255,255,255,.07); }
      .avatar { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center; font-size: 15px; }
      .avatar.in_game { background: rgba(96,165,250,.12); border: 1px solid rgba(96,165,250,.25); }
      .avatar.online  { background: rgba(74,222,128,.10); border: 1px solid rgba(74,222,128,.20); }
      .avatar.offline { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10); }
      .info { flex: 1; min-width: 0; }
      .name { font-size: 13px; font-weight: 700; color: #e2e8f0; }
      .sub  { font-size: 10px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub.game    { color: #60a5fa; }
      .sub.meta    { color: rgba(255,255,255,.35); }
      .status-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
                      text-transform: uppercase; letter-spacing: .05em; flex-shrink: 0; }
    `;
  }

  // ── Row HTML ───────────────────────────────────────────────────────────────

  _rowHtml(acc, s) {
    const name = acc.name || s?.profileName || acc.entity.split('.').pop();
    if (!s) {
      return `<div class="account" id="acc-${acc.entity.replace(/\./g,'_')}">
        <div class="avatar offline">👤</div>
        <div class="info">
          <div class="name">${name}</div>
          <div class="sub meta">Unavailable</div>
        </div>
        <div class="status-badge" style="color:rgba(255,255,255,.25);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)">—</div>
      </div>`;
    }
    const inGame  = s.state === 'in_game';
    const offline = s.state === 'offline';
    const subText = inGame  ? s.game
                  : offline ? (s.lastOnline ? `Last seen ${this._timeAgo(s.lastOnline)}` : 'Offline')
                  : 'Online';
    const subCls  = inGame ? 'game' : 'meta';

    return `<div class="account" id="acc-${acc.entity.replace(/\./g,'_')}">
      <div class="avatar ${s.state}">👤</div>
      <div class="info">
        <div class="name">${name}</div>
        <div class="sub ${subCls}">${subText || ''}</div>
      </div>
      <div class="status-badge"
           style="color:${s.meta.color};background:${s.meta.bg};border:1px solid ${s.meta.border}">
        ${s.meta.label}
      </div>
    </div>`;
  }

  // ── Render / Patch ─────────────────────────────────────────────────────────

  _render() {
    const rows = this._config.accounts
      .map(acc => this._rowHtml(acc, this._accountState(acc.entity)))
      .join('');

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap">
          <div class="hdr">Steam</div>
          <div id="accounts">${rows}</div>
        </div>
      </ha-card>`;
  }

  _patch() {
    this._config.accounts.forEach(acc => {
      const id  = `acc-${acc.entity.replace(/\./g,'_')}`;
      const el  = this.shadowRoot.getElementById(id);
      if (!el) return;
      const s   = this._accountState(acc.entity);
      const tmp = document.createElement('div');
      tmp.innerHTML = this._rowHtml(acc, s);
      const newEl = tmp.firstElementChild;
      if (newEl) el.replaceWith(newEl);
    });
  }
}

customElements.define('steam-card', SteamCard);
