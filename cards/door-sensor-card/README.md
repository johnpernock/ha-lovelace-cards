# door-sensor-card

Compact door/window sensor banner. Green when all doors are closed, red when any are open. Tapping opens a grid popup showing every door's status.

---

## How it works

The card reads the state of each configured `binary_sensor` entity. `state === 'on'` means open (the standard HA convention for binary door sensors).

### Banner

The banner shows:
- An icon (house with door open or closed)
- A title: "X door(s) open" or "All doors closed"
- A subtitle: names of open doors (if any), or "All doors are secure"

### Popup

The popup shows a 3-column grid of door tiles. Open doors sort to the top automatically. Each tile shows:
- An icon
- A shortened name (common suffixes like "Door", "Entry", "Slider", "Back" are stripped to keep tiles compact in 3 columns)
- A status label (Open / Closed)

Red tiles for open doors, green tiles for closed.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `doors` | ✅ | — | List of door objects |

### Door object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | `binary_sensor.*` entity. `state === 'on'` = open. |
| `name` | ✅ | — | Display name. Long suffixes (Door, Entry, Slider, Back, Master) are auto-shortened in the popup grid. |

---

## Example

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
    name: Kitchen Back
  - entity: binary_sensor.myggbett_door_window_sensor_door_5
    name: Garage Entry
  - entity: binary_sensor.myggbett_door_window_sensor_door_6
    name: Basement
  - entity: binary_sensor.myggbett_door_window_sensor_door_7
    name: Master Bedroom
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v9 | Padding consistency pass — ha-card insets banner 14px from card edges |
| v8 | Popup max-width normalized to 440px |
| v7 | Popup: body scroll lock on open/close; overscroll-behavior:contain on popup element |
| v6 | Tap-outside-to-close fixed — overlay listener now wired permanently in `_render()` instead of `once:true` in `_openPopup()`; survives hass re-renders reliably |
| v5 | Popup now re-renders correctly after full card re-render; popup state preserved across hass updates |
| v4 | Open doors sort to top in popup; name auto-shortening for 3-column grid |
| v3 | Added 3-column icon grid popup |
| v2 | Red/green color scheme; subtitle lists open door names |
| v1 | Initial release — banner only |
