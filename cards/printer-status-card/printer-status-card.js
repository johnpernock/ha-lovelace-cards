/**
 * printer-status-card.js  —  v2
 * Compact printer status for home view.
 */

class PrinterStatusCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  setConfig(c) { this._config = c; this._render(); }
  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.querySelector('ha-card') || !prev) { this._render(); return; }
    this._patch();
  }
  getCardSize() { return 2; }

  _pfx()    { return this._config.printer || 'p1s_01p09a3a1100648'; }
  _eid(s)   { return `${this._pfx()}_${s}`; }
  _state(s) { return this._hass?.states[this._eid(s)] || null; }
  _val(s)   { return this._state(s)?.state ?? null; }
  _num(s)   { const v = parseFloat(this._val(s)); return isNaN(v) ? null : v; }
  _isOn(s)  { const v = this._val(s); return v === 'on' || v === 'true'; }

  _fmtTime(hours) {
    if (!hours || isNaN(hours)) return null;
    const m = Math.round(hours * 60);
    if (m < 1) return '< 1m';
    const h = Math.floor(m / 60), mm = m % 60;
    if (h === 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
  }

  _patch() {
    // printer-status is lightweight — just update ha-card inner content, skip style rebuild
    const stage    = this._val('current_stage');
    const status   = this._val('print_status');
    const hasError = this._isOn('hms_errors') || this._isOn('print_error');
    const online   = this._isOn('online') || (stage && stage !== 'unavailable' && stage !== 'offline');
    const wasVisible = !!this.shadowRoot.querySelector('.wrap');
    const isVisible  = online && stage && stage !== 'unavailable';
    // Structure change → full re-render
    if (isVisible !== wasVisible) { this._render(); return; }
    if (!isVisible) return;
    // Re-render inner content only
    const haCard = this.shadowRoot.querySelector('ha-card');
    if (haCard) {
      // Re-use _render logic by temporarily letting it rebuild just the inner HTML
      this._render();
    }
  }

  _render() {
    const stage     = this._val('current_stage');
    const status    = this._val('print_status');
    const progress  = this._num('print_progress');
    const remaining = this._num('remaining_time');
    const taskName  = this._val('task_name') || this._val('gcode_filename');
    const hasError  = this._isOn('hms_errors') || this._isOn('print_error');
    const online    = this._isOn('online') || (stage && stage !== 'unavailable' && stage !== 'offline');
    const isPrinting = stage === 'printing' || status === 'running';
    const isPaused   = stage === 'pause' || stage?.startsWith('paused') || status === 'pause';
    const isFinished = stage === 'finish' || status === 'finish';

    let inner = '';

    if (!online || !stage || stage === 'unavailable') {
      inner = '';
    } else if (hasError) {
      const errMsg = this._isOn('hms_errors') ? 'HMS error detected' : 'Print error';
      inner = `
        <div class="row error">
          <div class="dot" style="background:#f87171"></div>
          <div class="info">
            <div class="label" style="color:#f87171">Printer Error</div>
            <div class="sub">${errMsg} — check Bambu app</div>
          </div>
          <div class="badge error-badge">Action needed</div>
        </div>`;
    } else if (isPrinting || isPaused) {
      const pct    = progress != null ? Math.round(progress) : 0;
      const remStr = this._fmtTime(remaining);
      const color  = isPaused ? '#fbbf24' : '#60a5fa';
      const lbl    = isPaused ? 'Paused' : 'Printing';
      const name   = taskName && taskName !== 'unavailable' ? taskName : '';
      inner = `
        <div class="row">
          <div class="dot" style="background:${color}"></div>
          <div class="info">
            <div class="label" style="color:${color}">${lbl}${name ? ` · ${name}` : ''}</div>
            ${remStr ? `<div class="sub">${remStr} remaining</div>` : ''}
          </div>
          <div class="pct" style="color:${color}">${pct}%</div>
        </div>
        <div class="prog-bg">
          <div class="prog-bar" style="width:${pct}%;background:${color}"></div>
        </div>`;
    } else if (isFinished) {
      const name = taskName && taskName !== 'unavailable' ? taskName : 'Print';
      inner = `
        <div class="row">
          <div class="dot" style="background:#4ade80"></div>
          <div class="info">
            <div class="label" style="color:#4ade80">Print complete</div>
            <div class="sub">${name}</div>
          </div>
          <div class="badge done-badge">Done</div>
        </div>`;
    } else {
      inner = '';
    }

    if (!inner) {
      this.shadowRoot.innerHTML = `<style>:host{display:block}ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0;margin:0}</style><ha-card></ha-card>`;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
        *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
        .wrap{border-radius:10px;border:1px solid rgba(255,255,255,.12);overflow:hidden;padding:10px 14px;display:flex;flex-direction:column;gap:7px}
        .row{display:flex;align-items:center;gap:10px}
        .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .info{flex:1;min-width:0}
        .label{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sub{font-size:11px;color:rgba(255,255,255,.4);margin-top:1px}
        .pct{font-size:15px;font-weight:700;flex-shrink:0}
        .prog-bg{height:5px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
        .prog-bar{height:100%;border-radius:99px;transition:width .3s}
        .badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;flex-shrink:0}
        .error-badge{background:rgba(239,68,68,.15);color:#f87171}
        .done-badge{background:rgba(74,222,128,.15);color:#4ade80}
        .wrap.has-error{border-color:rgba(239,68,68,.25);background:rgba(239,68,68,.04)}
      </style>
      <ha-card>
        <div class="wrap${hasError ? ' has-error' : ''}">
          ${inner}
        </div>
      </ha-card>`;
  }
}

customElements.define('printer-status-card', PrinterStatusCard);