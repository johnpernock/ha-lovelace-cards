/**
 * kiosk-voice-card.js  —  v1
 * Voice satellite monitoring and control card for Home Assistant Lovelace.
 * Shows online state, mic mute toggle, TTS speaker volume pips, last wake
 * phrase, and section-level Mute all / Unmute all / Night vol actions.
 *
 * Designed to work before satellites are fully configured — satellite rows
 * show "Pending setup" gracefully when entities are not yet available.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/kiosk-voice-card/kiosk-voice-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/kiosk-voice-card/kiosk-voice-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:kiosk-voice-card
 * satellites:
 *   - name: Family Room
 *     ip: 192.168.1.210                                  # shown for reference
 *     mute_entity:      switch.family_room_sat_mute      # optional
 *     volume_entity:    number.family_room_sat_volume     # optional (0–100)
 *     state_entity:     binary_sensor.family_room_sat_listening  # optional
 *     last_wake_entity: sensor.family_room_sat_last_wake  # optional
 *   - name: Bedroom
 *     ip: 192.168.1.211
 *     mute_entity:      switch.bedroom_sat_mute
 *     volume_entity:    number.bedroom_sat_volume
 *     state_entity:     binary_sensor.bedroom_sat_listening
 *     last_wake_entity: sensor.bedroom_sat_last_wake
 * night_volume: 25     # optional — Night vol button target (default 25)
 */

class KioskVoiceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
  }

  static getStubConfig() {
    return {
      satellites: [
        { name: 'Family Room', ip: '192.168.1.210' },
        { name: 'Bedroom',     ip: '192.168.1.211' },
      ],
      night_volume: 25,
    };
  }

  static getConfigForm() {
    return { schema: [] }; // satellites array — configure in YAML
  }

  setConfig(c) {
    if (!c.satellites?.length) throw new Error('kiosk-voice-card: define at least one satellite under satellites:');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return (this._config.satellites?.length || 1) * 2 + 2; }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _state(entity)   { return entity ? (this._hass?.states[entity]?.state ?? null) : null; }
  _attr(entity, k) { return entity ? (this._hass?.states[entity]?.attributes?.[k] ?? null) : null; }

  _isMuted(sat)     { return sat.mute_entity   ? this._state(sat.mute_entity) === 'on' : false; }
  _isListening(sat) { return sat.state_entity  ? this._state(sat.state_entity) === 'on' : false; }
  _isConfigured(sat){ return !!(sat.mute_entity || sat.volume_entity || sat.state_entity); }

  _volume(sat) {
    if (!sat.volume_entity) return null;
    const v = parseFloat(this._state(sat.volume_entity));
    return isNaN(v) ? null : Math.round(v);
  }

  _nearestVol(v) { return [25,50,75,100].reduce((a,b) => Math.abs(b-v)<Math.abs(a-b)?b:a); }

  _lastWake(sat) {
    if (!sat.last_wake_entity) return null;
    const s = this._state(sat.last_wake_entity);
    return s && s !== 'unknown' && s !== 'unavailable' ? s : null;
  }

  _satStatus(sat) {
    if (!this._isConfigured(sat)) return 'pending';
    if (this._isMuted(sat))       return 'muted';
    if (this._isListening(sat))   return 'listening';
    return 'idle';
  }

  _call(domain, service, data) { this._hass.callService(domain, service, data); }

  _toggleMute(sat) {
    if (!sat.mute_entity || this._busy[sat.mute_entity]) return;
    this._busy[sat.mute_entity] = true;
    setTimeout(() => { this._busy[sat.mute_entity] = false; }, 1500);
    this._call('switch', this._isMuted(sat) ? 'turn_off' : 'turn_on', { entity_id: sat.mute_entity });
  }

  _setVolume(sat, pct) {
    if (!sat.volume_entity || this._busy[sat.volume_entity]) return;
    this._busy[sat.volume_entity] = true;
    setTimeout(() => { this._busy[sat.volume_entity] = false; }, 1500);
    this._call('number', 'set_value', { entity_id: sat.volume_entity, value: pct });
  }

  _muteAll() {
    this._config.satellites.forEach(sat => {
      if (sat.mute_entity && !this._isMuted(sat)) this._call('switch', 'turn_on', { entity_id: sat.mute_entity });
    });
  }

  _unmuteAll() {
    this._config.satellites.forEach(sat => {
      if (sat.mute_entity && this._isMuted(sat)) this._call('switch', 'turn_off', { entity_id: sat.mute_entity });
    });
  }

  _nightVol() {
    const vol = this._config.night_volume ?? 25;
    this._config.satellites.forEach(sat => {
      if (sat.volume_entity) this._call('number', 'set_value', { entity_id: sat.volume_entity, value: vol });
    });
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  _css() { return `
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important}
    .wrap{border-radius:10px;overflow:hidden}
    .card-hdr{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.2px;padding:10px 14px 9px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
    .chip{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:4px}
    .chip-ok{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.28);color:#4ade80}
    .chip-info{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);color:rgba(96,165,250,.8)}
    .chip-warn{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);color:#fbbf24}
    .vrow{padding:8px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
    .vrow:last-of-type{border-bottom:none}
    .vtop{display:flex;align-items:center;gap:8px;margin-bottom:7px}
    .vav{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .vav-idle{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2)}
    .vav-listen{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.28)}
    .vav-muted{background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.18)}
    .vav-pending{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}
    .vinfo{flex:1;min-width:0}
    .vname{font-size:11px;font-weight:700;color:#e2e8f0;line-height:1}
    .vip{font-size:9px;color:rgba(255,255,255,.28);margin-top:2px;font-variant-numeric:tabular-nums}
    .mic-wrap{display:flex;align-items:center;gap:5px;flex-shrink:0}
    .mic-lbl{font-size:9px;color:rgba(255,255,255,.28)}
    .tog{width:36px;height:22px;border-radius:99px;position:relative;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;user-select:none;transition:background .12s}
    .tog-on{background:rgba(74,222,128,.16);border:1.5px solid rgba(74,222,128,.4)}
    .tog-off{background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.11)}
    .tog-muted{background:rgba(248,113,113,.14);border:1.5px solid rgba(248,113,113,.38)}
    .tog-disabled{background:rgba(255,255,255,.03);border:1.5px solid rgba(255,255,255,.07);pointer-events:none;opacity:.4}
    .tog-thumb{width:16px;height:16px;border-radius:50%;position:absolute;top:2px;transition:left .12s,background .12s}
    .tog-on .tog-thumb{left:16px;background:#4ade80}
    .tog-off .tog-thumb{left:2px;background:rgba(255,255,255,.22)}
    .tog-muted .tog-thumb{left:16px;background:#f87171}
    .tog-disabled .tog-thumb{left:2px;background:rgba(255,255,255,.15)}
    .tog:active:not(.tog-disabled){filter:brightness(.85)}
    .vbadge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:4px;flex-shrink:0;white-space:nowrap}
    .vb-idle{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);color:#4ade80}
    .vb-listen{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.28);color:#60a5fa}
    .vb-muted{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.22);color:#f87171}
    .vb-pending{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.3)}
    .vol-row{display:flex;align-items:center;gap:5px;margin-bottom:5px}
    .vol-ico{flex-shrink:0;opacity:.32}
    .vpips{display:flex;gap:3px;flex:1}
    .vpip{flex:1;height:30px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(255,255,255,.28);transition:transform .1s,filter .12s}
    .vpip:active{transform:scale(.93);filter:brightness(.82)}
    .vpip-active{background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.3);color:#60a5fa}
    .vpip-dim{opacity:.2;pointer-events:none}
    .vol-val{font-size:10px;font-weight:700;color:#60a5fa;width:28px;text-align:right;flex-shrink:0}
    .vol-val-off{color:rgba(255,255,255,.2)}
    .vlast{display:flex;align-items:center;gap:4px;font-size:9px;color:rgba(255,255,255,.26)}
    .vlast-listen{color:rgba(96,165,250,.7)}
    .pulse{display:inline-block;width:5px;height:5px;border-radius:50%;background:#60a5fa;animation:pulse 1.1s ease-in-out infinite;flex-shrink:0}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
    .divider{height:1px;background:rgba(255,255,255,.07)}
    .actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;padding:8px 14px 10px}
    .act{height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;font-size:11px;font-weight:700;transition:transform .1s,filter .12s}
    .act:active{transform:scale(.95);filter:brightness(.82)}
    .act-mute{background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.2);color:#f87171}
    .act-unmute{background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);color:#4ade80}
    .act-night{background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.2);color:#a78bfa}
    .act-disabled{opacity:.3;pointer-events:none}
  `; }

  // ── SVG icons ────────────────────────────────────────────────────────────────

  _micIco(stroke, w=12) {
    return `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  }
  _micMutedIco(stroke='#f87171', w=12) {
    return `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  }
  _volIco(muted=false) {
    if (muted) return `<svg class="vol-ico" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2.5" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
    return `<svg class="vol-ico" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2.5" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  }
  _clockIco() {
    return `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  }
  _moonIco(stroke='#a78bfa', w=11) {
    return `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
  }

  // ── Build row HTML ───────────────────────────────────────────────────────────

  _avatarClass(status) {
    return { idle:'vav-idle', listening:'vav-listen', muted:'vav-muted', pending:'vav-pending' }[status] ?? 'vav-pending';
  }

  _badgeHtml(status) {
    const map = {
      idle:      ['vb-idle', 'Idle'],
      listening: ['vb-listen', 'Active'],
      muted:     ['vb-muted', 'Muted'],
      pending:   ['vb-pending', 'Pending setup'],
    };
    const [cls, lbl] = map[status] ?? map.pending;
    return `<div class="vbadge ${cls}">${lbl}</div>`;
  }

  _lastWakeHtml(sat, status) {
    if (status === 'listening') {
      return `<div class="vlast vlast-listen"><span class="pulse"></span>Listening…</div>`;
    }
    const phrase = this._lastWake(sat);
    if (status === 'muted') {
      return `<div class="vlast">${this._clockIco()} Muted · ${phrase ? `last wake: "${phrase}"` : 'no recent wake'}</div>`;
    }
    if (!phrase && status === 'pending') {
      return `<div class="vlast">Configure entities to enable monitoring</div>`;
    }
    return phrase
      ? `<div class="vlast">${this._clockIco()} Last wake: "${phrase}"</div>`
      : `<div class="vlast">No wake phrase recorded yet</div>`;
  }

  _buildRow(sat, i) {
    const status  = this._satStatus(sat);
    const muted   = status === 'muted';
    const pending = status === 'pending';
    const vol     = this._volume(sat);
    const hasVol  = vol !== null;
    const nearVol = hasVol ? this._nearestVol(vol) : 0;

    const avIco = (muted || pending)
      ? this._micMutedIco(muted ? '#f87171' : 'rgba(255,255,255,.25)')
      : this._micIco(status === 'listening' ? '#60a5fa' : '#4ade80');

    const togCls = pending ? 'tog-disabled' : muted ? 'tog-muted' : 'tog-on';

    const volPips = [25,50,75,100].map(v => {
      const active = hasVol && !muted && nearVol === v;
      return `<div class="vpip ${muted || !hasVol ? 'vpip-dim' : active ? 'vpip-active' : ''}" data-sat="${i}" data-vol="${v}">${v}</div>`;
    }).join('');

    const volVal = muted || !hasVol
      ? `<div class="vol-val vol-val-off">—</div>`
      : `<div class="vol-val">${vol}%</div>`;

    return `
      <div class="vrow" id="vrow-${i}">
        <div class="vtop">
          <div class="vav ${this._avatarClass(status)}" id="vav-${i}">${avIco}</div>
          <div class="vinfo">
            <div class="vname">${sat.name}</div>
            ${sat.ip ? `<div class="vip">${sat.ip}${sat.protocol ? ` · ${sat.protocol}` : ' · wyoming'}</div>` : ''}
          </div>
          ${!pending ? `<div class="mic-wrap"><div class="mic-lbl">Mic</div><div class="tog ${togCls}" id="mtog-${i}" data-sat="${i}"><div class="tog-thumb"></div></div></div>` : ''}
          <div id="badge-${i}">${this._badgeHtml(status)}</div>
        </div>
        <div class="vol-row" id="volrow-${i}">
          ${this._volIco(muted)}
          <div class="vpips" id="vpips-${i}">${volPips}</div>
          ${volVal}
        </div>
        <div id="vlast-${i}">${this._lastWakeHtml(sat, status)}</div>
      </div>`;
  }

  _hasAnyEntities() {
    return this._config.satellites.some(s => this._isConfigured(s));
  }

  _buildHdr() {
    const configured = this._config.satellites.filter(s => this._isConfigured(s)).length;
    const total      = this._config.satellites.length;
    const chip = configured === 0
      ? `<div class="chip chip-warn">${total} pending</div>`
      : `<div class="chip chip-ok">${configured} configured</div>`;
    return `<div class="card-hdr"><span>Voice satellites</span><div id="hdr-chip">${chip}</div></div>`;
  }

  _buildActions() {
    const hasEnt = this._hasAnyEntities();
    const dis    = hasEnt ? '' : ' act-disabled';
    return `
      <div class="divider"></div>
      <div class="actions">
        <div class="act act-mute${dis}" id="vact-mute">
          ${this._micMutedIco('currentColor', 11)} Mute all
        </div>
        <div class="act act-unmute${dis}" id="vact-unmute">
          ${this._micIco('currentColor', 11)} Unmute all
        </div>
        <div class="act act-night${dis}" id="vact-night">
          ${this._moonIco()} Night vol
        </div>
      </div>`;
  }

  // ── Render / Patch ───────────────────────────────────────────────────────────

  _render() {
    const rows = this._config.satellites.map((s,i) => this._buildRow(s,i)).join('');
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card><div class="wrap">
        ${this._buildHdr()}
        ${rows}
        ${this._buildActions()}
      </div></ha-card>`;
    this._listen();
  }

  _patch() {
    const sr = this.shadowRoot;

    // Header chip
    const hdrChip = sr.getElementById('hdr-chip');
    if (hdrChip) {
      const configured = this._config.satellites.filter(s => this._isConfigured(s)).length;
      const total      = this._config.satellites.length;
      hdrChip.innerHTML = configured === 0
        ? `<div class="chip chip-warn">${total} pending</div>`
        : `<div class="chip chip-ok">${configured} configured</div>`;
    }

    this._config.satellites.forEach((sat, i) => {
      const status  = this._satStatus(sat);
      const muted   = status === 'muted';
      const pending = status === 'pending';
      const vol     = this._volume(sat);
      const hasVol  = vol !== null;
      const nearVol = hasVol ? this._nearestVol(vol) : 0;

      // Avatar
      const vav = sr.getElementById(`vav-${i}`);
      if (vav) {
        vav.className = `vav ${this._avatarClass(status)}`;
        const avIco = (muted || pending)
          ? this._micMutedIco(muted ? '#f87171' : 'rgba(255,255,255,.25)')
          : this._micIco(status === 'listening' ? '#60a5fa' : '#4ade80');
        vav.innerHTML = avIco;
      }

      // Mic toggle
      const mtog = sr.getElementById(`mtog-${i}`);
      if (mtog) {
        mtog.className = `tog ${pending ? 'tog-disabled' : muted ? 'tog-muted' : 'tog-on'}`;
      }

      // Badge
      const badge = sr.getElementById(`badge-${i}`);
      if (badge) badge.innerHTML = this._badgeHtml(status);

      // Volume pips
      sr.getElementById(`vpips-${i}`)?.querySelectorAll('.vpip').forEach(p => {
        const v = parseInt(p.dataset.vol);
        p.className = `vpip ${muted || !hasVol ? 'vpip-dim' : nearVol===v ? 'vpip-active' : ''}`;
      });

      // Last wake
      const lw = sr.getElementById(`vlast-${i}`);
      if (lw) lw.innerHTML = this._lastWakeHtml(sat, status);
    });
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  _listen() {
    const sr = this.shadowRoot;

    sr.getElementById('vact-mute')?.addEventListener('click',   () => this._muteAll());
    sr.getElementById('vact-unmute')?.addEventListener('click', () => this._unmuteAll());
    sr.getElementById('vact-night')?.addEventListener('click',  () => this._nightVol());

    sr.querySelectorAll('.tog:not(.tog-disabled)').forEach(el =>
      el.addEventListener('click', () => {
        const i = parseInt(el.dataset.sat);
        if (i >= 0) this._toggleMute(this._config.satellites[i]);
      })
    );

    sr.querySelectorAll('.vpip:not(.vpip-dim)').forEach(el =>
      el.addEventListener('click', () => {
        const i = parseInt(el.dataset.sat);
        const v = parseInt(el.dataset.vol);
        if (i >= 0) this._setVolume(this._config.satellites[i], v);
      })
    );
  }
}

customElements.define('kiosk-voice-card', KioskVoiceCard);
