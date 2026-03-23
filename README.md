# ha-lovelace-cards

Custom Home Assistant Lovelace cards for a wall-mounted 1200×800 dashboard (iPad/tablet) with mobile support. All cards share a consistent dark-theme design language — transparent backgrounds, subtle borders, left-accent-bar patterns, and bottom-sheet popups on mobile / centered modals on desktop ≥768px.

Popups are portalled to `document.body` to escape HA's CSS transforms. Values are patched in-place on `hass` updates (no full re-render) to preserve event listeners.

---

## Installation

1. Copy all `.js` files to `/config/www/` on your Home Assistant instance
2. Go to **Settings → Dashboards → Resources → Add resource** for each file:

| URL | Type |
|-----|------|
| `/local/room-controls-card.js` | JavaScript Module |
| `/local/room-buttons-card.js` | JavaScript Module |
| `/local/camera-layout-card.js` | JavaScript Module |
| `/local/technology-card.js` | JavaScript Module |
| `/local/bambu-printer-card.js` | JavaScript Module |
| `/local/printer-status-card.js` | JavaScript Module |
| `/local/weather-card-nws.js` | JavaScript Module |
| `/local/clock-card.js` | JavaScript Module |
| `/local/temp-strip-card.js` | JavaScript Module |
| `/local/door-sensor-card.js` | JavaScript Module |
| `/local/septa-paoli-card.js` | JavaScript Module |
| `/local/thermostat-card.js` | JavaScript Module |
| `/local/tesla-card.js` | JavaScript Module |
| `/local/calendar-card.js` | JavaScript Module |
| `/local/garage-door-card.js` | JavaScript Module |

3. Hard refresh your browser (`Ctrl+Shift+R` / `Cmd+Shift+R`)

---

## Color palette

All cards share a consistent color language:

| Color | Meaning |
|-------|---------|
| `#fbbf24` amber | Lights on |
| `#60a5fa` blue | Fans / info / cool |
| `#a78bfa` purple | Blinds |
| `#fb923c` orange | Heat / HVAC |
| `#4ade80` green | OK / closed / complete |
| `#f87171` red | Error / open / alert |
| `#2dd4bf` teal | Fan-only mode |

---

## Cards

---

### `room-controls-card`

The main room control card. One card definition covers all rooms — lights, fans, blinds, thermostat, and sensor rows render inline based on what each room has configured. Popups open for detail control.

**Inline rows (always visible)**

| Row | Description |
|-----|-------------|
| Lights | Master toggle + avg brightness drag slider |
| Fans | Signal-bar speed pips (off → speed N) |
| Blinds | Status pill (green=closed, amber=open, blue=moving) + position bar |
| Thermostat | Current temp · sensor pill · mode button · − setpoint + |
| Sensor | Plain temperature reading |
| Garage | Open/Closed status pill |

**Popups**

| Popup | Contents |
|-------|----------|
| Lights | Individual brightness sliders · CT presets · color presets (filtered to what bulbs support) |
| Blinds | Drag position slider (0 → `max_position`) |
| Thermostat | Fan mode · swing mode · preset |

```yaml
type: custom:room-controls-card

# Optional global CT and color preset overrides
ct_presets:
  - { label: Warm White,  kelvin: 2700, color: '#ffcf7d' }
  - { label: Soft White,  kelvin: 3000, color: '#ffd9a0' }
  - { label: Cool White,  kelvin: 4000, color: '#fff1d6' }
  - { label: Daylight,    kelvin: 5000, color: '#fffbf0' }
color_presets:
  - { label: Blue,   rgb: [116,192,252], color: '#74c0fc' }
  - { label: Purple, rgb: [167,139,250], color: '#a78bfa' }
  - { label: Red,    rgb: [248,113,113], color: '#f87171' }

rooms:
  - id: family_room
    name: Family Room
    lights:
      entity: light.all_family_room_lights
      individuals:
        - { entity: light.venus_window_lamp, name: Window }
        - { entity: light.floor_lamp,        name: Floor Lamp }
    fans:
      - { entity: fan.family_room_front_fan, name: Front Fan, speeds: 4 }
      - { entity: fan.family_room_back_fan,  name: Back Fan,  speeds: 4 }
    blinds:
      entity: cover.family_room_blinds
      max_position: 87           # open targets this position instead of 100
    thermostat:
      entity: climate.family_room_2
      name: Family Rm
      sensor: sensor.family_room_temperature
      sensor_label: "AC\nsensor"

  - id: bathroom
    name: Bathroom
    simplified: true             # shows count + header chevron instead of full lights row
    lights:
      entity: light.all_bathroom_lights
    sensor:
      entity: sensor.bathroom_temperature

  - id: garage
    name: Garage
    lights:
      entity: light.all_garage_lights
      no_popup: true             # toggle only, no popup
    garage:
      entity: cover.garage_door
```

