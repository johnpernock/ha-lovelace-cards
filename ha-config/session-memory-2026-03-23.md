# Home Assistant Dashboard — Conversation Memory Log
**Date:** March 23, 2026
**Session Duration:** ~12 hours (continuation of prior session)
**Project:** Custom Home Assistant Lovelace dashboard — Paoli, PA home

---

## 1. SESSION STARTING POINT

This session began with a memory document from a **previous session** that had established:
- 14 custom Lovelace cards in a flat file structure at `/home/claude/`
- All cards using vanilla JS Web Components with shadow DOM
- Core architectural patterns: popup portalling, `_patch()` system, fan speed resolution
- A GitHub repo at `https://github.com/johnpernock/ha-lovelace-cards` with one prior commit
- Pending items: GitHub push, Ubiquiti camera layout, Unraid storage sensors, `room-buttons-card` color mode support

The user uploaded all card files at the start, confirming the session container resets between conversations and files must be re-uploaded.

---

## 2. WHAT WAS ACCOMPLISHED THIS SESSION

### Phase 1 — GitHub Push + README
- Copied all uploaded files to `/home/claude/` with clean names (stripped version suffixes)
- Wrote a comprehensive `README.md` with full card docs and installation table
- Added a `docs/` folder with one markdown doc per card
- Pushed to GitHub (PAT: provided by user, repo: `johnpernock/ha-lovelace-cards`)

### Phase 2 — Repo Restructure
- Moved all cards from flat root to `cards/<card-name>/<card-name>.js`
- Moved per-card docs to `cards/<card-name>/README.md`
- Moved `docs/style-guide.md` → `STYLE-GUIDE.md` (root level, user preferred no nested docs folder)
- Created `shared/` with three ES modules (see Section 4)
- `garage-door-card` fully refactored as proof-of-concept shared module consumer

### Phase 3 — Outdoor Lighting Theme Feature
- Built `sensor.outdoor_lighting_theme` template sensor (see ha-config section)
- Added `theme_block:` to `room-controls-card` (Yard room in Lights/Fans view)
- Added `theme_sensor:` to `room-buttons-card` (Yard button in Home view)
- Created `light.yard_spotlights` group
- Added `ha-config/` folder to repo with YAML files and documentation

### Phase 4 — Dashboard YAML
- User provided complete dashboard YAML — committed as `ha-config/dashboard.yaml`
- This is the source of truth for all 7 views

### Phase 5 — Integration Audit + New Cards
Performed a full audit of all HA integrations vs dashboard coverage. Built 4 new cards:
- `wallbox-card` (Energy view)
- `peco-card` (Energy view)
- `ecoflow-card` (Energy view)
- `now-playing-card` (Home view)
New Energy view added. Traffic card removed from Home view to new Commute view.

### Phase 6 — Traffic Card
- Built `traffic-card` using Waze Travel Time sensors
- Created `ha-config/waze-sensors.yaml` with 3 sensors for Paoli → KoP commute
- Specific addresses: `21 Beryl Rd, Paoli, PA 19301` → `1030 Continental Dr, King of Prussia, PA 19406`

### Phase 7 — Commute View + SEPTA Fix
- **SEPTA sort bug fixed (v17):** Trains were sorted by sensor index, not by true arrival order. A late train scheduled before an on-time train would incorrectly show as "next." Fixed with `_sortByEstimatedArrival()` — sorts by `scheduled_arrival + delay_minutes` across all sensors
- SEPTA and traffic cards moved from Home view to new dedicated **Commute view**
- Commute view: 2 columns → 3 columns after Phase 8

### Phase 8 — Commute View Tesla + Charging Cards
- Built `tesla-commute-card` — expanded inline Tesla card, everything visible without a popup
- Built `charging-card` — unified Tesla + Wallbox card showing active/idle charging states
- Commute view expanded to 3 columns: Traffic | SEPTA | Tesla + Charging

---

## 3. CURRENT REPO STATE

**GitHub:** `https://github.com/johnpernock/ha-lovelace-cards`
**Latest commit:** `f321567` — Fix stale doc references
**PAT:** `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` (stored — user provided)

