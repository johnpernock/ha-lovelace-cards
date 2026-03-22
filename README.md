# ha-lovelace-cards

Custom Home Assistant Lovelace cards for a wall-mounted dashboard. All cards share a consistent dark-theme design language — transparent backgrounds, subtle borders, bottom-sheet popups on mobile, centered modals on desktop ≥768px.

---

## Installation

1. Copy the `.js` files to `/config/www/` on your Home Assistant instance
2. Go to **Settings → Dashboards → Resources → Add resource** for each file:

| URL | Type |
|-----|------|
| `/local/room-buttons-card.js` | JavaScript Module |
| `/local/weather-card-nws.js` | JavaScript Module |
| `/local/clock-card.js` | JavaScript Module |
| `/local/temp-strip-card.js` | JavaScript Module |
| `/local/door-sensor-card.js` | JavaScript Module |
| `/local/septa-paoli-card.js` | JavaScript Module |
| `/local/thermostat-card.js` | JavaScript Module |

3. Hard refresh your browser (`Ctrl+Shift+R` / `Cmd+Shift+R`)

---

## Cards

### `room-buttons-card`

Compact 2-column room button grid. Tap any button with `popup_entities` defined to open a detail popup. Buttons without `popup_entities` fire `hass-more-info` on tap and toggle on hold (600ms).

**Supported popup entity types**

| Type | Behaviour |
|------|-----------|
| `stat` | Read-only sensor value tile |
| `toggle` | On/off tile · `light.*` entities auto-show a brightness slider |
| `fan` | Speed pip header + pip segment buttons (3 or 4 speed) |
| `cover_group` | Single tile with ▲ Open / ▼ Close buttons for multiple blinds |

```yaml
type: custom:room-buttons-card
buttons:
  # Simple button — tap = hass-more-info, hold = toggle
  - entity: light.main_lights
    name: Main Lights
    icon: bulb

  # Cover direct-toggle (no popup)
  - entity: cover.garage_door
    name: Garage Door
    icon: garage
    tap_action: toggle

  # Button with custom popup
  - entity: light.family_room
    name: Family Room
    icon: sofa
    popup_entities:
      - entity: sensor.family_room_temperature
        label: Temperature
        type: stat
      - entity: sensor.family_room_humidity
        label: Humidity
        type: stat
      - entity: light.family_room
        label: Main Lights
        type: toggle
      - entity: fan.family_room_ceiling
        label: Ceiling Fan
        type: fan
        speeds: 3                        # 3 or 4
        speed_percentages: [33, 66, 100] # optional
      - entity: cover.fr_blind_1
        label: Blinds
        type: cover_group
        max_position: 70                 # open button targets this %, default 100
        entities:
          - cover.fr_blind_1
          - cover.fr_blind_2
          - cover.fr_blind_3
          - cover.fr_blind_4
```

**Available icons:** `bulb` `garage` `sofa` `sun` `kitchen` `dining` `desk` `bed` `bath` `stairs` `tree` `fan` `blinds` `tv` `appletv` `homepod` `speaker` `lock` `thermo` `plug` `home`

---

### `weather-card-nws`

Current conditions, 7-day forecast strip, and an optional detail popup. Uses the HA `weather/subscribe_forecast` API for twice-daily and hourly forecasts.

Tapping the card opens a popup with:
- Current conditions grid (humidity, dewpoint, UV index, visibility, pressure, cloud cover)
- Horizontally scrollable 12-hour forecast
- 7-day extended forecast with precipitation bars

```yaml
type: custom:weather-card-nws
entity: weather.home          # required
name: Home                    # optional — overrides friendly_name
unit: °F                      # optional — overrides entity unit
alert_entity: sensor.nws_alerts  # optional — shows alert banner when active
tap_action: popup             # popup (default) | none
```

---

### `clock-card`

Large clock with seconds and AM/PM. Tapping the date side opens a full calendar popup with month navigation and optional event dots from HA calendar entities.

```yaml
type: custom:clock-card

# All options below are optional
calendar_entities:
  - entity: calendar.personal
    color: '#60a5fa'
  - entity: calendar.work
    color: '#a78bfa'
  - entity: calendar.family
    color: '#4ade80'

show_next_event: true   # show next upcoming event below the time
today_color: '#60a5fa'  # accent color for today in the calendar
```

