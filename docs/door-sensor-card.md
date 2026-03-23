# door-sensor-card

Compact banner showing a count of open doors. Green when all doors are secure, red when any are open. Tapping opens a 3-column icon-grid popup listing every door with its current state.

---

## How it works

The card reads each door's `binary_sensor` entity — `on` = open, `off` = closed. The banner updates live on every hass update. In the popup, open doors are sorted to the top. Long door names are shortened automatically (removes "Master ", " Entry", " Slider", " Back", " Door") to fit the 3-column grid.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doors` | list | ✅ | List of door objects (at least one required) |

### Door object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity` | string | ✅ | Binary sensor entity ID |
| `name` | string | ✅ | Display name for this door |

---

## Full example

```yaml
type: custom:door-sensor-card
doors:
  - entity: binary_sensor.myggbett_door_window_sensor_door_1
    name: Front Door
  - entity: binary_sensor.myggbett_door_window_sensor_door_2
    name: Patio Slider
  - entity: binary_sensor.myggbett_door_window_sensor_door_3
    name: Office
  - entity: binary_sensor.myggbett_door_window_sensor_door_4
    name: Master Bedroom
  - entity: binary_sensor.myggbett_door_window_sensor_door_5
    name: Garage Entry
  - entity: binary_sensor.myggbett_door_window_sensor_door_6
    name: Basement
  - entity: binary_sensor.myggbett_door_window_sensor_door_7
    name: Kitchen Back
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v5 | Popup portalled to `document.body` — fixes clipping on wall display; door name shortening for 3-column fit |
| v4 | Open doors sort to top in popup grid |
| v3 | Popup added (3-column icon grid) |
| v2 | Multi-door support; open count summary |
| v1 | Initial release |