### Folder structure
```
ha-lovelace-cards/
├── STYLE-GUIDE.md              ← UI principles, color system, patterns, mockups
├── README.md                   ← All cards, resources, views, changelog
├── cards/                      ← 22 card folders, each with JS + README.md
├── shared/
│   ├── ha-utils.js             ← Entity helpers, COLORS, HVAC meta, fan speed, drag slider
│   ├── ha-styles.js            ← CSS string exports (CSS_RESET, CSS_POPUP, CSS_BADGE, etc.)
│   └── ha-popup.js             ← Portal popup factory
└── ha-config/
    ├── dashboard.yaml          ← Complete Lovelace dashboard — all 7 views
    ├── dashboard-README.md     ← Installation + view reference
    ├── outdoor-lighting-theme-sensor.yaml
    ├── light-groups.yaml
    ├── waze-sensors.yaml
    └── README.md
```

---

## 4. ALL 22 CARDS — CURRENT STATE

| Card | Custom Element | Version | Location on Dashboard |
|------|---------------|---------|----------------------|
| `room-controls-card` | `custom:room-controls-card` | v35 | Lights/Fans view |
| `room-buttons-card` | `custom:room-buttons-card` | v4 | Home view col 2 |
| `camera-layout-card` | `custom:camera-layout-card` | v1 | Cameras view (panel) |
| `technology-card` | `custom:technology-card` | v11 | Technology view |
| `bambu-printer-card` | `custom:bambu-printer-card` | current | 3D Printer view |
| `printer-status-card` | `custom:printer-status-card` | v1 | Home view col 2 |
| `weather-card-nws` | `custom:weather-card-nws` | v2 | Home view col 1 |
| `clock-card` | `custom:clock-card` | v3 | Home view col 1 |
| `temp-strip-card` | `custom:temp-strip-card` | v3 | Home view col 2 |
| `door-sensor-card` | `custom:door-sensor-card` | v5 | Home view col 2 |
| `septa-paoli-card` | `custom:septa-paoli-card` | v17 | Commute view col 2 |
| `thermostat-card` | `custom:thermostat-card` | v4 | Home view col 2 |
| `tesla-card` | `custom:tesla-card` | v9 | Home view col 1 |
| `calendar-card` | `custom:calendar-card` | v4 | Home view col 3 |
| `garage-door-card` | `custom:garage-door-card` | v3 | Standalone (not in main dashboard) |
| `wallbox-card` | `custom:wallbox-card` | v1 | Energy view col 1 |
| `peco-card` | `custom:peco-card` | v1 | Energy view col 2 |
| `ecoflow-card` | `custom:ecoflow-card` | v1 | Energy view col 3 |
| `now-playing-card` | `custom:now-playing-card` | v1 | Home view col 2 (above room-buttons) |
| `traffic-card` | `custom:traffic-card` | v1 | Commute view col 1 |
| `tesla-commute-card` | `custom:tesla-commute-card` | v1 | Commute view col 3 (top) |
| `charging-card` | `custom:charging-card` | v1 | Commute view col 3 (bottom) |

---

## 5. DASHBOARD VIEWS

| View | Path | Icon | Layout | Columns | Contents |
|------|------|------|--------|---------|----------|
| Home | `/home` | `mdi:home` | sections | 3 | Clock, weather, now-playing, Tesla, traffic (removed), door sensors, room buttons, thermostats, temp strip, printer status, calendar |
| Lights / Fans | `/lightsfans` | `mdi:lightbulb-group` | sections | 3 | All room-controls-cards (family room, kitchen, bathroom, yard, dining, master bedroom, garage, office, solarium, basement) |
| Cameras | `/cameras` | `mdi:cctv` | panel | — | camera-layout-card (doorbell + 3 cameras) |
| Technology | `/technology` | `mdi:desktop-classic` | sections | 3 | Network, speed, APs, Unraid health, services, storage, ink, recently added |
| Commute | `/commute` | `mdi:train-car` | sections | 3 | traffic-card, septa-paoli-card, tesla-commute-card + charging-card |
| Energy | `/energy` | `mdi:lightning-bolt` | sections | 3 | wallbox-card, peco-card, ecoflow-card |
| 3D Printer | `/3d-printer` | `mdi:printer-3d` | sections | 2 | bambu-printer-card (column span) |

