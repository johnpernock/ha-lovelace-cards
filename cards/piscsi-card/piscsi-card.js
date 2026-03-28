/**
 * piscsi-card.js  —  v1
 * PiSCSI / RaSCSI monitoring card for Home Assistant Lovelace.
 * Polls the PiSCSI REST API directly (no HA integration needed).
 * Shows daemon status, mounted SCSI devices with image names, and
 * an eject button per device with confirmation overlay.
 *
 * ── INSTALLATION ──────────────────────────────────────────────────────────────
 * 1. Copy to /config/www/cards/piscsi-card/piscsi-card.js
 * 2. HA → Settings → Dashboards → Resources → Add:
 *      URL:  /local/cards/piscsi-card/piscsi-card.js
 *      Type: JavaScript Module
 *
 * ── CONFIG ────────────────────────────────────────────────────────────────────
 * type: custom:piscsi-card
 * host: 192.168.1.x        # required — PiSCSI host IP or hostname
 * port: 3000               # optional — default 3000
 * name: Color Classic      # optional — machine name shown in header
 * poll_interval: 30        # optional — seconds between polls (default 30, min 10)
 *
 * ── PISCSI API ────────────────────────────────────────────────────────────────
 * Requires PiSCSI v24.04+ with the REST API enabled (default).
 * CORS is enabled by default in PiSCSI — no additional config needed.
 * Endpoints used:
 *   GET  /api/v1/devices        — list of mounted SCSI devices
 *   GET  /api/v1/system/status  — daemon status and version
 *   DELETE /api/v1/devices/{id} — eject a device (requires auth if enabled)
 *
 * ── SECURITY NOTES ────────────────────────────────────────────────────────────
 * - `host` is admin-set YAML only — never read from user input
 * - Host is validated against a safe character allowlist before use
 * - API response data is inserted via textContent (not innerHTML)
 * - SCSI IDs are validated as integers 0–7 before any API call
 * - Eject requires explicit confirmation overlay — no accidental triggers
 * - Busy lock prevents double-tap ejection
 */

// Safe character allowlist for host — allows IPs and hostnames only
const HOST_SAFE_RE = /^[a-zA-Z0-9._-]{1,253}$/;

// Map PiSCSI device type codes to human labels and accent colours
const TYPE_META = {
  SCHD: { label: 'HD',   color: '#4ade80', cls: 'sr-mounted' },
  SCCD: { label: 'CD',   color: '#60a5fa', cls: 'sr-cd'      },
  SCRM: { label: 'MO',   color: '#a78bfa', cls: 'sr-mounted' },
  SCMO: { label: 'MO',   color: '#a78bfa', cls: 'sr-mounted' },
  SCBR: { label: 'BR',   color: '#fbbf24', cls: 'sr-mounted' },
  SCDP: { label: 'NET',  color: '#fbbf24', cls: 'sr-mounted' },
};

function typeMeta(typeCode) {
  return TYPE_META[typeCode?.toUpperCase()] ?? { label: typeCode ?? '?', color: 'rgba(255,255,255,.4)', cls: 'sr-mounted' };
}

function basename(path) {
  if (!path || typeof path !== 'string') return '';
  return path.replace(/\\/g, '/').split('/').pop() ?? '';
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / 1048576;
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  return Math.round(mb) + ' MB';
}

