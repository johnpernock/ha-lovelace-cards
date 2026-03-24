# wallbox-card

Wallbox EV charger status card. Shows charger status, session energy, range added, live charge power and speed, a drag slider for max current, solar charging mode selector, and a lock toggle.

---

## How it works

All entities are resolved from the `prefix` config key — e.g. `prefix: wallbox_beryl_pulsar_plus` maps to `sensor.wallbox_beryl_pulsar_plus_charging_power`, `lock.wallbox_beryl_pulsar_plus_lock`, etc.

Status is read from `sensor.<prefix>_status_description` and mapped to a color theme (green=Ready, blue=Charging, amber=Connected/Paused, red=Error). The max current slider calls `number.set_value` with a 150ms debounce. Solar mode buttons call `select.select_option`. The lock row calls `lock.lock` / `lock.unlock`.

`_patch()` updates all values in-place — no DOM rebuild on hass updates.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `custom:wallbox-card` |
| `prefix` | string | ✅ | Entity ID prefix (everything between `sensor.` and `_charging_power`). E.g. `wallbox_beryl_pulsar_plus` |
| `name` | string | ❌ | Display name shown in the status banner. Defaults to `EV Charger` |

---

## Entity reference

All entities use `<prefix>` as defined in config:

| Entity | Description |
|--------|-------------|
| `sensor.<prefix>_status_description` | Human-readable status (Ready, Charging, etc.) |
| `sensor.<prefix>_added_energy` | Session energy in kWh |
| `sensor.<prefix>_added_range` | Range added this session in miles |
| `sensor.<prefix>_charging_power` | Live charge power in kW |
| `sensor.<prefix>_charging_speed` | Charge speed in km/h added |
| `sensor.<prefix>_max_available_power` | Max available current in A (used for bar scale) |
| `number.<prefix>_maximum_charging_current` | Max current slider (6–48 A) |
| `lock.<prefix>_lock` | Charger lock state and control |
| `select.<prefix>_solar_charging` | Solar mode: `off`, `eco_mode`, `full_solar` |

---

## Full config example

```yaml
type: custom:wallbox-card
prefix: wallbox_beryl_pulsar_plus
name: Wallbox Beryl Pulsar Plus
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v1 | Initial release |
| v2 | Touch/mobile audit: added `-webkit-tap-highlight-color:transparent` to ctrl-row and mode-opt buttons |