All views use `theme: Amoled+`.

---

## 6. HA CONFIGURATION REQUIRED

### configuration.yaml includes needed
```yaml
template: !include ha-config/outdoor-lighting-theme-sensor.yaml
light:     !include ha-config/light-groups.yaml
sensor:    !include ha-config/waze-sensors.yaml
```

### Sensors created by ha-config files

**Outdoor lighting theme sensor** (`sensor.outdoor_lighting_theme`):
- State: `Default` / holiday name (13 holidays incl. algorithmic Easter, Memorial Day, Thanksgiving)
- Attributes: `emoji`, `is_holiday`, `accent`, `all_outdoor_colors`, `spotlight_colors`, `front_path_colors`

**Light group** (`light.yard_spotlights`):
- Members: `light.yard_maple`, `light.corner_tree`, `light.big_tree`, `light.bay_window_maple`, `light.backyard_maple`

**Waze Travel Time sensors:**
- `sensor.commute_to_work` — 21 Beryl Rd → 1030 Continental Dr (US-202 N)
- `sensor.commute_home_via_202` — 1030 Continental Dr → 21 Beryl Rd (US-202 S)
- `sensor.commute_home_via_rt_30` — same, `avoid_highways: true` (Route 30 / Lancaster Ave)

---

## 7. KEY ENTITY IDs (confirmed this session)

### Commute / EV
- **Wallbox prefix:** `wallbox_beryl_pulsar_plus` → all entities use `sensor.wallbox_beryl_pulsar_plus_*`, `lock.wallbox_beryl_pulsar_plus_lock`, `select.wallbox_beryl_pulsar_plus_solar_charging`, `number.wallbox_beryl_pulsar_plus_maximum_charging_current`
- **Wallbox key sensors:** `status_description` (Ready/Charging), `charging_power` (kW), `added_energy` (kWh), `added_range` (mi), `max_available_power` (A), `max_charging_current` (A)
- **Tesla prefix:** `magneton_` → `sensor.magneton_battery`, `sensor.magneton_range`, `binary_sensor.magneton_charging`, `lock.magneton_doors`, `climate.magneton_hvac_climate_system`, `cover.magneton_trunk`, `switch.magneton_sentry_mode`, `sensor.magneton_odometer`, `sensor.magneton_temperature_inside`, `sensor.magneton_temperature_outside`, `sensor.magneton_tpms_front_left/right`, `sensor.magneton_tpms_rear_left/right`, `sensor.magneton_charging_rate`, `sensor.magneton_time_charge_complete`, `sensor.magneton_charge_limit`
- **Charge limit sensor:** `sensor.magneton_charge_limit` (confirmed present)

### Energy
- **PECO electric prefix:** `peco_electric` → `sensor.peco_electric_current_bill_electric_usage_to_date`, `_forecasted_usage`, `_cost_to_date`, `_forecasted_cost`, `_typical_monthly_electric_usage/cost`
- **PECO gas prefix:** `peco_gas` → gas sensors but currently `unavailable` (restored state)
- **Ecoflow prefix:** `river_2_pro` → `sensor.river_2_pro_battery_level`, `_state_of_health`, `_cycles`, `_ac_in_power`, `_ac_out_power`, `_solar_in_power`, `_dc_out_power`, `_charge_remaining_time`, `_discharge_remaining_time`, `_battery_temperature`, `_status`, `number.river_2_pro_max_charge_level`, `switch.river_2_pro_ac_enabled`, `switch.river_2_pro_dc_12v_enabled`

### Apple TV / Media
- `media_player.family_room` — Family Room Apple TV
- `media_player.master_bedroom` — Master Bedroom Apple TV
- `media_player.office` — Office Apple TV

### Outdoor lighting (confirmed)
- `light.all_yard_lights` — all yard lights group
- `light.hue_path_lights` — Hue pedestal group (front path)
- `switch.yard_light_controller_zone_1` — side path (switch, NOT a light — no color/dim)
- `light.hue_impress_outdoor_pedestal_1` / `light.hue_impress_outdoor_pedestal_2` — individual pedestals

