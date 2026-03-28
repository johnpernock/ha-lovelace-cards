/**
 * appletv-remote-card.js  —  v3
 * Apple TV remote card for Home Assistant Lovelace.
 *
 * Multi-ATV selector tabs, 200px D-pad, 2×4 navigation/playback buttons,
 * volume slider, sleep/power button, now-playing strip.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/appletv-remote-card/appletv-remote-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/appletv-remote-card/appletv-remote-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:appletv-remote-card
 * apple_tvs:
 *   - name: Family Room
 *     media_player: media_player.family_room_apple_tv
 *     remote: remote.family_room_apple_tv
 *   - name: Bedroom
 *     media_player: media_player.bedroom_apple_tv
 *     remote: remote.bedroom_apple_tv
 *   - name: Office
 *     media_player: media_player.office_apple_tv
 *     remote: remote.office_apple_tv
 */

import { COLORS, getVal, getAttr } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_BADGE, CSS_SECTION } from '../../shared/ha-styles.js';

class AppleTvRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config      = {};
    this._hass        = null;
    this._idx         = 0;       // active ATV index
    this._busy        = {};      // busy lock per command
    this._volTimer    = null;    // debounce volume slider
    this._docMoveHandler = null; // stored for cleanup
    this._docUpHandler   = null;
  }

  static getStubConfig() {
    return {
      apple_tvs: [
        { name: 'Family Room', media_player: 'media_player.family_room',    remote: 'remote.family_room' },
        { name: 'Bedroom',     media_player: 'media_player.master_bedroom', remote: 'remote.master_bedroom' },
        { name: 'Office',      media_player: 'media_player.office',         remote: 'remote.office' },
      ],
    };
  }
  static getConfigForm() {
    return {
      schema: [],
      assertCustomElement: 'appletv-remote-card',
    };
  }


  setConfig(c) {
    if (!c.apple_tvs?.length) throw new Error('appletv-remote-card: apple_tvs required');
    this._config = c;
    this._idx = 0;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 7; }

  disconnectedCallback() {
    if (this._volTimer) clearTimeout(this._volTimer);
    if (this._docMoveHandler) {
      document.removeEventListener('mousemove', this._docMoveHandler);
      document.removeEventListener('touchmove', this._docMoveHandler);
    }
    if (this._docUpHandler) {
      document.removeEventListener('mouseup',  this._docUpHandler);
      document.removeEventListener('touchend', this._docUpHandler);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _atv()       { return this._config.apple_tvs[this._idx] || this._config.apple_tvs[0]; }
  _mp()        { return this._atv().media_player; }
  _remote()    { return this._atv().remote; }
  _state()     { return this._hass?.states[this._mp()]; }
  _playing()   { return ['playing','paused'].includes(this._state()?.state); }
  _isPlaying() { return this._state()?.state === 'playing'; }
  _unavail()   {
    const s = this._state()?.state;
    return !s || s === 'unavailable' || s === 'unknown';
  }

  _mediaTitle() {
    const s = this._state();
    if (!s) return null;
    const a = s.attributes;
    return a.media_title || a.media_series_title || null;
  }

  _mediaSub() {
    const s = this._state();
    if (!s) return null;
    const a = s.attributes;
    const parts = [];
    if (a.app_name) parts.push(a.app_name);
    if (a.media_series_title && a.media_title && a.media_title !== a.media_series_title)
      parts.push(a.media_title);
    if (a.media_season != null && a.media_episode_number != null)
      parts.push(`S${String(a.media_season).padStart(2,'0')}E${String(a.media_episode_number).padStart(2,'0')}`);
    return parts.join(' · ') || null;
  }

  _volume() {
    const v = this._state()?.attributes?.volume_level;
    return v != null ? Math.round(v * 100) : null;
  }

  // ── Service calls ─────────────────────────────────────────────────────────

  async _remoteCmd(cmd) {
    if (this._busy[cmd]) return;
    this._busy[cmd] = true;
    try {
      await this._hass.callService('remote', 'send_command', {
        entity_id: this._remote(),
        command: cmd,
      });
    } catch (e) { console.warn('appletv-remote-card: remote cmd failed', cmd, e); }
    setTimeout(() => { this._busy[cmd] = false; }, 600);
  }

  async _mediaCmd(service, data = {}) {
    const key = service;
    if (this._busy[key]) return;
    this._busy[key] = true;
    try {
      await this._hass.callService('media_player', service, { entity_id: this._mp(), ...data });
    } catch (e) { console.warn('appletv-remote-card: media_player call failed', service, e); }
    setTimeout(() => { this._busy[key] = false; }, 800);
  }

  _setVolume(pct) {
    if (this._volTimer) clearTimeout(this._volTimer);
    this._volTimer = setTimeout(() => {
      this._mediaCmd('volume_set', { volume_level: pct / 100 });
    }, 150);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _css() {
    return `${CSS_RESET}${CSS_TAPPABLE}${CSS_BADGE}${CSS_SECTION}
      ha-card { padding: 0; }
      .wrap { border-radius: 10px; overflow: hidden; }
      .hdr  { font-size: 17px; font-weight: 700; color: white; letter-spacing: -.2px;
              padding: 10px 14px 9px; border-bottom: 1.5px solid rgba(255,255,255,.28); }
      /* ATV selector tabs */
      .tabs { display: flex; gap: 5px; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,.07); }
      .tab  { flex: 1; height: 32px; border-radius: 7px; display: flex; align-items: center;
              justify-content: center; font-size: 11px; font-weight: 700;
              background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10);
              color: rgba(255,255,255,.4); cursor: pointer; user-select: none;
              -webkit-tap-highlight-color: transparent; transition: transform .1s, filter .12s; }
      .tab:active { transform: scale(.96); filter: brightness(.88); }
      .tab.active { background: rgba(96,165,250,.12); border-color: rgba(96,165,250,.35); color: #60a5fa; }
      /* Now playing strip */
      .np { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
      .np-art { width: 36px; height: 36px; border-radius: 6px; flex-shrink: 0;
                background: rgba(96,165,250,.10); border: 1px solid rgba(96,165,250,.20);
                display: flex; align-items: center; justify-content: center; }
      .np-info { flex: 1; min-width: 0; }
      .np-title { font-size: 13px; font-weight: 700; color: #e2e8f0;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .np-sub   { font-size: 10px; color: rgba(255,255,255,.4); margin-top: 2px;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Unavailable banner */
      .unavail-banner { display:flex;align-items:center;gap:8px;margin:8px 14px 6px;padding:7px 10px;
        border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08); }
      .unavail-dot  { width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.2);flex-shrink:0; }
      .unavail-text { font-size:11px;color:rgba(255,255,255,.3);font-style:italic; }
      /* Inactive transport controls */
      .btn-row.ctrl-inactive { opacity:.3;pointer-events:none; }
      /* Badge variants */
      .np-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
                  text-transform: uppercase; letter-spacing: .05em; flex-shrink: 0; }
      .np-badge.playing { background: rgba(74,222,128,.08); border: 1px solid rgba(74,222,128,.25); color: #4ade80; }
      .np-badge.paused  { background: rgba(251,191,36,.08);  border: 1px solid rgba(251,191,36,.25);  color: #fbbf24; }
      .np-badge.idle    { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.35); }
      /* D-pad */
      .dpd-wrap { display: flex; justify-content: center; padding: 12px 14px 8px; }
      .dpd { width: 200px; height: 200px; position: relative; flex-shrink: 0; }
      .dpd-ring { width: 200px; height: 200px; border-radius: 50%;
                  background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.12); position: absolute; }
      .dpd-center { width: 72px; height: 72px; border-radius: 50%;
                    background: rgba(255,255,255,.07); border: 1.5px solid rgba(255,255,255,.15);
                    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none;
                    transition: transform .1s, filter .12s; }
      .dpd-center:active { transform: translate(-50%,-50%) scale(.94); filter: brightness(.85); }
      .dpd-center span { font-size: 14px; font-weight: 700; color: rgba(255,255,255,.7); }
      .dpd-arrow { position: absolute; display: flex; align-items: center; justify-content: center;
                   width: 76px; height: 76px;
                   cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none;
                   transition: filter .12s; color: rgba(255,255,255,.5); font-size: 15px; }
      .dpd-arrow:active { filter: brightness(.65); }
      .dpd-arrow.up { top: 4px; left: 50%; transform: translateX(-50%); }
      .dpd-arrow.dn { bottom: 4px; left: 50%; transform: translateX(-50%); }
      .dpd-arrow.lt { left: 4px; top: 50%; transform: translateY(-50%); }
      .dpd-arrow.rt { right: 4px; top: 50%; transform: translateY(-50%); }
      /* Button rows */
      .btn-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; padding: 0 14px 6px; }
      .fpip { height: 44px; border-radius: 8px; background: rgba(255,255,255,.04);
              border: 1px solid rgba(255,255,255,.10); display: flex; align-items: center;
              justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent;
              user-select: none; transition: transform .1s, filter .12s;
              color: rgba(255,255,255,.55); font-size: 12px; font-weight: 600; }
      .fpip:active { transform: scale(.96); filter: brightness(.88); }
      /* Volume */
      .vol-row { display: flex; align-items: center; gap: 8px; padding: 4px 14px 8px; }
      .vol-btn { min-width: 44px; height: 44px; border-radius: 8px;
                 background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10);
                 display: flex; align-items: center; justify-content: center;
                 cursor: pointer; -webkit-tap-highlight-color: transparent;
                 user-select: none; transition: transform .1s, filter .12s;
                 color: rgba(255,255,255,.55); font-size: 18px; flex-shrink: 0; }
      .vol-btn:active { transform: scale(.96); filter: brightness(.88); }
      .vol-wrap { flex: 1; padding: 14px 0; cursor: pointer; touch-action: none; user-select: none; }
      .vol-track { height: 5px; background: rgba(255,255,255,.10); border-radius: 99px; position: relative; }
      .vol-fill  { height: 100%; background: rgba(255,255,255,.5); border-radius: 99px; transition: width .1s; }
      .vol-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff;
                   position: absolute; top: 50%; transform: translate(-50%,-50%);
                   border: 2px solid rgba(255,255,255,.35); transition: left .1s; }
      /* Power */
      .power-wrap { padding: 2px 14px 12px; }
      .power-btn  { width: 100%; height: 44px; border-radius: 8px;
                    background: rgba(248,113,113,.06); border: 1px solid rgba(248,113,113,.25);
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    cursor: pointer; -webkit-tap-highlight-color: transparent;
                    user-select: none; transition: transform .1s, filter .12s;
                    color: #f87171; font-size: 12px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: .05em; }
      .power-btn:active { transform: scale(.98); filter: brightness(.88); }
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    const atvs   = this._config.apple_tvs || [];
    const title  = this._mediaTitle();
    const sub    = this._mediaSub();
    const vol    = this._volume();
    const state  = this._state()?.state;
    const playing = state === 'playing';
    const paused  = state === 'paused';
    const active  = playing || paused;
    const unavail  = this._unavail();
    const badgeCls = playing ? 'playing' : paused ? 'paused' : unavail ? 'unavail' : 'idle';
    const badgeTxt = playing ? 'Playing' : paused ? 'Paused' : unavail ? 'Unavailable' : 'Idle';
    const volPct = vol ?? 50;

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap">
          <div class="hdr">Apple TV</div>
          <div class="tabs">
            ${atvs.map((a,i) => `<div class="tab ha-tappable${i===this._idx?' active':''}" data-idx="${i}">${a.name}</div>`).join('')}
          </div>
          ${this._unavail() ? `
            <div class="unavail-banner">
              <div class="unavail-dot"></div>
              <div class="unavail-text">${this._atv().name} unavailable</div>
            </div>` : ''}
          <div class="np" id="np">
            <div class="np-art">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8">
                ${playing
                  ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
                  : '<polygon points="5 3 19 12 5 21 5 3"/>'}
              </svg>
            </div>
            <div class="np-info">
              <div class="np-title" id="np-title">${title || (active ? 'Unknown' : this._atv().name)}</div>
              <div class="np-sub"   id="np-sub">${sub || (active ? '' : 'Not playing')}</div>
            </div>
            <div class="np-badge ${badgeCls}" id="np-badge">${badgeTxt}</div>
          </div>
          <div class="dpd-wrap">
            <div class="dpd">
              <div class="dpd-ring"></div>
              <div class="dpd-arrow up ha-tappable" data-cmd="up">▲</div>
              <div class="dpd-arrow dn ha-tappable" data-cmd="down">▼</div>
              <div class="dpd-arrow lt ha-tappable" data-cmd="left">◀</div>
              <div class="dpd-arrow rt ha-tappable" data-cmd="right">▶</div>
              <div class="dpd-center" id="dpd-ok"><span>OK</span></div>
            </div>
          </div>
          <div class="btn-row${unavail ? ' ctrl-inactive' : ''}">
            <div class="fpip ha-tappable" data-cmd="menu">Menu</div>
            <div class="fpip ha-tappable" data-cmd="back">Back</div>
            <div class="fpip ha-tappable" data-cmd="home_hold">Home</div>
            <div class="fpip ha-tappable" data-media="media_play_pause">⏯</div>
          </div>
          <div class="btn-row${unavail ? ' ctrl-inactive' : ''}" style="padding-bottom:8px">
            <div class="fpip ha-tappable" data-media="media_previous_track">⏮</div>
            <div class="fpip ha-tappable" data-media="media_next_track">⏭</div>
            <div class="fpip ha-tappable" data-cmd="volume_up">Vol+</div>
            <div class="fpip ha-tappable" data-cmd="volume_down">Vol−</div>
          </div>
          <div class="vol-row">
            <div class="vol-btn ha-tappable" id="vol-dn">−</div>
            <div class="vol-wrap" id="vol-wrap">
              <div class="vol-track">
                <div class="vol-fill"  id="vol-fill"  style="width:${volPct}%"></div>
                <div class="vol-thumb" id="vol-thumb" style="left:${volPct}%"></div>
              </div>
            </div>
            <div class="vol-btn ha-tappable" id="vol-up">+</div>
          </div>
          <div class="power-wrap">
            <div class="power-btn ha-tappable" id="btn-sleep">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
              Sleep / Power
            </div>
          </div>
        </div>
      </ha-card>`;
    this._attachListeners();
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  _attachListeners() {
    const root = this.shadowRoot;

    // ATV tab selector
    root.querySelector('.tabs')?.addEventListener('click', e => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      this._idx = parseInt(tab.dataset.idx, 10);
      this._render();
    });

    // D-pad arrows
    root.querySelectorAll('[data-cmd]').forEach(el => {
      el.addEventListener('click', () => this._remoteCmd(el.dataset.cmd));
    });

    // D-pad center OK
    root.getElementById('dpd-ok')?.addEventListener('click', () => this._remoteCmd('select'));

    // Media player buttons
    root.querySelectorAll('[data-media]').forEach(el => {
      el.addEventListener('click', () => this._mediaCmd(el.dataset.media));
    });

    // Volume slider (drag)
    const wrap  = root.getElementById('vol-wrap');
    const fill  = root.getElementById('vol-fill');
    const thumb = root.getElementById('vol-thumb');
    if (wrap && fill && thumb) {
      let dragging = false;
      const calc = (clientX) => {
        const rect = wrap.getBoundingClientRect();
        const pct = Math.round(Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)));
        fill.style.width = pct + '%';
        thumb.style.left = pct + '%';
        this._setVolume(pct);
      };
      const start = e => { dragging = true; calc(e.touches ? e.touches[0].clientX : e.clientX); };
      const move  = e => { if (!dragging) return; calc(e.touches ? e.touches[0].clientX : e.clientX); };
      const end   = () => { dragging = false; };
      wrap.addEventListener('mousedown',  start);
      wrap.addEventListener('touchstart', start, { passive: true });
      // Store on instance so disconnectedCallback can remove them
      if (this._docMoveHandler) {
        document.removeEventListener('mousemove', this._docMoveHandler);
        document.removeEventListener('touchmove', this._docMoveHandler);
        document.removeEventListener('mouseup',   this._docUpHandler);
        document.removeEventListener('touchend',  this._docUpHandler);
      }
      this._docMoveHandler = move;
      this._docUpHandler   = end;
      document.addEventListener('mousemove',  move);
      document.addEventListener('touchmove',  move, { passive: true });
      document.addEventListener('mouseup',    end);
      document.addEventListener('touchend',   end);
    }

    // Vol +/- buttons
    root.getElementById('vol-up')?.addEventListener('click', () => {
      const cur = this._volume() ?? 50;
      this._setVolume(Math.min(100, cur + 10));
    });
    root.getElementById('vol-dn')?.addEventListener('click', () => {
      const cur = this._volume() ?? 50;
      this._setVolume(Math.max(0, cur - 10));
    });

    // Sleep / power
    root.getElementById('btn-sleep')?.addEventListener('click', () => this._mediaCmd('turn_off'));
  }

  // ── Patch ──────────────────────────────────────────────────────────────────

  _patch() {
    const root     = this.shadowRoot;
    const title    = this._mediaTitle();
    const sub      = this._mediaSub();
    const vol      = this._volume();
    const state    = this._state()?.state;
    const playing  = state === 'playing';
    const paused   = state === 'paused';
    const active   = playing || paused;
    const unavail  = this._unavail();
    const badgeCls = playing ? 'playing' : paused ? 'paused' : unavail ? 'unavail' : 'idle';
    const badgeTxt = playing ? 'Playing' : paused ? 'Paused' : unavail ? 'Unavailable' : 'Idle';

    const titleEl = root.getElementById('np-title');
    const subEl   = root.getElementById('np-sub');
    const badge   = root.getElementById('np-badge');
    const fill    = root.getElementById('vol-fill');
    const thumb   = root.getElementById('vol-thumb');

    if (titleEl) titleEl.textContent = title || (active ? 'Unknown' : this._atv().name);
    if (subEl)   subEl.textContent   = sub   || (active ? '' : 'Not playing');
    if (badge) {
      badge.textContent = badgeTxt;
      badge.className   = `np-badge ${badgeCls}`;
    }
    if (fill  && vol != null) fill.style.width  = vol + '%';
    if (thumb && vol != null) thumb.style.left  = vol + '%';
  }
}

customElements.define('appletv-remote-card', AppleTvRemoteCard);
