# Changelog

All notable changes to this project are documented here.
Most recent changes are listed first within each month.

---

## [Mar 2026] — Latest

### Performance audit — `_patch()` system across all 24 cards
Every card now separates initial render from incremental updates. Cards that were fully rebuilding their shadow DOM on every HA state push — `thermostat-card`, `door-sensor-card`, `now-playing-card`, `bambu-printer-card`, `traffic-card`, `tesla-card`, `room-buttons-card`, `technology-card`, `temp-strip-card`, `garage-door-card`, `printer-status-card` — now update only changed values in-place. `septa-paoli-card` set hass fixed to not double-render alongside its 60s interval. `leave-by-card` fixed to not call `_render()` from both `set hass` and the interval simultaneously. `weather-card-nws` patches inline values and forecast strip without rebuilding the full style block.

**Current card versions:** Room Controls v74 · Room Buttons v7 · Camera Layout v5 · Technology v14 · Bambu Printer v4 · Printer Status v2 · Weather (NWS) v8 · Clock v4 · Temp Strip v5 · Door Sensors v10 · SEPTA Paoli v25 · Thermostat v7 · Tesla v13 · Calendar v5 · Garage Door v6 · Wallbox v3 · PECO v3 · Ecoflow v3 · Now Playing v4 · Traffic v7 · Tesla Commute v4 · Charging v2 · Protect Events v1.1 · Leave By v4

### room-buttons-card v6 — lights/fans popup
Home view room buttons now open a full-featured popup with master brightness slider + individual light sliders (exact `pp-light` pattern from room-controls-card) and fan pip dot buttons. Stats moved to bottom. Dashboard `buttons` config updated with `lights` and `fans` for all 12 room buttons.

### Padding consistency pass
`room-controls-card` v74, `clock-card` v4, `door-sensor-card` v9, `garage-door-card` v5, `weather-card-nws` v7, `calendar-card` v5, `thermostat-card` v6, `temp-strip-card` v4 — all horizontal padding normalized to 14px across the board.

### room-controls-card v71–v73 — individual lights popup polish
Flat rows with uppercase name label above slider, color dot indicator, gap spacing (no dividers), live patch on every hass update.

### camera-layout-card v5
Loading placeholder (camera icon + name on dark background) behind each stream while RTSP connects.

### Popup consistency pass
`room-controls-card` v70: expand chevrons bare; off individual light rows dimmed to 65% opacity; brightness % hidden when off; subtitle "X of Y on" → "X / Y"; sheet max-width 440px. All popup cards normalized to 440px max-width: `septa-paoli-card` v24, `tesla-card` v11, `weather-card-nws` v6, `door-sensor-card` v8.

### Popup fixes — scroll lock + bottom sheet consistency
Fixed `once:true` tap-outside listeners, body scroll lock on open/close, `overscroll-behavior:contain` on all popup elements across all cards.

### Room card polish + responsive camera
Thermostat grey backgrounds removed; +/− buttons transparent; thermostat block auto-hides when entity missing. `camera-layout-card` v4: responsive stacking breakpoint raised to 700px.

### Dashboard-wide header redesign + fan pip dots
Room card background removed; room name 17px white bold; speed pip buttons show N dots matching speed. Header style applied consistently across all cards.

### SEPTA compact mode extra trains
`septa-paoli-card` v21: `show_next_trains: true` config param — compact mode shows up to 3 subsequent train pills below the hero train.

### UniFi Protect event feed card + Security view
New `protect-events-card` — real-time smart detection event feed with ring buffer, filter pills (All / Motion / Ring / Animal / Vehicle), thumbnail fetch, portal popup. Security view added to dashboard.

### Touch/mobile audit across all cards
`-webkit-tap-highlight-color:transparent` and `user-select:none` added to all interactive elements. `deploy.sh` script added for one-command SSH deployment.

### Bug fixes
`tesla-commute-card` v4: fixed `ReferenceError: ents is not defined` in `_patch()`.

### Expanded commute view + leave-by-card
`traffic-card` v2 — `expanded: true` hero/sub row layout. `septa-paoli-card` v18 — `expanded: true` full train rows. New `leave-by-card` — calculates and displays required departure time based on travel time + buffer.

### camera-layout-card v2 — dynamic 2×N grid
Grid rows auto-derived from camera count. Updated to UniFi Protect G6 entities.

### Expanded Tesla + Charging cards on Commute view
`tesla-commute-card` — expanded inline version: battery, interior/exterior temps, climate stepper, tire pressure grid, action buttons (lock/trunk/sentry/odometer). `charging-card` — unified Tesla + Wallbox card; active state shows battery progress bar with charge limit tick, live power, session energy, charging speed. Commute view expanded from 2 to 3 columns.

### SEPTA sort fix + Commute view
`septa-paoli-card` v17 — trains sorted by estimated arrival time (scheduled + delay) across all sensors. Inbound reads all sensors. SEPTA and traffic cards moved to new dedicated Commute view.

### Traffic commute card
New `traffic-card` using Waze Travel Time sensors — live travel time, delay vs typical, distance, Waze route name, Fastest badge across home routes, incident banner when delay exceeds threshold, to-work row dims after noon. Three Waze sensors added to `ha-config/waze-sensors.yaml`.

### Four new cards + Energy view
New `wallbox-card` (Beryl Pulsar Plus — session energy, range, power, current slider, solar mode, lock), `peco-card` (PECO electric + gas billing), `ecoflow-card` (River 2 Pro — battery, power flows, max charge slider, AC/DC toggles), `now-playing-card` (Apple TV / media players — collapses when idle). New Energy view added with all three energy cards.

### Dashboard YAML added
Full `dashboard.yaml` committed to `ha-config/` covering all views (Home, Lights/Fans, Cameras, Technology, 3D Printer, Commute, Energy, Security). `dashboard-README.md` documents all views, prerequisites, and specific configuration changes.

### Outdoor lighting theme indicator
New template sensor (`sensor.outdoor_lighting_theme`) covering 13 holidays + Default. New `light.yard_spotlights` group. `room-controls-card` gains `theme_block:` config — Option B zone indicator with color swatches, gradient bars, per-area state. `room-buttons-card` gains `theme_sensor:` — holiday color strip + name label.

### Repo restructure + shared modules
Cards moved to per-card folders under `cards/`. Three shared ES modules created:
- `shared/ha-utils.js` — COLORS palette, entity helpers, formatters, HVAC metadata, fan speed helpers, drag slider factory
- `shared/ha-styles.js` — named CSS string exports (CSS_RESET, CSS_POPUP, CSS_BADGE, CSS_PILL, CSS_SLIDER, CSS_TAPPABLE, CSS_GRIDS, CSS_ALL)
- `shared/ha-popup.js` — portal popup factory (appends to `document.body` to escape HA CSS transforms)

`garage-door-card` fully migrated to shared modules as proof of concept. Per-card `README.md` added. `STYLE-GUIDE.md` added.

### Major refactor session
Popup portalling (all popups escape shadow DOM via `document.body` append); `_patch()` system introduced; fan speed priority resolution; light color mode detection; left accent bars; blind/garage/door pills; HVAC live mode reading.

---

## [Earlier 2026]

Tesla popup sections; technology-card expansion; calendar map thumbnails; SEPTA popup; thermostat live mode detection.

---

## [Late 2025]

Initial versions of all cards. Core architecture established. Dark theme, shared color palette, Web Components pattern.