### SEPTA sensors
- Outbound: `sensor.paoli_outbound_1/2/3`
- Inbound: `sensor.paoli_inbound_1/2/3`
- Next station: `sensor.paoli_inbound_next_station_1/2/3`
- Alert: `sensor.paoli_line_alert`
- Delay attribute: `orig_delay` as string e.g. `"18 min"` or `"On time"`

---

## 8. SHARED MODULES

Three ES modules in `shared/` — imported by card JS files via relative path. **Not registered as HA resources** — only the card files need to be registered.

### `ha-utils.js` exports
- `COLORS` — palette object (`amber`, `blue`, `purple`, `orange`, `green`, `red`, `teal` + `rgb` variants)
- `colorTheme(name, bgOpacity, borderOpacity)` — returns `{bg, border, text}` themed values
- Entity helpers: `getState`, `getVal`, `getAttr`, `getNum`, `isOn`, `isUnavailable`, `getFriendlyName`
- Formatters: `fmtTime(hours)`, `fmtRelative(dateStr)`, `fmtNum(val)`
- Fan: `resolveFanSpeeds(hass, entityId, configSpeeds)`, `getFanPipIndex(hass, entityId, speeds)`
- HVAC: `HVAC_ORDER`, `HVAC_META`, `getHvacMeta(mode)`, `getSupportedModes`, `getNextHvacMode`, `hvacDotHtml(meta)`
- Cover: `getCoverTheme(state)`
- `attachSlider(wrap, initial, onDrag, debounceMs)` — returns cleanup function

### `ha-styles.js` exports
Named CSS strings: `CSS_RESET`, `CSS_POPUP`, `CSS_BADGE`, `CSS_UNAVAIL`, `CSS_SECTION`, `CSS_SLIDER`, `CSS_TAPPABLE`, `CSS_PILL`, `CSS_GRIDS`, `CSS_ALL`

### `ha-popup.js` exports
`createPopupPortal(id, innerHtml, onClose, options)`, `openPopup(portal)`, `closePopup(portal)`, `destroyPopupPortal(portal)`, `popupHeaderHtml(title, sub, subColor)`

**Migration status:** Only `garage-door-card` is fully migrated to use shared modules. All other cards have their own self-contained implementations. New cards going forward should use shared modules.

---

## 9. TECHNICAL PATTERNS (established in prior session, still active)

### _patch() system
```js
set hass(h) {
  const prev = this._hass;
  this._hass = h;
  if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
  this._patch();
}
```
`_render()` runs once on first load. `_patch()` updates values in-place on every subsequent hass update. This prevents DOM destruction and event listener loss.

### Portal overlay pattern
All popups appended to `document.body` to escape HA CSS transforms:
```js
const container = document.createElement('div');
container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;font-size:16px';
document.body.appendChild(container);
```

### Drag slider pattern
`mousedown/touchstart → mousemove/touchmove on document → mouseup/touchend`, 150ms debounce before HA service call. `touch-action:none` on wrap element.

### Fan speed resolution priority
1. YAML `speeds:` if set — always wins
2. `percentage_step` attribute (`100 / step`)
3. `speed_count` attribute
4. Default 4

**Always set `speeds:` explicitly for Lutron Caseta fans.**

### SEPTA sort (v17 — this session)
```js
_estimatedArrivalMins(data) {
  return this._parseTimeToMins(data.arrives) + this._delayMins(data.delay);
}
_sortByEstimatedArrival(trains) {
  return [...trains].sort((a, b) =>
    this._estimatedArrivalMins(a) - this._estimatedArrivalMins(b)
  );
}
```

---

## 10. NEW CARDS BUILT THIS SESSION

### `wallbox-card`
- Config key: `prefix: wallbox_beryl_pulsar_plus`
- Shows: status banner, session energy + range, charge power + speed, max current drag slider (6–48A), solar mode buttons (off/eco/full_solar), lock toggle
- Status mapped from `status_description`: Ready=green, Charging=blue, Paused=amber, Error=red