**Fan speed resolution** — priority order: YAML `speeds:` → `percentage_step` attribute (`100/step`) → `speed_count` attribute → default 4. Always set `speeds:` explicitly for Lutron Caseta fans.

**Light color modes** — CT presets are filtered to `min/max_color_temp_kelvin`. Color presets only appear if the room has color-capable bulbs. Chevron is hidden if no color-capable bulbs exist.

---

### `room-buttons-card`

Compact 2-column room button grid for the home view. Tap opens a popup; hold (600ms) toggles the entity. Buttons without `popup_entities` fire `hass-more-info` on tap.

**Supported popup entity types**

| Type | Behaviour |
|------|-----------|
| `stat` | Read-only sensor value tile |
| `toggle` | On/off tile — `light.*` entities auto-show a brightness slider |
| `fan` | Speed pip header + segment buttons (3 or 4 speed) |
| `cover_group` | ▲ Open / ▼ Close buttons for multiple blinds |

```yaml
type: custom:room-buttons-card
buttons:
  # Simple button — tap = hass-more-info, hold = toggle
  - entity: light.main_lights
    name: Main Lights
    icon: bulb

  # Button with popup
  - entity: light.family_room
    name: Family Room
    icon: sofa
    popup_entities:
      - entity: sensor.family_room_temperature
        label: Temperature
        type: stat
      - entity: light.family_room
        label: Main Lights
        type: toggle
      - entity: fan.family_room_ceiling
        label: Ceiling Fan
        type: fan
        speeds: 3
        speed_percentages: [33, 66, 100]   # optional
      - entity: cover.fr_blind_1
        label: Blinds
        type: cover_group
        max_position: 70
        entities:
          - cover.fr_blind_1
          - cover.fr_blind_2
```

**Available icons:** `bulb` `garage` `sofa` `sun` `kitchen` `dining` `desk` `bed` `bath` `stairs` `tree` `fan` `blinds` `tv` `appletv` `homepod` `speaker` `lock` `thermo` `plug` `home`

---

### `camera-layout-card`

Portrait doorbell on the left, 2×2 grid of cameras on the right. Designed for 1200×800 wall display. Uses native `ha-camera-stream` components for live video. Empty slots show a `+ Camera` placeholder.

```yaml
type: custom:camera-layout-card
height: 680          # optional — default 680px
doorbell:
  entity: camera.front_doorbell
  name: Front Door
cameras:
  - entity: camera.driveway_camera
    name: Driveway
  - entity: camera.back_left_camera
    name: Back Left
  - entity: camera.back_right_camera
    name: Back Right
  # 4th slot optional — leave blank for placeholder
```

---

### `technology-card`

Modular technology dashboard. Each card instance renders one section. Stack multiple instances in a sections view for a full tech dashboard.

**Available sections**

| Section | Description |
|---------|-------------|
| `network` | UniFi AP states, client counts, network names |
| `speed` | Speedtest download/upload/ping with sparkline history |
| `access_points` | AP restart buttons + status |
| `services` | Unraid docker service switches (on/off grid) |
| `storage` | Unraid CPU, RAM, array, cache usage bars |
| `ink` | Epson ink level bars |
| `controls` | Generic switch/button grid |
| `now_playing` | Sonarr/Radarr recently downloaded |
| `recently_added` | Media library additions |
| `immich` | Photo/video counts, disk usage |