---

### `temp-strip-card`

Single-row compact temperature strip. Supports any entity domain — `sensor.*` reads state directly, `climate.*` reads `current_temperature` attribute.

```yaml
type: custom:temp-strip-card
unit: °F    # optional — default °F
sensors:
  - entity: sensor.office_temperature
    abbr: Off
  - entity: sensor.bedroom_temperature
    abbr: Bed
  - entity: sensor.dining_room_temperature
    abbr: Din
  - entity: climate.family_room
    abbr: FR·T
  - entity: sensor.family_room_temperature
    abbr: FR·S
  - entity: climate.solarium
    abbr: Sol
```

---

### `door-sensor-card`

Compact banner showing open door count. Green when all clear, red when any door is open. Tapping opens a 3-column icon grid popup listing every door — open doors sort to the top.

```yaml
type: custom:door-sensor-card
doors:
  - entity: binary_sensor.front_door
    name: Front Door
  - entity: binary_sensor.patio_door
    name: Patio Slider
  - entity: binary_sensor.office_door
    name: Office
  - entity: binary_sensor.kitchen_door
    name: Kitchen Back
  - entity: binary_sensor.garage_entry
    name: Garage Entry
  - entity: binary_sensor.master_bedroom
    name: Master Bedroom
  - entity: binary_sensor.basement_door
    name: Basement
```

---

### `septa-paoli-card`

SEPTA Paoli/Thorndale line departures and arrivals. Shows next outbound departure with later trains as pills, next inbound arrival, delay status, and line alerts. Tapping any train card opens a popup with depart/arrive times, current station, and service type.

```yaml
type: custom:septa-paoli-card
outbound:
  - sensor.paoli_outbound_1
  - sensor.paoli_outbound_2
  - sensor.paoli_outbound_3
inbound:
  - sensor.paoli_inbound_1
  - sensor.paoli_inbound_2
  - sensor.paoli_inbound_3
inbound_next_station:
  - sensor.paoli_inbound_next_station_1
  - sensor.paoli_inbound_next_station_2
  - sensor.paoli_inbound_next_station_3
alert: sensor.paoli_line_alert
```

**Expected sensor attributes**

| Attribute | Description |
|-----------|-------------|
| `state` | Departure time (e.g. `10:22AM`) |
| `orig_arrival_time` | Arrival time |
| `orig_delay` | Delay string (e.g. `18 min` or `On time`) |
| `orig_train` | Train number |
| `orig_line` | Line name |
| `isdirect` | `"true"` if direct service |

---

### `thermostat-card`

Compact thermostat card designed to be used in a horizontal stack of 3. Shows current temp, target temp with `−`/`+` buttons, and mode indicator. Tapping anywhere on the card (not the buttons) opens a detail popup.

**Popup sections** (auto-populated from entity attributes — only shown if supported):
- Current temp + humidity · Target temp with `−`/`+` full-width buttons
- Mode — heat, cool, heat/cool, fan, dry, off
- Fan speed — auto, low, medium, high, turbo, quiet
- Airflow swing — off, vertical, horizontal, both
- Preset — eco, away, boost, comfort, sleep, home, activity

```yaml
# Recommended layout — horizontal stack of 3
type: horizontal-stack
cards:
  - type: custom:thermostat-card
    entity: climate.main_floor
    name: Main Floor
    step: 1              # optional — °F/°C per tap, default 1
  - type: custom:thermostat-card
    entity: climate.family_room
    name: Family Rm
  - type: custom:thermostat-card
    entity: climate.solarium
    name: Solarium
```

**Mode colors**

| Mode | Color |
|------|-------|
| Heat | Orange |
| Cool | Blue |
| Heat/Cool · Auto | Orange + Blue split |
| Fan only | Teal |
| Dry | Amber |
| Off | Gray |

---

## Design notes

- All cards use `background: transparent` so they inherit the dashboard theme
- Popups use a bottom sheet on mobile and a centered modal on desktop (≥768px)
- Color palette is consistent across all cards: amber for lights, cyan for fans, blue for covers/cool, green for "all clear", red for alerts/open/delayed
- Fan speed uses growing pip columns — Off is a ✕, speeds 1–N grow taller
- Cover groups with `max_position` show a ▲ Open button that targets the cap rather than 100%
