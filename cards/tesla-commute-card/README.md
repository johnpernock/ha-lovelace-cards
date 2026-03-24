# tesla-commute-card

Expanded Tesla card for the Commute view. Surfaces all commute-relevant data inline — battery, temperatures, climate control, tire pressures, and quick-action buttons — with no popup required. The compact `tesla-card` on the Home view remains unchanged; this is a separate independent card.

---

## How it works

### vs. compact tesla-card
| Section | Compact `tesla-card` | Expanded `tesla-commute-card` |
|---------|---------------------|-------------------------------|
| Battery | Bar + % + range | Large % + range + status inline |
| Temperatures | Popup only | Interior + exterior tiles always visible |
| Climate | Button only | Inline row with −/+ stepper + On/Off badge, tap to toggle |
| Tires | Popup only | Always-visible 2×2 grid, red tile + section label on warning |
| Lock | Button | Action button (tap to toggle) |
| Trunk | Button | Action button (tap to toggle) |
| Sentry | Popup only | Action button with live on/off state |
| Odometer | Popup only | Live reading on 4th action button |

### Interior temperature color
- Above 85°F → orange (hot, pre-cool before getting in)
- Below 45°F → blue (cold)
- Normal range → white

### Battery color
- ≥50% → green
- ≥20% → amber
- <20% → red

### `_patch()` system
All values update in-place on every `hass` update without re-rendering the DOM or losing event listeners.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `custom:tesla-commute-card` |
| `name` | string | ❌ | Vehicle nickname. Default `Magneton` |
| `tire_warn_psi` | number | ❌ | PSI below which a tire tile turns red. Default `40` |
| `temp_unit` | string | ❌ | `F` or `C`. Default `F` |
| `entities` | object | ✅ | Entity ID map (see table below) |

### `entities` keys

All keys are optional — sections only render if their entities are configured.

| Key | Domain | Description |
|-----|--------|-------------|
| `battery_level` | `sensor` | Battery state of charge % |
| `battery_range` | `sensor` | Estimated range in miles |
| `charging_state` | `binary_sensor` or `sensor` | Charging state (`on`/`charging`) |
| `door_lock` | `lock` | Door lock — shown as badge + action button |
| `climate` | `climate` | HVAC — inline row with target temp stepper |
| `trunk` | `cover` | Trunk open/close action button |
| `sentry_mode` | `switch` | Sentry mode action button |
| `odometer` | `sensor` | Live mileage on 4th action button |
| `interior_temperature` | `sensor` | Interior cabin temp tile |
| `exterior_temperature` | `sensor` | Outside temp tile |
| `tire_pressure_fl` | `sensor` | Front-left PSI |
| `tire_pressure_fr` | `sensor` | Front-right PSI |
| `tire_pressure_rl` | `sensor` | Rear-left PSI |
| `tire_pressure_rr` | `sensor` | Rear-right PSI |

---

## Full config example

```yaml
type: custom:tesla-commute-card
name: Magneton
tire_warn_psi: 40
temp_unit: F
entities:
  battery_level:        sensor.magneton_battery
  battery_range:        sensor.magneton_range
  charging_state:       binary_sensor.magneton_charging
  door_lock:            lock.magneton_doors
  climate:              climate.magneton_hvac_climate_system
  trunk:                cover.magneton_trunk
  sentry_mode:          switch.magneton_sentry_mode
  odometer:             sensor.magneton_odometer
  interior_temperature: sensor.magneton_temperature_inside
  exterior_temperature: sensor.magneton_temperature_outside
  tire_pressure_fl:     sensor.magneton_tpms_front_left
  tire_pressure_fr:     sensor.magneton_tpms_front_right
  tire_pressure_rl:     sensor.magneton_tpms_rear_left
  tire_pressure_rr:     sensor.magneton_tpms_rear_right
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v4 | Fixed ReferenceError: ents is not defined in _patch() — climate mode now reads from this._config.entities?.climate instead of undefined local variable |
| v2 | Climate badge now shows HVAC mode name (Heating / Cooling / Auto / Fan / Dry / Off) instead of On / Off. Tire pressures rounded to integer PSI. |
| v1 | Initial release |
| v2 | Climate badge now shows HVAC mode name (Heating/Cooling/Auto/Fan/Dry/Off) instead of On/Off — reads as state indicator not a control |