```yaml
type: custom:technology-card
section: network
entities:
  ap_office:        sensor.office_u7_state
  ap_family_room:   sensor.family_room_u7_state
  clients_office:   sensor.office_u7_clients
  clients_fr:       sensor.family_room_u7_clients
  sophienet:        sensor.sophienet
  sophienet_iot:    sensor.sophienet_iot
  sophienet_guest:  sensor.sophienet_guest_2
```

---

### `bambu-printer-card`

Full Bambu Lab P1S status card. Left column: print status, progress bar, nozzle/bed temps, speed profile, layer count. Right column: AMS unit with 4 tray slots (color swatches, active indicator, humidity) or external spool if active.

```yaml
type: custom:bambu-printer-card
printer: p1s_01p09a3a1100648    # entity prefix
```

---

### `printer-status-card`

Compact print status widget for the home view. Only renders content when something is happening (printing, paused, finished, error) — returns an invisible empty card when idle so it takes up no space.

```yaml
type: custom:printer-status-card
printer: p1s_01p09a3a1100648    # entity prefix
```

---

### `weather-card-nws`

Current conditions, 7-day forecast strip, and a detail popup. Uses the HA `weather/subscribe_forecast` API for twice-daily and hourly forecasts.

Popup contents: current conditions grid (humidity, dewpoint, UV index, visibility, pressure, cloud cover) · scrollable 12-hour forecast · 7-day extended forecast with precipitation bars.

```yaml
type: custom:weather-card-nws
entity: weather.home           # required
name: Home                     # optional
unit: °F                       # optional
alert_entity: sensor.nws_alerts  # optional — shows alert banner when active
tap_action: popup              # popup (default) | none
```

---

### `clock-card`

Large clock with seconds and AM/PM. Tapping the date side opens a full calendar popup with month navigation and optional event dots from HA calendar entities.

```yaml
type: custom:clock-card
calendar_entities:
  - entity: calendar.personal
    color: '#60a5fa'
  - entity: calendar.work
    color: '#a78bfa'
  - entity: calendar.family
    color: '#4ade80'
show_next_event: true    # show next upcoming event below the time
today_color: '#60a5fa'   # accent color for today in calendar
```

---

### `temp-strip-card`

Single-row compact temperature strip. Supports any entity — `sensor.*` reads state directly, `climate.*` reads `current_temperature` attribute.

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

### `door-sensor-card`

Compact banner showing open door count. Green when all clear, red when any door is open. Tapping opens a 3-column icon-grid popup listing every door — open doors sort to the top.

```yaml
type: custom:door-sensor-card
doors:
  - entity: binary_sensor.myggbett_door_window_sensor_door_1
    name: Front Door
  - entity: binary_sensor.myggbett_door_window_sensor_door_2
    name: Patio Slider
  - entity: binary_sensor.myggbett_door_window_sensor_door_3
    name: Office
  - entity: binary_sensor.myggbett_door_window_sensor_door_5
    name: Garage Entry
  - entity: binary_sensor.myggbett_door_window_sensor_door_6
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

**Expected sensor attributes:** `state` (departure time e.g. `10:22AM`), `orig_arrival_time`, `orig_delay` (e.g. `18 min` or `On time`), `orig_train`, `orig_line`, `isdirect`.

---

### `thermostat-card`

Compact thermostat designed for a horizontal stack of 3. Shows current temp, target temp with − / + buttons, and HVAC mode indicator. Mode button cycles only through modes reported by the entity's `hvac_modes` attribute — no cycling to unsupported modes.

```yaml
type: horizontal-stack
cards:
  - type: custom:thermostat-card
    entity: climate.main_floor
    name: Main Floor
    step: 1              # optional — °F per tap, default 1
  - type: custom:thermostat-card
    entity: climate.family_room_2
    name: Family Rm
  - type: custom:thermostat-card
    entity: climate.solarium_mini_split
    name: Solarium
