/**
 * room-controls-card.js  —  v78
 *
 * Unified room control card. One card definition works on both the
 * wall display (1200×800) and mobile. Popups are bottom-sheets on
 * mobile and centred modals on ≥768 px — same pattern as every other card.
 *
 * INLINE (always visible):
 *   lights    — master toggle + avg brightness bar  →  tap → popup
 *   fans      — signal-bar speed pips
 *   blinds    — Open / Close pips  +  Pos button  →  tap → popup
 *   thermostat — cur temp · set-point +/−  +  HVAC cycle btn  →  tap → popup
 *   sensor    — plain temperature reading
 *   garage    — Open / Closed pips
 *
 * POPUPS:
 *   lights popup   — individual sliders · CT presets · colour presets
 *   blind popup    — position slider (0 → max_position)
 *   tstat popup    — fan mode · swing mode · preset
 *
 * CONFIG:
 * type: custom:room-controls-card
 * ct_presets:       # optional override
 *   - { label: Warm White, kelvin: 2700, color: '#ffcf7d' }
 * color_presets:    # optional override
 *   - { label: Blue, rgb: [116,192,252], color: '#74c0fc' }
 * rooms:
 *   - id: family_room
 *     name: Family Room
 *     lights:
 *       entity: light.all_family_room_lights
 *       individuals:
 *         - { entity: light.venus_window_lamp, name: Window }
 *     fans:
 *       - { entity: fan.front_fan, name: Front Fan, speeds: 4 }
 *     blinds:
 *       entity: cover.family_room_blinds
 *       max_position: 87
 *     thermostat:
 *       entity: climate.family_room_2
 *       name: Family Rm
 *       sensor: sensor.family_room_temperature
 *       sensor_label: "AC\nsensor"
 *   - id: bathroom
 *     name: Bathroom
 *     lights:
 *       entity: light.all_bathroom_lights
 *     sensor:
 *       entity: sensor.bathroom_temperature
 *       name: Bathroom
 */

class RoomControlsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
  }

  setConfig(config) {
    if (!config.rooms?.length) throw new Error('room-controls-card: define at least one room');
    this._config = config;
    this._render();
  }
  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    // Full render on first load only — then patch values in place
    if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
    this._patch();
  }
  getCardSize() { return (this._config.rooms?.length || 1) * 3; }

  static getStubConfig() {
    return { rooms: [{ id:'r', name:'Room',
      lights:{ entity:'light.example', individuals:[] },
      thermostat:{ entity:'climate.example', name:'Thermostat' } }] };
  }

  /* ── Presets ─────────────────────────────────────────────────────── */

  static get DEFAULT_CT() { return [
    { label:'Candle',     kelvin:1900, color:'#ff8c3a' },
    { label:'Warm White', kelvin:2700, color:'#ffcf7d' },
    { label:'Soft White', kelvin:3000, color:'#ffe4a8' },
    { label:'Natural',    kelvin:4000, color:'#fff5d6' },
    { label:'Daylight',   kelvin:5000, color:'#fffbf0' },
    { label:'Cool',       kelvin:6500, color:'#d4eeff' },
  ]; }
  static get DEFAULT_COLORS() { return [
    { label:'Red',    rgb:[255,107,107], color:'#ff6b6b' },
    { label:'Orange', rgb:[255,154, 60], color:'#ff9a3c' },
    { label:'Yellow', rgb:[255,212, 59], color:'#ffd43b' },
    { label:'Green',  rgb:[105,219,124], color:'#69db7c' },
    { label:'Teal',   rgb:[ 56,217,169], color:'#38d9a9' },
    { label:'Blue',   rgb:[116,192,252], color:'#74c0fc' },
    { label:'Purple', rgb:[151,117,250], color:'#9775fa' },
    { label:'Pink',   rgb:[247,131,172], color:'#f783ac' },
    { label:'Lavend', rgb:[192,132,252], color:'#c084fc' },
    { label:'White',  rgb:[240,244,255], color:'#f0f4ff' },
  ]; }
  _ctPresets()    { return this._config.ct_presets    || RoomControlsCard.DEFAULT_CT; }
  _colorPresets() { return this._config.color_presets || RoomControlsCard.DEFAULT_COLORS; }

  /* ── Entity helpers ───────────────────────────────────────────────── */

  _state(id)     { return this._hass?.states[id] || null; }
  _attr(id, key) { return this._state(id)?.attributes[key] ?? null; }
  _isOn(id)      { return ['on','open','playing','paused'].includes(this._state(id)?.state); }

  _brightness(id) {
    const s = this._state(id);
    if (!s || s.state !== 'on') return null;
    const b = s.attributes.brightness;
    return b != null ? Math.round((b/255)*100) : null;
  }
  _onCount(lights)  { return lights.filter(l => this._isOn(l.entity)).length; }
  _avgBright(lights) {
    const on = lights.filter(l => this._isOn(l.entity));
    if (!on.length) return 0;
    return Math.round(on.map(l => this._brightness(l.entity)??100).reduce((a,b)=>a+b,0)/on.length);
  }
  _fanSpeeds(entity, configSpeeds) {
    // If explicitly set in YAML, trust it.
    // NOTE: speeds = total pip count including off (pip 0).
    // e.g. speeds:5 → off + 4 speed steps, speeds:4 → off + 3 steps.
    if (configSpeeds != null) return configSpeeds;
    const s = this._state(entity);
    if (!s) return 5;
    // percentage_step gives the number of speed steps (e.g. 25 → 4 steps).
    // Add 1 for the off pip.
    const step = s.attributes.percentage_step;
    if (step && step > 0) return Math.round(100 / step) + 1;
    // fall back to speed_count attribute (also add 1 for off)
    const sc = s.attributes.speed_count;
    if (sc && sc > 1) return sc + 1;
    return 5;
  }

  _fanIdx(id, speeds) {
    const s = this._state(id);
    if (!s || s.state==='off') return 0;
    const pct = s.attributes.percentage ?? (s.state==='on'?50:0);
    return Math.max(1, Math.min(speeds-1, Math.round((pct/100)*(speeds-1))));
  }
  _coverPos(id)   { return this._state(id)?.attributes.current_position ?? null; }
  _coverState(id) { return this._state(id)?.state || 'unknown'; }
  _coverClass(id) { return this._attr(id,'device_class') || 'blind'; }
  _tempVal(id) {
    const s = this._state(id);
    if (!s) return null;
    if (s.attributes.current_temperature != null) return Math.round(s.attributes.current_temperature);
    const v = parseFloat(s.state);
    return isNaN(v) ? null : Math.round(v);
  }
  _targetTemp(id) {
    const t = this._attr(id,'temperature') ?? this._attr(id,'target_temp_high');
    return t != null ? Math.round(t) : null;
  }
  _hvacMode(id)      { return this._state(id)?.state || 'off'; }
  _suppModes(id,key) { return this._attr(id,key) || []; }

  /* ── Service calls ────────────────────────────────────────────────── */

  async _call(domain, service, data, lock) {
    if (lock && this._busy[lock]) return;
    if (lock) this._busy[lock] = true;
    try { await this._hass.callService(domain, service, data); }
    catch(e) { console.warn('room-controls-card:', e); }
    if (lock) setTimeout(() => { this._busy[lock] = false; }, 700);
  }
  _toggleLight(id) { this._call(id.startsWith('switch.')?'switch':'light','toggle',{entity_id:id},id); }
  _setBrightness(id,pct) { this._call('light','turn_on',{entity_id:id,brightness_pct:pct},null); }
  _setColorTemp(id,k)    { this._call('light','turn_on',{entity_id:id,color_temp_kelvin:k},null); }
  _setColor(id,rgb)      { this._call('light','turn_on',{entity_id:id,rgb_color:rgb},null); }
  _supportsCT(id) {
    const modes = this._attr(id,'supported_color_modes') || [];
    return modes.some(m => ['color_temp','xy','hs','rgb','rgbw','rgbww'].includes(m)) ||
           this._attr(id,'color_temp_kelvin') != null;
  }
  _supportsColor(id) {
    const modes = this._attr(id,'supported_color_modes') || [];
    return modes.some(m => ['xy','hs','rgb','rgbw','rgbww'].includes(m));
  }
  _lightDotColor(id) {
    // Returns a CSS color string representing the light's current color
    const s = this._state(id);
    if (!s || s.state !== 'on') return 'rgba(255,255,255,.2)';
    const rgb = s.attributes.rgb_color;
    if (rgb) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    const k = s.attributes.color_temp_kelvin;
    if (k) {
      // Map kelvin to warm-cool gradient: 2000K=amber, 4000K=white, 6500K=cool blue
      const t = Math.max(0, Math.min(1, (k - 2000) / 4500));
      const r = Math.round(255 - t * 55);
      const g = Math.round(200 + t * 44);
      const b = Math.round(80 + t * 175);
      return `rgb(${r},${g},${b})`;
    }
    return '#fbbf24'; // amber — on but no color info
  }
  _ctRange(id) {
    const min = this._attr(id,'min_color_temp_kelvin') || 2000;
    const max = this._attr(id,'max_color_temp_kelvin') || 6500;
    return { min, max };
  }
  _setFanSpeed(id,speeds,idx) {
    if (idx===0) this._call('fan','turn_off',{entity_id:id},id);
    else this._call('fan','set_percentage',{entity_id:id,percentage:Math.round((idx/(speeds-1))*100)},id);
  }
  _setCoverPos(id,pos)    { this._call('cover','set_cover_position',{entity_id:id,position:pos},null); }
  _setCoverState(id,open) { this._call('cover',open?'open_cover':'close_cover',{entity_id:id},id); }
  _adjTemp(id,d) {
    const cur = this._targetTemp(id); if (cur==null) return;
    const min = this._attr(id,'min_temp')??-Infinity;
    const max = this._attr(id,'max_temp')??Infinity;
    this._call('climate','set_temperature',{entity_id:id,temperature:Math.min(max,Math.max(min,cur+d))},null);
  }
  _cycleHvac(id, allowedModes) {
    const sup = this._hvacOrder(id, allowedModes);
    if (!sup.length) return;
    const cur = this._hvacMode(id);
    const curIdx = sup.indexOf(cur);
    // If current mode not found in supported list, start from beginning
    const nextIdx = curIdx === -1 ? 0 : (curIdx + 1) % sup.length;
    const next = sup[nextIdx];
    if (!next || next === cur) return;
    this._call('climate','set_hvac_mode',{entity_id:id,hvac_mode:next},id);
  }
  _cycleFan(id) {
    const m = this._suppModes(id,'fan_modes'); if (!m.length) return;
    const next = m[(m.indexOf(this._attr(id,'fan_mode')||m[0])+1)%m.length];
    this._call('climate','set_fan_mode',{entity_id:id,fan_mode:next},null);
  }
  _cycleSwing(id) {
    const m = this._suppModes(id,'swing_modes'); if (!m.length) return;
    const next = m[(m.indexOf(this._attr(id,'swing_mode')||m[0])+1)%m.length];
    this._call('climate','set_swing_mode',{entity_id:id,swing_mode:next},null);
  }
  _cyclePreset(id) {
    const m = this._suppModes(id,'preset_modes').filter(p=>!['none','None'].includes(p));
    if (!m.length) return;
    const all = [null,...m];
    const cur = this._attr(id,'preset_mode');
    const idx = all.findIndex(p=>p===cur||(p==null&&(!cur||['none','None'].includes(cur))));
    this._call('climate','set_preset_mode',{entity_id:id,preset_mode:all[(idx+1)%all.length]??'none'},null);
  }

  /* ── HVAC meta ────────────────────────────────────────────────────── */

  static get HVAC_ORDER() { return ['heat_cool','auto','heat','cool','fan_only','dry','off']; }
  _hvacOrder(id, allowedModes) {
    // Read directly from live entity — never cycle to unsupported modes
    const raw = this._attr(id,'hvac_modes') || [];
    if (!raw.length) return [];
    // If caller restricts modes (e.g. modes: [heat, off]), honour that
    const pool = allowedModes?.length ? raw.filter(m => allowedModes.includes(m)) : raw;
    if (!pool.length) return raw; // fallback to all if filter leaves nothing
    const preferred = RoomControlsCard.HVAC_ORDER;
    const sorted = preferred.filter(m => pool.includes(m));
    pool.forEach(m => { if (!sorted.includes(m)) sorted.push(m); });
    return sorted;
  }
  static get HVAC_META() { return {
    heat:      { label:'Heat',      dot:'#fb923c', bg:'rgba(251,146,60,.08)',  bc:'rgba(251,146,60,.4)',  tc:'#fb923c' },
    cool:      { label:'Cool',      dot:'#60a5fa', bg:'rgba(96,165,250,.08)',  bc:'rgba(96,165,250,.4)',  tc:'#60a5fa' },
    heat_cool: { label:'Heat/Cool', dot:null,      bg:'rgba(251,146,60,.07)',  bc:'rgba(251,146,60,.35)', tc:'#fb923c', split:true },
    auto:      { label:'Auto',      dot:'#a78bfa', bg:'rgba(139,92,246,.08)',  bc:'rgba(139,92,246,.4)',  tc:'#a78bfa' },
    fan_only:  { label:'Fan',       dot:'#2dd4bf', bg:'rgba(20,184,166,.08)',  bc:'rgba(20,184,166,.4)',  tc:'#2dd4bf' },
    dry:       { label:'Dry',       dot:'#fbbf24', bg:'rgba(251,191,36,.08)',  bc:'rgba(251,191,36,.4)',  tc:'#fbbf24' },
    off:       { label:'Off',       dot:'rgba(255,255,255,.25)', bg:'rgba(255,255,255,.04)', bc:'rgba(255,255,255,.14)', tc:'rgba(255,255,255,.45)' },
  }; }
  _hvacMeta(mode) { return RoomControlsCard.HVAC_META[mode]||RoomControlsCard.HVAC_META.off; }

  /* ── Icons ────────────────────────────────────────────────────────── */

  static _svg(d,c,w,h) { return `<svg width="${w||16}" height="${h||16}" viewBox="0 0 24 24" fill="none" stroke="${c||'rgba(255,255,255,.4)'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`; }
  static get ICONS() { return {
    bulb: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>',
    fan:  '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-2-1-4.5-2.5-4.5S7 7 7 10c0 1.2.8 2.8 3.5 2.8"/><path d="M12 10c1.6 0 4.5.8 4.5 2.5S14.5 15 12 15c-1.2 0-2.8-.8-2.8-3.5"/><path d="M12 14c0 2 1 4.5 2.5 4.5S17 17 17 14c0-1.2-.8-2.8-3.5-2.8"/><path d="M12 14c-1.6 0-4.5-.8-4.5-2.5S9.5 9 12 9c1.2 0 2.8.8 2.8 3.5"/>',
    blind:'<rect x="3" y="3" width="18" height="3" rx="1"/><rect x="3" y="9" width="18" height="3" rx="1"/><rect x="3" y="15" width="18" height="3" rx="1"/>',
    up:   '<polyline points="18 15 12 9 6 15"/>',
    down: '<polyline points="6 9 12 15 18 9"/>',
    chev: '<polyline points="9 18 15 12 9 6"/>',
    heat: '<path d="M12 22c-4 0-6-3-6-6 0-2 1-4 3-5l1-1v2c0 1 1 2 2 2s2-1 2-2V8l1 1c2 1 3 3 3 5 0 3-2 6-6 6z"/>',
    cool: '<line x1="12" y1="2" x2="12" y2="22"/><polyline points="6 8 12 2 18 8"/><polyline points="6 16 12 22 18 16"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
    toff: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    fanm: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-2-1-4.5-2.5-4.5S7 7 7 10c0 1.2.8 2.8 3.5 2.8"/><path d="M12 10c1.6 0 4.5.8 4.5 2.5S14.5 15 12 15"/>',
    sw_off:'<line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/>',
    sw_v: '<line x1="12" y1="3" x2="12" y2="21"/><polyline points="6 9 12 3 18 9"/><polyline points="6 15 12 21 18 15"/>',
    sw_h: '<line x1="3" y1="12" x2="21" y2="12"/><polyline points="9 6 3 12 9 18"/><polyline points="15 6 21 12 15 18"/>',
    sw_b: '<line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 8 12 3 16 8"/><polyline points="8 16 12 21 16 16"/><polyline points="8 8 3 12 8 16"/><polyline points="16 8 21 12 16 16"/>',
    eco:  '<path d="M2 22c0 0 4-14 20-14-2 8-8 14-20 14z"/><path d="M2 22l6-6"/>',
    away: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    boost:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    sleep:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  }; }
  _ico(name,c,w,h) { return RoomControlsCard._svg(RoomControlsCard.ICONS[name]||'',c,w,h); }

  _signal(level,max,active) {
    if (!level) return `<div class="fpip-dot-off">Off</div>`;
    const c = active ? 'fpip-dot fpip-dot-on' : 'fpip-dot';
    if (level <= 3) {
      return `<div class="fpip-dots-row">${Array(level).fill(`<div class="${c}"></div>`).join('')}</div>`;
    }
    // 4+ dots: 2x2 grid
    return `<div class="fpip-dots-grid">${Array(level > 4 ? 4 : level).fill(`<div class="${c}"></div>`).join('')}</div>`;
  }

  /* ── Toggle helper ────────────────────────────────────────────────── */

  _togHtml(on, elId, action, size) {
    const w=size==='sm'?36:44, h=size==='sm'?24:30, tw=size==='sm'?16:20, tt=size==='sm'?4:5;
    const bg  = on?'background:rgba(251,191,36,.25);border-color:rgba(251,191,36,.5)':'background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)';
    const tl  = on?(w-tw-tt)+'px':tt+'px';
    const tbg = on?'#fbbf24':'rgba(255,255,255,.3)';
    const roomId = elId.replace(/^rtog-/,'').replace(/^pp-ltog-/,'');
    return `<div class="tog" style="${bg};width:${w}px;height:${h}px" id="${elId}" data-action="${action}" data-room="${roomId}"><div class="tog-thumb" style="top:${tt}px;width:${tw}px;height:${tw}px;left:${tl};background:${tbg}"></div></div>`;
  }

  /* ── Room builder ─────────────────────────────────────────────────── */

  _buildRoom(room) {
    const masterOn = room.lights ? this._isOn(room.lights.entity) : false;
    let body = '';

    /* theme block — outdoor lighting holiday indicator */
    body += this._buildThemeBlock(room);

    /* lights */
    if (room.lights) {
      const cfg   = room.lights;
      const indiv = cfg.individuals||[];
      const on    = this._isOn(cfg.entity);
      const cnt   = indiv.length?this._onCount(indiv):(on?1:0);
      const tot   = indiv.length||1;
      const avg   = indiv.length?this._avgBright(indiv):(this._brightness(cfg.entity)??(on?100:0));

      if (room.simplified) {
        // Simplified: no lights row — count shown in header, chevron in header
        // store in internal map (never mutate config objects)
        if (!this._simplifiedMeta) this._simplifiedMeta = {};
        this._simplifiedMeta[room.id] = { on, cnt, tot };
      } else {
        const sliderPct = on ? avg : 0;
        // mode: 'auto' = detect from domain, 'toggle' = force toggle, 'slider' = force slider
        const mode = cfg.mode || 'auto';
        const masterIsSwitch = mode === 'toggle' || (mode === 'auto' && cfg.entity.startsWith('switch.'));
        body += `<div class="sec-hdr">Lights</div>`;
        body += `<div class="light-row" id="lrow-${room.id}" style="margin-top:2px">
          ${masterIsSwitch
            ? `<div class="lm-sw-row" data-action="switch-toggle" data-entity="${cfg.entity}" data-room="${room.id}" style="cursor:pointer;-webkit-tap-highlight-color:transparent">
                <div class="lm-track" style="background:${on?'rgba(251,191,36,.35)':'rgba(255,255,255,.1)'}"><div class="lm-fill" id="lfill-${room.id}" style="width:${on?'100':'0'}%"></div></div>
              </div>`
            : `<div class="lm-slider-wrap" id="lslider-${room.id}" data-room="${room.id}" data-action="brightness-drag" data-entity="${cfg.entity}" style="touch-action:none">
                <div class="lm-track"><div class="lm-fill" id="lfill-${room.id}" style="width:${sliderPct}%"></div></div>
                <div class="lm-thumb" id="lthumb-${room.id}" style="left:${Math.max(4,Math.min(sliderPct,96))}%"></div>
              </div>`}
          <div class="lm-btn">${this._ico('chev','rgba(255,255,255,.4)',14,14)}</div>
        </div>`;
        // Individual light toggle grid
        if (cfg.individuals?.length) {
          const btns = cfg.individuals.map(l => {
            const lon = this._isOn(l.entity);
            const bg  = lon ? 'rgba(251,191,36,.10)' : 'rgba(255,255,255,.04)';
            const bc  = lon ? 'rgba(251,191,36,.30)' : 'rgba(255,255,255,.22)';
            const dc  = lon ? '#fbbf24' : 'rgba(255,255,255,.2)';
            const lc  = lon ? 'rgba(251,191,36,.8)' : 'rgba(255,255,255,.6)';
            const nm  = l.name || this._attr(l.entity,'friendly_name') || l.entity.split('.').pop();
            const eid = l.entity.replace(/[^a-z0-9]/g,'_');
            return `<div class="itog" id="itog-${room.id}-${eid}" data-room="${room.id}" data-action="indiv-tog" data-entity="${l.entity}" style="background:${bg};border:1px solid ${bc}"><div class="itog-dot" style="background:${dc}"></div><div class="itog-lbl" style="color:${lc}">${nm}</div></div>`;
          }).join('');
          body += `<div class="itog-grid" id="itog-grid-${room.id}">${btns}</div>`;
        }
      }
    }

    /* fans */
    if (room.fans?.length) {
      body += `<div class="fan-section">`;
      room.fans.forEach((f,fi) => {
        const sp = this._fanSpeeds(f.entity, f.speeds ?? null);
        const idx = this._fanIdx(f.entity, sp);
        let pips  = '';
        for(let i=0;i<sp;i++) pips+=`<div class="fpip${idx===i?' fpip-on':''}" data-room="${room.id}" data-fi="${fi}" data-idx="${i}" data-speeds="${sp}">${this._signal(i,sp,idx===i)}</div>`;
        const fanName = f.name || this._attr(f.entity,'friendly_name') || f.entity.split('.').pop().replace(/_/g,' ');
        body += `<div class="fan-flat"><div class="fan-nm-row"><span class="fan-nm">${fanName}</span></div><div class="fpips">${pips}</div></div>`;
      });
      body += `</div>`;
    }

    /* blinds — status pill */
    if (room.blinds) body += `<div class="sec-hdr">Blinds</div>`;
    if (room.blinds) {
      const max  = room.blinds.max_position || 100;
      const cs   = this._coverState(room.blinds.entity);
      const pos  = Math.min(this._coverPos(room.blinds.entity) ?? 0, max);
      const oo   = cs === 'open'   || pos >= max;
      const co   = cs === 'closed' || pos === 0;
      const mov  = cs === 'opening' || cs === 'closing';
      // pill appearance
      const color = oo ? '#a78bfa' : co ? 'rgba(255,255,255,.35)' : '#a78bfa';
      const bg    = oo ? 'rgba(167,139,250,.06)' : co ? 'rgba(255,255,255,.04)' : 'rgba(167,139,250,.04)';
      const bc    = oo ? 'rgba(167,139,250,.2)'  : co ? 'rgba(255,255,255,.1)'  : 'rgba(167,139,250,.15)';
      const lbl   = mov ? (cs==='opening'?'Opening…':'Closing…') : oo ? 'Blinds Open' : co ? 'Blinds Closed' : 'Blinds Partial';
      const sub   = mov ? 'In progress' : oo ? 'Tap to close' : co ? 'Tap to open' : 'Tap to open fully';
      // tapping: open→close, closed/partial→open to max_position
      const action = oo ? 'blind-close' : 'blind-open';
      const barPct = max > 0 ? Math.round((pos / max) * 100) : 0;
      const chevPath = (oo || cs==='opening') ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>';
      const opacity  = (!oo && !co) ? ';opacity:.7' : '';
      body += `<div class="blind-pill" id="bpill-${room.id}" style="background:${bg};border:1px solid ${bc}" data-room="${room.id}" data-action="${action}">
        <div class="blind-pill-dot" style="background:${color}${opacity}"></div>
        <div>
          <div class="blind-pill-lbl" style="color:${color}${opacity}">${lbl}</div>
          <div class="blind-pill-sub">${sub}</div>
        </div>
        <div class="blind-pill-track"><div class="blind-pill-fill" id="bpfill2-${room.id}" style="width:${barPct}%;background:${color}"></div></div>
        <span class="blind-pill-pct" id="bppct-${room.id}" style="color:${color}${opacity}">${pos}%</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" style="opacity:.6">${chevPath}</svg>
      </div>`;
    }

    /* thermostat */
    if (room.thermostat && this._state(room.thermostat.entity)) {
      const cfg=room.thermostat, eid=cfg.entity;
      const mode=this._hvacMode(eid), meta=this._hvacMeta(mode);
      const cur=this._tempVal(eid), set=this._targetTemp(eid), isOff=mode==='off';
      const dot=meta.split?`<div class="mode-dot-split"></div>`:`<div class="mode-dot" style="background:${meta.dot}"></div>`;
      let sensor='';
      body += `<div class="sec-hdr">Thermostat</div>`;
      body += `<div class="tstat-block tstat-${isOff?'off':mode.replace('_','-')}" id="tblock-${room.id}">
        <div class="tstat-top" data-room="${room.id}" data-action="tstat-popup" style="justify-content:space-between">
          <div class="tcur${isOff?' tcur-off':''}">${cur!=null?cur+'°':'—'}</div>
          ${sensor}
          <div class="hvac-btn" style="background:${meta.bg};border-color:${meta.bc}" data-room="${room.id}" data-action="hvac-cycle">
            ${dot}<span class="hvac-lbl" style="color:${meta.tc}" id="hvac-lbl-${room.id}">${meta.label}</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px;margin-left:auto"><div class="tadj${isOff?' tadj-off':''}" data-room="${room.id}" data-action="temp-dn">−</div>
          <div class="tsetval${isOff?' tsetval-off':''}" id="tset-${room.id}">${isOff?'—':(set!=null?set+'°':'—')}</div>
          <div class="tadj${isOff?' tadj-off':''}" data-room="${room.id}" data-action="temp-up">+</div></div>
        </div>
      </div>`;
    }

    /* sensor */
    if (room.sensor) {
      const v=this._tempVal(room.sensor.entity);
      const unit=this._attr(room.sensor.entity,'unit_of_measurement')||'°F';
      body += `<div class="sensor-row"><div class="sensor-val">${v!=null?v+unit:'—'}</div><div class="sensor-lbl">${room.sensor.name||this._attr(room.sensor.entity,'friendly_name')||'sensor'}<br>sensor</div></div>`;
    }

    /* garage */
    if (room.garage) body += `<div class="sec-hdr">Garage</div>`;
    if (room.garage) {
      const cs  = this._coverState(room.garage.entity);
      const io  = cs === 'open', ic = cs === 'closed';
      const mov = cs === 'opening' || cs === 'closing';
      const color  = ic ? '#4ade80' : io ? '#fbbf24' : '#60a5fa';
      const bg     = ic ? 'rgba(74,222,128,.06)'  : io ? 'rgba(251,191,36,.06)'  : 'rgba(96,165,250,.06)';
      const bc     = ic ? 'rgba(74,222,128,.2)'   : io ? 'rgba(251,191,36,.2)'   : 'rgba(96,165,250,.2)';
      const label  = ic ? 'Closed' : io ? 'Open' : cs === 'opening' ? 'Opening…' : cs === 'closing' ? 'Closing…' : cs === 'stopped' ? 'Stopped' : !cs || cs === 'unavailable' ? 'Unavailable' : 'Closed';
      const sub    = ic ? 'Tap to open' : io ? 'Tap to close' : (cs === 'opening' || cs === 'closing') ? 'In progress' : cs === 'unavailable' ? 'Check device' : 'Tap to open';
      const action = io ? 'garage-close' : 'garage-open';
      const chevPath = (ic || cs === 'opening') ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>';
      body += `<div class="garage-status" style="background:${bg};border:1px solid ${bc}" data-room="${room.id}" data-action="${action}">
        <div class="garage-dot" style="background:${color}"></div>
        <div>
          <div class="garage-lbl" style="color:${color}">${label}</div>
          <div class="garage-sub">${sub}</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" style="margin-left:auto;opacity:.6">${chevPath}</svg>
      </div>`;
    }

    const smMeta = room.simplified ? (this._simplifiedMeta?.[room.id] || null) : null;
    const smCount = smMeta ? `<span class="rhead-count">${smMeta.cnt} of ${smMeta.tot}</span>` : '';
    const smChev  = (smMeta && !room.no_popup) ? `<div class="lm-btn rhead-chev" id="lrow-${room.id}" data-room="${room.id}">${this._ico('chev','rgba(255,255,255,.4)',14,14)}</div>` : '';

    // door pills — supports door: {entity,name} or doors: [{entity,name},...]
    const doorList = room.doors ? room.doors : room.door ? [room.door] : [];
    const doorPills = doorList.map(d => {
      const open = this._state(d.entity)?.state === 'on';
      const color = open ? '#f87171' : '#4ade80';
      const bg    = open ? 'rgba(248,113,113,.08)' : 'rgba(74,222,128,.08)';
      const bc    = open ? 'rgba(248,113,113,.2)'  : 'rgba(74,222,128,.2)';
      const label = d.name || this._state(d.entity)?.attributes?.friendly_name || d.entity;
      return `<div class="door-pill" id="dpill-${room.id}-${d.entity.replace(/\./g,'_')}" style="background:${bg};border:1px solid ${bc}">
        <div class="door-pill-dot" style="background:${color}"></div>
        <span style="color:${color}">${label}</span>
      </div>`;
    }).join('');

    // Header pills: mode dot + thermostat cur°→set°, and sensor temp if separate
    let tempPill = '';
    if (room.thermostat && this._state(room.thermostat.entity)) {
      const _eid   = room.thermostat.entity;
      const _cur   = this._tempVal(_eid);
      const _set   = this._targetTemp(_eid);
      const _mode  = this._hvacMode(_eid);
      const _meta  = this._hvacMeta(_mode);
      const _isOff = _mode === 'off';
      // Mode dot — reuse existing dot pattern
      const _dot = _meta.split
        ? `<div style="width:7px;height:7px;border-radius:50%;background:linear-gradient(90deg,#fb923c 50%,#60a5fa 50%);flex-shrink:0"></div>`
        : `<div style="width:7px;height:7px;border-radius:50%;background:${_isOff ? 'rgba(255,255,255,.2)' : _meta.dot};flex-shrink:0"></div>`;
      const _clr = _isOff ? 'rgba(255,255,255,.10)' : 'rgba(251,146,60,.15)';
      const _bc  = _isOff ? 'rgba(255,255,255,.07)' : 'rgba(251,146,60,.25)';
      if (_cur != null) {
        const _setHtml = (!_isOff && _set != null)
          ? `<span class="rtp-arr">→</span><span class="rtp-set">${_set}°</span>`
          : '';
        tempPill = `<div class="rhead-temp-pill" style="background:${_clr};border:1px solid ${_bc}">
          ${_dot}<span class="rtp-cur">${_cur}°</span>${_setHtml}
        </div>`;
      }
      // Sensor pill — only if a separate sensor entity is configured
      if (room.thermostat.sensor) {
        const _sv = this._tempVal(room.thermostat.sensor);
        if (_sv != null) {
          tempPill += `<div class="rhead-temp-pill" style="background:rgba(96,165,250,.10);border:1px solid rgba(96,165,250,.22)"><span style="color:#60a5fa;font-weight:700">${_sv}°</span></div>`;
        }
      }
    }

    return `<div class="room" id="room-${room.id}">
      <div class="rhead${smMeta?' rhead-simple':''}">
        <span class="rlbl">${room.name}</span>
        ${doorPills}
        ${tempPill}
        ${smCount}
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
          ${smChev}
          ${this._togHtml(masterOn,`rtog-${room.id}`,'room-toggle','lg')}
        </div>
      </div>
      ${body ? `<div class="rbody">${body}</div>` : ''}
    </div>`;
  }

  /* ── Popup: sheets ────────────────────────────────────────────────── */

  _sheet(id, title, sub, inner) {
    return `<div class="rcc-overlay" id="${id}">
      <div class="rcc-sheet">
        <div class="rcc-handle"></div>
        <div class="sheet-head">
          <div><div class="sheet-title">${title}</div>${sub?`<div class="sheet-sub">${sub}</div>`:''}</div>
          <div class="sheet-close" data-close="${id}">×</div>
        </div>
        ${inner}
      </div>
    </div>`;
  }

  _presetRow(list, prefix, grid=false) {
    return (grid ? `<div class="pp-presets-grid">` : `<div class="pp-presets">`) +
      list.map((p,i)=>`<div class="pp-preset" data-action="${prefix}" data-idx="${i}"><div class="pp-dot" style="background:${p.color}"></div><div class="pp-dot-lbl">${p.label}</div></div>`).join('') +
    `</div>`;
  }

  _buildLightsPopup(room) {
    if (!room.lights) return '';
    const cfg=room.lights, indiv=cfg.individuals||[];
    const on=this._isOn(cfg.entity);
    const cnt=indiv.length?this._onCount(indiv):(on?1:0);
    const tot=indiv.length||1;
    const avg=indiv.length?this._avgBright(indiv):(this._brightness(cfg.entity)??(on?100:0));
    const mtog=this._togHtml(on,`pp-ltog-${room.id}`,'popup-master-tog','sm');
    const mbar=`<div class="lm-bar"><div class="lm-fill" style="width:${on?avg:0}%"></div></div>`;

    const sliderPct = on ? avg : 0;
    const ents = (cfg.individuals||[{entity:cfg.entity}]).map(l=>l.entity);
    const lightEnts = ents.filter(e=>!e.startsWith('switch.'));
    // Also check the master group entity itself — HA groups report their own
    // supported_color_modes even when some individuals are plain dimmers/switches
    const masterSupCT    = this._supportsCT(cfg.entity);
    const masterSupColor = this._supportsColor(cfg.entity);
    const hasColors = masterSupCT || masterSupColor || lightEnts.some(e=>this._supportsCT(e)||this._supportsColor(e));
    const anyCT    = masterSupCT    || lightEnts.some(e=>this._supportsCT(e));
    const anyColor = masterSupColor || lightEnts.some(e=>this._supportsColor(e));
    const ctEnts   = [cfg.entity, ...lightEnts].filter(e=>this._supportsCT(e));
    const minK = ctEnts.length ? Math.max(...ctEnts.map(e=>this._ctRange(e).min)) : 2000;
    const maxK = ctEnts.length ? Math.min(...ctEnts.map(e=>this._ctRange(e).max)) : 6500;
    const ctPfx='pct-all:'+room.id, ccPfx='pcc-all:'+room.id;

    const mode = cfg.mode || 'auto'; // 'auto' | 'toggle' | 'slider'
    const masterIsSwitch = mode === 'toggle' || (mode === 'auto' && cfg.entity.startsWith('switch.'));
    const masterBlock=`<div class="sec-hdr" style="padding:10px 14px 4px">All Lights</div><div class="pp-master">
      <div class="pp-mrow">
        ${masterIsSwitch
          ? `<div class="lm-sw-row" data-action="switch-toggle" data-entity="${cfg.entity}" data-room="${room.id}" style="flex:1;cursor:pointer;-webkit-tap-highlight-color:transparent">
              <span class="lm-sw-lbl">All Lights</span>
              <span class="lm-sw-state" id="pp-mstate-${room.id}" style="color:${on?'#fbbf24':'rgba(255,255,255,.35)'}">${on?'On':'Off'}</span>
            </div>`
          : `<div class="lm-slider-wrap" id="pp-mslider-${room.id}" data-room="${room.id}" data-action="brightness-drag" data-entity="${cfg.entity}" style="touch-action:none">
              <div class="lm-track"><div class="lm-fill" id="pp-mfill-${room.id}" style="width:${sliderPct}%"></div></div>
              <div class="lm-thumb" id="pp-mthumb-${room.id}" style="left:${Math.min(sliderPct,96)}%"></div>
            </div>
            <span class="lm-pct" id="pp-mpct-${room.id}">${on?avg+'%':''}</span>`}
        ${hasColors?`<div class="pp-mchev" data-action="popup-master-expand" data-room="${room.id}" id="ppmc-${room.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-linecap="round" style="transition:transform .2s" id="ppmc-a-${room.id}"><polyline points="6 9 12 15 18 9"/></svg>
        </div>`:''}
      </div>
      <div class="pp-master-exp hidden" id="ppme-${room.id}">
        ${(anyCT?`<div class="pp-clbl">Color temperature — all lights</div>
          ${this._presetRow(this._ctPresets().filter(p=>p.kelvin>=minK&&p.kelvin<=maxK),ctPfx,true)}`:'')}
        ${(anyColor?`<div class="pp-clbl">Color — all lights</div>
          ${this._presetRow(this._colorPresets(),ccPfx,true)}`:'')}
      </div>
    </div>`;

    const list = indiv.length?indiv:[{entity:cfg.entity,name:'All Lights'}];
    const lights = list.map((l,li)=>{
      const lon=this._isOn(l.entity), lpct=this._brightness(l.entity)??(lon?100:0);
      const isSw=l.mode==='toggle'||(l.entity.startsWith('switch.')&&l.mode!=='slider');
      const lSliderPct = lon ? lpct : 0;
      const hasCols = !isSw&&(this._supportsCT(l.entity)||this._supportsColor(l.entity));
      const lname = l.name||this._attr(l.entity,'friendly_name')||l.entity.split('.').pop().replace(/_/g,' ');
      return `<div class="pp-light" id="ppl-${room.id}-${li}">
        <span class="pp-lname${lon?' lit':''}">${lname}</span>
        <div class="pp-lrow">
          ${!isSw?`<div class="lm-slider-wrap" id="ppls-wrap-${room.id}-${li}" data-room="${room.id}" data-li="${li}" data-action="popup-brightness-drag" data-entity="${l.entity}" style="touch-action:none">
              <div class="lm-track"><div class="lm-fill" id="ppls-${room.id}-${li}" style="width:${lSliderPct}%"></div></div>
              <div class="lm-thumb" id="pplthumb-${room.id}-${li}" style="left:${Math.max(4,Math.min(lSliderPct,96))}%"></div>
            </div>`:`<div style="flex:1"></div>`}
          <span class="lm-pct" id="ppp-${room.id}-${li}">${lon?(isSw?'On':lpct+'%'):''}</span>
          ${hasCols?`<div class="pp-lchev" data-action="popup-light-exp" data-room="${room.id}" data-li="${li}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2" stroke-linecap="round" style="transition:transform .2s" id="ppla-${room.id}-${li}"><polyline points="6 9 12 15 18 9"/></svg>
          </div>`:''}
        </div>
        ${hasCols?`<div class="pp-color-sec hidden" id="ppcs-${room.id}-${li}">
          ${this._supportsCT(l.entity)?`<div class="pp-clbl">Color temperature</div>
          ${this._presetRow(this._ctPresets().filter(p=>{const r=this._ctRange(l.entity);return p.kelvin>=r.min&&p.kelvin<=r.max;}),'pct:'+room.id+':'+li,true)}`:''}
          ${this._supportsColor(l.entity)?`<div class="pp-clbl">Color</div>
          ${this._presetRow(this._colorPresets(),'pcc:'+room.id+':'+li,true)}`:''}
        </div>`:''}
      </div>`;
    }).join('');

    return this._sheet(`lp-${room.id}`,`${room.name} Lights`,`${cnt} / ${tot}`,
      masterBlock+`<div class="pp-lights">${lights}</div>`);
  }

  _buildBlindPopup(room) {
    if (!room.blinds) return '';
    const max=room.blinds.max_position||100;
    const pos=Math.min(this._coverPos(room.blinds.entity)??0,max);
    return this._sheet(`bp-${room.id}`,`${room.name} Blinds`,'Position',`
      <div style="padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:rgba(255,255,255,.4)">Open → Closed</span>
          <span style="font-size:16px;font-weight:700;color:#a78bfa" id="bpos-${room.id}">${pos}%</span>
        </div>
        <div class="strack" style="height:8px">
          <div class="sfill" id="bpfill-${room.id}" style="width:${((pos/max)*100).toFixed(1)}%;background:#a78bfa;height:100%"></div>
          <input type="range" min="0" max="${max}" step="1" value="${pos}" class="sinput" style="height:22px;margin-top:-7px" data-room="${room.id}" data-action="blind-pos-slide">
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:12px;color:rgba(255,255,255,.25)">0% open</span>
          <span style="font-size:12px;color:rgba(255,255,255,.25)">${max}% closed</span>
        </div>
      </div>`);
  }

  _buildTstatPopup(room) {
    if (!room.thermostat) return '';
    const cfg=room.thermostat, eid=cfg.entity;
    const mode=this._hvacMode(eid), meta=this._hvacMeta(mode);
    const cur=this._tempVal(eid), set=this._targetTemp(eid), isOff=mode==='off';
    const hvacModes=this._hvacOrder(eid, cfg.modes);
    const fanModes=this._suppModes(eid,'fan_modes');
    const swingModes=this._suppModes(eid,'swing_modes');
    const presets=this._suppModes(eid,'preset_modes').filter(p=>!['none','None'].includes(p));
    const modeButtons=this._buildModeButtons(room.id,eid,{hvacModes,fanModes,swingModes,presets,hasFan:fanModes.length>0,hasSwing:swingModes.length>0,hasPreset:presets.length>0});
    let sensor='';
    if (cfg.sensor){const sv=this._tempVal(cfg.sensor),sl=(cfg.sensor_label||'Room\nsensor').replace('\n','<br>');if(sv!=null)sensor=`<div class="t-pill"><div class="t-pill-val">${sv}°</div></div>`;}

    const tblock=`<div class="tstat-block tstat-${isOff?'off':mode.replace('_','-')}" >
      <div class="tstat-top" style="cursor:default">
        <div class="tcur${isOff?' tcur-off':''}">${cur!=null?cur+'°':'—'}</div>
        <div class="tdiv"></div>
        <div class="tsetblock"><div class="tsetlbl">Set to</div>
          <div class="tsetctrl">
            <div class="tadj${isOff?' tadj-off':''}" data-room="${room.id}" data-action="temp-dn">−</div>
            <div class="tsetval${isOff?' tsetval-off':''}" id="tset-pp-${room.id}">${isOff?'—':(set!=null?set+'°':'—')}</div>
            <div class="tadj${isOff?' tadj-off':''}" data-room="${room.id}" data-action="temp-up">+</div>
          </div>
        </div>
        ${sensor}
      </div>
    </div>
    <div style="padding:8px 16px 16px">${modeButtons}</div>`;

    return this._sheet(`tp-${room.id}`,`${room.name} · ${cfg.name||eid}`,cur!=null?cur+'°F now':'',tblock);
  }

  _buildModeButtons(roomId,eid,{hvacModes,fanModes,swingModes,presets,hasFan,hasSwing,hasPreset}) {
    if (!hvacModes.length) return '';
    const mode=this._hvacMode(eid), meta=this._hvacMeta(mode);
    const fanMode=this._attr(eid,'fan_mode')||(fanModes[0]||'');
    const swingMode=this._attr(eid,'swing_mode')||(swingModes[0]||'');
    const presetMode=this._attr(eid,'preset_mode');
    const hasPV=presetMode&&!['none','None',null].includes(presetMode);
    const swMap={off:'sw_off',vertical:'sw_v',horizontal:'sw_h',both:'sw_b','swing off':'sw_off'};
    const swIco=this._ico(swMap[(swingMode||'').toLowerCase()]||'sw_off','#60a5fa',14,14);
    const pColors={eco:'#4ade80',away:'#94a3b8',boost:'#fb923c',sleep:'#60a5fa',home:'#4ade80'};
    const pColor=hasPV?(pColors[(presetMode||'').toLowerCase()]||'#e2e8f0'):'rgba(255,255,255,.2)';
    const dot=meta.split?`<div class="mode-dot-split"></div>`:`<div class="mode-dot" style="background:${meta.dot}"></div>`;

    let btns=`<div class="mode-btn" style="background:${meta.bg};border-color:${meta.bc}" data-room="${roomId}" data-action="hvac-cycle">
      ${dot}<div><div class="mode-txt" style="color:${meta.tc}" id="hvac-lbl-${roomId}">${meta.label}</div><div class="mode-sub">HVAC mode</div></div></div>`;
    if(hasFan)btns+=`<div class="mode-btn mode-btn-fan" data-room="${roomId}" data-action="fan-cycle">
      ${this._ico('fanm','#2dd4bf',14,14)}<div><div class="mode-txt mode-txt-fan" id="fanm-lbl-${roomId}">${fanMode}</div><div class="mode-sub">Fan mode</div></div></div>`;
    if(hasSwing)btns+=`<div class="mode-btn mode-btn-swing" data-room="${roomId}" data-action="swing-cycle">
      <div id="swing-ico-${roomId}">${swIco}</div><div><div class="mode-txt mode-txt-swing" id="swing-lbl-${roomId}">${swingMode}</div><div class="mode-sub">Swing</div></div></div>`;
    if(hasPreset)btns+=`<div class="mode-btn" style="background:rgba(255,255,255,.04);border-color:${hasPV?pColor+'55':'rgba(255,255,255,.1)'}" id="preset-btn-${roomId}" data-room="${roomId}" data-action="preset-cycle">
      <div class="mode-dot" style="background:${pColor}" id="preset-dot-${roomId}"></div>
      <div><div class="mode-txt" style="color:${hasPV?pColor:'rgba(255,255,255,.4)'}" id="preset-lbl-${roomId}">${hasPV?presetMode:'No preset'}</div><div class="mode-sub">Preset</div></div></div>`;

    const cnt=1+(hasFan?1:0)+(hasSwing?1:0)+(hasPreset?1:0);
    return `<div class="mode-btns" style="grid-template-columns:${cnt===1?'1fr':'1fr 1fr'}">${btns}</div>`;
  }

  /* ── CSS ──────────────────────────────────────────────────────────── */

  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    .grid{display:grid;gap:8px;padding:8px 14px}
    @media(max-width:767px){.grid{grid-template-columns:1fr!important}}
    .room{border-radius:10px;border:1px solid rgba(255,255,255,.25);overflow:hidden}
    .door-pill{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-left:7px;flex-shrink:0}
    .door-pill-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .rhead{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 9px;border-bottom:1px solid rgba(255,255,255,.18)}
    .rlbl{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px}
    .rbody{padding:6px 10px 10px;display:flex;flex-direction:column;gap:5px}
    .tog{position:relative;border-radius:99px;cursor:pointer;flex-shrink:0;border:1px solid;transition:background .15s,border-color .15s;user-select:none}
    .tog-thumb{position:absolute;border-radius:50%;transition:left .15s,background .15s}
    .light-row{display:flex;align-items:center;gap:8px;padding:7px 0;user-select:none;transition:opacity .2s}
    .lm-lbl{font-size:13px;font-weight:700;color:rgba(255,255,255,.5);flex-shrink:0}
    .lm-lbl.lit{color:rgba(255,255,255,.8)}
    .lm-sub{font-size:10px;color:rgba(255,255,255,.3);font-weight:400;margin-left:4px}
    .lm-slider-wrap{flex:1;height:32px;display:flex;align-items:center;position:relative;cursor:ew-resize;min-width:0;padding-right:12px}
    .lm-track{width:100%;height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;position:relative}
    .lm-fill{height:100%;border-radius:99px;background:#fbbf24;transition:width .05s}
    .lm-thumb{position:absolute;top:50%;width:16px;height:16px;border-radius:50%;background:#fbbf24;border:2px solid rgba(255,255,255,.9);transform:translate(-50%,-50%);pointer-events:none;transition:left .05s}
    .lm-pct{font-size:11px;font-weight:700;color:rgba(255,255,255,.35);width:28px;text-align:right;flex-shrink:0}
    .lm-sw-row{flex:1;display:flex;align-items:center;gap:8px;padding:0 4px;min-width:0;user-select:none}
    .lm-sw-lbl{font-size:12px;font-weight:700;color:rgba(255,255,255,.55);flex:1}
    .lm-sw-state{font-size:12px;font-weight:700;flex-shrink:0}
    .lm-btn{width:26px;height:26px;border-radius:5px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}
    .itog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:4px 0 2px;}
    .itog{border-radius:7px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;min-height:54px;justify-content:center;transition:background .1s,border-color .1s}
    .itog:active{transform:scale(.94)}
    .itog-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    .itog-lbl{font-size:12px;font-weight:700;text-align:center;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:0 3px}
    .light-row-simple{cursor:pointer}
    .rhead-count{font-size:11px;color:rgba(255,255,255,.35);margin-left:6px;font-weight:400}
    .rhead-chev{cursor:pointer}
    .fan-section{display:flex;flex-direction:column;gap:4px}
    .fan-flat{display:flex;flex-direction:column;gap:4px}
    .fan-nm-row{padding:0 2px}
    .fan-nm{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.3)}
    .sec-hdr{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);padding:8px 0 2px}
    .fpips{display:flex;gap:4px;flex:1}
    .fpip{flex:1;height:44px;border-radius:7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,border-color .1s;user-select:none;-webkit-tap-highlight-color:transparent}
    .fpip:active{transform:scale(.9)}
    .fpip-on{background:rgba(45,212,191,.15);border-color:rgba(45,212,191,.4)}
    .fpip-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2)}
    .fpip-dot-on{background:#2dd4bf}
    .fpip-dot-off{font-size:9px;font-weight:700;color:rgba(255,255,255,.25)}
    .fpip-dots-row{display:flex;gap:4px;align-items:center;justify-content:center}
    .fpip-dots-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;align-items:center;justify-items:center}
    .bpip-pos{flex:0 0 auto;width:68px}
    .blind-pill{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;cursor:pointer;user-select:none;transition:filter .1s;margin:2px 0}
    .blind-pill:active{filter:brightness(.85)}
    .blind-pill-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
    .blind-pill-lbl{font-size:14px;font-weight:700}
    .blind-pill-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .blind-pill-track{flex:1;height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin:0 2px}
    .blind-pill-fill{height:100%;border-radius:99px;transition:width .3s}
    .blind-pill-pct{font-size:12px;font-weight:700;flex-shrink:0;width:30px;text-align:right}
    .garage-status{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;user-select:none;transition:filter .1s;margin:2px 0}
    .garage-status:active{filter:brightness(.85)}
    .garage-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
    .garage-lbl{font-size:14px;font-weight:700}
    .garage-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .bpip-pos span{color:rgba(139,92,246,.7)}
    .tstat-block{border-radius:0 8px 8px 0;overflow:hidden}
    .tstat-heat{border-left:3px solid rgba(251,146,60,.5);background:rgba(251,146,60,.05)}
    .tstat-cool{border-left:3px solid rgba(96,165,250,.5);background:rgba(96,165,250,.05)}
    .tstat-heat-cool,.tstat-auto{border-left:3px solid rgba(139,92,246,.5);background:rgba(139,92,246,.04)}
    .tstat-fan-only{border-left:3px solid rgba(20,184,166,.5);background:rgba(20,184,166,.04)}
    .tstat-dry{border-left:3px solid rgba(251,191,36,.5);background:rgba(251,191,36,.04)}
    .tstat-off{border-left:3px solid rgba(255,255,255,.12)}
    .tstat-top{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:pointer;user-select:none}
    .tstat-top:active{filter:brightness(.88)}
    .tcur{font-size:24px;font-weight:700;color:var(--primary-text-color);letter-spacing:-1px;line-height:1}
    .tcur-off{color:rgba(255,255,255,.4)}
    .tdiv{width:1px;height:28px;background:rgba(255,255,255,.1);flex-shrink:0}
    .tsetblock{flex:1;display:flex;flex-direction:column;align-items:center}
    .tsetctrl{display:flex;align-items:center;gap:4px}
    .tadj{width:34px;height:34px;flex-shrink:0;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,.12);color:var(--primary-text-color);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;user-select:none;transition:background .1s}
    .tadj:active{background:rgba(255,255,255,.18)}
    .tadj-off{opacity:.3;pointer-events:none}
    .tsetval{font-size:18px;font-weight:700;color:#fb923c;min-width:36px;text-align:center}
    .tsetval-off{color:rgba(255,255,255,.3)}
    .t-pill{display:flex;align-items:center;gap:4px;padding:5px 9px;border-radius:7px;background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.18);margin-left:3px;flex-shrink:0}
    .t-pill-val{font-size:18px;font-weight:700;color:#60a5fa;line-height:1}
    .t-pill-lbl{font-size:9px;color:rgba(96,165,250,.6);line-height:1.3}
    .hvac-btn{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:7px;border:0.5px solid;cursor:pointer;transition:transform .1s;user-select:none}
    .hvac-btn:active{transform:scale(.95)}
    .hvac-lbl{font-size:11px;font-weight:700}
    .rhead-temp-pill{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;flex-shrink:0;margin-left:6px}
    .rhead-temp-pill .rtp-cur{color:var(--primary-text-color)}
    .rhead-temp-pill .rtp-arr{color:rgba(255,255,255,.25);margin:0 1px}
    .rhead-temp-pill .rtp-set{color:#fb923c}
    .mode-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .mode-dot-split{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:linear-gradient(90deg,#fb923c 50%,#60a5fa 50%)}
    .sensor-row{border-radius:8px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);padding:10px 12px;display:flex;align-items:center;gap:10px}
    .sensor-val{font-size:34px;font-weight:700;color:var(--primary-text-color);letter-spacing:-1px;line-height:1}
    .sensor-lbl{font-size:12px;color:rgba(255,255,255,.3);line-height:1.5}
    .mode-btns{display:grid;gap:5px;padding:4px 0}
    .mode-btn{border-radius:9px;padding:9px 12px;display:flex;align-items:center;gap:9px;cursor:pointer;border:0.5px solid;transition:transform .1s;user-select:none}
    .mode-btn:active{transform:scale(.97)}
    .mode-txt{font-size:13px;font-weight:700}
    .mode-sub{font-size:9px;color:rgba(255,255,255,.28);font-weight:400;margin-top:1px}
    .mode-btn-fan{background:rgba(20,184,166,.07)!important;border-color:rgba(20,184,166,.3)!important}
    .mode-txt-fan{color:#2dd4bf}
    .mode-btn-swing{background:rgba(96,165,250,.06)!important;border-color:rgba(96,165,250,.25)!important}
    .mode-txt-swing{color:#60a5fa}
    .strack{height:5px;border-radius:99px;background:rgba(255,255,255,.08);position:relative;overflow:visible}
    .sfill{height:100%;border-radius:99px;background:#fbbf24;transition:width .1s;pointer-events:none}
    .sinput{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer;height:18px;margin-top:-6px}
    .theme-block{margin-bottom:4px}
    .theme-block-hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px}
    .theme-block-name{font-size:13px;font-weight:700}
    .theme-block-sub{font-size:10px;color:rgba(255,255,255,.35);margin-left:auto;white-space:nowrap}
    .theme-areas{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
    .theme-area{border-radius:7px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;transition:background .1s,border-color .1s;min-height:58px;justify-content:center}
    .theme-area:active{transform:scale(.94)}
    .theme-area-label{font-size:10px;font-weight:700;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:0 2px}
    .theme-area-swatches{display:flex;gap:3px;justify-content:center}
    .theme-area-swatch{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    /* popup CSS lives in portal style block */
  `; }

  /* ── Theme block — outdoor lighting holiday indicator ─────────────────── */

  _themeAreaState(area) {
    const isSwitch = area.type === 'switch';
    const on = area.entity
      ? (isSwitch
          ? this._hass?.states[area.entity]?.state === 'on'
          : this._isOn(area.entity))
      : false;
    const bri = isSwitch ? null : this._brightness(area.entity);
    if (!on) return { label:'Off',  color:'rgba(255,255,255,.25)', pct:0   };
    if (isSwitch) return { label:'On',  color:'#4ade80',             pct:100 };
    if (bri != null && bri < 30)
              return { label:bri+'%', color:'#fbbf24',             pct:bri };
    const label = area.count ? area.count+' on' : 'On';
    return { label, color:'#4ade80', pct: bri ?? 100 };
  }

  _buildThemeBlock(room) {
    if (!room.theme_block) return '';
    const cfg    = room.theme_block;
    const sensor = this._hass?.states[cfg.sensor];
    const theme  = sensor?.state?.trim() || 'Default';
    const attrs  = sensor?.attributes || {};
    const isHol  = attrs.is_holiday === true || theme !== 'Default';
    const accent = attrs.accent || 'rgba(255,255,255,.55)';
    const emoji  = attrs.emoji  || '🌙';
    const sub    = isHol ? 'Holiday theme active' : 'Warm white';

    const areasHtml = (cfg.areas || []).map((area, ai) => {
      const colors   = attrs[area.color_attr] || ['#ffcf7d'];
      const isSwitch = area.type === 'switch';
      const st       = this._themeAreaState(area);
      const gradient = colors.length > 1
        ? `linear-gradient(to right,${colors.join(',')})`
        : colors[0] || '#ffcf7d';
      const swatchHtml = isSwitch ? '' :
        colors.slice(0,6).map(c => `<div class="theme-area-swatch" style="background:${c}"></div>`).join('');
      const isOn = st.pct > 0;
      const btnBg  = isOn ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.02)';
      const btnBc  = isOn ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)';
      const lblClr = isOn ? st.color : 'rgba(255,255,255,.2)';
      return `<div class="theme-area" id="tarea-${room.id}-${ai}" style="background:${btnBg};border:1px solid ${btnBc};${isOn?'':'opacity:.5'}">
        <div class="theme-area-swatches" id="tasw-${room.id}-${ai}">${swatchHtml}</div>
        <div class="theme-area-label" id="tast-${room.id}-${ai}" style="color:${lblClr}">${area.label}</div>
      </div>`;
    }).join('');

    return `<div class="theme-block" id="tblock-${room.id}">
      <div class="theme-block-hdr">
        <span style="font-size:14px;line-height:1">${emoji}</span>
        <div class="theme-block-name" id="tname-${room.id}" style="color:${accent}">${theme}</div>
        <div class="theme-block-sub" id="tsub-${room.id}">${sub}</div>
      </div>
      <div class="theme-areas">${areasHtml}</div>
    </div>`;
  }

  _patchThemeBlock(room, sr) {
    const cfg    = room.theme_block;
    const sensor = this._hass?.states[cfg.sensor];
    if (!sensor) return;
    const theme  = sensor.state?.trim() || 'Default';
    const attrs  = sensor.attributes || {};
    const isHol  = attrs.is_holiday === true || theme !== 'Default';
    const accent = attrs.accent || 'rgba(255,255,255,.55)';
    const emoji  = attrs.emoji  || '🌙';

    const nameEl = sr.getElementById(`tname-${room.id}`);
    const subEl  = sr.getElementById(`tsub-${room.id}`);
    if (nameEl) { nameEl.textContent = theme; nameEl.style.color = accent; }
    if (subEl)  subEl.textContent = isHol ? 'Holiday theme active' : 'Warm white';

    (cfg.areas || []).forEach((area, ai) => {
      const colors   = attrs[area.color_attr] || ['#ffcf7d'];
      const isSwitch = area.type === 'switch';
      const st       = this._themeAreaState(area);
      const gradient = colors.length > 1
        ? `linear-gradient(to right,${colors.join(',')})`
        : colors[0] || '#ffcf7d';

      const btnEl = sr.getElementById(`tarea-${room.id}-${ai}`);
      const stEl  = sr.getElementById(`tast-${room.id}-${ai}`);
      const swEl  = sr.getElementById(`tasw-${room.id}-${ai}`);
      const isOn  = st.pct > 0;
      if (btnEl) {
        btnEl.style.background  = isOn ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.02)';
        btnEl.style.borderColor = isOn ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)';
        btnEl.style.opacity     = isOn ? '' : '0.5';
      }
      if (stEl)  { stEl.textContent = area.label; stEl.style.color = isOn ? st.color : 'rgba(255,255,255,.3)'; }
      if (swEl && !isSwitch) {
        swEl.innerHTML = colors.slice(0,6)
          .map(c => `<div class="theme-area-swatch" style="background:${c}"></div>`).join('');
      }
    });
  }

  /* ── Patch — update values without destroying DOM ─────────────────── */

  _patchTog(sr, id, on) {
    const tog = sr.getElementById(id);
    if (!tog) return;
    const w = parseInt(tog.style.width), tt = 2, tw = parseInt(tog.style.height) - tt*2;
    const thumb = tog.querySelector('.tog-thumb');
    if (on) {
      tog.style.background = 'rgba(251,191,36,.25)';
      tog.style.borderColor = 'rgba(251,191,36,.5)';
      if (thumb) { thumb.style.left = (w-tw-tt)+'px'; thumb.style.background = '#fbbf24'; }
    } else {
      tog.style.background = 'rgba(255,255,255,.06)';
      tog.style.borderColor = 'rgba(255,255,255,.12)';
      if (thumb) { thumb.style.left = tt+'px'; thumb.style.background = 'rgba(255,255,255,.3)'; }
    }
  }

  _patch() {
    const sr = this.shadowRoot;
    this._config.rooms.forEach(room => {
      // lights toggle + slider + room toggle visual
      const masterOn = room.lights ? this._isOn(room.lights.entity) : false;
      // dim light row when off
      const lrowEl = sr.getElementById(`lrow-${room.id}`);
      
      // update room toggle thumb
      this._patchTog(sr, `rtog-${room.id}`, masterOn);

      if (room.lights) {
        const on  = this._isOn(room.lights.entity);
        const indiv = room.lights.individuals||[];
        const cnt = indiv.length ? this._onCount(indiv) : (on?1:0);
        const tot = indiv.length||1;
        const avg = indiv.length ? this._avgBright(indiv) : (this._brightness(room.lights.entity)??(on?100:0));
        // update fill + thumb + pct on slider
        const fill  = sr.getElementById(`lfill-${room.id}`);
        const thumb = sr.getElementById(`lthumb-${room.id}`);
        const pct   = sr.getElementById(`lpct-${room.id}`);
        if (fill)  fill.style.width  = (on?avg:0)+'%';
        if (thumb) thumb.style.left  = Math.max(4,Math.min(on?avg:0,96))+'%';
        if (pct)   pct.textContent   = on?avg+'%':'';
        // lm-lbl lit class
        const lbl = sr.querySelector(`#lrow-${room.id} .lm-lbl`);
        if (lbl) lbl.className = `lm-lbl${on?' lit':''}`;
        // individual light toggle buttons
        const itogGrid = sr.getElementById(`itog-grid-${room.id}`);
        if (itogGrid && room.lights?.individuals) {
          room.lights.individuals.forEach(l => {
            const lon = this._isOn(l.entity);
            const btn = itogGrid.querySelector(`[data-entity="${l.entity}"]`);
            if (!btn) return;
            btn.style.background = lon ? 'rgba(251,191,36,.10)' : 'rgba(255,255,255,.04)';
            btn.style.borderColor = lon ? 'rgba(251,191,36,.30)' : 'rgba(255,255,255,.08)';
            const dot2=btn.querySelector('.itog-dot'), lbl2=btn.querySelector('.itog-lbl');
            if (dot2) dot2.style.background = lon ? '#fbbf24' : 'rgba(255,255,255,.2)';
            if (lbl2) lbl2.style.color = lon ? 'rgba(251,191,36,.8)' : 'rgba(255,255,255,.35)';
          });
        }
        // simplified header count
        if (!this._simplifiedMeta) this._simplifiedMeta = {};
        this._simplifiedMeta[room.id] = { on, cnt, tot };
        const hcount = sr.querySelector(`#room-${room.id} .rhead-count`);
        if (hcount) hcount.textContent = `${cnt} of ${tot}`;

        // patch popup individual light rows (fill, thumb, pct, on/off classes)
        const oc = this._overlayContainer;
        if (oc && indiv.length) {
          // master popup slider
          const mfill  = oc.querySelector(`#pp-mfill-${room.id}`);
          const mthumb = oc.querySelector(`#pp-mthumb-${room.id}`);
          const mpct   = oc.querySelector(`#pp-mpct-${room.id}`);
          if (mfill)  mfill.style.width  = (on?avg:0)+'%';
          if (mthumb) mthumb.style.left  = Math.min(on?avg:0,96)+'%';
          if (mpct)   mpct.textContent   = on?avg+'%':'';
          // individual light rows
          indiv.forEach((l, li) => {
            const lon  = this._isOn(l.entity);
            const lpct = this._brightness(l.entity)??(lon?100:0);
            const lSliderPct = lon ? lpct : 0;
            const lightEl = oc.querySelector(`#ppl-${room.id}-${li}`);
            if (lightEl) {
              if (lon) lightEl.classList.add('pp-light-on');
              else     lightEl.classList.remove('pp-light-on');
            }
            const lname = oc.querySelector(`#ppl-${room.id}-${li} .pp-lname`);
            if (lname) lname.className = `pp-lname${lon?' lit':''}`;
            const lfill  = oc.querySelector(`#ppls-${room.id}-${li}`);
            const lthumb = oc.querySelector(`#pplthumb-${room.id}-${li}`);
            const lpctEl = oc.querySelector(`#ppp-${room.id}-${li}`);
            if (lfill)  lfill.style.width  = lSliderPct+'%';
            if (lthumb) lthumb.style.left  = Math.max(4,Math.min(lSliderPct,96))+'%';
            if (lpctEl) lpctEl.textContent = lon ? (l.entity.startsWith('switch.')?'On':lpct+'%') : '';
          });
        }
      }
      // thermostat setpoint labels
      if (room.thermostat && this._state(room.thermostat.entity)) {
        const eid = room.thermostat.entity;
        const set = this._targetTemp(eid);
        const mode = this._hvacMode(eid);
        const isOff = mode === 'off';
        // inline card
        const tset = sr.getElementById(`tset-${room.id}`);
        if (tset) tset.textContent = isOff ? '—' : (set!=null?set+'°':'—');
        // popup
        const tsetPp = sr.getElementById(`tset-pp-${room.id}`);
        if (tsetPp) tsetPp.textContent = isOff ? '—' : (set!=null?set+'°':'—');
        // hvac button label
        const meta = this._hvacMeta(mode);
        const hvacLbl = sr.getElementById(`hvac-lbl-${room.id}`);
        if (hvacLbl) { hvacLbl.textContent = meta.label; hvacLbl.style.color = meta.tc; }
      }
      // door pills in header
      if (room.door || room.doors) {
        const doorList = room.doors ? room.doors : [room.door];
        doorList.forEach(d => {
          const pill = sr.querySelector(`#dpill-${room.id}-${d.entity.replace(/\./g,'_')}`);
          if (!pill) return;
          const open  = this._state(d.entity)?.state === 'on';
          const color = open ? '#f87171' : '#4ade80';
          const bg    = open ? 'rgba(248,113,113,.08)' : 'rgba(74,222,128,.08)';
          const bc    = open ? 'rgba(248,113,113,.2)'  : 'rgba(74,222,128,.2)';
          pill.style.background   = bg;
          pill.style.borderColor  = bc;
          const dot  = pill.querySelector('.door-pill-dot');
          const span = pill.querySelector('span');
          if (dot)  dot.style.background = color;
          if (span) span.style.color     = color;
        });
      }

      // blind pill
      if (room.blinds) {
        const pill = sr.querySelector(`#bpill-${room.id}`);
        if (pill) {
          const max  = room.blinds.max_position || 100;
          const cs   = this._coverState(room.blinds.entity);
          const pos  = Math.min(this._coverPos(room.blinds.entity) ?? 0, max);
          const oo   = cs === 'open'   || pos >= max;
          const co   = cs === 'closed' || pos === 0;
          const mov  = cs === 'opening' || cs === 'closing';
          const color = oo ? '#a78bfa' : co ? 'rgba(255,255,255,.35)' : '#a78bfa';
          const bg    = oo ? 'rgba(167,139,250,.06)' : co ? 'rgba(255,255,255,.04)' : 'rgba(167,139,250,.04)';
          const bc    = oo ? 'rgba(167,139,250,.2)'  : co ? 'rgba(255,255,255,.1)'  : 'rgba(167,139,250,.15)';
          const lbl   = mov ? (cs==='opening'?'Opening…':'Closing…') : oo ? 'Blinds Open' : co ? 'Blinds Closed' : 'Blinds Partial';
          const sub   = mov ? 'In progress' : oo ? 'Tap to close' : co ? 'Tap to open' : 'Tap to open fully';
          const action = oo ? 'blind-close' : 'blind-open';
          const barPct = max > 0 ? Math.round((pos / max) * 100) : 0;
          const chevPath = (oo || cs==='opening') ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>';
          const opacity = (!oo && !co) ? ';opacity:.7' : '';
          pill.style.background  = bg;
          pill.style.borderColor = bc;
          pill.dataset.action    = action;
          const dot  = pill.querySelector('.blind-pill-dot');
          const llbl = pill.querySelector('.blind-pill-lbl');
          const lsub = pill.querySelector('.blind-pill-sub');
          const fill = sr.querySelector(`#bpfill2-${room.id}`);
          const pct  = sr.querySelector(`#bppct-${room.id}`);
          const svg  = pill.querySelector('svg');
          if (dot)  { dot.style.background = color; dot.style.opacity = (!oo&&!co)?'.7':'1'; }
          if (llbl) { llbl.textContent = lbl; llbl.style.color = color; llbl.style.opacity = (!oo&&!co)?'.7':'1'; }
          if (lsub) lsub.textContent = sub;
          if (fill) { fill.style.width = barPct+'%'; fill.style.background = color; }
          if (pct)  { pct.textContent = pos+'%'; pct.style.color = color; pct.style.opacity = (!oo&&!co)?'.7':'1'; }
          if (svg)  { svg.style.stroke = color; svg.innerHTML = chevPath; }
        }
      }

      // garage status pill
      if (room.garage) {
        const pill = sr.querySelector(`.garage-status[data-room="${room.id}"]`);
        if (pill) {
          const cs  = this._coverState(room.garage.entity);
          const io  = cs === 'open', ic = cs === 'closed';
          const color = ic ? '#4ade80' : io ? '#fbbf24' : '#60a5fa';
          const bg    = ic ? 'rgba(74,222,128,.06)'  : io ? 'rgba(251,191,36,.06)'  : 'rgba(96,165,250,.06)';
          const bc    = ic ? 'rgba(74,222,128,.2)'   : io ? 'rgba(251,191,36,.2)'   : 'rgba(96,165,250,.2)';
          const label = ic ? 'Closed' : io ? 'Open' : cs === 'opening' ? 'Opening…' : cs === 'closing' ? 'Closing…' : 'Unknown';
          const sub   = ic ? 'Tap to open' : io ? 'Tap to close' : 'In progress';
          const action= io ? 'garage-close' : 'garage-open';
          const chevPath = (ic || cs === 'opening') ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>';
          pill.style.background = bg;
          pill.style.borderColor = bc;
          pill.dataset.action = action;
          const dot = pill.querySelector('.garage-dot');
          const lbl = pill.querySelector('.garage-lbl');
          const sub2= pill.querySelector('.garage-sub');
          const svg = pill.querySelector('svg');
          if (dot) dot.style.background = color;
          if (lbl) { lbl.textContent = label; lbl.style.color = color; }
          if (sub2) sub2.textContent = sub;
          if (svg)  { svg.style.stroke = color; svg.innerHTML = chevPath; }
        }
      }

      // fan pips — update class AND SVG signal icon
      if (room.fans?.length) {
        room.fans.forEach((f,fi) => {
          const sp = this._fanSpeeds(f.entity, f.speeds ?? null);
          const idx = this._fanIdx(f.entity, sp);
          for (let i=0; i<sp; i++) {
            const pip = sr.querySelector(`.fpip[data-room="${room.id}"][data-fi="${fi}"][data-idx="${i}"]`);
            if (!pip) continue;
            const active = idx === i;
            if (active) pip.classList.add('fpip-on');
            else pip.classList.remove('fpip-on');
            // also update the signal SVG inside
            pip.innerHTML = this._signal(i, sp, active);
          }
        });
      }

      // theme block
      if (room.theme_block) this._patchThemeBlock(room, sr);
    });
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  _render() {
    if (!this._config.rooms) return;
    const rooms = this._config.rooms;
    const cols  = Math.min(rooms.length, 3);
    const gcols = cols===1?'1fr':cols===2?'1fr 1fr':'repeat(3,1fr)';

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="grid" style="grid-template-columns:${gcols}">
          ${rooms.map(r => this._buildRoom(r)).join('')}
        </div>
      </ha-card>
`;

    // Remove any previous portalled overlays from this instance
    this._overlayContainer?.remove();
    const oc = document.createElement('div');
    oc.className = 'rcc-overlays';
    oc.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;font-size:16px';
    oc.innerHTML = `
      <style>
        .rcc-overlay{display:none;position:absolute;inset:0;background:rgba(0,0,0,.55);
          align-items:flex-end;justify-content:center;pointer-events:all}
        .rcc-overlay.open{display:flex}
        @media(min-width:768px){.rcc-overlay{align-items:center;justify-content:center;padding:24px}}
        .rcc-sheet{background:var(--card-background-color,#1e1e1e);border:1px solid rgba(255,255,255,.12);
          border-radius:16px 16px 0 0;border-bottom:none;padding:0 0 16px;overflow-y:auto;
          max-height:88vh;width:100%;max-width:100%;touch-action:pan-y;overscroll-behavior:contain;
          font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px}
        @media(min-width:768px){.rcc-sheet{max-width:440px;border-radius:16px;
          border-bottom:1px solid rgba(255,255,255,.12);max-height:80vh}}
        .rcc-handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);margin:12px auto 8px}
        @media(min-width:768px){.rcc-handle{display:none}}
        *{box-sizing:border-box;margin:0;padding:0;color:inherit}
        .sheet-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 12px;border-bottom:1px solid rgba(255,255,255,.07)}
        .sheet-title{font-size:17px;font-weight:700;color:white;letter-spacing:-.2px}
        .sheet-sub{font-size:10px;color:rgba(255,255,255,.35);margin-top:2px}
        .sheet-close{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.08);cursor:pointer;color:rgba(255,255,255,.6);font-size:20px;display:flex;align-items:center;justify-content:center;user-select:none;border:none;flex-shrink:0}
        .hidden{display:none!important}
        .pp-master{margin:10px 14px 6px;border-radius:8px;background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.25);overflow:hidden}
        .pp-mrow{display:flex;align-items:center;gap:8px;padding:10px 12px}
        .pp-minfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        .pp-mlbl{font-size:14px;font-weight:700;color:rgba(255,255,255,.8);flex-shrink:0}
        .pp-msub{font-size:11px;color:rgba(255,255,255,.35);font-weight:400;margin-left:4px}
        .pp-mchev{width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent}
        .pp-master-exp{padding:0 12px 10px;border-top:1px solid rgba(251,191,36,.12)}
        .pp-lights{padding:4px 14px 8px;display:flex;flex-direction:column;gap:8px}
        .pp-light{opacity:.5;transition:opacity .15s;padding:0}
        .pp-light-on{opacity:1}
        .pp-lname{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);padding:0 0 5px;display:block}
        .pp-lname.lit{color:rgba(255,255,255,.65)}
        .pp-lrow{display:flex;align-items:center;gap:8px;padding:0}
        .pp-ldot{display:none}
        .pp-ltrack{flex:1;height:4px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
        .pp-lfill{height:100%;border-radius:99px;background:#fbbf24;transition:width .1s}
        .pp-lpct{font-size:9px;font-weight:700;color:rgba(251,191,36,.75);width:30px;text-align:right;flex-shrink:0}
        .pp-lpct.off{color:rgba(255,255,255,.2)}
        .pp-lchev{width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent}
        .pp-lslider{padding:0 11px 7px;display:flex;align-items:center}
        .pp-color-sec{padding:7px 11px 9px;border-top:1px solid rgba(255,255,255,.06)}
        .pp-clbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:rgba(255,255,255,.25);margin-bottom:6px;margin-top:3px}
        .pp-presets{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
        .pp-presets-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:10px}
        .pp-preset{flex:1;min-width:0;height:60px;border-radius:7px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 4px;transition:all .12s;user-select:none;-webkit-tap-highlight-color:transparent}
        .pp-presets-grid .pp-preset{height:54px;flex:unset}
        .pp-preset:active{transform:scale(.92)}
        .pp-preset-sel{border-width:1.5px}
        .pp-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0}
        .pp-dot-lbl{font-size:10px;font-weight:700;color:rgba(255,255,255,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:center;line-height:1}
        .pp-preset-sel .pp-dot-lbl{color:rgba(255,255,255,.82)}
        .strack{height:5px;border-radius:99px;background:rgba(255,255,255,.08);position:relative;overflow:visible}
        .sfill{height:100%;border-radius:99px;background:#fbbf24;transition:width .1s;pointer-events:none}
        .sinput{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer;height:44px;margin-top:-19px}
        .lm-bar{height:4px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
        .lm-slider-wrap{flex:1;height:36px;display:flex;align-items:center;position:relative;cursor:ew-resize;min-width:0}
        .lm-track{width:100%;height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;position:relative}
        .lm-fill{height:100%;border-radius:99px;background:#fbbf24;transition:width .05s}
        .lm-thumb{position:absolute;top:50%;width:18px;height:18px;border-radius:50%;background:#fbbf24;border:2px solid rgba(255,255,255,.9);transform:translate(-50%,-50%);pointer-events:none;transition:left .05s}
        .lm-pct{font-size:12px;font-weight:700;color:rgba(255,255,255,.35);width:32px;text-align:right;flex-shrink:0}
        .lm-sw-row{flex:1;display:flex;align-items:center;gap:8px;padding:0 4px;min-width:0;user-select:none}
        .lm-sw-lbl{font-size:12px;font-weight:700;color:rgba(255,255,255,.55);flex:1}
        .lm-sw-state{font-size:12px;font-weight:700;flex-shrink:0}
        .lm-fill{height:100%;border-radius:99px;background:#fbbf24;transition:width .2s}
        .tog{position:relative;border-radius:8px;cursor:pointer;flex-shrink:0;border:1px solid;user-select:none}
        .tog-thumb{position:absolute;border-radius:50%;transition:left .15s,background .15s}
        .mode-btns{display:grid;gap:5px;padding:4px 0}
        .mode-btn{border-radius:9px;padding:9px 12px;display:flex;align-items:center;gap:9px;cursor:pointer;border:0.5px solid;transition:transform .1s;user-select:none}
        .mode-btn:active{transform:scale(.97)}
        .mode-txt{font-size:13px;font-weight:700}
        .mode-sub{font-size:9px;color:rgba(255,255,255,.28);font-weight:400;margin-top:1px}
        .mode-btn-fan{background:rgba(20,184,166,.07)!important;border-color:rgba(20,184,166,.3)!important}
        .mode-txt-fan{color:#2dd4bf}
        .mode-btn-swing{background:rgba(96,165,250,.06)!important;border-color:rgba(96,165,250,.25)!important}
        .mode-txt-swing{color:#60a5fa}
        .mode-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .mode-dot-split{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:linear-gradient(90deg,#fb923c 50%,#60a5fa 50%)}
        .tstat-block{border-radius:0 8px 8px 0;overflow:hidden}
        .tstat-heat{border-left:3px solid rgba(251,146,60,.5);background:rgba(251,146,60,.05)}
        .tstat-cool{border-left:3px solid rgba(96,165,250,.5);background:rgba(96,165,250,.05)}
        .tstat-heat-cool,.tstat-auto{border-left:3px solid rgba(139,92,246,.5);background:rgba(139,92,246,.04)}
        .tstat-fan-only{border-left:3px solid rgba(20,184,166,.5);background:rgba(20,184,166,.04)}
        .tstat-dry{border-left:3px solid rgba(251,191,36,.5);background:rgba(251,191,36,.04)}
        .tstat-off{border-left:3px solid rgba(255,255,255,.12)}
        .tstat-top{display:flex;align-items:center;gap:8px;padding:10px 12px}
        .tcur{font-size:34px;font-weight:700;color:#e2e8f0;letter-spacing:-1.5px;line-height:1}
        .tcur-off{color:rgba(255,255,255,.4)}
        .tdiv{width:1px;height:36px;background:rgba(255,255,255,.1);flex-shrink:0}
        .tsetblock{flex:1;display:flex;flex-direction:column;align-items:center}
        .tsetlbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.25);margin-bottom:4px}
        .tsetctrl{display:flex;align-items:center;gap:5px}
        .tadj{width:44px;height:44px;flex-shrink:0;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,.12);color:#e2e8f0;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;user-select:none;transition:background .1s}
        .tadj:active{background:rgba(255,255,255,.18)}
        .tadj-off{opacity:.3;pointer-events:none}
        .tsetval{font-size:22px;font-weight:700;color:#fb923c;min-width:44px;text-align:center}
        .tsetval-off{color:rgba(255,255,255,.3)}
        .t-pill{display:flex;align-items:center;gap:4px;padding:5px 9px;border-radius:7px;background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.18);margin-left:3px;flex-shrink:0}
        .t-pill-val{font-size:18px;font-weight:700;color:#60a5fa;line-height:1}
        .t-pill-lbl{font-size:9px;color:rgba(96,165,250,.6);line-height:1.3}
        .hvac-btn{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:7px;border:0.5px solid;cursor:pointer;transition:transform .1s;user-select:none}
        .hvac-btn:active{transform:scale(.95)}
        .hvac-lbl{font-size:11px;font-weight:700}
      </style>
      ${rooms.filter(r=>r.lights && !r.no_popup).map(r=>this._buildLightsPopup(r)).join('')}
      ${rooms.filter(r=>r.blinds).map(r=>this._buildBlindPopup(r)).join('')}
      ${rooms.filter(r=>r.thermostat).map(r=>this._buildTstatPopup(r)).join('')}`;
    document.body.appendChild(oc);
    this._overlayContainer = oc;

    this._listen();
  }

  /* ── Listeners ────────────────────────────────────────────────────── */

  _getOverlay(id)   { return this._overlayContainer?.querySelector(`#${id}`) || this.shadowRoot.getElementById(id); }
  _openOverlay(id)  { const e=this._getOverlay(id); if(e){ e.classList.add('open'); e.classList.remove('hidden'); document.body.style.overflow='hidden'; } }
  _closeOverlay(id) { const e=this._getOverlay(id); if(e){ e.classList.remove('open'); e.classList.add('hidden'); document.body.style.overflow=''; } }

  _listen() {
    const sr = this.shadowRoot;
    const oc = this._overlayContainer;

    // Overlay container: handle close buttons and fan pips, relay actions to main handler
    if (oc) {
      oc.addEventListener('click', e => {
        const closeEl = e.target.closest('[data-close]');
        if (closeEl) { this._closeOverlay(closeEl.dataset.close); return; }
        const pipEl = e.target.closest('.fpip');
        if (pipEl) {
          const rid=pipEl.dataset.room, fi=parseInt(pipEl.dataset.fi,10);
          const idx=parseInt(pipEl.dataset.idx,10), sp=parseInt(pipEl.dataset.speeds,10);
          const room=this._config.rooms.find(r=>r.id===rid);
          if (room?.fans?.[fi]) this._setFanSpeed(room.fans[fi].entity, sp, idx);
          return;
        }
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action=el.dataset.action, rid=el.dataset.room;
        const room=this._config.rooms.find(r=>r.id===rid);
        if (action==='temp-dn') { if(room?.thermostat) this._adjTemp(room.thermostat.entity,-1); return; }
        if (action==='temp-up') { if(room?.thermostat) this._adjTemp(room.thermostat.entity, 1); return; }
        if (action==='hvac-cycle') { if(room?.thermostat) this._cycleHvac(room.thermostat.entity); return; }
        if (action==='fan-cycle') { if(room?.thermostat) this._cycleFan(room.thermostat.entity); return; }
        if (action==='swing-cycle') { if(room?.thermostat) this._cycleSwing(room.thermostat.entity); return; }
        if (action==='preset-cycle') { if(room?.thermostat) this._cyclePreset(room.thermostat.entity); return; }
        if (action==='popup-master-tog') {
          const r2=this._config.rooms.find(r=>el.id===`pp-ltog-${r.id}`||r.id===rid);
          if(r2?.lights) this._toggleLight(r2.lights.entity); return;
        }
        if (action==='popup-master-expand') {
          const exp=oc.querySelector(`#ppme-${rid}`), arr=oc.querySelector(`#ppmc-a-${rid}`);
          if(exp){
            const opening=exp.classList.contains('hidden');
            if(opening){oc.querySelectorAll('.pp-master-exp:not(.hidden)').forEach(d=>d.classList.add('hidden'));oc.querySelectorAll('.pp-color-sec:not(.hidden)').forEach(d=>d.classList.add('hidden'));oc.querySelectorAll('[id^="ppmc-a-"],[id^="ppla-"]').forEach(a=>a.style.transform='');}
            exp.classList.toggle('hidden'); if(arr) arr.style.transform=opening?'rotate(180deg)':'';
          } return;
        }
        if (action==='popup-light-exp') {
          const li=el.dataset.li, cs=oc.querySelector(`#ppcs-${rid}-${li}`), ar=oc.querySelector(`#ppla-${rid}-${li}`);
          if(cs){
            const opening2=cs.classList.contains('hidden');
            if(opening2){oc.querySelectorAll('.pp-color-sec:not(.hidden)').forEach(d=>d.classList.add('hidden'));oc.querySelectorAll('[id^="ppla-"]').forEach(a=>a.style.transform='');}
            cs.classList.toggle('hidden'); if(ar) ar.style.transform=opening2?'rotate(180deg)':'';
          } return;
        }
        if (action?.includes(':')) {
          const [type,...parts]=action.split(':');
          const r2=this._config.rooms.find(r=>r.id===parts[0]);
          const idx=parseInt(el.dataset.idx,10);
          if(type==='pct-all'){const p=this._ctPresets()[idx];if(p&&r2?.lights){[...(r2.lights.individuals||[]),{entity:r2.lights.entity}].forEach(l=>this._setColorTemp(l.entity,p.kelvin));this._selPreset(el,oc.querySelector(`#ppme-${parts[0]}`));}}
          else if(type==='pcc-all'){const p=this._colorPresets()[idx];if(p&&r2?.lights){[...(r2.lights.individuals||[]),{entity:r2.lights.entity}].forEach(l=>this._setColor(l.entity,p.rgb));this._selPreset(el,oc.querySelector(`#ppme-${parts[0]}`));}}
          else if(type==='pct'){const li=parseInt(parts[1],10),p=this._ctPresets()[idx];const ls=r2?.lights?.individuals?.length?r2.lights.individuals:[{entity:r2?.lights?.entity}];if(p&&ls[li])this._setColorTemp(ls[li].entity,p.kelvin);this._selPreset(el,oc.querySelector(`#ppcs-${parts[0]}-${li}`));}
          else if(type==='pcc'){const li=parseInt(parts[1],10),p=this._colorPresets()[idx];const ls=r2?.lights?.individuals?.length?r2.lights.individuals:[{entity:r2?.lights?.entity}];if(p&&ls[li])this._setColor(ls[li].entity,p.rgb);this._selPreset(el,oc.querySelector(`#ppcs-${parts[0]}-${li}`));}
        }
      });
      // Per-light drag sliders in overlay
      oc.querySelectorAll('[data-action="popup-brightness-drag"]').forEach(wrap => {
        const rid=wrap.dataset.room, li=parseInt(wrap.dataset.li,10), eid=wrap.dataset.entity;
        const fill=oc.querySelector(`#ppls-${rid}-${li}`);
        const thumb=oc.querySelector(`#pplthumb-${rid}-${li}`);
        const pct=oc.querySelector(`#ppp-${rid}-${li}`);
        let dragging=false, commitTimer=null;
        const update=(clientX,commit)=>{
          const rect=wrap.getBoundingClientRect();
          const p=Math.max(0,Math.min(100,Math.round(((clientX-rect.left)/rect.width)*100)));
          if(fill) fill.style.width=p+'%';
          if(thumb) thumb.style.left=p+'%';
          if(pct) pct.textContent=p+'%';
          if(commit){clearTimeout(commitTimer);commitTimer=setTimeout(()=>{
            if(p===0) this._call('light','turn_off',{entity_id:eid},null);
            else this._call('light','turn_on',{entity_id:eid,brightness_pct:p},null);
          },150);}
        };
        wrap.addEventListener('mousedown',e=>{dragging=true;update(e.clientX,false);e.preventDefault();});
        wrap.addEventListener('touchstart',e=>{dragging=true;update(e.touches[0].clientX,false);},{passive:true});
        document.addEventListener('mousemove',e=>{if(dragging)update(e.clientX,true);});
        document.addEventListener('touchmove',e=>{if(dragging)update(e.touches[0].clientX,true);},{passive:true});
        document.addEventListener('mouseup',()=>{dragging=false;});
        document.addEventListener('touchend',()=>{dragging=false;});
      });

      // Master "All Lights" drag slider in overlay
      oc.querySelectorAll('[data-action="brightness-drag"]').forEach(wrap => {
        const rid=wrap.dataset.room, eid=wrap.dataset.entity;
        const fill=oc.querySelector(`#pp-mfill-${rid}`);
        const thumb=oc.querySelector(`#pp-mthumb-${rid}`);
        const pct=oc.querySelector(`#pp-mpct-${rid}`);
        let dragging=false, commitTimer=null;
        const update=(clientX,commit)=>{
          const rect=wrap.getBoundingClientRect();
          const p=Math.max(0,Math.min(100,Math.round(((clientX-rect.left)/rect.width)*100)));
          if(fill) fill.style.width=p+'%';
          if(thumb) thumb.style.left=p+'%';
          if(pct) pct.textContent=p+'%';
          if(commit){clearTimeout(commitTimer);commitTimer=setTimeout(()=>{
            if(p===0) this._call('light','turn_off',{entity_id:eid},null);
            else this._call('light','turn_on',{entity_id:eid,brightness_pct:p},null);
          },150);}
        };
        wrap.addEventListener('mousedown',e=>{dragging=true;update(e.clientX,false);e.preventDefault();});
        wrap.addEventListener('touchstart',e=>{dragging=true;update(e.touches[0].clientX,false);},{passive:true});
        document.addEventListener('mousemove',e=>{if(dragging)update(e.clientX,true);});
        document.addEventListener('touchmove',e=>{if(dragging)update(e.touches[0].clientX,true);},{passive:true});
        document.addEventListener('mouseup',()=>{dragging=false;});
        document.addEventListener('touchend',()=>{dragging=false;});
      });
      // switch-toggle: tap-to-toggle for switch.* master entities in popup
      oc.querySelectorAll('[data-action="switch-toggle"]').forEach(row => {
        row.addEventListener('click', e => {
          const eid = row.dataset.entity;
          const rid = row.dataset.room;
          const isOn = this._isOn(eid);
          this._call('switch', isOn ? 'turn_off' : 'turn_on', { entity_id: eid }, null);
          // Optimistic UI update
          const stateEl = oc.querySelector(`#pp-mstate-${rid}`);
          if (stateEl) { stateEl.textContent = isOn ? 'Off' : 'On'; stateEl.style.color = isOn ? 'rgba(255,255,255,.35)' : '#fbbf24'; }
        });
      });
      // Blind sliders in overlay
      oc.querySelectorAll('input[data-action="blind-pos-slide"]').forEach(inp => {
        inp.addEventListener('input', () => {
          const rid=inp.dataset.room, v=parseInt(inp.value,10);
          const room=this._config.rooms.find(r=>r.id===rid);
          const max=room?.blinds?.max_position||100;
          const fill=oc.querySelector(`#bpfill-${rid}`), lbl=oc.querySelector(`#bpos-${rid}`);
          if(fill) fill.style.width=((v/max)*100).toFixed(1)+'%';
          if(lbl) lbl.textContent=v+'%';
          if(room?.blinds) this._setCoverPos(room.blinds.entity,v);
        });
      });
    }

    sr.addEventListener('click', e => {
      /* close buttons */
      const closeEl = e.target.closest('[data-close]');
      if (closeEl) { this._closeOverlay(closeEl.dataset.close); return; }

      /* fan pips — checked first as they have no data-action */
      const pipEl = e.target.closest('.fpip');
      if (pipEl) {
        e.stopPropagation();
        const rid=pipEl.dataset.room, fi=parseInt(pipEl.dataset.fi,10);
        const idx=parseInt(pipEl.dataset.idx,10), sp=parseInt(pipEl.dataset.speeds,10);
        const room=this._config.rooms.find(r=>r.id===rid);
        if (room?.fans?.[fi]) this._setFanSpeed(room.fans[fi].entity, sp, idx);
        return;
      }

      const el = e.target.closest('[data-action]');
      if (!el) return;
      e.stopPropagation();
      const action=el.dataset.action, rid=el.dataset.room;
      const room=this._config.rooms.find(r=>r.id===rid);

      switch(action) {
        case 'room-toggle':         if(room?.lights) this._toggleLight(room.lights.entity); break;
        case 'light-tog':           if(room) { const r2=this._config.rooms.find(r=>r.id===el.id.replace('ltog-','')||r.id===rid); if(r2?.lights) this._toggleLight(r2.lights.entity); } break;

        case 'blind-open':          if(room?.blinds) this._setCoverPos(room.blinds.entity, room.blinds.max_position||100); break;
        case 'blind-close':         if(room?.blinds) this._setCoverState(room.blinds.entity,false); break;
        case 'blind-popup':         this._openOverlay(`bp-${rid}`); break;
        case 'indiv-tog': { const eid=el.dataset.entity; if(eid) this._toggleLight(eid); break; }
        case 'garage-open':         if(room?.garage) this._setCoverState(room.garage.entity,true);  break;
        case 'garage-close':        if(room?.garage) this._setCoverState(room.garage.entity,false); break;

        case 'tstat-popup':         if(!e.target.closest('.tadj')) this._openOverlay(`tp-${rid}`); break;
        case 'temp-dn':             e.stopPropagation(); if(room?.thermostat) this._adjTemp(room.thermostat.entity,-1); break;
        case 'temp-up':             e.stopPropagation(); if(room?.thermostat) this._adjTemp(room.thermostat.entity, 1); break;
        case 'hvac-cycle':          e.stopPropagation(); if(room?.thermostat) this._cycleHvac(room.thermostat.entity, room.thermostat.modes); break;
        case 'fan-cycle':           if(room?.thermostat) this._cycleFan(room.thermostat.entity);   break;
        case 'swing-cycle':         if(room?.thermostat) this._cycleSwing(room.thermostat.entity); break;
        case 'preset-cycle':        if(room?.thermostat) this._cyclePreset(room.thermostat.entity);break;

        case 'popup-master-tog': {
          const r2=this._config.rooms.find(r=>el.id===`pp-ltog-${r.id}`||r.id===rid);
          if(r2?.lights) this._toggleLight(r2.lights.entity); break;
        }
        case 'popup-master-expand': {
          const exp=sr.getElementById(`ppme-${rid}`), arr=sr.getElementById(`ppmc-a-${rid}`);
          if(!exp) break;
          const opening=exp.classList.contains('hidden');
          if(opening){sr.querySelectorAll('.pp-master-exp:not(.hidden)').forEach(d=>d.classList.add('hidden'));sr.querySelectorAll('.pp-color-sec:not(.hidden)').forEach(d=>d.classList.add('hidden'));sr.querySelectorAll('[id^="ppmc-a-"],[id^="ppla-"]').forEach(a=>a.style.transform='');}
          exp.classList.toggle('hidden'); if(arr) arr.style.transform=opening?'rotate(180deg)':''; break;
        }
        case 'popup-light-exp': {
          const li=el.dataset.li, cs=sr.getElementById(`ppcs-${rid}-${li}`), ar=sr.getElementById(`ppla-${rid}-${li}`);
          if(!cs) break;
          const opening2=cs.classList.contains('hidden');
          if(opening2){sr.querySelectorAll('.pp-color-sec:not(.hidden)').forEach(d=>d.classList.add('hidden'));sr.querySelectorAll('[id^="ppla-"]').forEach(a=>a.style.transform='');}
          cs.classList.toggle('hidden'); if(ar) ar.style.transform=opening2?'rotate(180deg)':''; break;
        }
      }

      /* preset actions */
      if (action?.includes(':')) {
        const [type,...parts]=action.split(':');
        const r2=this._config.rooms.find(r=>r.id===parts[0]);
        const idx=parseInt(el.dataset.idx,10);
        if (type==='pct-all') { const p=this._ctPresets()[idx]; if(p&&r2?.lights){[...(r2.lights.individuals||[]),{entity:r2.lights.entity}].forEach(l=>this._setColorTemp(l.entity,p.kelvin)); this._selPreset(el,sr.getElementById(`ppme-${parts[0]}`));} }
        else if (type==='pcc-all') { const p=this._colorPresets()[idx]; if(p&&r2?.lights){[...(r2.lights.individuals||[]),{entity:r2.lights.entity}].forEach(l=>this._setColor(l.entity,p.rgb)); this._selPreset(el,sr.getElementById(`ppme-${parts[0]}`));} }
        else if (type==='pct') { const li=parseInt(parts[1],10), p=this._ctPresets()[idx]; const ls=r2?.lights?.individuals?.length?r2.lights.individuals:[{entity:r2?.lights?.entity}]; if(p&&ls[li]) this._setColorTemp(ls[li].entity,p.kelvin); this._selPreset(el,sr.getElementById(`ppcs-${parts[0]}-${li}`)); }
        else if (type==='pcc') { const li=parseInt(parts[1],10), p=this._colorPresets()[idx]; const ls=r2?.lights?.individuals?.length?r2.lights.individuals:[{entity:r2?.lights?.entity}]; if(p&&ls[li]) this._setColor(ls[li].entity,p.rgb); this._selPreset(el,sr.getElementById(`ppcs-${parts[0]}-${li}`)); }
      }
    });

    /* light row → open lights popup (not toggle or slider drag) */
    sr.querySelectorAll('[id^="lrow-"]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.tog')) return;
        const rid = row.id.replace('lrow-','');
        const room = this._config.rooms.find(r=>r.id===rid);
        if (!room || room.no_popup) return;
        if (e.target.closest('[data-action="brightness-drag"]')) return;
        // simplified: rhead-chev click OR rhead-simple click opens popup
        // full room: only .lm-btn chevron opens popup
        const isSimplified = !!room.simplified;
        if (!isSimplified && !e.target.closest('.lm-btn')) return;
        this._openOverlay(`lp-${rid}`);
      });
    });

    /* simplified room header — clicking anywhere on rhead-simple opens popup */
    sr.querySelectorAll('.rhead-simple').forEach(rhead => {
      rhead.addEventListener('click', e => {
        if (e.target.closest('.tog')) return;
        const roomEl = rhead.closest('[id^="room-"]');
        if (!roomEl) return;
        const rid = roomEl.id.replace('room-','');
        const room = this._config.rooms.find(r=>r.id===rid);
        if (!room || room.no_popup) return;
        this._openOverlay(`lp-${rid}`);
      });
    });

    /* ltog- elements removed from light row — toggle handled by room-toggle in header */

    /* brightness drag sliders on light rows */
    sr.querySelectorAll('[data-action="brightness-drag"]').forEach(wrap => {
      const roomId  = wrap.dataset.room;
      const entityId= wrap.dataset.entity;
      const fill    = sr.getElementById(`lfill-${roomId}`);
      const thumb   = sr.getElementById(`lthumb-${roomId}`);
      const pct     = sr.getElementById(`lpct-${roomId}`);
      let dragging  = false;
      let commitTimer = null;

      const update = (clientX, commit) => {
        const rect = wrap.getBoundingClientRect();
        const p = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
        if (fill)  fill.style.width  = p + '%';
        if (thumb) thumb.style.left  = p + '%';
        if (pct)   pct.textContent   = p + '%';
        if (commit) {
          clearTimeout(commitTimer);
          commitTimer = setTimeout(() => {
            if (p === 0) this._call('light','turn_off',{entity_id:entityId},null);
            else this._call('light','turn_on',{entity_id:entityId,brightness_pct:p},null);
          }, 150);
        }
      };

      wrap.addEventListener('mousedown', e => {
        if (e.target.closest('.lm-btn') || e.target.closest('.tog')) return;
        dragging = true;
        update(e.clientX, false);
        e.preventDefault();
      });
      wrap.addEventListener('touchstart', e => {
        if (e.target.closest('.lm-btn') || e.target.closest('.tog')) return;
        dragging = true;
        update(e.touches[0].clientX, false);
      }, {passive:true});
      document.addEventListener('mousemove', e => { if (dragging) update(e.clientX, true); });
      document.addEventListener('touchmove', e => { if (dragging) update(e.touches[0].clientX, true); }, {passive:true});
      document.addEventListener('mouseup',  () => { dragging = false; });
      document.addEventListener('touchend', () => { dragging = false; });
    });

    /* switch-toggle: tap-to-toggle for switch.* master entities on inline rows */
    sr.querySelectorAll('[data-action="switch-toggle"]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.lm-btn')) return; // don't intercept chevron
        const eid = row.dataset.entity;
        const isOn = this._isOn(eid);
        this._call('switch', isOn ? 'turn_off' : 'turn_on', { entity_id: eid }, null);
        // Optimistic UI update
        const fill = sr.getElementById(`lfill-${row.dataset.room}`);
        if (fill) fill.style.width = isOn ? '0%' : '100%';
      });
    });


    sr.querySelectorAll('.tstat-top[data-action="tstat-popup"]').forEach(top => {
      top.addEventListener('click', e => {
        if (e.target.closest('.tadj')) return;
        this._openOverlay(`tp-${top.dataset.room}`);
      });
    });

    /* close overlay on backdrop click */
    sr.querySelectorAll('.overlay').forEach(ov => {
      ov.addEventListener('click', e => { if(e.target===ov) this._closeOverlay(ov.id); });
    });
    this._overlayContainer?.querySelectorAll('.rcc-overlay').forEach(ov => {
      ov.addEventListener('click', e => { if(e.target===ov) this._closeOverlay(ov.id); });
    });

  }

  _selPreset(el, container) {
    const row = el.closest('.pp-presets');
    if (row) row.querySelectorAll('.pp-preset').forEach(p => {
      p.classList.remove('pp-preset-sel');
      p.style.borderColor=''; p.style.background='';
      const d=p.querySelector('.pp-dot-lbl'); if(d) d.style.color='rgba(255,255,255,.35)';
    });
    el.classList.add('pp-preset-sel');
    const dot=el.querySelector('.pp-dot');
    if (dot) { el.style.borderColor=dot.style.background+'55'; el.style.background=dot.style.background+'1a'; }
    const d=el.querySelector('.pp-dot-lbl'); if(d) d.style.color='rgba(255,255,255,.82)';
  }
}

customElements.define('room-controls-card', RoomControlsCard);