# temp-strip-card

Single-row temperature strip. Shows multiple sensors in one compact horizontal bar — abbreviated label above, temperature value below.

---

## How it works

The card renders a flex row with one cell per configured sensor. Each cell shows a short abbreviation and the current temperature. Cells are divided by a 1px separator.

### Entity domain handling

- `sensor.*` — reads `state` directly and rounds to nearest integer
- `climate.*` — reads `attributes.current_temperature` (the actual room temperature, not the setpoint)
- Any other domain — attempts to parse `state` as a number

Unavailable or non-numeric states show `—`.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `sensors` | ✅ | — | List of sensor objects |
| `unit` | ❌ | `°F` | Temperature unit label displayed as superscript after each value |

### Sensor object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Any `sensor.*` or `climate.*` entity with a numeric temperature value |
| `abbr` | ✅ | — | Short label (2–4 characters recommended). Shown above the temperature. Use `·` for compound labels like `FR·T`. |

---

## Example

```yaml
type: custom:temp-strip-card
unit: °F
sensors:
  - entity: sensor.office_temperature
    abbr: Off
  - entity: sensor.dining_room_temperature
    abbr: Din
  - entity: climate.family_room_2
    abbr: FR·T
  - entity: sensor.family_room_temperature
    abbr: FR·S
  - entity: climate.solarium_mini_split
    abbr: Sol
  - entity: climate.main_floor
    abbr: Main
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v4 | Padding consistency pass — horizontal padding normalized to 14px |
| v3 | Added `climate.*` domain support — reads `current_temperature` attribute |
| v2 | Added `unit` config option; separator lines between cells |
| v1 | Initial release |