```

**Mode colors:** Heat → orange · Cool → blue · Heat/Cool/Auto → orange+blue split dot · Fan only → teal · Dry → amber · Off → gray

---

### `tesla-card`

Tesla vehicle status card. Main card shows battery level/range, lock state, climate, and trunk. Tapping opens a popup with battery, tire pressure, temperatures, climate controls, seat heating, and vehicle status sections.

```yaml
type: custom:tesla-card
name: Magneton               # vehicle nickname
tire_warn_psi: 40            # PSI below which tire shows warning (default 40)
temp_unit: F                 # F or C (default F)
entities:
  battery_level:          sensor.magneton_battery_level
  battery_range:          sensor.magneton_battery_range
  charging_state:         sensor.magneton_charging_state
  charge_rate:            sensor.magneton_charge_rate
  time_to_full_charge:    sensor.magneton_time_to_full_charge
  door_lock:              lock.magneton_door_lock
  climate:                climate.magneton_hvac_climate_system
  trunk:                  cover.magneton_trunk
  charge_port:            binary_sensor.magneton_charge_port_door
  sentry_mode:            switch.magneton_sentry_mode
  odometer:               sensor.magneton_odometer
  interior_temperature:   sensor.magneton_inside_temperature
  exterior_temperature:   sensor.magneton_outside_temperature
  tire_pressure_fl:       sensor.magneton_tire_pressure_front_left
  tire_pressure_fr:       sensor.magneton_tire_pressure_front_right
  tire_pressure_rl:       sensor.magneton_tire_pressure_rear_left
  tire_pressure_rr:       sensor.magneton_tire_pressure_rear_right
  front_defrost:          switch.magneton_defrost
  rear_defrost:           switch.magneton_rear_defroster
  seat_heat_driver:       select.magneton_heated_seat_driver
  seat_heat_passenger:    select.magneton_heated_seat_passenger
```

---

### `calendar-card`

Full calendar with month navigation and upcoming event list. Supports multiple calendar entities with per-calendar dot colors.

```yaml
type: custom:calendar-card
calendars:
  - entity: calendar.personal
    color: '#60a5fa'
  - entity: calendar.work
    color: '#a78bfa'
  - entity: calendar.family
    color: '#4ade80'
