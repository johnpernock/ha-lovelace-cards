# temp-strip-card

Single-row compact temperature strip. Shows multiple room temperatures side-by-side in one horizontal bar. Works with any entity type — sensors, climate entities, or anything with a numeric state.

---

## How it works

Each cell reads its value based on entity domain: `climate.*` entities read `current_temperature` from attributes; all other entities read the state value directly as a number. Values are rounded to whole degrees.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sensors` | list | ✅ | List of sensor objects (at least one required) |
| `unit` | string | ❌ | Unit label appended to each value (e.g. `°F`). Default: `°F` |

### Sensor object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity` | string | ✅ | Any entity ID — sensor, climate, or other numeric entity |
| `abbr` | string | ✅ | Short abbreviation shown above the value (e.g. `FR`, `Off`, `Sol`) |

---

## Domain behavior

| Domain | How value is read |
|--------|-------------------|
| `climate.*` | `attributes.current_temperature` |
| `sensor.*` | `state` parsed as float |
| Everything else | `state` parsed as float |

Unavailable or non-numeric values show `—`.

---

## Full example

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
  - entity: sensor.master_bedroom_temperature
    abbr: Bed
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v3 | `climate.*` domain auto-detection reads `current_temperature` attribute; unavailable state handled gracefully (shows `—`) |
| v2 | Multi-entity support; `unit` config option |
| v1 | Initial release |
