# room-buttons-card

Compact 2-column room button grid for the home view. Each button represents a room or device. Buttons can open a custom popup with detailed controls, or fire a direct toggle/more-info action.

---

## How it works

Buttons are rendered in a 2-column grid. Each button shows an icon and a room name. The active state (lit amber) reflects whether the main entity is on.

**Without `popup_entities`:**
- Tap → fires `hass-more-info` (opens HA's built-in detail panel)
- Hold 600ms → toggles the entity

**With `popup_entities`:**
- Tap → opens a custom popup with the configured entity tiles

**With `tap_action: toggle`:**
- Tap → directly calls `open_cover` / `close_cover` or `toggle` — no popup, no more-info

### Popup entity types

| Type | What it shows |
|------|--------------|
| `stat` | Read-only tile — label + current value from the entity's state |
| `toggle` | On/off tile with colored indicator. `light.*` entities auto-show a brightness slider when on |
| `fan` | Fan speed control — off pip + 3 or 4 speed pips. Tapping a pip sets that speed. |
| `cover_group` | Blind group tile with ▲ Open and ▼ Close buttons. `max_position` caps how far Open goes. |

### Fan speed in popups

Each `fan` popup entity resolves speeds the same way as `room-controls-card`: YAML `speeds:` wins, then `percentage_step`, then `speed_count`, then default 3. `speed_percentages` lets you manually map pip numbers to exact percentages if the fan needs non-linear steps.

---

## Parameters

### Top-level

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `buttons` | ✅ | — | List of button objects |

### Button object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | The entity this button represents. Its on/off state drives the active indicator. |
| `name` | ✅ | — | Label shown below the icon |
| `icon` | ❌ | `home` | Icon name (see icon list below) |
| `tap_action` | ❌ | `more-info` | Set to `toggle` for direct cover or switch control without popup |
| `popup_entities` | ❌ | — | List of popup entity objects (see below). Presence of this key overrides `tap_action`. |

### Popup entity object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | HA entity ID |
| `label` | ✅ | — | Display label in the popup tile |
| `type` | ✅ | — | `stat`, `toggle`, `fan`, or `cover_group` |
| `icon` | ❌ | Auto | Override icon for `toggle` tiles. Auto-detected from domain if not set. |
| `speeds` | ❌ | 3 | (`fan` type) Number of speed steps |
| `speed_percentages` | ❌ | Equal divisions | (`fan` type) Manual percentage mapping for each speed step |
| `max_position` | ❌ | `100` | (`cover_group` type) Open button targets this position instead of 100 |
| `entities` | ❌ | `[entity]` | (`cover_group` type) All cover entities to move together |

### Available icons

`bulb` `garage` `sofa` `sun` `kitchen` `dining` `desk` `bed` `bath` `stairs` `tree` `fan` `blinds` `tv` `appletv` `homepod` `speaker` `lock` `thermo` `plug` `home`

Unknown values fall back to `home`.

---

## Example

```yaml
type: custom:room-buttons-card
buttons:
  - entity: light.all_family_room_lights
    name: Family Room
    icon: sofa
    popup_entities:
      - entity: sensor.family_room_temperature
        label: Temperature
        type: stat
      - entity: sensor.family_room_humidity
        label: Humidity
        type: stat
      - entity: light.all_family_room_lights
        label: Main Lights
        type: toggle
      - entity: fan.white_series_lightfan_module_2
        label: Front Fan
        type: fan
        speeds: 4
      - entity: cover.family_room_blinds
        label: Blinds
        type: cover_group
        max_position: 87
        entities:
          - cover.family_room_blinds

  - entity: cover.garage_door
    name: Garage
    icon: garage
    tap_action: toggle

  - entity: switch.basement_lights
    name: Basement
    icon: stairs
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v3 | Fixed fan popup speed resolution — now uses `_fanResolvedSpeeds()` helper instead of hardcoded value; matches `room-controls-card` priority logic |
| v2 | Added `cover_group` popup type with `max_position` support; added `tap_action: toggle` for direct cover control |
| v1 | Initial release — 2-column grid, `stat` / `toggle` / `fan` popup types |