### `peco-card`
- Config keys: `electric_prefix: peco_electric`, `gas_prefix: peco_gas`
- Shows: usage-to-date bar vs forecast, cost to date, forecasted bill (shows "updating" when 0 due to Opower lag), typical monthly comparison pill, gas section (hidden when unavailable)

### `ecoflow-card`
- Config key: `prefix: river_2_pro`
- Shows: battery level bar (green/amber/red by %), health/cycles/temp, power flow rows (AC in/solar/AC out/DC — auto-dim when 0), max charge level drag slider (50–100%), AC + DC 12V toggles

### `now-playing-card`
- Config: `players:` list with `entity` + `name`
- Collapses to invisible empty card when all players idle (same pattern as `printer-status-card`)
- Active: title (TV show episode formatted), source app, room, playing/paused state
- Tap active player → `hass-more-info`
- Players: `media_player.family_room`, `media_player.master_bedroom`, `media_player.office`

### `traffic-card`
- Config: `to_work:` (single entity + labels), `home_routes:` list, `incident_threshold`, `hide_to_work_after`
- Live data from Waze Travel Time sensors
- Incident banner fires when any route delay ≥ threshold (default 10 min)
- "Fastest" badge dynamically on lowest current-time home route
- To-work row dims after `hide_to_work_after` hour (default 12pm)
- `route_label` fallback when Waze `route` attribute is empty

### `tesla-commute-card`
- Expanded inline Tesla card for Commute view — no popup
- Shows: battery (large % + range + charge status), interior/exterior temp tiles (interior color-codes hot orange >85°F / cold blue <45°F), climate row with inline −/+ stepper + on/off toggle, tire 2×2 grid (red tile when < `tire_warn_psi`), 4 action buttons (lock/trunk/sentry/odometer)
- Entity keys same as `tesla-card` — no new sensors needed

### `charging-card`
- Config: `wallbox_prefix:`, `tesla:` entity map
- **Active state:** pulsing blue banner, battery progress bar with charge limit tick mark (white line at limit %), stats: power kW (Wallbox), session energy kWh (Wallbox), speed mi/h (Tesla), time to full
- **Idle state:** dim "Not charging" + last session energy, range, speed, current battery %
- Switches between states with full re-render only when `charging_state` changes

---

## 11. OUTDOOR LIGHTING THEME BLOCK

Added to `room-controls-card` Yard room in Lights/Fans view:

```yaml
theme_block:
  sensor: sensor.outdoor_lighting_theme
  areas:
    - label: All Outdoor
      entity: light.all_yard_lights
      color_attr: all_outdoor_colors
    - label: Display Lights
      entity: light.yard_spotlights
      color_attr: spotlight_colors
      count: 5
    - label: Front Path
      entity: light.hue_path_lights
      color_attr: front_path_colors
    - label: Side Path
      entity: switch.yard_light_controller_zone_1
      type: switch        # switch type → no color swatches, on/off only
```

Added to `room-buttons-card` Yard button in Home view:
```yaml
- entity: light.all_yard_lights
  name: Yard
  icon: tree
  theme_sensor: sensor.outdoor_lighting_theme
```

On normal nights: theme block shows "🌙 Default Schedule · Warm white". Home button shows no strip. On holidays: colored swatches + gradient bars per area, holiday name + emoji in header. Home button gets color strip along bottom + theme name sub-label.

---

## 12. DECISIONS MADE THIS SESSION