title: Calendar              # optional
```

---

### `garage-door-card`

Standalone compact garage door toggle card. Matches the Tesla card button design language. Closed=green (tap to open), Open=blue (tap to close), Opening=amber (disabled), Closing=orange (disabled).

```yaml
type: custom:garage-door-card
entity: cover.garage_door
name: Garage                 # optional
```

---

## Views

All views use `type: sections` layout except Cameras.

| View | Layout | Columns |
|------|--------|---------|
| Home | sections | 3 |
| Lights & Fans | sections | 3 |
| Cameras | panel | — |
| Technology | sections | 3 |
| 3D Printer | sections | 2 (span) |

---

## Design notes

- All cards use `background: transparent` — they inherit the dashboard theme
- Popups are portalled to `document.body` to avoid HA CSS transform clipping, with `position:fixed;inset:0` outer container and `position:absolute;inset:0` overlays inside
- Bottom sheet on mobile, centered modal on desktop ≥768px
- Left accent bars use `border-radius: 0 8px 8px 0` (flat left, rounded right)
- `set hass` calls `_patch()` after first render — updates values in-place without destroying event listeners
- Fan speed pips use `fan-flat` rows — name on left, growing signal-bar pips fill right
- Inline drag sliders use `mousedown/touchstart → mousemove/touchmove → mouseup/touchend` with 150ms debounce before HA service call
- Wall display first (1200×800), mobile is secondary

---

## Changelog

### Overall project

| Date | Summary |
|------|---------|
| Mar 2026 | **Major refactor session.** Popup portalling to `document.body` across all popup cards; `_patch()` system for in-place DOM updates; fan speed priority resolution; light color mode detection; left accent bar design language; blind and garage status pills; door pills in room headers; HVAC live mode reading; portal CSS consolidation. |
| Earlier 2026 | Tesla card popup sections (tire pressure, temps, climate, seats); technology-card sections expansion (immich, access_points, sparklines); calendar-card map thumbnails; septa popup; thermostat live mode cycling. |
| Late 2025 | Initial versions of all cards. Core architecture established — transparent backgrounds, bottom sheet / centered modal popup pattern, consistent color palette. |

### Card version summary

| Card | Deployed version | Notes |
|------|-----------------|-------|
| `room-controls-card` | v34 | Most iterated card — popup portalling, patch system, pills, color modes |
| `septa-paoli-card` | v16 | Train popup, delay colors, alert banner |
| `technology-card` | v11 | 10 section types, sparklines, restart buttons |
| `tesla-card` | v9 | Full popup with 6 sections |
| `calendar-card` | v4 | Map thumbnails, multi-calendar, event popup |
| `thermostat-card` | v4 | Live mode cycling, split dot |
| `clock-card` | v3 | Calendar popup, event dots |
| `temp-strip-card` | v3 | Climate entity support |
| `room-buttons-card` | v3 | Fan speed fix |
| `weather-card-nws` | v2 | Hourly subscription, 12h strip |
| `garage-door-card` | v2 | Progress bar, busy lock |
| `door-sensor-card` | v5 | 3-column popup, sorted grid |
| `bambu-printer-card` | v1+ | Stage mapping improvements |
| `printer-status-card` | v1 | Initial release |
| `camera-layout-card` | v1 | Initial release |

---

## Per-card documentation

Detailed parameter references and changelogs for each card are in the [`docs/`](docs/) folder:

| Card | Doc |
|------|-----|
| room-controls-card | [docs/room-controls-card.md](docs/room-controls-card.md) |
| room-buttons-card | [docs/room-buttons-card.md](docs/room-buttons-card.md) |
| camera-layout-card | [docs/camera-layout-card.md](docs/camera-layout-card.md) |
| technology-card | [docs/technology-card.md](docs/technology-card.md) |
| bambu-printer-card | [docs/bambu-printer-card.md](docs/bambu-printer-card.md) |
| printer-status-card | [docs/printer-status-card.md](docs/printer-status-card.md) |
| weather-card-nws | [docs/weather-card-nws.md](docs/weather-card-nws.md) |
| clock-card | [docs/clock-card.md](docs/clock-card.md) |
| temp-strip-card | [docs/temp-strip-card.md](docs/temp-strip-card.md) |
| door-sensor-card | [docs/door-sensor-card.md](docs/door-sensor-card.md) |
| septa-paoli-card | [docs/septa-paoli-card.md](docs/septa-paoli-card.md) |
| thermostat-card | [docs/thermostat-card.md](docs/thermostat-card.md) |
| tesla-card | [docs/tesla-card.md](docs/tesla-card.md) |
| calendar-card | [docs/calendar-card.md](docs/calendar-card.md) |
| garage-door-card | [docs/garage-door-card.md](docs/garage-door-card.md) |

---

## Changelog

### Session 2 — March 2026
- **room-controls-card** reached v34: popup portalling, `_patch()` in-place updates, door pills in room headers, thermostat row redesign, HVAC mode cycling fix, light color mode filtering, blind and garage status pills, Lutron Caseta fan speed fix
- **room-buttons-card** v3: fan popup speed count fixed via `_fanResolvedSpeeds()`
- **printer-status-card**: new card — zero-height idle state, shows status only when printer is active
- **technology-card** v11: Speedtest sparklines, AP restart section, Immich section
- **septa-paoli-card** v16: delay arrival calculation improvements, 60-second auto-refresh
- All views converted from `type: masonry` to `type: sections` layout
- README fully rewritten; per-card docs added in `docs/`

### Session 1 — Earlier 2026
- **tesla-card** v9: full popup with battery, tires, temps, climate, seats, status
- **weather-card-nws** v2: hourly forecast popup section, dual subscriptions
- **clock-card** v3: multi-calendar support, next event countdown
- **calendar-card** v4: mobile expand, legend, map thumbnails
- **door-sensor-card** v5: 3-column popup, sort open doors first
- **thermostat-card** v4: live `hvac_modes` cycling, split dot for heat_cool
- **garage-door-card** v2: busy flag, stopped state handling
- **camera-layout-card** v2: `_patchStreams()` prevents stream restart on hass update
- **bambu-printer-card**: AMS active tray detection, external spool support, status label mapping
- **temp-strip-card** v3: `climate.*` domain support
- **septa-paoli-card**: alert banner, next-station tracking, train detail popup
