/**
 * homepod-music-card.js  —  v3
 * HomePod speaker group + music control card for Home Assistant Lovelace.
 *
 * Sections:
 *   Now Playing  — album art placeholder, title, artist, source badge, progress, transport
 *   Speakers     — per-speaker toggle (join/unjoin group) + individual volume + group master vol
 *   Favorites    — configurable playlist tiles (name + emoji icon)
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/homepod-music-card/homepod-music-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/homepod-music-card/homepod-music-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:homepod-music-card
 * speakers:
 *   - entity: media_player.family_room_homepod
 *     name: Family Room
 *   - entity: media_player.kitchen_homepod
 *     name: Kitchen
 *   - entity: media_player.bedroom_homepod
 *     name: Bedroom
 * favorites:
 *   - name: Morning
 *     icon: 🌅
 *     media_content_id: "music://playlist/morning"
 *     media_content_type: music           # optional, defaults to music
 *   - name: Focus
 *     icon: 🎯
 *     media_content_id: "music://playlist/focus"
 *
 * Notes:
 *   - The first speaker in the list is treated as the group coordinator.
 *   - Toggling a speaker ON calls media_player.join targeting the coordinator.
 *   - Toggling a speaker OFF calls media_player.unjoin on that speaker.
 *   - Group volume adjusts all currently-grouped speakers proportionally.
 */

import { COLORS, getVal, getAttr, getNum, isUnavailable } from '../../shared/ha-utils.js';
import { CSS_RESET, CSS_TAPPABLE, CSS_BADGE, CSS_SECTION, CSS_SLIDER } from '../../shared/ha-styles.js';

class HomepodMusicCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config      = {};
    this._hass        = null;
    this._busy        = {};
    this._volTimers   = {};   // debounce per speaker + group
    this._progTimer   = null; // progress bar animation
    this._progStart   = null; // timestamp when progress snapshot taken
    this._progPct     = 0;    // last known progress %
    this._docHandlers = [];   // stored for cleanup: [{move, up}]
  }

  static getStubConfig() {
    return {
      speakers: [
        { entity: 'media_player.family_room_hp',    name: 'Family Room' },
        { entity: 'media_player.master_bedroom_hp', name: 'Master Bedroom' },
        { entity: 'media_player.dining_hp',         name: 'Dining Room' },
      ],
      favorites: [
        { name: 'Morning', icon: '🌅', media_content_id: 'music://playlist/morning' },
        { name: 'Focus',   icon: '🎯', media_content_id: 'music://playlist/focus' },
      ],
    };
  }
  static getConfigForm() {
    return {
      schema: [],
      assertCustomElement: 'homepod-music-card',
    };
  }


  setConfig(c) {
    if (!c.speakers?.length) throw new Error('homepod-music-card: speakers required');
    this._config = { favorites: [], ...c };
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 8; }

  disconnectedCallback() {
    Object.values(this._volTimers).forEach(clearTimeout);
    if (this._progTimer) clearInterval(this._progTimer);
    this._docHandlers.forEach(({ move, up }) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('mouseup',   up);
      document.removeEventListener('touchend',  up);
    });
    this._docHandlers = [];
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _coordinator()  { return this._config.speakers[0]; }
  _coordState()   { return this._hass?.states[this._coordinator().entity]; }
  _spkState(e)    { return this._hass?.states[e]; }

  _isGrouped(entity) {
    // A speaker is "in group" if its state is playing/paused AND
    // it appears in the coordinator's group_members or IS the coordinator
    if (entity === this._coordinator().entity) return this._isActive(entity);
    const members = this._coordState()?.attributes?.group_members || [];
    return members.includes(entity) && this._isActive(entity);
  }

  _isActive(entity) {
    const s = this._spkState(entity)?.state;
    return s === 'playing' || s === 'paused';
  }

  _mediaTitle() {
    const a = this._coordState()?.attributes || {};
    return a.media_title || null;
  }

  _mediaArtist() {
    const a = this._coordState()?.attributes || {};
    return a.media_artist || a.media_album_name || null;
  }

  _mediaSource() {
    const a = this._coordState()?.attributes || {};
    return a.app_name || a.source || null;
  }

  _isPlaying() { return this._coordState()?.state === 'playing'; }
  _isShuffled() { return this._coordState()?.attributes?.shuffle === true; }
  _repeatMode() { return this._coordState()?.attributes?.repeat || 'off'; }

  _volume(entity) {
    const v = this._spkState(entity)?.attributes?.volume_level;
    return v != null ? Math.round(v * 100) : null;
  }

  _mediaPos()      { return this._coordState()?.attributes?.media_position ?? null; }
  _mediaDuration() { return this._coordState()?.attributes?.media_duration ?? null; }
  _lastUpdated()   { return this._coordState()?.attributes?.media_position_updated_at ?? null; }

  _progressPct() {
    const pos = this._mediaPos();
    const dur = this._mediaDuration();
    if (pos == null || !dur) return 0;
    const elapsed = this._isPlaying()
      ? pos + (Date.now() - new Date(this._lastUpdated()).getTime()) / 1000
      : pos;
    return Math.min(100, Math.round(elapsed / dur * 100));
  }

  _fmtTime(s) {
    if (s == null) return '—';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  _groupVolume() {
    const vols = this._config.speakers
      .filter(s => this._isGrouped(s.entity))
      .map(s => this._volume(s.entity))
      .filter(v => v != null);
    return vols.length ? Math.round(vols.reduce((a,b) => a+b, 0) / vols.length) : null;
  }

  _groupedCount() {
    return this._config.speakers.filter(s => this._isGrouped(s.entity)).length;
  }

  _coordUnavail() {
    const s = this._coordState()?.state;
    return !s || s === 'unavailable' || s === 'unknown';
  }

  // toggle should be disabled when: nothing playing AND speaker is not already grouped
  // (keeps toggle enabled if already grouped so user can dissolve)
  _togDisabled(entity) {
    const active = this._isActive(entity);
    const grouped = this._isGrouped(entity);
    return !active && !grouped;
  }

  // ── Service calls ─────────────────────────────────────────────────────────

  async _mediaCmd(service, data = {}, lockKey = null) {
    const key = lockKey || service;
    if (this._busy[key]) return;
    this._busy[key] = true;
    try {
      await this._hass.callService('media_player', service, {
        entity_id: this._coordinator().entity, ...data,
      });
    } catch(e) { console.warn('homepod-music-card:', service, e); }
    setTimeout(() => { this._busy[key] = false; }, 800);
  }

  async _toggleSpeaker(entity) {
    const key = 'spk_' + entity;
    if (this._busy[key]) return;
    this._busy[key] = true;
    try {
      if (this._isGrouped(entity) && entity !== this._coordinator().entity) {
        await this._hass.callService('media_player', 'unjoin', { entity_id: entity });
      } else if (!this._isGrouped(entity)) {
        await this._hass.callService('media_player', 'join', {
          entity_id: this._coordinator().entity,
          group_members: [entity],
        });
      }
    } catch(e) { console.warn('homepod-music-card: toggle speaker', entity, e); }
    setTimeout(() => { this._busy[key] = false; }, 1000);
  }

  _debounceVolume(key, entity, pct) {
    if (this._volTimers[key]) clearTimeout(this._volTimers[key]);
    this._volTimers[key] = setTimeout(async () => {
      try {
        await this._hass.callService('media_player', 'volume_set', {
          entity_id: entity, volume_level: pct / 100,
        });
      } catch(e) { console.warn('homepod-music-card: volume_set', entity, e); }
    }, 150);
  }

  _setGroupVolume(pct) {
    const grouped = this._config.speakers.filter(s => this._isGrouped(s.entity));
    grouped.forEach(s => this._debounceVolume('gvol', s.entity, pct));
  }

  async _playFavorite(fav) {
    const key = 'fav_' + fav.media_content_id;
    if (this._busy[key]) return;
    this._busy[key] = true;
    try {
      await this._hass.callService('media_player', 'play_media', {
        entity_id: this._coordinator().entity,
        media_content_id:   fav.media_content_id,
        media_content_type: fav.media_content_type || 'music',
      });
    } catch(e) { console.warn('homepod-music-card: play_media', fav, e); }
    setTimeout(() => { this._busy[key] = false; }, 1500);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _css() {
    return `${CSS_RESET}${CSS_TAPPABLE}${CSS_SECTION}${CSS_SLIDER}
      ha-card { padding: 0; }
      .wrap { border-radius: 10px; overflow: hidden; }
      .hdr  { font-size: 17px; font-weight: 700; color: white; letter-spacing: -.2px;
              padding: 10px 14px 9px; border-bottom: 1.5px solid rgba(255,255,255,.28); }
      .divider { height: 1px; background: rgba(255,255,255,.07); }
      /* Now playing */
      .np { display: flex; align-items: center; gap: 10px; padding: 12px 14px 8px; }
      .np-art { width: 44px; height: 44px; border-radius: 8px; flex-shrink: 0;
                background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10);
                display: flex; align-items: center; justify-content: center; font-size: 20px; }
      .np-info { flex: 1; min-width: 0; }
      .np-title  { font-size: 13px; font-weight: 700; color: #e2e8f0;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .np-artist { font-size: 11px; color: rgba(255,255,255,.4); margin-top: 2px;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .np-source { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 4px;
                   text-transform: uppercase; letter-spacing: .05em; margin-top: 4px; display: inline-block;
                   background: rgba(250,83,53,.10); border: 1px solid rgba(250,83,53,.25); color: #fa5335; }
      /* Progress */
      .prog { padding: 4px 14px 6px; }
      .prog-track { height: 3px; background: rgba(255,255,255,.10); border-radius: 99px; position: relative; margin-bottom: 3px; }
      .prog-fill  { height: 100%; background: rgba(255,255,255,.4); border-radius: 99px; transition: width .5s linear; }
      .prog-times { display: flex; justify-content: space-between; }
      .prog-t     { font-size: 9px; color: rgba(255,255,255,.3); }
      /* Transport */
      .transport { display: grid; grid-template-columns: repeat(5,1fr); gap: 6px; padding: 4px 14px 10px; }
      .tbtn { height: 44px; border-radius: 8px; background: rgba(255,255,255,.04);
              border: 1px solid rgba(255,255,255,.10); display: flex; align-items: center;
              justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent;
              user-select: none; transition: transform .1s, filter .12s;
              color: rgba(255,255,255,.55); font-size: 14px; }
      .tbtn:active { transform: scale(.96); filter: brightness(.88); }
      .tbtn.active { background: rgba(96,165,250,.10); border-color: rgba(96,165,250,.3); color: #60a5fa; }
      /* Speakers */
      .spk { display: flex; align-items: center; gap: 10px; padding: 8px 14px; min-height: 44px;
             cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none;
             transition: filter .12s; }
      .spk:active { filter: brightness(.88); }
      .spk + .spk { border-top: 1px solid rgba(255,255,255,.06); }
      .spk-name { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.4); flex-shrink: 0; width: 88px; }
      .spk.on .spk-name { color: #e2e8f0; }
      .spk-vol-track { flex: 1; height: 3px; background: rgba(255,255,255,.10); border-radius: 99px; position: relative; }
      .spk-vol-fill  { height: 100%; border-radius: 99px; background: #60a5fa; }
      .spk-vol-pct   { font-size: 10px; color: rgba(255,255,255,.25); width: 28px; text-align: right; flex-shrink: 0; }
      .spk.on .spk-vol-pct { color: rgba(96,165,250,.7); }
      .tog { width: 34px; height: 19px; border-radius: 99px; flex-shrink: 0;
             background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
             position: relative; transition: background .15s, border-color .15s; }
      .tog.on { background: rgba(96,165,250,.25); border-color: rgba(96,165,250,.5); }
      .tog-dot { width: 13px; height: 13px; border-radius: 50%; background: rgba(255,255,255,.3);
                 position: absolute; top: 2px; left: 2px; transition: left .15s, background .15s; }
      .tog.on .tog-dot { left: 19px; background: #60a5fa; }
      /* Disabled toggle — nothing playing and not grouped */
      .spk.tog-disabled { pointer-events: none; }
      .spk.tog-disabled .tog { opacity: .25; }
      .spk.tog-disabled .spk-name { opacity: .4; }
      .spk.tog-disabled .spk-vol-pct { opacity: .4; }
      /* Group volume — dimmed when solo (no group active) */
      .gvol.gvol-solo { opacity: .35; pointer-events: none; }
      /* Unavailable — coordinator entity not available */
      .unavail-banner { display: flex; align-items: center; gap: 8px;
        margin: 10px 14px 8px; padding: 8px 10px; border-radius: 8px;
        background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); }
      .unavail-dot { width: 6px; height: 6px; border-radius: 50%;
        background: rgba(255,255,255,.2); flex-shrink: 0; }
      .unavail-text { font-size: 11px; color: rgba(255,255,255,.3); font-style: italic; }
      /* Group volume */
      .gvol { display: flex; align-items: center; gap: 8px; padding: 8px 14px 10px;
              border-top: 1px solid rgba(255,255,255,.06); }
      .gvol-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
                  color: rgba(255,255,255,.25); flex-shrink: 0; }
      .gvol-wrap { flex: 1; padding: 12px 0; cursor: pointer; touch-action: none; user-select: none; }
      .gvol-track { height: 4px; background: rgba(255,255,255,.10); border-radius: 99px; position: relative; }
      .gvol-fill  { height: 100%; background: linear-gradient(90deg,rgba(250,204,21,.5),#facc15); border-radius: 99px; transition: width .1s; }
      .gvol-thumb { width: 12px; height: 12px; border-radius: 50%; background: #facc15; border: 2px solid rgba(0,0,0,.5); position: absolute; top: 50%; transform: translate(-50%,-50%); pointer-events: none; transition: left .1s; }
      .gvol-pct { font-size: 11px; font-weight: 700; color: #fbbf24; width: 30px; text-align: right; flex-shrink: 0; }
      /* Favorites */
      .fav-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; padding: 4px 14px 12px; }
      .fav { height: 52px; border-radius: 8px; background: rgba(255,255,255,.04);
             border: 1px solid rgba(255,255,255,.10); display: flex; flex-direction: column;
             align-items: center; justify-content: center; gap: 3px;
             cursor: pointer; -webkit-tap-highlight-color: transparent;
             user-select: none; transition: transform .1s, filter .12s; }
      .fav:active { transform: scale(.96); filter: brightness(.88); }
      .fav-icon { font-size: 16px; line-height: 1; }
      .fav-lbl  { font-size: 9px; font-weight: 700; color: rgba(255,255,255,.45);
                  text-transform: uppercase; letter-spacing: .04em; }
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    const title    = this._mediaTitle();
    const artist   = this._mediaArtist();
    const source   = this._mediaSource();
    const playing  = this._isPlaying();
    const shuffled = this._isShuffled();
    const repeat   = this._repeatMode();
    const pct      = this._progressPct();
    const pos      = this._mediaPos();
    const dur      = this._mediaDuration();
    const gvol     = this._groupVolume() ?? 50;
    const favs     = this._config.favorites || [];

    const speakersHtml = this._config.speakers.map((s,i) => {
      const on    = this._isGrouped(s.entity);
      const vol   = this._volume(s.entity) ?? 0;
      const disabled = this._togDisabled(s.entity);
      return `<div class="spk${on?' on':''}${disabled?' tog-disabled':''}" data-entity="${s.entity}" id="spk-${i}">
        <div class="spk-name">${s.name}</div>
        <div class="spk-vol-track"><div class="spk-vol-fill" id="svf-${i}" style="width:${on?vol:0}%"></div></div>
        <div class="spk-vol-pct" id="svp-${i}">${on?vol+'%':'—'}</div>
        <div class="tog${on?' on':''}" id="tog-${i}"><div class="tog-dot"></div></div>
      </div>`;
    }).join('');

    const favsHtml = favs.map((f,i) =>
      `<div class="fav ha-tappable" data-fav="${i}">
        <div class="fav-icon">${f.icon || '♪'}</div>
        <div class="fav-lbl">${f.name}</div>
      </div>`
    ).join('');

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap">
          <div class="hdr">Music</div>
          ${this._coordUnavail() ? `
            <div class="unavail-banner">
              <div class="unavail-dot"></div>
              <div class="unavail-text">Speaker unavailable</div>
            </div>` : ''}
          <div class="np">
            <div class="np-art">♪</div>
            <div class="np-info">
              <div class="np-title"  id="np-title">${title  || 'Nothing playing'}</div>
              <div class="np-artist" id="np-artist">${artist || ''}</div>
              ${source ? `<div class="np-source" id="np-source">${source}</div>` : '<div id="np-source"></div>'}
            </div>
          </div>
          <div class="prog">
            <div class="prog-track">
              <div class="prog-fill" id="prog-fill" style="width:${pct}%"></div>
            </div>
            <div class="prog-times">
              <span class="prog-t" id="prog-pos">${this._fmtTime(pos)}</span>
              <span class="prog-t" id="prog-dur">${this._fmtTime(dur)}</span>
            </div>
          </div>
          <div class="transport">
            <div class="tbtn ha-tappable${shuffled?' active':''}" id="btn-shuffle" title="Shuffle">⇄</div>
            <div class="tbtn ha-tappable" data-media="media_previous_track">⏮</div>
            <div class="tbtn ha-tappable" data-media="media_play_pause" id="btn-play">
              ${playing ? '⏸' : '▶'}
            </div>
            <div class="tbtn ha-tappable" data-media="media_next_track">⏭</div>
            <div class="tbtn ha-tappable${repeat!=='off'?' active':''}" id="btn-repeat" title="Repeat">↻</div>
          </div>
          <div class="divider"></div>
          <div class="ha-section-label">Speakers</div>
          ${speakersHtml}
          <div class="gvol${this._groupedCount() <= 1 ? ' gvol-solo' : ''}">
            <div class="gvol-lbl">Group</div>
            <div class="gvol-wrap" id="gvol-wrap">
              <div class="gvol-track">
                <div class="gvol-fill"  id="gvol-fill"  style="width:${gvol}%"></div>
                <div class="gvol-thumb" id="gvol-thumb" style="left:${gvol}%"></div>
              </div>
            </div>
            <div class="gvol-pct" id="gvol-pct">${gvol}%</div>
          </div>
          ${favs.length ? `
          <div class="divider"></div>
          <div class="ha-section-label">Favorites</div>
          <div class="fav-grid">${favsHtml}</div>` : ''}
        </div>
      </ha-card>`;
    this._attachListeners();
    this._startProgressTimer();
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  _attachListeners() {
    const root = this.shadowRoot;

    // Transport media player commands
    root.querySelectorAll('[data-media]').forEach(el => {
      el.addEventListener('click', () => this._mediaCmd(el.dataset.media));
    });

    // Shuffle toggle
    root.getElementById('btn-shuffle')?.addEventListener('click', () => {
      this._mediaCmd('shuffle_set', { shuffle: !this._isShuffled() }, 'shuffle');
    });

    // Repeat toggle
    root.getElementById('btn-repeat')?.addEventListener('click', () => {
      const modes = ['off', 'one', 'all'];
      const next  = modes[(modes.indexOf(this._repeatMode()) + 1) % modes.length];
      this._mediaCmd('repeat_set', { repeat: next }, 'repeat');
    });

    // Speaker toggles
    this._config.speakers.forEach((s,i) => {
      root.getElementById(`spk-${i}`)?.addEventListener('click', () => this._toggleSpeaker(s.entity));
    });

    // Group volume slider
    this._attachVolSlider('gvol-wrap', 'gvol-fill', 'gvol-thumb', 'gvol-pct', 'gvol',
      pct => { this._setGroupVolume(pct); });

    // Favorites
    root.querySelectorAll('[data-fav]').forEach(el => {
      const fav = this._config.favorites[parseInt(el.dataset.fav, 10)];
      if (fav) el.addEventListener('click', () => this._playFavorite(fav));
    });
  }

  _attachVolSlider(wrapId, fillId, thumbId, pctId, timerKey, onChange) {
    const root  = this.shadowRoot;
    const wrap  = root.getElementById(wrapId);
    const fill  = root.getElementById(fillId);
    const thumb = root.getElementById(thumbId);
    const pctEl = root.getElementById(pctId);
    if (!wrap || !fill || !thumb) return;

    let dragging = false;
    const calc = (clientX) => {
      const rect = wrap.getBoundingClientRect();
      const pct  = Math.round(Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)));
      fill.style.width  = pct + '%';
      thumb.style.left  = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      onChange(pct);
    };
    const start = e => { dragging = true; calc(e.touches ? e.touches[0].clientX : e.clientX); };
    const move  = e => { if (!dragging) return; calc(e.touches ? e.touches[0].clientX : e.clientX); };
    const end   = () => { dragging = false; };
    wrap.addEventListener('mousedown',  start);
    wrap.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('mousemove',  move);
    document.addEventListener('touchmove',  move, { passive: true });
    document.addEventListener('mouseup',    end);
    document.addEventListener('touchend',   end);
    // Store for cleanup in disconnectedCallback
    this._docHandlers.push({ move, up: end });
  }

  _startProgressTimer() {
    if (this._progTimer) clearInterval(this._progTimer);
    if (!this._isPlaying()) return;
    this._progTimer = setInterval(() => {
      const fill  = this.shadowRoot.getElementById('prog-fill');
      const posEl = this.shadowRoot.getElementById('prog-pos');
      if (!fill || !posEl) return;
      const pct = this._progressPct();
      const pos = this._mediaPos();
      const elapsed = pos != null ? pos + (Date.now() - new Date(this._lastUpdated()).getTime()) / 1000 : 0;
      fill.style.width  = pct + '%';
      posEl.textContent = this._fmtTime(Math.round(elapsed));
    }, 5000);
  }

  // ── Patch ──────────────────────────────────────────────────────────────────

  _patch() {
    const root    = this.shadowRoot;
    const title   = this._mediaTitle();
    const artist  = this._mediaArtist();
    const source  = this._mediaSource();
    const playing = this._isPlaying();
    const pct     = this._progressPct();
    const pos     = this._mediaPos();
    const dur     = this._mediaDuration();
    const gvol    = this._groupVolume();

    // Now playing
    const titleEl  = root.getElementById('np-title');
    const artistEl = root.getElementById('np-artist');
    const sourceEl = root.getElementById('np-source');
    const playBtn  = root.getElementById('btn-play');
    const progFill = root.getElementById('prog-fill');
    const progPos  = root.getElementById('prog-pos');
    const progDur  = root.getElementById('prog-dur');

    if (titleEl)  titleEl.textContent  = title  || 'Nothing playing';
    if (artistEl) artistEl.textContent = artist || '';
    if (sourceEl) { sourceEl.textContent = source || ''; sourceEl.style.display = source ? '' : 'none'; }
    if (playBtn)  playBtn.textContent  = playing ? '⏸' : '▶';
    if (progFill) progFill.style.width = pct + '%';
    if (progPos)  progPos.textContent  = this._fmtTime(pos);
    if (progDur)  progDur.textContent  = this._fmtTime(dur);

    // Shuffle / repeat active states
    const shuffleBtn = root.getElementById('btn-shuffle');
    const repeatBtn  = root.getElementById('btn-repeat');
    if (shuffleBtn) shuffleBtn.classList.toggle('active', this._isShuffled());
    if (repeatBtn)  repeatBtn.classList.toggle('active',  this._repeatMode() !== 'off');

    // Speakers
    this._config.speakers.forEach((s,i) => {
      const on    = this._isGrouped(s.entity);
      const vol   = this._volume(s.entity);
      const spkEl = root.getElementById(`spk-${i}`);
      const fillEl = root.getElementById(`svf-${i}`);
      const pctEl  = root.getElementById(`svp-${i}`);
      const togEl  = root.getElementById(`tog-${i}`);
      if (spkEl)  spkEl.classList.toggle('on', on);
      if (fillEl) fillEl.style.width  = on && vol != null ? vol + '%' : '0%';
      if (pctEl)  pctEl.textContent   = on && vol != null ? vol + '%' : '—';
      if (togEl)  togEl.classList.toggle('on', on);
    });

    // Group volume
    if (gvol != null) {
      const gFill  = root.getElementById('gvol-fill');
      const gThumb = root.getElementById('gvol-thumb');
      const gPct   = root.getElementById('gvol-pct');
      if (gFill)  gFill.style.width  = gvol + '%';
      if (gThumb) gThumb.style.left  = gvol + '%';
      if (gPct)   gPct.textContent   = gvol + '%';
    }

    // Restart progress timer if play state changed
    this._startProgressTimer();
  }
}

customElements.define('homepod-music-card', HomepodMusicCard);