| Decision | Choice | Reason |
|----------|--------|--------|
| SEPTA view | Moved to Commute view | Logical grouping with traffic |
| Traffic card location | Commute view (not Home) | Cleaner home view, better thematic grouping |
| Wallbox session cost | Removed entirely | User didn't care about it |
| Ecoflow sliders | Max charge level only, inline (not popup) | Simplest useful control |
| Ecoflow location | Energy view only | No compact home widget needed |
| Now-playing tap action | Opens HA more-info | Standard HA behavior |
| Traffic data source | Waze Travel Time | Built into HA, free, no API key, great Philly/Main Line coverage |
| Traffic routes | 202N to work, 202S + Rt30 home | User confirmed these are the actual routes used |
| Wallbox solar mode | Hidden everywhere | User doesn't use it |
| PECO gas section | Show/hide based on entity availability | Gas sensors currently unavailable (restored state) |
| Tesla commute vs home card | Separate independent component | Different data surface, don't want popup on commute view |
| Charging state "not charging" | Show last session summary | More useful than blank/hidden |
| Charging speed metric | mi/hr (Tesla attribute) | More meaningful than avg power approximation |
| Style guide location | Root level `STYLE-GUIDE.md` | User didn't want a `docs/` folder with just one file |
| Repo structure | `cards/<name>/` per card | Easier to maintain, card + docs together |
| Shared module migration | Incremental (garage-door-card as POC) | Can't test in HA from here, risky to rewrite all at once |
| Commute view columns | 3 (traffic / SEPTA / Tesla+charging) | After adding Tesla cards, 3 col makes sense |

---

## 13. USER WORKING STYLE & PREFERENCES

1. **Mockup first for new UI** — always show a visual mockup/wireframe before writing code. User approves direction before implementation begins. This is non-negotiable.
2. **Confirm entity IDs before building** — never assume. Always ask for exact entity IDs from Developer Tools → States before writing card code.
3. **Ask clarifying questions upfront** — use the `ask_user_input` widget to collect all needed info before starting, not mid-build.
4. **Short direct feedback** — user gives terse corrections ("that's fine", "remove that", "I don't care about that"). Take at face value, don't over-interpret.
5. **Push to GitHub after every meaningful chunk** — don't batch too many sessions worth of work into one push. Commit messages should be detailed.
6. **Documentation must match code** — user explicitly checks and calls out stale references. After any code change, update ALL affected docs before pushing.
7. **Wall display first** — 1200×800 iPad landscape. Mobile is supported but secondary.
8. **Transparent, dark theme** — all cards `background: transparent`. Dashboard theme is `Amoled+`.
9. **File downloads not preferred** — user wants code in GitHub, not downloaded files.
10. **Prefers `present_files` only for final deliverables** — don't present intermediate files.
11. **Iterative refinement** — comfortable building complexity gradually. Will catch and report errors clearly (shares exact HA error messages verbatim).
12. **Trusts design decisions** — lets Claude make color assignments, layout choices, rainbow ordering, etc. without approving each one.
13. **Specific addresses** — Paoli, PA. Home: 21 Beryl Rd, Paoli, PA 19301. Work: 1030 Continental Dr, King of Prussia, PA 19406.
14. **Practical approach to tradeoffs** — when asked about approximate vs precise data, chooses simpler/good-enough (e.g. "I don't care" about session cost, charging speed over avg power approximation).

---

## 14. COLLABORATION APPROACHES THAT WORKED WELL

- **Widget-based clarification** — using `ask_user_input_v0` to gather multiple decisions at once before building anything. Avoided multiple back-and-forth rounds.
- **Mockup before code** — showing full visual mockup (including multiple scenarios: normal/holiday/after-midnight, charging/idle) got clean approval before writing 300+ lines of JS.
- **Integration audit visualization** — rendering the gap analysis as an interactive widget (covered/gaps/partial/infrastructure) let the user quickly see what was missing at a glance.
- **Show all layout options at once** — presenting Options A/B/C/D simultaneously rather than sequentially. User could compare and pick. Used for SEPTA theme block layout and traffic card.
- **Thorough commit messages** — detailed multi-paragraph commit messages serve as a secondary record of what changed and why.
- **Separate mockup confirmation step** — always ending a mockup phase with explicit "confirm with me before I build" rather than immediately writing code.
- **Reading existing code before modifying** — always grepping and reading the relevant sections before making changes. Prevented breaking existing functionality.

---

## 15. CORRECTIONS MADE THIS SESSION

