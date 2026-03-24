# ecoflow-card

Ecoflow River 2 Pro power station card. Shows battery level and health, live power flows (AC in, solar in, AC out, DC out), an inline max charge level slider, battery temperature and cycle count, and AC/DC output toggles.

---

## How it works

All entities are resolved from the `prefix` config key. Battery color transitions green → amber → red based on level (≥60% green, ≥30% amber, <30% red). The max charge slider calls `number.set_value` on `number.<prefix>_max_charge_level` with a 150ms debounce. AC and DC toggle rows call `switch.turn_on` / `switch.turn_off`.

Power flow rows auto-dim when value is 0 — only active flows are highlighted.

`_patch()` updates all values in-place on every hass update.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `custom:ecoflow-card` |
| `prefix` | string | ✅ | Entity ID prefix. E.g. `river_2_pro` |
| `name` | string | ❌ | Display name. Defaults to `River 2 Pro` |

---

## Entity reference

| Entity | Description |
|--------|-------------|
| `sensor.<prefix>_battery_level` | Battery % |
| `sensor.<prefix>_state_of_health` | Battery health % |
| `sensor.<prefix>_cycles` | Charge cycle count |
| `sensor.<prefix>_battery_temperature` | Battery temp °F |
| `sensor.<prefix>_status` | Online/offline status |
| `sensor.<prefix>_ac_in_power` | AC input watts |
| `sensor.<prefix>_ac_out_power` | AC output watts |
| `sensor.<prefix>_solar_in_power` | Solar input watts |
| `sensor.<prefix>_dc_out_power` | DC 12V output watts |
| `sensor.<prefix>_charge_remaining_time` | Minutes until full charge |
| `sensor.<prefix>_discharge_remaining_time` | Minutes of runtime remaining |
| `number.<prefix>_max_charge_level` | Max charge level slider (50–100%) |
| `switch.<prefix>_ac_enabled` | AC output toggle |
| `switch.<prefix>_dc_12v_enabled` | DC 12V output toggle |

---

## Full config example

```yaml
type: custom:ecoflow-card
prefix: river_2_pro
name: River 2 Pro
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v3 | v3 | Card header: font-size 10px uppercase → 17px white bold |
| v2 | Tap states added (.ha-tap class with scale/brightness :active). Outer container background removed. |
| v1 | Initial release |
| v2 | Added `.ha-tap` class with `scale(0.96)/brightness(0.9)` `:active` states on interactive rows. Touch/mobile audit. |