function formatUptime(seconds) {
  if (seconds == null || isNaN(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

class PiSCSICard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._devices   = [];        // array from last API poll
    this._status    = null;      // daemon status from last poll
    this._error     = null;      // last fetch error message
    this._busy      = {};        // eject busy locks keyed by SCSI ID
    this._tick      = null;      // poll interval handle
    this._fetching  = false;     // in-flight guard
    this._lastPoll  = 0;         // monotonic timestamp of last poll
    this._ejectId   = null;      // SCSI ID pending eject confirmation
  }

  static getStubConfig() {
    return {
      host:          '192.168.1.x',
      port:          3000,
      name:          'Color Classic',
      poll_interval: 30,
    };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: 'host',          label: 'PiSCSI host IP or hostname', selector: { text: {} } },
        { name: 'port',          label: 'API port (default 3000)',     selector: { number: { min: 1, max: 65535, mode: 'box' } } },
        { name: 'name',          label: 'Machine name (optional)',     selector: { text: {} } },
        { name: 'poll_interval', label: 'Poll interval seconds',       selector: { number: { min: 10, max: 300, mode: 'box' } } },
      ],
      assertCustomElement: 'piscsi-card',
    };
  }

  setConfig(c) {
    if (!c.host) throw new Error('piscsi-card: host is required');
    if (!HOST_SAFE_RE.test(c.host)) throw new Error('piscsi-card: host contains invalid characters');
    const port = parseInt(c.port ?? 3000);
    if (isNaN(port) || port < 1 || port > 65535) throw new Error('piscsi-card: port must be 1–65535');
    this._config = {
      ...c,
      port,
      poll_interval: Math.max(10, parseInt(c.poll_interval ?? 30)),
    };
    this._render();
  }

  set hass(h) {
    this._hass = h;
    // hass setter fires on every HA state update — don't re-poll here.
    // Polling is managed by connectedCallback / the interval.
  }

  getCardSize() { return 5; }

  connectedCallback() {
    this._startPolling();
  }

  disconnectedCallback() {
    this._stopPolling();
  }

  // ── Polling ─────────────────────────────────────────────────────────────────

  _startPolling() {
    this._stopPolling();
    this._poll();   // immediate first fetch
    this._tick = setInterval(() => this._poll(), this._config.poll_interval * 1000);
  }

  _stopPolling() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  }

  // ── API calls ────────────────────────────────────────────────────────────────

  _baseUrl() {
    // Host is admin-set and already validated in setConfig — safe to interpolate
    return `http://${this._config.host}:${this._config.port}/api/v1`;
  }

  async _poll() {
    if (this._fetching) return;
    this._fetching = true;
    try {
      const [devRes, sysRes] = await Promise.all([
        fetch(`${this._baseUrl()}/devices`,       { signal: AbortSignal.timeout(8000) }),
        fetch(`${this._baseUrl()}/system/status`, { signal: AbortSignal.timeout(8000) }),
      ]);

      if (!devRes.ok) throw new Error(`API ${devRes.status}`);
      const devData = await devRes.json();

      // PiSCSI API returns either { devices: [...] } or { devices: { "0": {...} } }
      let devices = [];
      if (Array.isArray(devData.devices)) {
        devices = devData.devices;
      } else if (devData.devices && typeof devData.devices === 'object') {
        devices = Object.entries(devData.devices).map(([id, d]) => ({ id: parseInt(id), ...d }));
      }
      this._devices = devices;

      if (sysRes.ok) {
        const sysData = await sysRes.json();
        this._status  = sysData;
      }
      this._error = null;
      this._lastPoll = Date.now();
    } catch (e) {
      this._error = e.message ?? 'Unreachable';
    } finally {
      this._fetching = false;
      this._patchDevices();
    }
  }

  async _eject(scsiId) {
    // Validate SCSI ID is integer 0–7
    const id = parseInt(scsiId);
    if (isNaN(id) || id < 0 || id > 7) return;
    if (this._busy[id]) return;
    this._busy[id] = true;

    try {
      const res = await fetch(`${this._baseUrl()}/devices/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Eject failed: ${res.status}`);
      // Re-poll after eject
      await this._poll();
    } catch (e) {
      console.error('piscsi-card eject error:', e);
    } finally {
      this._busy[id] = false;
      this._ejectId  = null;
      this._closeConfirm();
    }
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  _css() { return `
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .wrap{border-radius:10px;overflow:hidden;position:relative}
    .card-hdr{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.2px;padding:10px 14px 9px;border-bottom:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between}
    .chip{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:4px}
    .chip-ok{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.28);color:#4ade80}
    .chip-err{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.22);color:#f87171}
    .chip-info{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);color:rgba(96,165,250,.8)}
    .chip-warn{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.22);color:#fbbf24}
    .sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:space-between;padding:8px 14px 4px;padding-right:14px}
    .divider{height:1px;background:rgba(255,255,255,.07)}

    /* Daemon status bar */
    .daemon-bar{margin:8px 14px 4px;padding:8px 11px;border-radius:8px;display:flex;align-items:center;gap:9px}
    .daemon-ok{background:rgba(74,222,128,.05);border:1px solid rgba(74,222,128,.15)}
    .daemon-err{background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.18)}
    .daemon-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .daemon-info{flex:1;min-width:0}
    .daemon-name{font-size:11px;font-weight:700}
    .daemon-sub{font-size:9px;margin-top:1px}
    .daemon-ip{font-size:9px;color:rgba(255,255,255,.28)}

    /* SCSI device rows — left accent bar from style guide */
    .scsi-row{display:flex;align-items:center;border-radius:0 8px 8px 0;padding:9px 12px;margin:0 14px 5px;gap:10px;-webkit-tap-highlight-color:transparent;user-select:none;transition:filter .12s}
    .sr-mounted{border-left:3px solid #4ade80;background:rgba(74,222,128,.04);border-top:1px solid rgba(74,222,128,.1);border-right:1px solid rgba(74,222,128,.1);border-bottom:1px solid rgba(74,222,128,.1)}
    .sr-cd{border-left:3px solid #60a5fa;background:rgba(96,165,250,.04);border-top:1px solid rgba(96,165,250,.1);border-right:1px solid rgba(96,165,250,.1);border-bottom:1px solid rgba(96,165,250,.1)}
    .sr-empty{border-left:3px solid rgba(255,255,255,.1);background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);opacity:.5}
    .scsi-id{font-size:10px;font-weight:700;color:rgba(255,255,255,.3);width:22px;flex-shrink:0;letter-spacing:.04em}
    .scsi-body{flex:1;min-width:0}
    .scsi-img{font-size:11px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .scsi-meta{font-size:9px;color:rgba(255,255,255,.28);margin-top:2px}
    .scsi-type{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0;white-space:nowrap}
    .st-hd{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.18);color:rgba(74,222,128,.8)}
    .st-cd{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.18);color:rgba(96,165,250,.8)}
    .st-mo{background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.18);color:rgba(167,139,250,.8)}
    .st-br{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.18);color:rgba(251,191,36,.8)}
    .st-na{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.2)}
    .eject-btn{width:30px;height:30px;border-radius:7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;user-select:none;transition:transform .1s,filter .12s}
    .eject-btn:active{transform:scale(.93);filter:brightness(.82)}
    .eject-btn.disabled{opacity:.25;pointer-events:none}

    /* Last activity note */
    .bus-note{margin:4px 14px 10px;font-size:9px;color:rgba(255,255,255,.22);font-style:italic;display:flex;align-items:center;gap:5px}

    /* Error state */
    .error-banner{margin:8px 14px;padding:9px 12px;border-radius:8px;background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.18);display:flex;align-items:center;gap:9px}
    .error-text{font-size:11px;font-weight:700;color:#f87171;flex:1}
    .error-sub{font-size:9px;color:rgba(248,113,113,.55);margin-top:2px}

    /* Confirmation overlay — same pattern as network-controls-card */
    .confirm-overlay{display:none;position:absolute;inset:0;background:rgba(0,0,0,.7);align-items:flex-end;justify-content:center;z-index:10;border-radius:10px}
    .confirm-overlay.open{display:flex}
    .confirm-sheet{background:var(--card-background-color,#1a1a2e);border:1px solid rgba(255,255,255,.15);border-radius:12px 12px 0 0;border-bottom:none;padding:16px;width:100%}
    @media(min-width:480px){
      .confirm-overlay{align-items:center;justify-content:center;padding:16px}
      .confirm-sheet{border-radius:12px;border:1px solid rgba(255,255,255,.15);max-width:340px}
      .confirm-handle{display:none}
    }
    .confirm-handle{width:32px;height:3px;background:rgba(255,255,255,.15);border-radius:2px;margin:0 auto 12px}
    .confirm-title{font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:4px}
    .confirm-sub{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px;line-height:1.5}
    .confirm-btns{display:flex;gap:8px}
    .confirm-yes{flex:1;height:40px;border-radius:8px;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#f87171;font-size:13px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:filter .12s}
    .confirm-yes:active{filter:brightness(.82)}
    .confirm-no{flex:1;height:40px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:filter .12s}
    .confirm-no:active{filter:brightness(.82)}
  `; }

  // ── SVG helpers ──────────────────────────────────────────────────────────────

  _ico(path, stroke = 'rgba(255,255,255,.5)', size = 14) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }
  _ejectIco(stroke = 'rgba(255,255,255,.45)', size = 12) {
    return this._ico('<polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="5" y1="20" x2="19" y2="20"/>', stroke, size);
  }
  _clockIco(stroke = 'rgba(255,255,255,.3)', size = 9) {
    return this._ico('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', stroke, size);
  }
  _warnIco(stroke = '#f87171', size = 16) {
    return this._ico('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', stroke, size);
  }

  // ── Build HTML ───────────────────────────────────────────────────────────────

  _buildDaemonBar() {
    if (this._error) {
      return `
        <div class="error-banner">
          ${this._warnIco()}
          <div>
            <div class="error-text">PiSCSI unreachable</div>
            <div class="error-sub">${this._error}</div>
          </div>
        </div>`;
    }
    const ver     = this._status?.version ?? '';
    const uptimeSec = this._status?.uptime ?? this._status?.uptime_seconds;
    const uptime  = uptimeSec ? formatUptime(uptimeSec) : null;
    const sub     = [ver ? `v${ver}` : null, uptime ? `uptime ${uptime}` : null].filter(Boolean).join(' · ');
    return `
      <div class="daemon-bar daemon-ok">
        <div class="daemon-dot" style="background:#4ade80"></div>
        <div class="daemon-info">
          <div class="daemon-name" style="color:#4ade80">rascsi daemon active</div>
          <div class="daemon-sub" style="color:rgba(74,222,128,.5)">${sub}</div>
        </div>
        <div class="daemon-ip">${this._config.host}:${this._config.port}</div>
      </div>`;
  }

  _buildDeviceRows() {
    if (this._error) return '';

    // Show IDs 0–6 that either have a device or are in _devices list
    const rows = this._devices.map(d => {
      const id     = parseInt(d.id ?? d.unit ?? 0);
      if (isNaN(id) || id < 0 || id > 7) return '';

      const file   = basename(d.file ?? d.image ?? '');
      const type   = d.type ?? d.device_type ?? '';
      const meta   = typeMeta(type);
      const size   = formatBytes(d.size ?? d.block_size * d.blocks);
      const hasFile = !!file;

      // Type badge style based on type code prefix
      let typeBadgeCls = 'st-na';
      if (type.startsWith('SCH') || type === 'SAHD') typeBadgeCls = 'st-hd';
      else if (type.startsWith('SCC')) typeBadgeCls = 'st-cd';
      else if (type.startsWith('SCR') || type.startsWith('SCM')) typeBadgeCls = 'st-mo';
      else if (type.startsWith('SCB') || type.startsWith('SCD')) typeBadgeCls = 'st-br';

      const rowCls  = hasFile ? meta.cls : 'sr-empty';
      const imgTxt  = hasFile ? file : 'No image mounted';
      const metaTxt = hasFile ? [
        type ? `${meta.label} drive` : 'Drive',
        size,
      ].filter(Boolean).join(' · ') : 'Available';

      const ejectDisabled = !hasFile || this._busy[id] ? ' disabled' : '';

      return `
        <div class="scsi-row ${rowCls}">
          <div class="scsi-id">ID ${id}</div>
          <div class="scsi-body">
            <div class="scsi-img" id="scsi-img-${id}">${imgTxt}</div>
            <div class="scsi-meta" id="scsi-meta-${id}">${metaTxt}</div>
          </div>
          ${hasFile ? `<div class="scsi-type ${typeBadgeCls}">${meta.label}</div>` : `<div class="scsi-type st-na">—</div>`}
          <div class="eject-btn${ejectDisabled}" data-id="${id}" title="Eject ID ${id}">
            ${this._ejectIco()}
          </div>
        </div>`;
    });

    if (!rows.length) {
      rows.push(`
        <div class="scsi-row sr-empty" style="margin-bottom:8px">
          <div class="scsi-body" style="text-align:center;padding:4px 0">
            <div class="scsi-img" style="color:rgba(255,255,255,.25)">No devices mounted</div>
          </div>
        </div>`);
    }

    return rows.join('');
  }

  _buildBusNote() {
    if (this._error || !this._lastPoll) return '';
    const mins = Math.floor((Date.now() - this._lastPoll) / 60000);
    const ago  = mins < 1 ? 'just now' : `${mins}m ago`;
    return `
      <div class="bus-note">
        ${this._clockIco()} Last polled ${ago}
      </div>`;
  }

  _buildConfirm() {
    return `
      <div class="confirm-overlay" id="confirm-overlay">
        <div class="confirm-sheet">
          <div class="confirm-handle"></div>
          <div class="confirm-title" id="confirm-title">Eject image?</div>
          <div class="confirm-sub" id="confirm-sub">The Mac should have no open files on this drive before ejecting.</div>
          <div class="confirm-btns">
            <button class="confirm-yes" id="confirm-yes">Eject</button>
            <button class="confirm-no"  id="confirm-no">Cancel</button>
          </div>
        </div>
      </div>`;
  }

  _chipHtml() {
    if (this._error) return `<div class="chip chip-err">Offline</div>`;
    const active = this._devices.filter(d => !!(d.file ?? d.image)).length;
    const total  = this._devices.length;
    return `<div class="chip chip-ok">${active} of ${total} mounted</div>`;
  }

  // ── Render / Patch ───────────────────────────────────────────────────────────

  _render() {
    const name = this._config.name ? this._config.name : 'PiSCSI';
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card><div class="wrap">
        <div class="card-hdr">
          <span>${name}</span>
          <div id="hdr-chip">${this._chipHtml()}</div>
        </div>
        ${this._buildDaemonBar()}
        <div class="sec-lbl">
          SCSI bus
          <div id="bus-chip"></div>
        </div>
        <div id="device-list">${this._buildDeviceRows()}</div>
        <div id="bus-note">${this._buildBusNote()}</div>
        ${this._buildConfirm()}
      </div></ha-card>`;
    this._listen();
  }

  _patchDevices() {
    const sr = this.shadowRoot;
    if (!sr.querySelector('.wrap')) { this._render(); return; }

    // Header chip
    const chip = sr.getElementById('hdr-chip');
    if (chip) chip.innerHTML = this._chipHtml();

    // Daemon bar
    const bar = sr.querySelector('.daemon-bar, .error-banner');
    if (bar) bar.outerHTML = this._buildDaemonBar();
    else {
      // Insert after header
      const hdr = sr.querySelector('.card-hdr');
      if (hdr) hdr.insertAdjacentHTML('afterend', this._buildDaemonBar());
    }

    // Device list
    const list = sr.getElementById('device-list');
    if (list) list.innerHTML = this._buildDeviceRows();

    // Bus note
    const note = sr.getElementById('bus-note');
    if (note) note.innerHTML = this._buildBusNote();

    // Re-attach listeners since device list was rebuilt
    this._listen();
  }

  // ── Confirmation overlay ─────────────────────────────────────────────────────

  _openConfirm(scsiId) {
    const sr = this.shadowRoot;
    const d  = this._devices.find(d => parseInt(d.id ?? d.unit) === scsiId);
    const file = basename(d?.file ?? d?.image ?? '');
    this._ejectId = scsiId;
    const title = sr.getElementById('confirm-title');
    const sub   = sr.getElementById('confirm-sub');
    if (title) title.textContent = `Eject ID ${scsiId}?`;
    if (sub)   sub.textContent   = file
      ? `Eject "${file}" from SCSI ID ${scsiId}. Make sure the Mac has no open files on this drive.`
      : `Eject device from SCSI ID ${scsiId}.`;
    sr.getElementById('confirm-overlay')?.classList.add('open');
  }

  _closeConfirm() {
    this.shadowRoot.getElementById('confirm-overlay')?.classList.remove('open');
    this._ejectId = null;
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  _listen() {
    const sr = this.shadowRoot;

    // Eject buttons
    sr.querySelectorAll('.eject-btn:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        if (!isNaN(id) && id >= 0 && id <= 7) this._openConfirm(id);
      });
    });

    // Confirm overlay
    sr.getElementById('confirm-yes')?.addEventListener('click', () => {
      if (this._ejectId != null) this._eject(this._ejectId);
    });
    sr.getElementById('confirm-no')?.addEventListener('click',     () => this._closeConfirm());
    sr.getElementById('confirm-overlay')?.addEventListener('click', e => {
      if (e.target === sr.getElementById('confirm-overlay')) this._closeConfirm();
    });
  }
}

customElements.define('piscsi-card', PiSCSICard);
