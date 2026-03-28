/**
 * kiosk-displays-card.js  —  v1
 * Wall-panel display control card for Home Assistant Lovelace.
 * Controls brightness and on/off for kiosk displays via HA template lights.
 * Shows a sleep banner when all displays are off, schedule countdown, and
 * quick-action buttons (Both off / Both on / Night mode).
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/kiosk-displays-card/kiosk-displays-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/kiosk-displays-card/kiosk-displays-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:kiosk-displays-card
 * displays:
 *   - name: Front Door
 *     entity:  light.kiosk_front_door_display   # HA template light
 *     dim_at:  "22:00"                          # optional — schedule label
 *     wake_at: "07:00"                          # optional — schedule label
 *   - name: Garage
 *     entity:  light.kiosk_garage_display
 *     dim_at:  "22:00"
 *     wake_at: "07:00"
 * night_brightness: 20    # optional — Night button target (default 20)
 */

class KioskDisplaysCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
    this._busy   = {};
    this._tick   = null;
  }

  static getStubConfig() {
    return {
      displays: [
        { name: 'Front Door', entity: 'light.kiosk_front_door_display', dim_at: '22:00', wake_at: '07:00' },
        { name: 'Garage',     entity: 'light.kiosk_garage_display',     dim_at: '22:00', wake_at: '07:00' },
      ],
      night_brightness: 20,
    };
  }

  static getConfigForm() {
    return { schema: [] }; // displays array — configure in YAML
  }

  setConfig(c) {
    if (!c.displays?.length) throw new Error('kiosk-displays-card: define at least one display under displays:');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('.wrap') || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return (this._config.displays?.length || 1) * 2 + 2; }

  connectedCallback()    { this._tick = setInterval(() => this._patchSchedule(), 30000); }
  disconnectedCallback() { clearInterval(this._tick); this._tick = null; }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _isOn(entity) { return this._hass?.states[entity]?.state === 'on'; }

  _brightness(entity) {
    const s = this._hass?.states[entity];
    if (!s || s.state !== 'on') return 0;
    return Math.round(((s.attributes?.brightness ?? 0) / 255) * 100);
  }

  _allOff() { return this._config.displays.every(d => !this._isOn(d.entity)); }

  _nearestPip(bri) { return [20,40,60,80,100].reduce((a,b) => Math.abs(b-bri)<Math.abs(a-bri)?b:a); }

  _nextOccurrence(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date(), target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const diff = target - now;
    const hours = Math.floor(diff / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  _scheduleText(d) {
    const on = this._isOn(d.entity);
    const nightBri = this._config.night_brightness ?? 20;
    if (on && d.dim_at) {
      const t = this._nextOccurrence(d.dim_at);
      return t ? `Dims to ${nightBri}% at ${d.dim_at} · ${t}` : null;
    }
    if (!on && d.wake_at) {
      const t = this._nextOccurrence(d.wake_at);
      return t ? `Wakes at ${d.wake_at} · ${t}` : null;
    }
    return null;
  }

  _call(domain, service, data) { this._hass.callService(domain, service, data); }

  _toggle(entity) {
    if (this._busy[entity]) return;
    this._busy[entity] = true;
    setTimeout(() => { this._busy[entity] = false; }, 1500);
    this._call('light', this._isOn(entity) ? 'turn_off' : 'turn_on', { entity_id: entity });
  }

  _setBri(entity, pct) {
    if (this._busy[entity]) return;
    this._busy[entity] = true;
    setTimeout(() => { this._busy[entity] = false; }, 1500);
    this._call('light', 'turn_on', { entity_id: entity, brightness_pct: pct });
  }

  _allOff_action()  { this._config.displays.forEach(d => this._call('light', 'turn_off', { entity_id: d.entity })); }
  _allOn_action()   { this._config.displays.forEach(d => this._call('light', 'turn_on',  { entity_id: d.entity })); }
  _night_action()   {
    const bri = this._config.night_brightness ?? 20;
    this._config.displays.forEach(d => this._call('light', 'turn_on', { entity_id: d.entity, brightness_pct: bri }));
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  _css() { return `
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important}
    .wrap{border-radius:10px;border:1px solid rgba(255,255,255,.12);overflow:hidden}
    .card-hdr{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.2px;padding:10px 14px 9px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
    .hdr-chips{display:flex;gap:5px}
    .chip{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:4px}
    .chip-ok{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.28);color:#4ade80}
    .chip-sleep{background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.28);color:#a78bfa}
    .sleep-banner{margin:8px 14px 4px;padding:9px 11px;border-radius:8px;background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.18);display:flex;align-items:center;gap:9px}
    .sleep-ico{width:26px;height:26px;border-radius:6px;background:rgba(167,139,250,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sleep-text{flex:1;min-width:0}
    .sleep-title{font-size:10px;font-weight:700;color:#a78bfa}
    .sleep-sub{font-size:9px;color:rgba(167,139,250,.5);margin-top:1px}
    .wake-btn{font-size:9px;font-weight:700;padding:5px 9px;border-radius:6px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.35);color:#a78bfa;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;user-select:none;transition:transform .1s,filter .12s}
    .wake-btn:active{transform:scale(.96);filter:brightness(.85)}
    .sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28);padding:8px 14px 4px}
    .disp-row{padding:8px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
    .disp-row:last-of-type{border-bottom:none}
    .disp-top{display:flex;align-items:center;gap:8px;margin-bottom:7px}
    .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .dot-on{background:#4ade80}
    .dot-off{background:rgba(255,255,255,.15)}
    .disp-name{font-size:12px;font-weight:700;color:#e2e8f0;flex:1;min-width:0;transition:color .12s}
    .disp-name-off{color:rgba(255,255,255,.38)}
    .disp-pct{font-size:10px;font-weight:700;color:#fbbf24;flex-shrink:0;margin-right:6px;transition:color .12s}
    .disp-pct-off{color:rgba(255,255,255,.2)}
    .tog{width:40px;height:24px;border-radius:99px;position:relative;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;user-select:none;transition:background .12s}
    .tog-on{background:rgba(74,222,128,.16);border:1.5px solid rgba(74,222,128,.4)}
    .tog-off{background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.11)}
    .tog-thumb{width:18px;height:18px;border-radius:50%;position:absolute;top:2px;transition:left .12s,background .12s}
    .tog-on .tog-thumb{left:18px;background:#4ade80}
    .tog-off .tog-thumb{left:2px;background:rgba(255,255,255,.22)}
    .tog:active{filter:brightness(.85)}
    .pips{display:flex;gap:3px}
    .pip{flex:1;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(255,255,255,.28);transition:transform .1s,filter .12s}
    .pip:active{transform:scale(.93);filter:brightness(.82)}
    .pip-active{background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.35);color:#fbbf24}
    .pip-dim{opacity:.2;pointer-events:none}
    .sched{display:flex;align-items:center;gap:5px;margin-top:6px;min-height:14px}
    .sched-text{font-size:9px;color:rgba(255,255,255,.26)}
    .sched-time{color:rgba(255,255,255,.42);font-weight:600}
    .divider{height:1px;background:rgba(255,255,255,.07)}
    .actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;padding:8px 14px 10px}
    .act{height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;font-size:11px;font-weight:700;transition:transform .1s,filter .12s}
    .act:active{transform:scale(.95);filter:brightness(.82)}
    .act-off{background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.2);color:#f87171}
    .act-on{background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);color:#4ade80}
    .act-night{background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.2);color:#a78bfa}
  `; }

  // ── Build HTML ───────────────────────────────────────────────────────────────

  _moonIco(stroke='#a78bfa',w=12) {
    return `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
  }
  _clockIco() {
    return `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  }
  _sunIco() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  }
  _pwrIco() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`;
  }

  _buildHdr() {
    const onCount = this._config.displays.filter(d => this._isOn(d.entity)).length;
    const allOff  = onCount === 0;
    const chip    = allOff
      ? `<div class="chip chip-sleep">Sleep mode</div>`
      : `<div class="chip chip-ok">${onCount} on</div>`;
    return `<div class="card-hdr"><span>Kiosk displays</span><div class="hdr-chips" id="hdr-chips">${chip}</div></div>`;
  }

  _buildSleepBanner() {
    const wakeAt = this._config.displays.find(d => d.wake_at)?.wake_at ?? '';
    const t = wakeAt ? this._nextOccurrence(wakeAt) : null;
    return `
      <div class="sleep-banner">
        <div class="sleep-ico">${this._moonIco()}</div>
        <div class="sleep-text">
          <div class="sleep-title">Both displays off</div>
          <div class="sleep-sub">Touch-to-wake active${wakeAt ? ` · wakes at ${wakeAt}` : ''}</div>
        </div>
        <div class="wake-btn" id="wake-all">Wake both</div>
      </div>`;
  }

  _buildRow(d, i) {
    const on      = this._isOn(d.entity);
    const bri     = this._brightness(d.entity);
    const nearest = on ? this._nearestPip(bri) : 0;
    const pips    = [20,40,60,80,100].map(v => {
      const active = on && nearest === v;
      return `<div class="pip ${!on ? 'pip-dim' : active ? 'pip-active' : ''}" data-disp="${i}" data-bri="${v}">${v}</div>`;
    }).join('');
    const sched = this._scheduleText(d);
    return `
      <div class="disp-row">
        <div class="disp-top">
          <div class="dot ${on ? 'dot-on' : 'dot-off'}" id="dot-${i}"></div>
          <div class="disp-name ${on ? '' : 'disp-name-off'}" id="dname-${i}">${d.name}</div>
          <div class="disp-pct ${on ? '' : 'disp-pct-off'}" id="dpct-${i}">${on ? `${bri}%` : 'off'}</div>
          <div class="tog ${on ? 'tog-on' : 'tog-off'}" id="tog-${i}" data-disp="${i}"><div class="tog-thumb"></div></div>
        </div>
        <div class="pips" id="pips-${i}">${pips}</div>
        <div class="sched">${sched ? this._clockIco() : ''}<div class="sched-text" id="sched-${i}">${sched||''}</div></div>
      </div>`;
  }

  _buildActions() {
    return `
      <div class="divider"></div>
      <div class="actions">
        <div class="act act-off" id="act-off">${this._pwrIco()} Both off</div>
        <div class="act act-on"  id="act-on">${this._sunIco()} Both on</div>
        <div class="act act-night" id="act-night">${this._moonIco('currentColor',11)} Night</div>
      </div>`;
  }

  // ── Render / Patch ───────────────────────────────────────────────────────────

  _render() {
    const allOff = this._allOff();
    const rows   = this._config.displays.map((d,i) => this._buildRow(d,i)).join('');
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card><div class="wrap">
        ${this._buildHdr()}
        <div class="sec-lbl">Displays</div>
        ${allOff ? this._buildSleepBanner() : ''}
        ${rows}
        ${this._buildActions()}
      </div></ha-card>`;
    this._listen();
  }

  _patch() {
    const sr     = this.shadowRoot;
    const allOff = this._allOff();
    const onCnt  = this._config.displays.filter(d => this._isOn(d.entity)).length;

    // Header chip
    const chips = sr.getElementById('hdr-chips');
    if (chips) chips.innerHTML = allOff
      ? `<div class="chip chip-sleep">Sleep mode</div>`
      : `<div class="chip chip-ok">${onCnt} on</div>`;

    // Per-display updates
    this._config.displays.forEach((d, i) => {
      const on  = this._isOn(d.entity);
      const bri = this._brightness(d.entity);
      const np  = on ? this._nearestPip(bri) : 0;

      const set = (id, cls, txt) => {
        const el = sr.getElementById(id);
        if (el) { if (cls !== null) el.className = cls; if (txt !== null) el.textContent = txt; }
      };
      set(`dot-${i}`,   `dot ${on ? 'dot-on' : 'dot-off'}`,                      null);
      set(`dname-${i}`, `disp-name ${on ? '' : 'disp-name-off'}`,                 null);
      set(`dpct-${i}`,  `disp-pct ${on ? '' : 'disp-pct-off'}`,  on ? `${bri}%` : 'off');
      set(`tog-${i}`,   `tog ${on ? 'tog-on' : 'tog-off'}`,                       null);

      sr.getElementById(`pips-${i}`)?.querySelectorAll('.pip').forEach(p => {
        const v = parseInt(p.dataset.bri);
        p.className = `pip ${!on ? 'pip-dim' : np===v ? 'pip-active' : ''}`;
      });

      const schedEl = sr.getElementById(`sched-${i}`);
      if (schedEl) schedEl.textContent = this._scheduleText(d) || '';
    });
  }

  _patchSchedule() {
    this._config.displays.forEach((d, i) => {
      const el = this.shadowRoot?.getElementById(`sched-${i}`);
      if (el) el.textContent = this._scheduleText(d) || '';
    });
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  _listen() {
    const sr = this.shadowRoot;
    sr.getElementById('wake-all')?.addEventListener('click', () => this._allOn_action());
    sr.getElementById('act-off')?.addEventListener('click',  () => this._allOff_action());
    sr.getElementById('act-on')?.addEventListener('click',   () => this._allOn_action());
    sr.getElementById('act-night')?.addEventListener('click',() => this._night_action());

    sr.querySelectorAll('.tog').forEach(el =>
      el.addEventListener('click', () => this._toggle(this._config.displays[+el.dataset.disp].entity))
    );
    sr.querySelectorAll('.pip').forEach(el =>
      el.addEventListener('click', () => {
        if (el.classList.contains('pip-dim')) return;
        this._setBri(this._config.displays[+el.dataset.disp].entity, +el.dataset.bri);
      })
    );
  }
}

customElements.define('kiosk-displays-card', KioskDisplaysCard);