1. **"all three areas" → actually four** — user said "all three" but listed four zones (all outdoor, side path, front path, display lights). Caught by clarifying widget.
2. **Display lights entity name** — user specified `light.yard_spotlights` (not `light.yard_display_lights` as assumed)
3. **Side path entity type** — `switch.yard_light_controller_zone_1` is a switch, not a light. Cannot dim or change color. Handled in theme block with `type: switch`.
4. **Traffic view** — user said "move SEPTA from home view and traffic card go into a new commute view" — implied both should move, not just SEPTA.
5. **Wallbox solar mode** — user said "hide solar buttons all the time" after they appeared in the charging card mockup.
6. **PECO sensor prefix** — entities use `peco_electric_*` prefix, not `opower_*` or `energy_*`.
7. **Ecoflow model** — River 2 Pro (not River 2 or Delta Pro). Matters because sensor entity names differ.
8. **Apple TV count** — "Three or more" (family room, master bedroom, office).

---

## 16. PENDING / NOT YET DONE

1. **Shared module migration** — 21 of 22 cards still self-contained. Only `garage-door-card` uses shared modules. Migration should be incremental when editing each card.
2. **`room-buttons-card` color mode support** — CT/color filter logic from `room-controls-card` (discussed in previous session) was never implemented. When a room-buttons popup opens a light, it doesn't filter CT/color presets by `supported_color_modes`.
3. **Ubiquiti camera layout** — waiting on physical install. 7 cameras total: G6 Entry doorbell + 6 turrets (3×2 grid). Entity IDs TBD after install. `camera-layout-card` currently shows 4 cameras max; may need updating for 7.
4. **Unraid storage hardcoded values** — in technology view YAML, `used: "18.8 TB"` and `free: "11.2 TB"` are still hardcoded. Should swap to real Unraid integration sensors when they expose disk free/used.
5. **Ecoflow `battery_charging_state` sensor** — shows `unused` state. May improve battery status display once it reports properly.
6. **Google Nest devices** — flagged in integration audit as not on dashboard. Unclear which devices (Hub, Audio, Protect smoke detectors). If Nest Protect, smoke/CO alerts should be visible somewhere.
7. **ESPHome devices** — unknown what's deployed. If any have temp sensors or motion sensors, they should be added to `temp-strip-card` or `door-sensor-card`.
8. **Cielo Home** — smart AC controller. May overlap with Solarium mini-split. Worth checking if it exposes separate entities.
9. **System Monitoring** — HA host health (CPU/RAM/disk of the HA machine itself) not shown anywhere. Different from Unraid.
10. **Traffic card Waze sensors** — require HA restart (not just reload) to activate. User still needs to add the three `!include` lines to `configuration.yaml` and restart.
11. **charging-card `charge_limit` entity** — user confirmed `sensor.magneton_charge_limit` or similar exists, but exact entity ID was not confirmed. May need to verify in HA States.

---

## 17. HA RESOURCES TO REGISTER (complete list)

All 22 cards need to be registered at **Settings → Dashboards → Resources**:

```
/local/cards/room-controls-card/room-controls-card.js
/local/cards/room-buttons-card/room-buttons-card.js
/local/cards/camera-layout-card/camera-layout-card.js
/local/cards/technology-card/technology-card.js
/local/cards/bambu-printer-card/bambu-printer-card.js
/local/cards/printer-status-card/printer-status-card.js
/local/cards/weather-card-nws/weather-card-nws.js
/local/cards/clock-card/clock-card.js
/local/cards/temp-strip-card/temp-strip-card.js
/local/cards/door-sensor-card/door-sensor-card.js
/local/cards/septa-paoli-card/septa-paoli-card.js
/local/cards/thermostat-card/thermostat-card.js
/local/cards/tesla-card/tesla-card.js
/local/cards/calendar-card/calendar-card.js
/local/cards/garage-door-card/garage-door-card.js
/local/cards/wallbox-card/wallbox-card.js
/local/cards/peco-card/peco-card.js
/local/cards/ecoflow-card/ecoflow-card.js
/local/cards/now-playing-card/now-playing-card.js
/local/cards/traffic-card/traffic-card.js
/local/cards/tesla-commute-card/tesla-commute-card.js
/local/cards/charging-card/charging-card.js
```

All type: JavaScript Module. `shared/` modules do NOT need to be registered.

---

## 18. DEPLOYMENT CHECKLIST FOR NEXT SESSION

