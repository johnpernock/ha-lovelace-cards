# peco-card

PECO / Opower utility energy card. Shows electric usage to date vs forecast with a progress bar, forecasted bill, cost to date, and typical monthly comparisons. Optional gas section shown if gas entities are available.

---

## How it works

Reads from Opower/PECO entities via the HA Opower integration. Cost sensors commonly return `0` due to Opower's daily update lag — the card shows an "updating" note in that case rather than a false zero. Gas entities that return `unavailable` are hidden entirely rather than shown as errors.

`_patch()` updates the usage bar and cost values in-place on every hass update.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `custom:peco-card` |
| `electric_prefix` | string | ✅ | Entity prefix for electric sensors (e.g. `peco_electric`) |
| `gas_prefix` | string | ❌ | Entity prefix for gas sensors (e.g. `peco_gas`). Section hidden if entities are unavailable |
| `name` | string | ❌ | Display name. Defaults to `PECO Electric` |

---

## Entity reference

| Entity | Description |
|--------|-------------|
| `sensor.<electric_prefix>_current_bill_electric_usage_to_date` | kWh used so far this billing period |
| `sensor.<electric_prefix>_current_bill_electric_forecasted_usage` | Forecasted total kWh for the period |
| `sensor.<electric_prefix>_current_bill_electric_cost_to_date` | Cost to date in USD |
| `sensor.<electric_prefix>_current_bill_electric_forecasted_cost` | Forecasted total cost in USD |
| `sensor.<electric_prefix>_typical_monthly_electric_usage` | Historical typical monthly kWh |
| `sensor.<electric_prefix>_typical_monthly_electric_cost` | Historical typical monthly cost |
| `sensor.<electric_prefix>_last_updated` | Timestamp of last data update |
| `sensor.<gas_prefix>_current_bill_gas_usage_to_date` | CCF used (optional) |
| `sensor.<gas_prefix>_current_bill_gas_forecasted_usage` | Forecasted CCF (optional) |
| `sensor.<gas_prefix>_current_bill_gas_cost_to_date` | Gas cost to date (optional) |

---

## Full config example

```yaml
type: custom:peco-card
electric_prefix: peco_electric
gas_prefix: peco_gas
name: PECO Electric
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v1 | Initial release |
| v2 | Removed amber tinted background from outer `.card` container — style guide prohibits colored backgrounds on the card shell |
