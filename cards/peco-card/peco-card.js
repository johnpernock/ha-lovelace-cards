/**
 * peco-card.js
 * PECO / Opower utility energy card for Home Assistant Lovelace.
 *
 * CONFIG:
 * type: custom:peco-card
 * electric_prefix: peco_electric     # required
 * gas_prefix: peco_gas               # optional — shown if entities are available
 * name: PECO                         # optional display name
 */

class PecoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  setConfig(c) {
    if (!c.electric_prefix) throw new Error('peco-card: electric_prefix is required');
    this._config = c;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 5; }

  // ── Entity helpers ─────────────────────────────────────────────────────────
  _eid(prefix, suffix) { return `sensor.${prefix}_${suffix}`; }
  _val(prefix, suffix) { return this._hass?.states[this._eid(prefix,suffix)]?.state ?? null; }
  _num(prefix, suffix) { const v = parseFloat(this._val(prefix,suffix)); return isNaN(v) ? 0 : v; }
  _avail(prefix, suffix) {
    const s = this._hass?.states[this._eid(prefix,suffix)];
    return s && s.state !== 'unavailable' && s.state !== 'unknown';
  }

  _fmtDate(iso) {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    } catch { return null; }
  }

  _fmtCurrency(val) {
    if (!val && val !== 0) return '—';
    return '$'+Number(val).toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
  }

  _fmtKwh(val) {
    if (!val && val !== 0) return '—';
    return Number(val).toLocaleString('en-US')+'';
  }

  _css() { return `
    :host{display:block}
    ha-card{background:transparent!important;box-shadow:none!important;border:none!important;padding:0}
    *{box-sizing:border-box;margin:0;padding:0;font-family:var(--primary-font-family,-apple-system,sans-serif)}
    .card{border-radius:10px;border:1px solid rgba(255,255,255,.10);overflow:hidden}
    .sbanner{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid rgba(251,191,36,.1)}
    .sdot{width:10px;height:10px;border-radius:50%;background:#fbbf24;flex-shrink:0}
    .slabel{font-size:15px;font-weight:700;color:#fbbf24;line-height:1}
    .ssub{font-size:10px;color:rgba(255,255,255,.4);margin-top:2px}
    .sec{padding:10px 14px 12px;display:flex;flex-direction:column;gap:9px}
    .usage-lbl-row{display:flex;justify-content:space-between;align-items:baseline}
    .usage-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.3)}
    .usage-val{font-size:22px;font-weight:700;color:#e2e8f0;letter-spacing:-.5px;line-height:1}
    .usage-unit{font-size:11px;color:rgba(255,255,255,.35);margin-left:2px}
    .pct-pill{font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;flex-shrink:0}
    .bar-bg{height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:6px}
    .bar-fill{height:100%;border-radius:99px;transition:width .5s}
    .bar-ends{display:flex;justify-content:space-between;margin-top:3px}
    .bar-end{font-size:9px;color:rgba(255,255,255,.2)}
    .divider{height:1px;background:rgba(255,255,255,.07)}
    .bill-row{display:flex;align-items:center;justify-content:space-between}
    .bill-lbl{font-size:12px;color:rgba(255,255,255,.45)}
    .bill-val{font-size:13px;font-weight:700;color:#e2e8f0}
    .bill-note{font-size:10px;color:rgba(255,255,255,.25);margin-left:5px}
    .gas-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.2);margin-bottom:4px}
    .unavail-note{font-size:11px;color:rgba(255,255,255,.2);font-style:italic}
    .updated{font-size:10px;color:rgba(255,255,255,.18);margin-top:2px}
    .typical-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0}
    .typical-lbl{font-size:11px;color:rgba(255,255,255,.3)}
    .typical-val{font-size:11px;font-weight:700;color:rgba(255,255,255,.4)}
  `; }

  _buildElectric() {
    const ep = this._config.electric_prefix;
    const usage    = this._num(ep, 'current_bill_electric_usage_to_date');
    const forecast = this._num(ep, 'current_bill_electric_forecasted_usage');
    const cost     = this._num(ep, 'current_bill_electric_cost_to_date');
    const fcCost   = this._num(ep, 'current_bill_electric_forecasted_cost');
    const typical  = this._num(ep, 'typical_monthly_electric_usage');
    const typCost  = this._num(ep, 'typical_monthly_electric_cost');
    const updated  = this._val(ep, 'last_updated');
    const pct      = forecast > 0 ? Math.min(100, Math.round((usage / forecast) * 100)) : 0;
    const vsTyp    = typical > 0 ? Math.round(((forecast - typical) / typical) * 100) : null;
    const overTyp  = vsTyp != null && vsTyp > 5;
    const underTyp = vsTyp != null && vsTyp < -5;
    const pillBg   = overTyp  ? 'rgba(248,113,113,.12)' : underTyp ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.08)';
    const pillClr  = overTyp  ? '#f87171'               : underTyp ? '#4ade80'               : 'rgba(255,255,255,.35)';
    const pillTxt  = vsTyp != null ? (vsTyp > 0 ? `+${vsTyp}% vs typical` : `${vsTyp}% vs typical`) : '';
    const updStr   = this._fmtDate(updated);
    const costZero = cost === 0;

    return `
      <div class="usage-lbl-row">
        <span class="usage-lbl">Usage to date</span>
        ${pillTxt ? `<span class="pct-pill" style="background:${pillBg};color:${pillClr}">${pillTxt}</span>` : ''}
      </div>
      <div>
        <span class="usage-val" id="pc-usage">${this._fmtKwh(usage)}</span>
        <span class="usage-unit">kWh</span>
      </div>
      <div>
        <div class="bar-bg"><div class="bar-fill" id="pc-bar" style="width:${pct}%;background:linear-gradient(to right,#fbbf24,#fb923c)"></div></div>
        <div class="bar-ends">
          <span class="bar-end">0</span>
          <span class="bar-end" id="pc-forecast">Forecast: ${this._fmtKwh(forecast)} kWh (${pct}%)</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="bill-row">
        <span class="bill-lbl">Cost to date</span>
        <span class="bill-val" id="pc-cost">${this._fmtCurrency(cost)}${costZero ? '<span class="bill-note">updating</span>' : ''}</span>
      </div>
      <div class="bill-row">
        <span class="bill-lbl">Forecasted bill</span>
        <span class="bill-val" id="pc-fccost">${this._fmtCurrency(fcCost)}${fcCost === 0 ? '<span class="bill-note">updating</span>' : ''}</span>
      </div>
      <div class="divider"></div>
      <div class="typical-row">
        <span class="typical-lbl">Typical monthly usage</span>
        <span class="typical-val">${this._fmtKwh(typical)} kWh</span>
      </div>
      <div class="typical-row">
        <span class="typical-lbl">Typical monthly cost</span>
        <span class="typical-val">${typCost > 0 ? this._fmtCurrency(typCost) : '—'}</span>
      </div>
      ${updStr ? `<div class="updated">Updated ${updStr}</div>` : ''}`;
  }

  _buildGas() {
    const gp = this._config.gas_prefix;
    if (!gp) return '';
    const avail = this._avail(gp, 'current_bill_gas_usage_to_date');
    if (!avail) return `
      <div class="divider"></div>
      <div class="gas-hdr">Gas</div>
      <div class="unavail-note">Data unavailable</div>`;
    const usage   = this._num(gp, 'current_bill_gas_usage_to_date');
    const fcUsage = this._num(gp, 'current_bill_gas_forecasted_usage');
    const cost    = this._num(gp, 'current_bill_gas_cost_to_date');
    return `
      <div class="divider"></div>
      <div class="gas-hdr">Gas</div>
      <div class="bill-row">
        <span class="bill-lbl">Usage to date</span>
        <span class="bill-val">${this._fmtKwh(usage)} CCF</span>
      </div>
      <div class="bill-row">
        <span class="bill-lbl">Forecasted</span>
        <span class="bill-val">${this._fmtKwh(fcUsage)} CCF</span>
      </div>
      <div class="bill-row">
        <span class="bill-lbl">Cost to date</span>
        <span class="bill-val">${this._fmtCurrency(cost)}</span>
      </div>`;
  }

  _render() {
    const name = this._config.name || 'PECO Electric';
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="card">
          <div class="sbanner">
            <div class="sdot"></div>
            <div>
              <div class="slabel">${name}</div>
              <div class="ssub">Current billing period</div>
            </div>
          </div>
          <div class="sec" id="peco-sec">
            ${this._buildElectric()}
            ${this._buildGas()}
          </div>
        </div>
      </ha-card>`;
  }

  _patch() {
    const ep      = this._config.electric_prefix;
    const usage   = this._num(ep, 'current_bill_electric_usage_to_date');
    const forecast= this._num(ep, 'current_bill_electric_forecasted_usage');
    const cost    = this._num(ep, 'current_bill_electric_cost_to_date');
    const fcCost  = this._num(ep, 'current_bill_electric_forecasted_cost');
    const pct     = forecast > 0 ? Math.min(100, Math.round((usage / forecast) * 100)) : 0;
    const sr      = this.shadowRoot;
    const el      = id => sr.getElementById(id);
    if (el('pc-usage'))    el('pc-usage').textContent    = this._fmtKwh(usage);
    if (el('pc-bar'))      el('pc-bar').style.width      = pct+'%';
    if (el('pc-forecast')) el('pc-forecast').textContent = `Forecast: ${this._fmtKwh(forecast)} kWh (${pct}%)`;
    if (el('pc-cost'))     el('pc-cost').innerHTML       = this._fmtCurrency(cost)+(cost===0 ? '<span class="bill-note">updating</span>' : '');
    if (el('pc-fccost'))   el('pc-fccost').innerHTML     = this._fmtCurrency(fcCost)+(fcCost===0 ? '<span class="bill-note">updating</span>' : '');
  }
}

customElements.define('peco-card', PecoCard);