If deploying the full current repo to HA:

1. Copy entire repo to `/config/www/` (so paths become `/config/www/cards/`, `/config/www/shared/`, etc.)
2. Register all 22 JS files as resources (type: JavaScript Module)
3. Add to `configuration.yaml`:
   ```yaml
   template: !include ha-config/outdoor-lighting-theme-sensor.yaml
   light:     !include ha-config/light-groups.yaml
   sensor:    !include ha-config/waze-sensors.yaml
   ```
4. **Restart HA** (Waze sensors require restart, not just reload)
5. After restart: Developer Tools → YAML → Reload Template Entities
6. Paste `ha-config/dashboard.yaml` into dashboard raw config editor
7. Verify `sensor.outdoor_lighting_theme` appears in States
8. Verify `light.yard_spotlights` appears in States
9. Verify 3 commute sensors appear with real values after ~5 minutes
10. Confirm `sensor.magneton_charge_limit` exact entity ID — update `charging-card` config if different

---

## 19. INTEGRATIONS INVENTORY (from user confirmation)

| Integration | On Dashboard? | Notes |
|-------------|--------------|-------|
| Apple TV | ✅ Yes | now-playing-card on Home view |
| Bambu Lab | ✅ Yes | Full card + compact widget |
| Browser Mod | — | Infrastructure, not displayed |
| CalDAV | ✅ Yes | calendar-card |
| Cielo Home | ❌ No | May overlap with Solarium mini-split |
| Ecoflow | ✅ Yes | ecoflow-card on Energy view |
| ESPHome | ❓ Partial | Unknown devices deployed |
| Google Nest | ❌ No | Unknown device types |
| HA Connect ZBT | — | Zigbee coordinator |
| HomeKit Bridge | — | Exposes HA to Apple Home |
| Hubspace | ❓ Partial | May power some lights |
| Immich | ✅ Yes | technology-card immich section |
| Internet Printing | ✅ Yes | ink section in technology-card |
| Jellyfin | ✅ Yes | Switch via Unraid services; active sessions via now-playing-card |
| Lutron Caseta | ✅ Yes | Fans + some lights |
| Matter | — | Protocol layer |
| NWC | — | Protocol layer |
| NWS Alerts | ✅ Yes | weather-card-nws |
| Opower (PECO) | ✅ Yes | peco-card on Energy view |
| Hue | ✅ Yes | Color lights + path lights |
| Radarr | ✅ Yes | recently_added section |
| Restful | ✅ Yes | Sonarr/Radarr sensors |
| Season | ❌ No | Could drive outdoor lighting themes |
| Sonarr | ✅ Yes | recently_added section |
| Speedtest | ✅ Yes | technology-card speed section |
| Spook | — | Virtual helpers |
| Sun | ✅ Yes | Outdoor lighting automations |
| System Monitoring | ❌ No | HA host health not shown |
| Tesla Custom | ✅ Yes | tesla-card + tesla-commute-card + charging-card |
| Thread | — | Protocol layer |
| Unifi Network | ✅ Yes | technology-card network section |
| Unifi Protect | ✅ Yes | camera-layout-card (4 of eventual 7) |
| Unraid API | ✅ Yes | technology-card server/services/storage |
| Wallbox | ✅ Yes | wallbox-card on Energy view + charging-card on Commute view |
| WebOS TV | ✅ Yes | now-playing-card (via media_player) |
| Zigbee | ✅ Yes | Door sensors, some lights |

---

## 20. COLOR PALETTE (shared across all cards)

| Token | Hex | Meaning |
|-------|-----|---------|
| `COLORS.amber` | `#fbbf24` | Lights on, active |
| `COLORS.blue` | `#60a5fa` | Fans, info, cool mode, charging |
| `COLORS.purple` | `#a78bfa` | Blinds, calibrating |
| `COLORS.orange` | `#fb923c` | Heat mode, closing |
| `COLORS.green` | `#4ade80` | OK, closed, complete, on-time, locked |
| `COLORS.red` | `#f87171` | Error, open, alert, delayed, unlocked |
| `COLORS.teal` | `#2dd4bf` | Fan-only HVAC mode |
