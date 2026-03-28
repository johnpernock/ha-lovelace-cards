# Card Reference

Config parameters, entity reference, and changelogs for all 24 cards. For design patterns and shared CSS see [`STYLE-GUIDE.md`](STYLE-GUIDE.md). For HA config files and dashboard setup see [`ha-config/README.md`](ha-config/README.md).

---

## Table of contents

- [room-controls-card](#room-controls-card)
- [room-buttons-card](#room-buttons-card)
- [camera-layout-card](#camera-layout-card)
- [protect-events-card](#protect-events-card)
- [technology-card](#technology-card)
- [bambu-printer-card](#bambu-printer-card)
- [bambu-status-card](#bambu-status-card)
- [weather-card-nws](#weather-card-nws)
- [clock-card](#clock-card)
- [calendar-card](#calendar-card)
- [temp-strip-card](#temp-strip-card)
- [door-sensor-card](#door-sensor-card)
- [septa-paoli-card](#septa-paoli-card)
- [traffic-card](#traffic-card)
- [leave-by-card](#leave-by-card)
- [thermostat-card](#thermostat-card)
- [tesla-card](#tesla-card)
- [tesla-commute-card](#tesla-commute-card)
- [charging-card](#charging-card)
- [garage-door-card](#garage-door-card)
- [wallbox-card](#wallbox-card)
- [peco-card](#peco-card)
- [ecoflow-card](#ecoflow-card)
- [now-playing-card](#now-playing-card)

---

## room-controls-card

The main room control card. A single card definition renders all rooms in your home — each room row is built dynamically based on what you configure. Lights, fans, blinds, thermostat, sensors, and garage door all live in one place.

Designed for a 1200×800 wall-mounted display but fully functional on mobile.

### How it works

On first load the card does a full render into its shadow DOM. On every subsequent `hass` update it calls `_patch()` — this updates only changed values (brightness slider, temperatures, fan pips, mode button, toggle states) without destroying the DOM or re-attaching event listeners.

All popups (lights detail, blind position, thermostat controls) are injected directly into `document.body` rather than staying inside the shadow DOM. This avoids the popup being clipped by HA's CSS transforms.

Each room renders a header (name + door pills) followed by whatever rows are configured:

| Row | Visible when |
|-----|-------------|
| Lights | `lights:` defined |
| Fans | `fans:` list non-empty |
| Blinds | `blinds:` defined |
| Thermostat | `thermostat:` defined |
| Sensor | `sensor:` defined and no thermostat |
| Garage | `garage:` defined |

The room header always shows the room name, door pills (if configured), and the on/off toggle. When a thermostat is configured, the header also shows compact temperature pills: a **thermostat pill** (`● 68° → 70°`) and optionally a **sensor pill** (bare blue reading from a separate room sensor).

`simplified: true` collapses the lights row to a count badge in the header (e.g. "3 / 5 on") with a chevron. Good for bathrooms and utility rooms.

### Fan speed resolution

Priority order:
1. YAML `speeds:` — always wins if set
2. `percentage_step` entity attribute — `round(100 ÷ step)` speeds + 1 off pip
3. `speed_count` entity attribute — count + 1 off pip
4. Default: 5 (off + 4 speeds)

`speeds:` is the **total pip count including off** — e.g. `speeds: 5` = off + 4 speed pips. Most fans do not need `speeds:` set at all. Only white-series preset-mode fans need it hardcoded.

### Parameters

**Top-level**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `rooms` | ✅ | — | List of room objects |
| `ct_presets` | ❌ | 4 built-in | Color temperature preset buttons. Each: `label`, `kelvin`, `color` (hex swatch) |
| `color_presets` | ❌ | 4 built-in | RGB color presets. Each: `label`, `rgb` ([r,g,b]), `color` (hex) |

**Room object**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `id` | ✅ | — | Unique key (no spaces — used as DOM ID prefix) |
| `name` | ✅ | — | Display name |
| `simplified` | ❌ | `false` | Collapse lights to count badge + header chevron |
| `lights` | ❌ | — | Lights config (see below) |
| `fans` | ❌ | — | List of fan objects |
| `blinds` | ❌ | — | Blinds config |
| `thermostat` | ❌ | — | Thermostat config |
| `sensor` | ❌ | — | Plain temperature sensor (shown only if no thermostat) |
| `garage` | ❌ | — | Garage door config |
| `door` | ❌ | — | Single door sensor — pill in room header |
| `doors` | ❌ | — | Multiple door sensors — pills in header |
| `theme_block` | ❌ | — | Holiday/schedule indicator (see below) |

**Lights object**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Main group/area light entity |
| `individuals` | ❌ | `[]` | List of `{ entity, name }` — individual sliders in popup |
| `no_popup` | ❌ | `false` | Skip popup — tap just toggles the group |

**Fan object**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Fan entity |
| `name` | ❌ | friendly_name | Label shown above pips |
| `speeds` | ❌ | Auto-detected | Total pip count including off. Set explicitly for Lutron Caseta. |

**Blinds object**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Cover entity |
| `max_position` | ❌ | `100` | Max open position — open tap and popup slider target this value |

**Thermostat object**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Climate entity |
| `name` | ❌ | friendly_name | Label on mode button |
| `sensor` | ❌ | — | Separate room temp sensor — shown as blue pill in header |
| `sensor_label` | ❌ | — | Label for sensor in inline thermostat block |

**`theme_block` object** — holiday/schedule indicator above the lights row

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sensor` | string | ✅ | `sensor.outdoor_lighting_theme` entity ID |
| `areas` | list | ✅ | Area rows to show |

**`theme_block.areas` item**

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label` | string | ✅ | Display label (e.g. `All Outdoor`) |
| `entity` | string | ✅ | Entity to read on/off/brightness state from |
| `color_attr` | string | ✅ | Attribute on the sensor holding this area's color array |
| `type` | string | ❌ | `switch` for switch entities — shows On/Off only, no color swatches |
| `count` | number | ❌ | Shows "N on" instead of "On" in the state label |

### Example

```yaml
type: custom:room-controls-card
ct_presets:
  - label: Warm
    kelvin: 2700
    color: '#ff9a3c'
  - label: Neutral
    kelvin: 3500
    color: '#ffd59e'
rooms:
  - id: family
    name: Family Room
    lights:
      entity: light.all_family_room_lights
      individuals:
        - entity: light.family_room_overhead
          name: Overhead
        - entity: light.family_room_lamps
          name: Lamps
    fans:
      - entity: fan.family_room_ceiling_fan
        name: Ceiling Fan
    blinds:
      entity: cover.family_room_blinds
      max_position: 87
    thermostat:
      entity: climate.family_room_2
      sensor: sensor.family_room_temperature
    door:
      entity: binary_sensor.family_room_entry
      name: Entry

  - id: yard
    name: Yard
    lights:
      entity: light.all_yard_lights
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
          type: switch
```

### Changelog

| Version | Changes |
|---------|---------|
| v97 | **Perf fix:** popup slider document listeners now tracked via `_trackDoc()` helper and cleared via `_clearDocHandlers()` on popup close and `disconnectedCallback`. Previously each popup open added 12 document listeners (4 per slider × 3 sliders) that persisted for the card lifetime, compounding across repeated popup opens on a long-running wall panel |
| v96 | Popup overlay dim corrected to 85% and sheet background set to true black `#000000` across all `rcc-overlay` instances within this card |
| v95 | Popup border fixes: rcc-sheet border added at ≥768px (was `border:none`); mode-btn border increased from 0.5px to 1.5px; popup overlay dim increased to 85%; popup background set to true black |
| v94 | UX: remove border from popup sheet (rcc-sheet) — both mobile and desktop variants |
| v93 | Remove .room border/border-radius — room cards borderless on Lights/Fans view |
| v92 | UX: tstat bars 3px .5→4px .80, bg tints removed; inline tadj 34×34 1.5px→44×44 2px; popup tadj 1.5px→2px — all match new thermostat-card style |
| v91 | Fix: popup master lm-bar track .08→.40/4px→5px; popup individual pp-ltrack same |
| v90 | Fix: light slider track rgba(.1)→(.35) — visible gray on OLED when off; switch track same; header pill padding 3→4px, margin 6→8px; rhead padding 14→16px |
| v89 | UX: gray=off/color=on — removed all opacity dimming; itog/fpip/toggle/theme-area/blind/thermostat off states now solid gray not faded; tadj-off gray not transparent |
| v88 | Fix: temp pill border 1px .22→1.5px .45; popup master expand border .12→.30 |
| v87 | Low-DPI: thermostat/door dots 7px→9px, disabled +/- opacity .3→.5, pp-clbl font 8px→10px opacity .25→.55 |
| v86 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v85 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v84 | Light mode: CSS vars on borders/dots/labels/fan pips/itog/thermostat; @media light override; room border .25→.22 |
| v83 | Final pass: thermostat off dot .25→.65/bg→0/border→.22; preset-cycle bg→0 |
| v82 | OLED visibility pass: itog-dot CSS default .75; off dot .45→.80; toggle thumb .30→.60; thermostat dot .25→.60 |
| v81 | Comprehensive visibility pass: all neutral borders 0.22-0.28, fan pip off-dot 0.45, fan dot-off label 0.5, lm-btn 0.22, sensor-row 0.2, tstat-off 0.28, tadj popup 0.28, tdiv 0.25, theme-area off label 0.5, sheet border 0.28, fpip-dot off 0.45, mode-sub 0.45, lm-sub 0.5, sensor-lbl 0.5 |
| v81 | Comprehensive OLED visibility pass: toggle OFF bg→0/border→.28/thumb→.45; theme-area OFF bg→0/border→.22/opacity→.6; fpip OFF bg→0/border→.28; blind border→.22; lm-btn bg→0 |
| v80 | (version sync — intermediate v80 changes applied on device) |
| v79 | Fix: itog off-state dot `rgba(255,255,255,.45)`, border `0.28`, label `0.65`, bg `0` — all visible on OLED black; _patch path updated to match |
| v78 | Switch master entities now render tap-to-toggle row instead of brightness slider on both inline and popup views; `mode: toggle\|slider` override on individuals; CSS `.lm-sw-row` added |
| v77 | Version header corrected — JS was at v76 but resources required v77 due to prior deploy |
| v76 | Version header corrected — JS was at v75 but resources required v76 due to prior deploy |
| v75 | Version header corrected — JS was at v74 but resources required v75 due to prior deploy at v74 |
| v74 | Padding consistency pass — grid side padding normalized to 14px |
| v73 | Individual light rows in popup redesigned: removed border-bottom dividers, tightened padding, brightened lit label. Fixed patch bug — popup individual light fills/thumbs/pct now update live on every hass update |
| v72 | Fixed pp-lrow flex-direction was column — changed to row so dot/name/slider/pct/chevron all sit on one horizontal line; dot size 9→11px |
| v71 | Popup individual light rows: removed bordered box, added color dot before name, flat single row layout with name+slider+pct+chevron |
| v70 | Popup improvements: expand chevrons bare; off individual lights dimmed 65%; pct hidden when off; subtitle "X of Y on" → "X / Y"; sheet max-width 440px |
| v69 | Popup sheet header: added top padding; title 16px→17px white bold |
| v66 | Overlays: body scroll lock added to open/close |
| v63 | Theme area buttons dim when off |
| v57 | No card background (transparent, border rgba(.12)); room name 17px white bold; speed pip buttons show N dots matching speed |
| v54 | Toggle pill-shaped (border-radius:99px, circular thumb) |
| v51 | Added Lights and Thermostat section headers |
| v42 | Fan pips replaced with dot tap buttons; individual light toggle grid added; popup drawers close others on open |
| v39 | Header sensor pill (bare blue reading) added |
| v37 | Header thermostat pill (mode dot + cur°→set°) added |
| v35 | Fan pip off-by-1 fixed; theme_block added |
| v34 | Popup portalling to document.body |
| v33 | set hass calls _patch() instead of _render() |
| v24 | Live hvac_modes cycling — no longer cycles to unsupported modes |
| v16 | simplified: true and no_popup: true added |
| v8 | Thermostat row added |
| v4 | Fan pips added |
| v7 | `_patch()` added — route times and delays update in-place; full re-render only when incident banner appears/disappears |
| v8 | `_patch()` added — inline conditions, temp, and forecast strip update without rebuilding style block |
| v1 | Initial release |

---

## room-buttons-card

Compact 2-column room button grid for the home view. Each button represents a room or device. Buttons can open a custom popup with detailed controls or fire a direct toggle/more-info action.

### Parameters

**Top-level**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `buttons` | ✅ | — | List of button objects |

**Button object**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Entity whose on/off state drives the active indicator |
| `name` | ✅ | — | Label shown below the icon |
| `icon` | ❌ | `home` | Icon name (see list below) |
| `tap_action` | ❌ | `more-info` | Set to `toggle` for direct cover or switch control |
| `theme_sensor` | ❌ | — | `sensor.outdoor_lighting_theme` entity ID — adds holiday color strip and theme name label to this button |
| `lights` | ❌ | — | Lights config — enables the lights/fans-view popup with master slider + individual rows (see below) |
| `fans` | ❌ | — | List of fan objects — adds fan pip section to the popup (see below) |
| `popup_entities` | ❌ | — | Legacy popup entity list (`stat`, `toggle`, `cover_group`). Stats are shown at the bottom. |

**`lights` object**

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `entity` | ✅ | — | Main group/area light entity |
| `individuals` | ❌ | `[]` | List of `{ entity, name }` — shown as individual sliders below the master |

**Fan object** (item in `fans` list)

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `entity` | ✅ | — | Fan entity |
| `name` | ❌ | friendly_name | Label shown above pip row |
| `speeds` | ❌ | Auto-detected | Total pip count including off. Set explicitly for Lutron Caseta / white-series fans. |

**Popup entity object**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | HA entity ID |
| `label` | ✅ | — | Display label in popup tile |
| `type` | ✅ | — | `stat`, `toggle`, `fan`, or `cover_group` |
| `icon` | ❌ | Auto | Override icon for `toggle` tiles |
| `speeds` | ❌ | 3 | (`fan`) Number of speed steps |
| `speed_percentages` | ❌ | Equal | (`fan`) Manual percentage mapping per speed step |
| `max_position` | ❌ | `100` | (`cover_group`) Open button targets this position |
| `entities` | ❌ | `[entity]` | (`cover_group`) All cover entities to move together |

**Available icons:** `bulb` `garage` `sofa` `sun` `kitchen` `dining` `desk` `bed` `bath` `stairs` `tree` `fan` `blinds` `tv` `appletv` `homepod` `speaker` `lock` `thermo` `plug` `home`

### Example

```yaml
type: custom:room-buttons-card
buttons:
  - entity: light.all_family_room_lights
    name: Family Room
    icon: sofa
    lights:
      entity: light.all_family_room_lights
      individuals:
        - entity: light.venus_window_lamp
          name: Window
        - entity: light.reading_lamp
          name: Reading
    fans:
      - entity: fan.white_series_lightfan_module_2
        name: Front Fan
        speeds: 4
  - entity: light.all_yard_lights
    name: Yard
    icon: tree
    theme_sensor: sensor.outdoor_lighting_theme
    lights:
      entity: light.all_yard_lights
  - entity: cover.garage_door
    name: Garage
    icon: garage
    tap_action: toggle
```

### Changelog

| Version | Changes |
|---------|---------|
| v32 | **Perf fix:** same popup slider listener cleanup as room-controls-card — 8 document listeners per popup open now properly cleaned up via `_trackDoc()` + `_clearDocHandlers()` |
| v31 | Popup restyled to match `room-controls-card`: edge-to-edge header with `border-bottom: 1.5px solid`, bigger close button (44px), tighter padding rhythm, `440px` max-width on wall display, proper horizontal margins on master slider and individual light grid |
| v30 | Popup border fixes: wall display modal border added (1.5px); rb-overlay dim increased to 85%; rb-popup background set to true black; rb-master All Lights border opacity increased for visibility |
| v29 | UX: gray=off/color=on — button tile off state bolder (icon .65, name .85); itog off border .40, dot .65, label .75; theme-area no opacity dim |
| v28 | Fix: master slider container bg .04→0, border 1px .12→1.5px .35 |
| v27 | Low-DPI: rb-clbl font 8px→10px, opacity .5→.6 |
| v26 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v25 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v24 | Light mode: CSS vars on all borders/dots/labels/fan pips/itog; @media light override; fan pip dot .20→.75; wallbox-style bg fixed |
| v23 | Final pass: cover closed border .09→.22/bg→0; popup icon off .28→.55; theme-area label off .20→.50 |
| v22 | OLED visibility pass: itog-dot CSS default .75; off dot .45→.80; inner borders .08→.18 |
| v21 | Comprehensive visibility pass: pop-tile off border 0.28, rb-track 0.22, master-exp border-top 0.3, rb-divider 0.2, fp pip border 0.22, fp dot-off 0.5, rb-preset border 0.22, rb-dot-lbl 0.6, rb-clbl 0.5 |
| v21 | Comprehensive OLED visibility pass: theme-area OFF bg→0/border→.22; fpip OFF bg→0/border→.28; preset bg→0/border→.25; color-sec border→.22; theme-block border→.25/bg→0 |
| v20 | (version sync — intermediate changes applied on device) |
| v19 | (version sync) |
| v18 | Fix: itog off-state dot `rgba(255,255,255,.45)`, border `0.28`, label `0.65`, bg `0` — visible on OLED; optimistic update path matched |
| v17 | Added `greenhouse` icon to icon set; Solarium button updated from `home` fallback to `greenhouse` |
| v16 | Yard popup: `theme_block` with area grid (matching lightfan view); `theme_block` config supported on any home button. Basement popup: fans added. `_themeAreaState` helper ported from room-controls-card |
| v15 | Fix: fan speed detection aligned with room-controls-card — `_fanResolvedSpeeds` now adds +1 for Off pip, `_fanCurrentStep` uses `Math.round((pct/100)*(speeds-1))` matching room-controls exactly; `_fanSpeedPercentages` removed |
| v14 | Popup redesign — fans now use `fpip`/`fpip-dot` signal-bar pips and individuals use `itog-grid` tap-to-toggle dots, matching room-controls-card exactly; per-light color chevrons removed (color/CT on master chevron only); dead rb-fpip CSS and event handlers removed |
| v13 | Switch/slider display mode — `mode: toggle\|slider` on `lights:` and each individual row overrides auto-detection; switch entities default to toggle, lights default to slider |
| v12 | Fix: `popup.getElementById()` replaced with `popup.querySelector()` throughout — `getElementById` is a Document-only method; calling it on an Element silently returns `undefined`, breaking all chevron expand and color preset interactions |
| v11 | Fix: chevron expand logic inverted — `classList.toggle()` returns `true` when class added (hidden), was being read as "opening"; arrow rotation and close-others logic now correct |
| v10 | Color/CT chevrons on individual lights and master slider; theme color swatch bar in Yard popup; section labels removed from popup header; `_openCoverGroup` method header restored |
| v9 | Fix: duplicate `_buildPopupContent` method removed — second definition was silently overwriting the first, causing `lights:` and `fans:` popup buttons to show empty popups |
| v8 | Fix: `hasPopup` check now includes `lights` and `fans` keys so custom popup opens correctly for those buttons |
| v7 | `_patch()` added — button active states, colors, and theme strips update in-place; popup master slider refreshes on hass updates |
| v6 | New `lights` and `fans` button params — popup now shows master + individual brightness sliders (exact match to lights/fans view) and full-width fan pip dot buttons. Stats moved to bottom. `popup_entities` still works for legacy `toggle` and `cover_group` entries. |
| v5 | Padding consistency pass — horizontal padding normalized to 14px |
| v4 | `theme_sensor` parameter added — holiday color strip and theme name label |
| v3 | Fan popup speed resolution fixed — uses `_fanResolvedSpeeds()` helper |
| v2 | `cover_group` popup type with `max_position`; `tap_action: toggle` for direct cover control |
| v1 | Initial release |

---

## camera-layout-card

Portrait doorbell on the left, dynamic 2×N camera grid on the right. Built for a 1200×800 wall-mounted display using native `ha-camera-stream` components for live video.

### Layout

```
┌──────────┬────────────────────────────┐
│          │  Driveway  │  Back Garden  │
│  Front   ├────────────┼───────────────┤
│  Door    │  Back Yard │  Garage Side  │
│ (tall)   ├────────────┼───────────────┤
│          │Utility Side│  + Camera     │
└──────────┴────────────┴───────────────┘
  26% wide       74% wide — 2×3 grid
```

Grid rows are derived automatically from camera count:

| Cameras | Grid |
|---------|------|
| 1–2 | 2×1 |
| 3–4 | 2×2 |
| 5–6 | 2×3 |

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `doorbell` | ✅ | — | Doorbell camera object (`entity`, optional `name`) |
| `cameras` | ❌ | `[]` | Up to 6 grid cameras. Each: `entity`, optional `name` |
| `height` | ❌ | `680` | Total card height in px |

### Example

```yaml
type: custom:camera-layout-card
height: 680
doorbell:
  entity: camera.g6_entry
  name: Front Door
cameras:
  - entity: camera.driveway
    name: Driveway
  - entity: camera.back_garden
    name: Back Garden
  - entity: camera.back_yard
    name: Back Yard
  - entity: camera.garage_side_yard
    name: Garage Side
  - entity: camera.utility_side_yard
    name: Utility Side
```

### Changelog

| Version | Changes |
|---------|---------|
| v9 | Remove ha-card background #08080f→transparent, border-radius 12px→0 |
| v8 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v7 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v6 | Light mode: @media light override block |
| v5 | Loading placeholder behind each stream — shows camera icon and name while stream connects |
| v4 | Responsive stacking breakpoint raised 480px → 700px |
| v3 | Responsive flex-wrap layout; below 480px doorbell stacks above cameras |
| v2 | Dynamic grid rows auto-derived from camera count (1–6 cameras). Doorbell narrowed to 26% |
| v1 | Initial release |

---

## printer-ink-card

Standalone Epson printer ink level card. Extracted from `technology-card` (`section: ink`) so it can be used independently anywhere on the dashboard.

**Config:**
```yaml
type: custom:printer-ink-card
entities:
  ink_black:   sensor.epson_et_5170_series_black_ink
  ink_cyan:    sensor.epson_et_5170_series_cyan_ink
  ink_magenta: sensor.epson_et_5170_series_magenta_ink
  ink_yellow:  sensor.epson_et_5170_series_yellow_ink
```

**Changelog:**

| v1 | Initial release — extracted from `technology-card` section: ink. Four ink bars (K/C/M/Y) with low-ink warning at < 20%. |

---

## protect-events-card

Real-time UniFi Protect smart detection event feed. Displays a live-updating list of person, vehicle, animal, and package detections across all configured cameras.

### Prerequisites

- UniFi Protect integration configured in HA (built-in, not HACS)
- Cameras must have RTSP enabled in UniFi Protect settings
- Integration user must have Full Management permission
- Smart detections (person/vehicle/animal/package) require G4 or AI series cameras

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `cameras` | ✅ | — | List of camera entity IDs or `{entity, sensor_base}` objects |
| `max_events` | ❌ | `8` | Rows shown in the list |
| `show_motion` | ❌ | `false` | Include plain motion events (no smart detection) |
| `confidence_threshold` | ❌ | `0` | Hide events below this confidence % |
| `cameras_view` | ❌ | — | Path to navigate when "All →" footer link is tapped |

**`sensor_base` override** — multi-channel cameras (G6 Entry, G4 Doorbell Pro) expose multiple stream entities with suffixes like `_high_resolution_channel`. Use `sensor_base` to specify the correct detection sensor prefix:

```yaml
cameras:
  - entity: camera.g6_entry_high_resolution_channel
    sensor_base: g6_entry
  - camera.driveway   # plain string still works for standard cameras
```

### Example

```yaml
type: custom:protect-events-card
cameras:
  - entity: camera.g6_entry_high_resolution_channel
    sensor_base: g6_entry
  - camera.driveway
  - camera.back_garden
  - camera.back_yard
  - camera.garage_side_yard
  - camera.utility_side_yard
max_events: 8
cameras_view: /security
```

### Changelog

| Version | Notes |
|---------|-------|
| v7 | Refactored from standalone (shared modules inlined, 1669 lines) to using shared/ imports (619 lines). Bug fixes to ha-utils/ha-styles/ha-popup now automatically propagate to this card |
| v6 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v5 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v4 | Light mode: CSS vars on borders; @media light override block |
| v3 | Final pass: off state bg .04→0 |
| v2 | OLED visibility pass: off dot .25→.60, off border .12→.22, off bg→0 |
| v1.1 | `sensor_base` override for multi-channel cameras |
| v1 | Initial release. Ring buffer, filter pills, thumbnail fetch, portal popup, live state_changed subscription |

---

## technology-card

Modular technology dashboard card. Each card instance renders exactly one section. Add multiple instances in a sections-layout view to build a full tech dashboard.

### Sections

| Section | Description |
|---------|-------------|
| `network` | UniFi AP states, client counts, SSID names |
| `speed` | Speedtest results with sparkline history |
| `access_points` | AP status with restart buttons |
| `services` | Unraid Docker service on/off grid |
| `storage` | Unraid CPU, RAM, array, cache bars + parity check status |
| `ink` | Epson printer ink levels |
| `immich` | Immich photo library stats |
| `now_playing` / `recently_added` | Recent Sonarr/Radarr activity |
| `controls` | Generic switch/button grid |

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `section` | ✅ | — | Section to render (see above) |
| `entities` | ❌ | — | Map of logical names to HA entity IDs. Required keys vary by section. |
| `title` | ❌ | Auto | Override the section header title |

### Entity maps by section

**`network`**

| Key | Entity |
|-----|--------|
| `ap_office` | `sensor.office_u7_state` |
| `ap_family_room` | `sensor.family_room_u7_state` |
| `clients_office` | `sensor.office_u7_clients` |
| `clients_fr` | `sensor.family_room_u7_clients` |
| `sophienet` | `sensor.sophienet` |
| `sophienet_iot` | `sensor.sophienet_iot` |
| `sophienet_guest` | `sensor.sophienet_guest_2` |

**`speed`**

| Key | Entity |
|-----|--------|
| `speedtest_download` | `sensor.speedtest_download` |
| `speedtest_upload` | `sensor.speedtest_upload` |
| `speedtest_ping` | `sensor.speedtest_ping` |

**`access_points`**

| Key | Entity |
|-----|--------|
| `ap_office` | `sensor.office_u7_state` |
| `ap_family_room` | `sensor.family_room_u7_state` |
| `restart_office` | `button.office_u7_restart` |
| `restart_fr` | `button.family_room_u7_restart` |
| `restart_dream` | `button.beryl_dream_machine_restart` |

**`services`** — map service names to `switch.unraid_*` entities:

```yaml
section: services
entities:
  sonarr:       switch.unraid_sonarr
  radarr:       switch.unraid_radarr
  jellyfin:     switch.unraid_jellyfin
  immich:       switch.unraid_immich
  seerr:        switch.unraid_seerr
  syncthing:    switch.unraid_syncthing
  jackett:      switch.unraid_jackett
  gitea:        switch.unraid_gitea
  kitchenowl:   switch.unraid_kitchenowl
  profilarr:    switch.unraid_profilarr
  homeassistant: switch.unraid_homeassistant
  homarr:       switch.unraid_homarr
  icloudpd:     switch.unraid_icloudpd
```

**`storage`**

| Key | Entity |
|-----|--------|
| `cpu_util` | `sensor.unraid_cpu_utilization` |
| `cpu_temp` | `sensor.unraid_cpu_temperature` |
| `ram` | `sensor.unraid_ram_usage` |
| `array` | `sensor.unraid_array_usage` |
| `array_state` | `sensor.unraid_array_state` |
| `cache` | `sensor.unraid_cache_usage` |
| `parity` | `sensor.unraid_parity_check` |
| `parity_progress` | `sensor.unraid_parity_check_progress` |
| `parity_speed` | `sensor.unraid_parity_check_speed` |

**`ink`**

| Key | Entity |
|-----|--------|
| `black` | `sensor.epson_et_5170_series_black_ink` |
| `cyan` | `sensor.epson_et_5170_series_cyan_ink` |
| `magenta` | `sensor.epson_et_5170_series_magenta_ink` |
| `yellow` | `sensor.epson_et_5170_series_yellow_ink` |

**`immich`**

| Key | Entity |
|-----|--------|
| `photos` | `sensor.immich_photos_count` |
| `videos` | `sensor.immich_videos_count` |
| `disk_available` | `sensor.immich_disk_available` |
| `disk_size` | `sensor.immich_disk_size` |

**`now_playing` / `recently_added`**

| Key | Entity |
|-----|--------|
| `sonarr` | `sensor.sonarr_recent` |
| `radarr` | `sensor.radarr_recent` |

### Changelog

| Version | Changes |
|---------|---------|
| v25 | Network banners background/border opacity increased for wall display visibility. Recently Added: expanded title detection (series.title → seriesTitle → title → path → filename scrub). Ink bar track opacity increased 8%→18%. Added getStubConfig() |
| v24 | Remove outer .card border/border-radius — borderless on Technology view |
| v23 | Fix: card-hdr now has border-bottom 1.5px .28 — consistent with all other cards |
| v22 | Fix: popup sheet-head divider border .18→.30 |
| v21 | Fix: network row bg .05→0, WiFi row bg→0, chip dots 7px→9px, disk temp border 1px .1→1.5px .28 |
| v20 | Low-DPI: spark baseline stroke-width 1→1.5, opacity .2→.35 |
| v19 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v18 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v17 | Light mode: CSS vars on border/labels; @media light override |
| v16 | Final pass: media divider .06→.15 |
| v15 | OLED visibility pass: card border .12→.22, inner borders .08→.18, tile bg→0 |
| v2 | OLED visibility pass: off dot .25→.60, off border .12→.22, off bg→0 |
| v14 | `_patch()` added — inner content updates only; style block never rebuilt after initial render |
| v13 | Card section headers: 10px uppercase → 17px white bold |
| v12 | Touch audit: added `-webkit-tap-highlight-color:transparent` to `.rbtn` |
| v11 | Added `immich` and `recently_added` sections |
| v10 | Added `now_playing` section |
| v9 | Added parity check status to `storage` |
| v8 | Added `access_points` with restart buttons |
| v5 | Added `services` section |
| v4 | Added `storage` section |
| v3 | Added sparkline to `speed` section |
| v2 | Added `speed` section |
| v14 | `_patch()` added — section inner HTML updates without rebuilding the style block; `_listen()` still re-attaches on content change |
| v1 | Initial release — `network` section |

---


**Changelog:**

| v27 | **Perf fix:** `_patch()` guards with `_patchKey()` fingerprint — skips full `haCard.innerHTML` rebuild when no entity `last_updated` values have changed since last render |
| v26 | Episode number fix: `r.episode` (Sonarr v3) not `r.episodes[0]`; slice 3→5 items |

## bambu-printer-card

Full Bambu Lab P1S status card. Two-column layout — print status on the left, filament (AMS or external spool) on the right.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `printer` | ❌ | `p1s_01p09a3a1100648` | Entity prefix for your printer. Found by looking at any printer entity and removing the trailing `_<sensor_name>`. |

### Entity prefix reference

All entities are `<printer>_<suffix>`:

| Suffix | Description |
|--------|-------------|
| `current_stage` | Current print stage |
| `print_status` | Print status |
| `print_progress` | Progress 0–100 |
| `remaining_time` | Remaining time in hours |
| `task_name` | Print job name |
| `nozzle_temperature` | Current nozzle temp |
| `nozzle_target_temperature` | Target nozzle temp |
| `bed_temperature` | Current bed temp |
| `target_bed_temperature` | Target bed temp |
| `current_layer` | Current layer |
| `total_layer_count` | Total layers |
| `speed_profile` | Speed profile name |
| `ams_1_active` | AMS unit active |
| `ams_1_tray_1` through `_tray_4` | AMS slot entities |
| `ams_1_humidity` | AMS humidity % |
| `ams_1_humidity_index` | AMS humidity index |
| `active_tray` | Currently loaded tray |
| `externalspool_active` | External spool active |
| `externalspool_external_spool` | External spool entity |

### Example

```yaml
type: custom:bambu-printer-card
printer: p1s_01p09a3a1100648
```

### Changelog

| Version | Changes |
|---------|---------|
| v13 | **Config:** added `setConfig` validation — throws clear error if `printer` prefix not provided |
| v12 | Remove outer .card border/border-radius — borderless on 3D Printer view |
| v11 | Fix: status banner bg .05→0, border-bottom 1px .1→1.5px .45 |
| v10 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v9 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v8 | Light mode: CSS vars on border/header; @media light override block; fan pip/itog CSS normalized |
| v7 | Final pass: filament slot active border .20→.35, bg→0 |
| v6 | OLED visibility pass: card border .12→.22, inner borders .08→.18, tile bg .04→0 |
| v5 | Fix: `_state()` now scans common HA domains (`sensor.`, `binary_sensor.`, etc.) — previously looked up bare entity IDs which never matched, causing blank card |
| v4 | `_patch()` added — status label, progress bar, and temperatures update in-place; full re-render only when status category changes |
| v3 | Active tray detection handles multiple firmware formats; external spool auto-switch; humidity display |
| v2 | `current_stage` status label mapping improved |
| v1 | Initial release |

---

## bambu-status-card

Compact Bambu Lab printer status widget for the home view. Only renders when the printer is actively doing something — returns an invisible empty card when idle.

| State | Shows |
|-------|-------|
| Printing | Blue dot, job name, time remaining, progress bar |
| Paused | Amber dot, "Paused", time remaining |
| Finished | Green dot, "Print complete", Done badge |
| Error | Red dot, "Printer Error", Action needed badge |
| Idle / offline | Empty transparent card |

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `printer` | ❌ | `p1s_01p09a3a1100648` | Entity prefix for your printer |

### Example

```yaml
type: custom:bambu-status-card
printer: p1s_01p09a3a1100648
```

### Changelog

| Version | Changes |
|---------|---------|
| v7 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v6 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v5 | Light mode: CSS vars on border; @media light override block |
| v4 | OLED visibility pass: card border .12→.22 |
| v3 | Fix: same domain-scanning fix as bambu-printer-card v5 — bare entity ID lookup was silently returning null |
| v2 | `_patch()` added — rebuilds inner content only; full re-render on visibility change |
| v1 | Initial release |

---


**Changelog:**

| v9 | **Config:** added `setConfig` validation — throws clear error if `printer` prefix not provided |
| v8 | Renamed from `printer-status-card` |

## weather-card-nws

Weather card built for the NWS HA integration, compatible with any `weather.*` entity. Current conditions inline, detailed popup on tap with hourly strip and 7-day forecast.

### How it works

Uses HA's `weather/subscribe_forecast` WebSocket API for forecast data — maintains `twice_daily` and `hourly` subscriptions. Subscriptions are cleaned up in `disconnectedCallback()`.

When `alert_entity` is configured and its state is not empty/unavailable/unknown, an amber banner appears at the top of the card.

Tapping opens a bottom sheet (mobile) or centered modal (desktop ≥768px) with current conditions grid, 12-hour hourly scroll, and 7-day extended forecast with precip probability bars.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Any `weather.*` entity |
| `name` | ❌ | friendly_name | Override the location name |
| `unit` | ❌ | Entity's unit | `°F` or `°C` |
| `alert_entity` | ❌ | — | Sensor holding NWS alert text — amber banner when active |
| `tap_action` | ❌ | `popup` | `popup` or `none` |

### Example

```yaml
type: custom:weather-card-nws
entity: weather.home
name: Paoli
unit: °F
alert_entity: sensor.nws_alerts
tap_action: popup
```

### Changelog

| Version | Changes |
|---------|---------|
| v15 | Condition label normalization strips hyphens/underscores before MAP lookup — fixes raw state display (e.g. Partlycloudy). Added NWS hyphenated state mappings. Fallback capitalizer improved |
| v14 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v13 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v12 | Light mode: CSS vars on border; @media light override block |
| v11 | Final pass: stat panel bg .04→0 |
| v10 | OLED visibility pass: card border .12→.22, inner borders .08→.18 |
| v9 | Fix: `_patch()` condition text now uses `_label()` — previously used raw `replace(/_/g,' ')` which left hyphens in place (e.g. `clear-night` instead of `Clear Night`) |
| v8 | `_patch()` added — inline conditions, temp, and forecast strip update without rebuilding style block |
| v7 | Padding consistency pass — horizontal padding normalized to 14px |
| v6 | Popup max-width normalized to 440px |
| v5 | Fixed once:true tap-outside listener; body scroll lock; overscroll-behavior:contain |
| v4 | Touch audit: added `-webkit-tap-highlight-color:transparent` |
| v3 | Tap hint label removed |
| v2 | Hourly forecast subscription and 12-hour strip; `alert_entity` banner |
| v1 | Initial release |

---

## clock-card

Large clock with live seconds and AM/PM. Optionally shows a next-event strip and opens a full calendar popup when you tap the date.

### How it works

Runs a `setInterval` every 1 second to update time. Only the time portion updates each tick — the rest of the card is not re-rendered.

When `calendar_entities` is configured, events are fetched from HA's calendar API every 5 minutes. The popup calendar grid shows colored dots on days with events and supports month navigation.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `calendar_entities` | ❌ | — | List of `{ entity, color }` calendar entries |
| `show_next_event` | ❌ | `true` (when calendars set) | Show next upcoming event title + countdown below time |
| `today_color` | ❌ | `#60a5fa` | Accent color for today's date in popup grid |

### Example

```yaml
type: custom:clock-card
calendar_entities:
  - entity: calendar.personal
    color: '#60a5fa'
  - entity: calendar.work
    color: '#a78bfa'
  - entity: calendar.family
    color: '#4ade80'
show_next_event: true
today_color: '#60a5fa'
```

### Changelog

| Version | Changes |
|---------|---------|
| v12 | Low-DPI: event dot 7px→9px, mini dot 4px→8px |
| v11 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v10 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v9 | Light mode: CSS vars on border; @media light override; outer border .18→.22 |
| v8 | OLED visibility pass: card border .07→.18, inner borders .08→.18 |
| v7 | Version header corrected — JS was at v6 but resources required v7 due to prior deploy |
| v6 | Version header corrected — JS was at v5 but resources required v6 due to prior deploy |
| v5 | `_patch()` added — temperature values update in-place on hass updates |
| v4 | Padding consistency pass — horizontal padding normalized to 14px |
| v3 | Calendar popup with month navigation and event dots; next-event strip |
| v2 | `today_color` option; seconds display refined |
| v1 | Initial release |

---

## calendar-card

Full standalone calendar card with a scrollable event list, multi-calendar support, and event detail popups. For the dedicated calendar view — see `clock-card` for the smaller inline clock with popup calendar.

### How it works

Events are fetched from each configured calendar using HA's REST calendar API (`/api/calendars/<entity>`). Refreshed every `refresh_interval` minutes. Events are grouped by day with a pulsing dot on the next upcoming event. Tapping an event opens a detail popup with title, calendar, date/time, location (with optional Google Maps static thumbnail), and description.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `calendars` | ✅ | — | List of `{ entity, color, name }` calendar entries |
| `days_ahead` | ❌ | `14` | How many days ahead to fetch |
| `max_events` | ❌ | `30` | Hard cap on total events across all calendars |
| `refresh_interval` | ❌ | `5` | Minutes between background refreshes |
| `grid_rows` | ❌ | `8` | HA grid rows this card occupies — controls height on desktop |
| `show_past_events` | ❌ | `true` | Show earlier-today events dimmed |
| `today_color` | ❌ | `#60a5fa` | Accent color for today's date column pulse |
| `show_legend` | ❌ | `false` | Show color legend below card |
| `mobile_expand` | ❌ | `true` | On mobile, card grows with content instead of scrolling internally |
| `google_maps_api_key` | ❌ | — | Google Maps Static API key for map thumbnails. Store in `secrets.yaml`. |

### Example

```yaml
type: custom:calendar-card
calendars:
  - entity: calendar.personal
    color: '#60a5fa'
    name: Personal
  - entity: calendar.work
    color: '#a78bfa'
    name: Work
  - entity: calendar.family
    color: '#4ade80'
    name: Family
days_ahead: 14
max_events: 30
refresh_interval: 5
grid_rows: 8
google_maps_api_key: !secret google_maps_api_key
```

**secrets.yaml:**

```yaml
google_maps_api_key: YOUR_KEY_HERE
```

### Changelog

| Version | Changes |
|---------|---------|
| v9 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v8 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v7 | Light mode: CSS vars on border; @media light override block |
| v6 | OLED visibility pass: card border .12→.22, inner borders .08→.18 |
| v5 | Padding consistency pass — horizontal padding normalized to 14px |
| v4 | Event detail popup with location, static map thumbnail, description |
| v3 | `show_past_events`, `mobile_expand`, `show_legend`; pulsing today accent; globally-next event highlight |
| v2 | Multi-calendar support; countdown badges (today/tmrw/+Nd) |
| v1 | Initial release |

---

## temp-strip-card

Single-row temperature strip. Shows multiple sensors in one compact horizontal bar — abbreviated label above, temperature value below.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `sensors` | ✅ | — | List of `{ entity, abbr }` sensor objects |
| `unit` | ❌ | `°F` | Temperature unit label |

`entity` can be `sensor.*` (reads `state`) or `climate.*` (reads `current_temperature` attribute).

### Example

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

### Changelog

| Version | Changes |
|---------|---------|
| v8 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v7 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v6 | Light mode: @media light override block |
| v5 | `_patch()` added — individual cell values update in-place by index class |
| v4 | Padding consistency pass — horizontal padding normalized to 14px |
| v3 | `climate.*` domain support — reads `current_temperature` attribute |
| v2 | `unit` config option; separator lines between cells |
| v1 | Initial release |

---

## door-sensor-card

Compact door/window sensor banner. Green when all doors closed, red when any are open. Tapping opens a 3-column grid popup sorted with open doors at the top.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `doors` | ✅ | — | List of `{ entity, name }` door objects |

`entity` is a `binary_sensor.*`. `state === 'on'` means open (standard HA convention). Long suffixes in `name` (Door, Entry, Slider, Back, Master) are auto-shortened in the popup grid for compact display.

### Example

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
```

### Changelog

| Version | Changes |
|---------|---------|
| v19 | `_garageCfg()` helper — garage from `doors` array (`type: garage`) now fully supported in banner and alert, identical to separate `garage:` key. |
| v18 | Garage door alert in banner: already supported via `garage:` config — confirmed working. Popup overlay dim increased to 85%; popup background true black |
| v17 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v16 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v15 | Light mode: @media light override block |
| v14 | OLED visibility pass: inner borders .08→.18 |
| v13 | Version header corrected — JS was at v12 but resources required v13 due to prior deploy |
| v12 | Version header corrected — JS was at v11 but resources required v12 due to prior deploy |
| v11 | Version header corrected — JS was at v10 but resources required v11 due to prior deploy at v10 |
| v10 | `_patch()` added — banner color, title, and subtitle update in-place |
| v9 | Padding consistency pass |
| v8 | Popup max-width normalized to 440px |
| v7 | Body scroll lock; overscroll-behavior:contain |
| v6 | Tap-outside-to-close fixed — overlay listener wired permanently in `_render()` |
| v5 | Popup re-renders correctly after full card re-render |
| v4 | Open doors sort to top; name auto-shortening |
| v3 | 3-column icon grid popup |
| v2 | Red/green color scheme; subtitle lists open door names |
| v1 | Initial release |

---

## septa-paoli-card

SEPTA Paoli/Thorndale Regional Rail departures and arrivals. Shows next outbound train with upcoming trains, next inbound arrival, delay status, and line-wide alerts.

### How it works

Reads from HA REST sensors that poll the SEPTA API. Trains across all configured sensors are sorted by **estimated arrival time** (`scheduled_arrival + delay`) before hero selection — this ensures the true next-to-arrive train is always shown first regardless of sensor index.

Auto-refreshes every 60 seconds. Tapping a train opens a popup with departure/arrival times, current station, train number, and service type.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `outbound` | ✅ | — | List of outbound sensor entity IDs — first is primary hero, rest are pills |
| `inbound` | ✅ | — | List of inbound sensor entity IDs |
| `inbound_next_station` | ❌ | — | Sensors reporting the current station per inbound train. Must match order of `inbound`. |
| `alert` | ❌ | — | Sensor entity holding line alert text — amber banner when active |
| `expanded` | ❌ | `false` | Full hero/sub row layout for the Commute view |
| `show_next_trains` | ❌ | `false` | (compact mode) Show up to 3 subsequent trains as pills below the hero row |

### REST sensor setup

```yaml
- platform: rest
  name: paoli_outbound_1
  resource: "https://www3.septa.org/api/NextToArrive/index.php?req1=Paoli&req2=30th+Street+Station&req3=3"
  value_template: "{{ value_json[0].orig_departure_time }}"
  json_attributes:
    - orig_departure_time
    - orig_arrival_time
    - orig_delay
    - orig_train
    - orig_line
    - isdirect
  scan_interval: 60
```

### Example

```yaml
type: custom:septa-paoli-card
expanded: true
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

### Changelog

| Version | Changes |
|---------|---------|
| v41 | **Config:** added `setConfig` validation — throws clear error if neither `outbound.trains` nor `inbound.trains` is defined |
| v40 | Fix: add border:none!important to expanded view ha-card — HA default was showing |
| v39 | Remove .exp-wrap border/border-radius — expanded view borderless like compact |
| v38 | UX: on-time compact pills → green tint rgba(74,222,128,.08) bg + .55 border (matches delayed red pill pattern); both outbound and inbound |
| v38 | UX: small on-time pills get green tint bg .08 + green border .55 (was clear/white); expanded non-hero rows get green/red tint bg .06 and green border .55 |
| v37 | Remove exp-row-div dividers between train rows in expanded view |
| v36 | UX: hide .div separator between outbound and inbound trains |
| v35 | Fix: restore border:none!important on compact ha-card — HA default was showing through |
| v34 | UX: remove outer ha-card border on compact/expanded views; remove pills border-top divider (pills have own borders); add 6px padding-top to pills section |
| v34 | UX: remove outer border from compact view (pills have own borders); remove middle divider between Outbound/Inbound |
| v33 | Fix: ha-card now has 1.5px .40 border in both compact and expanded views; hero-neutral bg .04→0, border .30→.40 |
| v32 | Fix: all inline 1px→1.5px; card/pill/badge/row borders boosted (.25-.35→.55-.65); expanded view row bg→0, bdr .07→.30; slider now gray when off |
| v31 | Fix: row/section dividers height:1px→2px, opacity .05/.07→.18/.22; no-alert border .18→.30 |
| v30 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v29 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v28 | Light mode: CSS vars on border/header/labels; @media light override; header divider .07→.15 |
| v27 | Final pass: expanded info box bg .04→0 |
| v26 | OLED visibility pass: on-time pill border .08→.20, card border .22 retained |
| v25 | set hass no longer re-renders on every HA state push — 60s interval is the sole render driver |
| v24 | Popup max-width normalized to 440px |
| v23 | Fixed once:true tap-outside listener; body scroll lock; overscroll-behavior:contain |
| v22 | Card header: 10px uppercase → 17px white bold |
| v21 | `show_next_trains: true` — compact mode subsequent train pills |
| v21 | Comprehensive OLED visibility pass: theme-area OFF bg→0/border→.22; fpip OFF bg→0/border→.28; preset bg→0/border→.25; color-sec border→.22; theme-block border→.25/bg→0 |
| v20 | Touch audit: `-webkit-tap-highlight-color:transparent` and `user-select:none` |
| v18 | `expanded: true` mode — hero/sub row layout, station badge header, train number + service meta |
| v17 | Sort fix — trains sorted by estimated arrival time across all sensors |
| v14 | `inbound_next_station` support |
| v12 | `alert` banner |
| v10 | Train detail popup |
| v1 | Initial release |

---

## traffic-card

Commute traffic card using Waze Travel Time sensors. Live travel time, delay vs typical, distance, and recommended route. Incident banner when any route significantly exceeds typical. "Fastest" badge dynamically moves to the quickest home route.

### How it works

All data from HA's built-in Waze Travel Time integration. Delay = `current − typical`. Incident detection compares each route's current time against typical — no external API needed. To-work row is single route; home shows all configured routes.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to_work` | object | ✅ | Single outbound route config |
| `home_routes` | list | ✅ | One or more return route configs |
| `incident_threshold` | number | ❌ | Minutes over typical that triggers the incident banner. Default `10` |
| `hide_to_work_after` | number | ❌ | Hour (24h) after which to-work row dims. Default `12` |
| `expanded` | boolean | ❌ | Hero/sub row layout for Commute view |

**Route object** (both `to_work` and `home_routes` items):

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `entity` | string | ✅ | Waze Travel Time sensor entity ID |
| `label` | string | ❌ | Destination label |
| `route_label` | string | ❌ | Fallback road name if Waze `route` attribute is empty |
| `via_label` | string | ❌ | Additional "via" line |

### Example

```yaml
type: custom:traffic-card
expanded: true
incident_threshold: 10
hide_to_work_after: 12
to_work:
  entity: sensor.commute_to_work
  label: Work Address
  route_label: US-202 N
home_routes:
  - entity: sensor.commute_home_via_202
    label: Home Address
    route_label: US-202 S
  - entity: sensor.commute_home_via_rt_30
    label: Home Address
    route_label: Route 30 W
    via_label: via Lancaster Ave
```

### Changelog

| Version | Changes |
|---------|---------|
| v20 | Remove outer .card border/border-radius — borderless on Commute view |
| v19 | UX: exp-sub-row gets rgba(t.rgb,.05) tint matching hero row; exp-row-div between route rows removed (display:none) |
| v19 | UX: tile rows get color tint bg rgba(t.rgb,.07); exp-hero-row border 1px.25→1.5px.45 |
| v18 | Fix: card-hdr border .28→.40; .divider hidden (card-hdr border handles separation) |
| v18 | Fix: .card-hdr missing border-bottom — added 1.5px rgba(.28) |
| v17 | UX: removed .dimmed opacity — rows show at full opacity, distinction comes from color not fading |
| v16 | Fix: delay/On Time badge borders 1px→1.5px; row/section dividers 1px→2px .18/.22 |
| v15 | Low-DPI: incident dot 7px→9px, dimmed opacity .38→.60, best-badge font 8px→10px |
| v14 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v13 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v12 | Light mode: CSS vars on border/labels; @media light override |
| v11 | Final pass: unavailable row bg .03→0, border→.22 |
| v10 | OLED visibility pass: card border .10→.22, inner borders .08→.18 |
| v9 | New `hide_home_before` param — dims home route row before a specified hour (symmetric to `hide_to_work_after`); dashboard simplified to single home route |
| v8 | Removed hardcoded `'Home Address'` fallback for home direction label — now uses `home_routes[0].label` only |
| v7 | `_patch()` added — route times and delays update in-place; full re-render only when incident banner appears/disappears |
| v6 | Card header title: 10px uppercase → 17px white bold |
| v5 | Touch audit: `-webkit-tap-highlight-color:transparent` on expanded row classes |
| v4 | To-work row dimming after noon removed — always full brightness |
| v3 | hass guard added to `_renderExpanded()` |
| v2 | `expanded: true` mode — hero/sub rows, delay colouring, Fastest badge |
| v1 | Initial release |

---

## leave-by-card

"Leave by" departure planner. Reads outbound SEPTA train times and a Waze Travel Time sensor, computes when you need to leave home to catch each train, and colour-codes urgency.

### Urgency thresholds

| Colour | Condition |
|--------|-----------|
| Red | Leave within 15 minutes (or overdue) |
| Amber | 15–60 minutes away |
| Green (dim) | More than 60 minutes away |

Stale trains (estimated departure more than 2 minutes ago) are filtered out. Refreshes every 30 seconds.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `waze_entity` | ✅ | — | Waze Travel Time sensor. Uses `state` (travel time in minutes). |
| `outbound` | ✅ | — | List of outbound SEPTA sensor entity IDs — same list as `septa-paoli-card` |
| `station` | ❌ | `'Station'` | Station name shown in the header badge |

### Example

```yaml
type: custom:leave-by-card
waze_entity: sensor.commute_to_work
station: Paoli Station
outbound:
  - sensor.paoli_outbound_1
  - sensor.paoli_outbound_2
  - sensor.paoli_outbound_3
```

### Changelog

| Version | Changes |
|---------|---------|
| v13 | Remove .wrap border — borderless on Commute view |
| v12 | UX: lb-ok (on-time) rows → green tint rgba(74,222,128,.08) bg + .50 border; now/soon rows already red/amber; all statuses now consistently color-coded |
| v12 | UX: full row tinting — ok=green bg.08/border.55, soon=amber bg.10/border.55, now=red bg.12/border.55; all borders boosted to .55 |
| v11 | UX: card-hdr border .28→.40; more space between header and pills (drive-note padding, row margin 6→8px) |
| v11 | Fix: row margin/padding +2px; chip borders 1px→1.5px; row bdr colors boosted; 1px→1.5px on rows |
| v10 | UX: removed opacity:.65 on on-time rows — all rows same opacity, on-time shown via green color |
| v9 | Fix: on-time row border 1px .2→1.5px .45 |
| v8 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v7 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v6 | Light mode: CSS vars on border/header; @media light override; header divider .07→.15 |
| v5 | OLED visibility pass: card border .10→.22, row border .07→.18, row bg→0 |
| v4 | `_patch()` added — set hass no longer calls `_render()` on top of the 30s interval (was double-rendering) |
| v3 | Card header: 10px uppercase → 17px white bold |
| v4 | Fixed double-render — `set hass` no longer calls `_render()` on top of the 30s interval |
| v2 | Touch audit: `-webkit-tap-highlight-color:transparent` on `lb-row` |
| v1 | Initial release |

---

## thermostat-card

Compact thermostat card for a horizontal stack of 3. Current temp, setpoint +/− adjustment, and HVAC mode indicator cycling only through modes the thermostat actually supports.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | `climate.*` entity |
| `name` | ❌ | friendly_name | Label shown above current temperature |
| `step` | ❌ | `1` | Degrees per +/− tap |

### Example

```yaml
type: horizontal-stack
cards:
  - type: custom:thermostat-card
    entity: climate.main_floor
    name: Main Floor
  - type: custom:thermostat-card
    entity: climate.family_room_2
    name: Family Rm
  - type: custom:thermostat-card
    entity: climate.solarium_mini_split
    name: Solarium
```

### Changelog

| Version | Changes |
|---------|---------|
| v15 | Revert ha-card to transparent/borderless — colored bg was too much for compact Lights/Fans view; mode color stays on mode-btn pill only |
| v14 | UX: ha-card now colored by mode (bg+border from MODE_META cardBg/border); remove .sep divider bar; mode-btn border boosted to .45 |
| v13 | Revert to original layout; tgt-btn updated to 44px height, 2px solid border, transparent bg; mode-btn border 0.5px→1.5px |
| v12 | Redesign: colored left bar=mode (4px .80), mode pill left of controls, 44×44 2px tadj buttons, no bg tint, outer card border+header divider, matches room-controls tstat style |
| v11 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v10 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v9 | Light mode: @media light override block |
| v8 | OLED visibility pass: off dot .25→.60, inner borders .08→.18, bg→0 |
| v7 | `_patch()` added — current temp, setpoint, mode dot/colors update in-place |
| v6 | Padding consistency pass |
| v5 | Touch audit: `user-select:none` on tappable elements |
| v4 | Mode cycling reads live `hvac_modes` attribute |
| v3 | Fixed +/− buttons losing listeners after HA state push |
| v2 | Split dot for heat_cool/auto; `target_temp_high` fallback |
| v1 | Initial release |

---

## tesla-card

Tesla vehicle status card. Battery, lock, climate, and trunk inline. Tapping opens a detailed popup with battery info, tire pressures, temperatures, climate controls, seat heating, and vehicle status.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `name` | ❌ | `Model Y` | Vehicle nickname |
| `tire_warn_psi` | ❌ | `40` | PSI below which a tire shows a warning |
| `temp_unit` | ❌ | `F` | `F` or `C` |
| `entities` | ✅ | — | Map of logical names to HA entity IDs (see below) |

### Entity map

| Key | Domain | Description |
|-----|--------|-------------|
| `battery_level` | `sensor` | State of charge % |
| `battery_range` | `sensor` | Estimated range |
| `charging_state` | `sensor` | Charging status text |
| `charge_rate` | `sensor` | Charge rate (while charging) |
| `time_to_full_charge` | `sensor` | Time remaining to full |
| `door_lock` | `lock` | Vehicle door lock |
| `climate` | `climate` | HVAC — on/off toggle and target temp |
| `trunk` | `cover` | Trunk/frunk |
| `charge_port` | `binary_sensor` | Charge port door |
| `sentry_mode` | `switch` | Sentry mode |
| `odometer` | `sensor` | Odometer |
| `interior_temperature` | `sensor` | Cabin temp |
| `exterior_temperature` | `sensor` | Outside temp |
| `tire_pressure_fl/fr/rl/rr` | `sensor` | Tire pressures |
| `front_defrost` | `switch` | Front windshield defrost |
| `rear_defrost` | `switch` | Rear window defrost |
| `steering_wheel_heat` | `switch` | Steering wheel heater |
| `seat_heat_driver` | `select` | Driver seat heat level |
| `seat_heat_passenger` | `select` | Passenger seat heat level |

All entity keys are optional — sections without configured entities are hidden.

### Example

```yaml
type: custom:tesla-card
name: Magneton
tire_warn_psi: 40
temp_unit: F
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

### Changelog

| Version | Changes |
|---------|---------|
| v22 | Removed `.batt-nub` terminal cap element — the bright bar at the right end of the battery indicator on the home card. |
| v21 | Fix: tile-lbl color rgba(.55) instead of opacity:.6 on secondary text color |
| v20 | Fix: tile 1px→1.5px; off state bg .04→0, border .1→.35; popup off border .22→.40 |
| v19 | Fix: Lock/Climate/Trunk action button borders 1px→1.5px .7 |
| v18 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v17 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v16 | Light mode: CSS vars on off-state; @media light override |
| v15 | Final pass: all off-state bg .04→0, border .10/.22→.28 |
| v14 | OLED visibility pass: action button off border .12→.22, bg→0, off icon .28→.55 |
| v13 | `_patch()` added — battery bar, badges, and lock/climate/trunk button states update in-place |
| v12 | Padding consistency pass |
| v11 | Popup max-width normalized to 440px |
| v10 | Fixed once:true tap-outside listener; body scroll lock |
| v9 | Added steering wheel heat; popup sections conditionally hidden |
| v8 | Seat heating section |
| v7 | Climate controls section |
| v6 | Tire pressure section with `tire_warn_psi` |
| v5 | Temperature section |
| v4 | Popup portalled to document.body |
| v3 | Charge animation; charge rate and time-to-full inline |
| v2 | Full popup with battery and vehicle status |
| v1 | Initial release |

---

## tesla-commute-card

Expanded Tesla card for the Commute view. All commute-relevant data inline — battery, temperatures, climate, tire pressures, and quick-action buttons — no popup required.

### vs. compact tesla-card

| Section | Compact `tesla-card` | Expanded `tesla-commute-card` |
|---------|---------------------|-------------------------------|
| Battery | Bar + % + range | Large % + range + status |
| Temperatures | Popup only | Interior + exterior tiles always visible |
| Climate | Button only | Inline row with −/+ stepper + On/Off badge |
| Tires | Popup only | Always-visible 2×2 grid, red tile on warning |
| Lock/Trunk/Sentry | Popup | Action buttons |
| Odometer | Popup | Live reading on 4th action button |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ❌ | Vehicle nickname. Default `Magneton` |
| `tire_warn_psi` | number | ❌ | PSI below which tire tile turns red. Default `40` |
| `temp_unit` | string | ❌ | `F` or `C`. Default `F` |
| `entities` | object | ✅ | Entity ID map |

### Entity keys

| Key | Domain | Description |
|-----|--------|-------------|
| `battery_level` | `sensor` | SoC % |
| `battery_range` | `sensor` | Estimated range |
| `charging_state` | `binary_sensor` or `sensor` | Charging state |
| `door_lock` | `lock` | Door lock |
| `climate` | `climate` | HVAC — target temp stepper |
| `trunk` | `cover` | Trunk action button |
| `sentry_mode` | `switch` | Sentry action button |
| `odometer` | `sensor` | Live mileage |
| `interior_temperature` | `sensor` | Cabin temp |
| `exterior_temperature` | `sensor` | Outside temp |
| `tire_pressure_fl/fr/rl/rr` | `sensor` | Tire PSI |

### Example

```yaml
type: custom:tesla-commute-card
name: Magneton
tire_warn_psi: 40
temp_unit: F
entities:
  battery_level:        sensor.magneton_battery
  battery_range:        sensor.magneton_range
  charging_state:       binary_sensor.magneton_charging
  door_lock:            lock.magneton_doors
  climate:              climate.magneton_hvac_climate_system
  trunk:                cover.magneton_trunk
  sentry_mode:          switch.magneton_sentry_mode
  odometer:             sensor.magneton_odometer
  interior_temperature: sensor.magneton_temperature_inside
  exterior_temperature: sensor.magneton_temperature_outside
  tire_pressure_fl:     sensor.magneton_tpms_front_left
  tire_pressure_fr:     sensor.magneton_tpms_front_right
  tire_pressure_rl:     sensor.magneton_tpms_rear_left
  tire_pressure_rr:     sensor.magneton_tpms_rear_right
```

### Changelog

| Version | Changes |
|---------|---------|
| v15 | Odometer button now shows blue color and highlighted background when value is present — was always dim. Live patch updates odo color/border without re-render |
| v14 | Remove outer .card border/border-radius — borderless on Commute view |
| v13 | Fix: section dividers 1px .07 → 2px .22 — visible on low DPI wall display |
| v12 | Fix: .hdr border-bottom .28→.40 — more visible header divider |
| v12 | Fix: .hdr missing border-bottom — added 1.5px rgba(.28) |
| v11 | Fix: climate/lock badge borders 1px .3→1.5px .5 |
| v10 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v9 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v8 | Light mode: CSS vars on border/labels; @media light override |
| v7 | Final pass: action off border .10→.28 |
| v6 | OLED visibility pass: card border .10→.22, inner borders .08→.18, tile bg→0 |
| v5 | Removed hardcoded default `name: 'Magneton'` — defaults to empty string so cards without a name set don't show a stale vehicle name |
| v4 | Fixed ReferenceError: ents is not defined in `_patch()` |
| v3 | Climate temp display shows empty string when off |
| v2 | Climate badge shows HVAC mode name; tire pressures rounded to integer PSI |
| v1 | Initial release |

---

## charging-card

Unified EV charging card combining Tesla and Wallbox data. Placed below `tesla-commute-card` on the Commute view.

**Active:** pulsing blue status, battery progress bar with charge limit marker, live power (Wallbox kW), session energy (Wallbox kWh), charging speed in mi/h (Tesla).

**Not charging:** dim status, last session summary (energy, range, speed, current battery %).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ❌ | Vehicle nickname. Default `Magneton` |
| `wallbox_prefix` | string | ✅ | Wallbox entity prefix (e.g. `wallbox_beryl_pulsar_plus`) |
| `tesla` | object | ✅ | Tesla entity ID map |

### `tesla` keys

| Key | Domain | Description |
|-----|--------|-------------|
| `battery_level` | `sensor` | SoC % |
| `battery_range` | `sensor` | Estimated range |
| `charging_state` | `binary_sensor` or `sensor` | Charging state |
| `charge_rate` | `sensor` | Charging speed in mi/h |
| `time_to_full` | `sensor` | Time remaining to charge limit |
| `charge_limit` | `sensor` | Charge limit % — sets the progress bar tick |

### Wallbox entities (from `wallbox_prefix`)

| Suffix | Description |
|--------|-------------|
| `charging_power` | Live kW |
| `added_energy` | Session kWh |
| `added_range` | Session miles |
| `status_description` | Charger status text |

### Example

```yaml
type: custom:charging-card
name: Magneton
wallbox_prefix: wallbox_beryl_pulsar_plus
tesla:
  battery_level:  sensor.magneton_battery
  battery_range:  sensor.magneton_range
  charging_state: binary_sensor.magneton_charging
  charge_rate:    sensor.magneton_charging_rate
  time_to_full:   sensor.magneton_time_charge_complete
  charge_limit:   sensor.magneton_charge_limit
```

### Changelog

| Version | Changes |
|---------|---------|
| v12 | Remove outer .card border/border-radius — borderless on Commute view |
| v11 | Fix: section divider 1px .07 → 2px .22 — visible on low DPI wall display |
| v10 | Fix: banner bg .04→0, border-bottom-color .12→.45 |
| v9 | Low-DPI: idle dot 7px→9px, opacity .55→.75 |
| v8 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v7 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v6 | Light mode: CSS vars on border/header/stat-val; @media light override; header divider .07→.15 |
| v5 | Final pass: session-tile border .06→.18 |
| v4 | OLED visibility pass: card border .10→.22, inner borders .08→.18, idle dot .18→.55, tile bg→0 |
| v3 | New `charger_name` config param — replaces hardcoded `'Beryl Pulsar Plus'` in banner sub-label; `name` default changed from `'Magneton'` to `''` |
| v2 | Card name label: 15px → 17px white bold |
| v1 | Initial release |

---

## garage-door-card

Standalone compact garage door toggle. Single large button shows door state and opens/closes with one tap.

| State | Color | Action |
|-------|-------|--------|
| `closed` | Green | `cover.open_cover` |
| `open` | Blue | `cover.close_cover` |
| `opening` | Amber | Disabled (progress bar animates) |
| `closing` | Orange | Disabled (progress bar animates) |
| `stopped` / unknown | Gray | `cover.toggle` |

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | `cover.*` entity |
| `name` | ❌ | friendly_name | Override display name |

### Example

```yaml
type: custom:garage-door-card
entity: cover.garage_door
name: Garage
```

### Changelog

| Version | Changes |
|---------|---------|
| v14 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v13 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v12 | Light mode: CSS vars on border; @media light override block |
| v11 | OLED visibility pass: card border .10→.22, unknown state border .12→.22 |
| v10 | Fix: animation stutter during opening/closing — `set hass` now skips patch when state unchanged; `_patch()` triggers full re-render on canToggle change (adds/removes progress bar); selectors fixed to match rendered class names |
| v9 | Version header corrected — JS was at v8 but resources required v9 due to prior deploy |
| v8 | Version header corrected — JS was at v7 but resources required v8 due to prior deploy |
| v7 | Version header corrected — JS was at v7 but CARDS.md only had v6 |
| v6 | `_patch()` added — button color, label, and icon update in-place |
| v5 | Padding consistency pass |
| v4 | Touch audit: `-webkit-tap-highlight-color:transparent` |
| v3 | Entity ID updated to `cover.garage_door_door` |
| v2 | Improved icon set — unique SVG per state |
| v1 | Initial release |

---

## wallbox-card

Wallbox EV charger status card. Status, session energy, range added, live power and speed, max current drag slider, solar charging mode selector, and lock toggle.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prefix` | string | ✅ | Entity ID prefix (e.g. `wallbox_beryl_pulsar_plus`) |
| `name` | string | ❌ | Display name. Default `EV Charger` |

### Entity reference

| Entity | Description |
|--------|-------------|
| `sensor.<prefix>_status_description` | Human-readable status |
| `sensor.<prefix>_added_energy` | Session energy kWh |
| `sensor.<prefix>_added_range` | Range added miles |
| `sensor.<prefix>_charging_power` | Live power kW |
| `sensor.<prefix>_charging_speed` | Charge speed km/h |
| `sensor.<prefix>_max_available_power` | Max available current A |
| `number.<prefix>_maximum_charging_current` | Max current slider (6–48 A) |
| `lock.<prefix>_lock` | Charger lock |
| `select.<prefix>_solar_charging` | Solar mode: `off`, `eco_mode`, `full_solar` |

### Example

```yaml
type: custom:wallbox-card
prefix: wallbox_beryl_pulsar_plus
name: Wallbox Beryl Pulsar Plus
```

### Changelog

| Version | Changes |
|---------|---------|
| v13 | **Perf fix:** same document listener cleanup as ecoflow-card — `_docHandlers` array + `disconnectedCallback` |
| v12 | Remove outer .card border/border-radius — borderless on Energy view |
| v11 | Fix: section divider 1px .07 → 2px .22 — visible on low DPI wall display |
| v10 | Fix: sbanner header divider always white .40 (removed dynamic color override); boost .35→.40 |
| v10 | Fix: sbanner inline border-bottom-color .2→.45; CSS fallback .28→.35 |
| v9 | Fix: sbanner dynamic border-bottom-color .2→.45 |
| v8 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v7 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v6 | Light mode: CSS vars on border/header/stat-val; @media light override; dynamic bg→0/border→.35; header divider .07→.15 |
| v5 | Final pass: stat-tile bg .04→0/border→.22; section border-top .06→.15 |
| v4 | OLED visibility pass: card border .10→.22, inner borders .08→.18 |
| v3 | Card name label: 15px → 17px white bold |
| v2 | Touch audit: `-webkit-tap-highlight-color:transparent` on ctrl-row and mode-opt buttons |
| v1 | Initial release |

---

## peco-card

PECO / Opower utility energy card. Electric usage vs forecast with progress bar, forecasted bill, cost to date, and typical monthly comparisons. Optional gas section.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `electric_prefix` | string | ✅ | Entity prefix for electric sensors (e.g. `peco_electric`) |
| `gas_prefix` | string | ❌ | Entity prefix for gas sensors. Section hidden if unavailable. |
| `name` | string | ❌ | Display name. Default `PECO Electric` |

### Entity reference

| Entity | Description |
|--------|-------------|
| `sensor.<electric_prefix>_current_bill_electric_usage_to_date` | kWh used this period |
| `sensor.<electric_prefix>_current_bill_electric_forecasted_usage` | Forecasted total kWh |
| `sensor.<electric_prefix>_current_bill_electric_cost_to_date` | Cost to date |
| `sensor.<electric_prefix>_current_bill_electric_forecasted_cost` | Forecasted total cost |
| `sensor.<electric_prefix>_typical_monthly_electric_usage` | Historical typical monthly kWh |
| `sensor.<electric_prefix>_typical_monthly_electric_cost` | Historical typical monthly cost |
| `sensor.<electric_prefix>_last_updated` | Last data update timestamp |
| `sensor.<gas_prefix>_current_bill_gas_usage_to_date` | CCF used (optional) |
| `sensor.<gas_prefix>_current_bill_gas_forecasted_usage` | Forecasted CCF (optional) |
| `sensor.<gas_prefix>_current_bill_gas_cost_to_date` | Gas cost to date (optional) |

### Example

```yaml
type: custom:peco-card
electric_prefix: peco_electric
gas_prefix: peco_gas
name: PECO Electric
```

### Changelog

| Version | Changes |
|---------|---------|
| v10 | Remove outer .card border/border-radius — borderless on Energy view |
| v9 | Fix: divider height 1px→2px, opacity .07→.22 |
| v8 | Fix: sbanner border-bottom 1px .1→1.5px .35 |
| v7 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v6 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v5 | Light mode: CSS vars on border; @media light override block |
| v4 | OLED visibility pass: card border .10→.22 |
| v3 | Card name label: 15px amber → 17px white bold |
| v2 | Removed amber tinted background from outer `.card` container |
| v1 | Initial release |

---

## ecoflow-card

Ecoflow River 2 Pro power station card. Battery level and health, live power flows (AC in, solar in, AC out, DC out), max charge level slider, battery temperature and cycle count, AC/DC output toggles.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prefix` | string | ✅ | Entity ID prefix (e.g. `river_2_pro`) |
| `name` | string | ❌ | Display name. Default `River 2 Pro` |

### Entity reference

| Entity | Description |
|--------|-------------|
| `sensor.<prefix>_battery_level` | Battery % |
| `sensor.<prefix>_state_of_health` | Battery health % |
| `sensor.<prefix>_cycles` | Charge cycle count |
| `sensor.<prefix>_battery_temperature` | Battery temp °F |
| `sensor.<prefix>_status` | Online/offline status |
| `sensor.<prefix>_ac_in_power` | AC input watts |
| `sensor.<prefix>_ac_out_power` | AC output watts |
| `sensor.<prefix>_solar_in_power` | Solar input watts |
| `sensor.<prefix>_dc_out_power` | DC 12V output watts |
| `sensor.<prefix>_charge_remaining_time` | Minutes until full |
| `sensor.<prefix>_discharge_remaining_time` | Minutes of runtime remaining |
| `number.<prefix>_max_charge_level` | Max charge level slider (50–100%) |
| `switch.<prefix>_ac_enabled` | AC output toggle |
| `switch.<prefix>_dc_12v_enabled` | DC 12V output toggle |

### Example

```yaml
type: custom:ecoflow-card
prefix: river_2_pro
name: River 2 Pro
```

### Changelog

| Version | Changes |
|---------|---------|
| v10 | **Perf fix:** added `disconnectedCallback` — document-level drag handlers (mousemove/touchmove/mouseup/touchend) now stored in `_docHandlers` and removed on disconnect, preventing memory leak during long wall-panel sessions |
| v9 | Remove outer .card border/border-radius — borderless on Energy view |
| v8 | Fix: section divider height 1px→2px, opacity .07→.22 |
| v7 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v6 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v5 | Light mode: CSS vars on border/header; @media light override; header divider .07→.15 |
| v4 | OLED visibility pass: card border .10→.22, inner borders .08→.18, tile bg→0 |
| v3 | Card header: 10px uppercase → 17px white bold |
| v2 | Added `.ha-tap` class with `scale(0.96)/brightness(0.9)` `:active` states |
| v1 | Initial release |

---

## now-playing-card

Compact now-playing widget for the home view. Shows active media players with title, source app, and room name. Collapses to an invisible empty card when all players are idle.

Tapping an active player opens the HA more-info dialog.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `players` | list | ✅ | List of `{ entity, name }` media player definitions |

### Example

```yaml
type: custom:now-playing-card
players:
  - entity: media_player.family_room
    name: Family Room
  - entity: media_player.master_bedroom
    name: Master Bedroom
  - entity: media_player.office
    name: Office
```

### Changelog

| Version | Changes |
|---------|---------|
| v11 | Fix: album art border 1px .2→1.5px .40 |
| v10 | Low-DPI: idle dot 6px→9px, opacity .55→.75 |
| v9 | Wall display fix: all borders boosted to 1.5px thickness; outer card borders .22→.40, inner tile borders .18→.30, section dividers .07/.15→.18/.28 — physically thicker lines visible on lower-DPI displays |
| v8 | Fix: borders reverted to hardcoded rgba — CSS vars were being overridden by Amoled+ theme making all borders invisible; CSS vars now only in @media light block |
| v7 | Light mode: CSS vars on border/header; @media light override; header divider .07→.15 |
| v6 | Final pass: player divider .06→.18, idle row border .05→.18 |
| v5 | OLED visibility pass: idle dot .20→.55 |
| v4 | `_patch()` added — title, source, and state update per player; full re-render only when active player count changes |
| v3 | Card header: 10px uppercase → 17px white bold |
| v4 | `_patch()` added — player title, source, and play/pause state update in-place; re-renders only when active count changes |
| v2 | Touch audit: `user-select:none` on tappable elements |
| v1 | Initial release |

---

## appletv-remote-card

Apple TV remote control card with multi-ATV selector tabs, 200px D-pad, two rows of navigation and playback buttons, volume slider, and sleep/power button.

**Config:**
```yaml
type: custom:appletv-remote-card
apple_tvs:
  - name: Family Room
    media_player: media_player.family_room_apple_tv
    remote: remote.family_room_apple_tv
  - name: Bedroom
    media_player: media_player.bedroom_apple_tv
    remote: remote.bedroom_apple_tv
  - name: Office
    media_player: media_player.office_apple_tv
    remote: remote.office_apple_tv
```

**Features:**
- Selector tabs at top switch active ATV — single card instance controls all three
- Now playing strip shows current title, app source, and play/pause state
- 200px D-pad ring with large touch targets (76×76px per direction zone)
- Row 1 buttons: Menu, Back, Home, Play/Pause
- Row 2 buttons: Previous, Next, Vol+, Vol−
- Drag or tap volume slider; slider debounced 150ms before service call
- Sleep/Power button calls `media_player.turn_off` on active ATV
- `_patch()` updates now-playing strip and volume without full re-render
- Document-level drag listeners cleaned up in `disconnectedCallback()`

**Changelog:**

| v1 | Initial release — multi-ATV tabs, 200px D-pad, transport + volume + power |

---

## homepod-music-card

HomePod speaker group management + music control card with now playing, progress bar, transport controls, per-speaker grouping toggles, group volume slider, and configurable favorites grid.

**Config:**
```yaml
type: custom:homepod-music-card
speakers:
  - entity: media_player.family_room_homepod
    name: Family Room
  - entity: media_player.kitchen_homepod
    name: Kitchen
  - entity: media_player.bedroom_homepod
    name: Bedroom
favorites:
  - name: Morning
    icon: 🌅
    media_content_id: "music://playlist/morning"
    media_content_type: music           # optional, defaults to music
  - name: Focus
    icon: 🎯
    media_content_id: "music://playlist/focus"
  - name: Workout
    icon: 💪
    media_content_id: "music://playlist/workout"
```

**Features:**
- First speaker in list is the group coordinator
- Speaker toggle: ON calls `media_player.join` (adds to coordinator group), OFF calls `media_player.unjoin`
- Group volume slider adjusts all currently-grouped speakers proportionally
- Progress bar auto-advances every 5s while playing (no extra HA polling)
- Shuffle and repeat buttons toggle state with active highlight
- Favorites grid: 4-column, 1–2 rows, configurable name + emoji icon
- Favorites call `media_player.play_media` on the coordinator entity
- All volume changes debounced 150ms before service call
- Document-level drag listeners cleaned up in `disconnectedCallback()`

**Getting Apple Music playlist URIs:**
Use a Shortcut on iPhone: Shortcuts app → New Shortcut → Get Current Song → Get Details of Music → Copy to Clipboard. Play the playlist you want, run the shortcut, paste the URI into config.

**Changelog:**

| v1 | Initial release — now playing, speaker grouping, group vol, favorites |

---

## recently-added-card

Standalone recently-added media card showing the most recently imported movies and TV episodes from Radarr and Sonarr REST sensors. Extracted from `technology-card` (section: recently_added).

**Config:**
```yaml
type: custom:recently-added-card
sonarr_sensor: sensor.sonarr_recent    # default
radarr_sensor: sensor.radarr_recent    # default
max_items: 5                           # default
```

**REST sensor setup (configuration.yaml):**
```yaml
rest:
  - resource: "http://SONARR_IP:8989/api/v3/history?pageSize=10&includeSeries=true&includeEpisode=true"
    headers:
      X-Api-Key: !secret sonarr_api_key
    scan_interval: 300
    sensor:
      - name: "Sonarr Recent"
        value_template: "{{ value_json.records | length }}"
        json_attributes_path: "$"
        json_attributes: ["records"]
  - resource: "http://RADARR_IP:7878/api/v3/history?pageSize=10&includeMovie=true"
    headers:
      X-Api-Key: !secret radarr_api_key
    scan_interval: 300
    sensor:
      - name: "Radarr Recent"
        value_template: "{{ value_json.records | length }}"
        json_attributes_path: "$"
        json_attributes: ["records"]
```

**Important:** Sonarr URL must include `includeSeries=true&includeEpisode=true` otherwise episode numbers won't resolve and 3 episodes of the same show will collapse to 1 entry.

**Features:**
- Merges TV (Sonarr) and Movie (Radarr) records, sorted by import date
- Deduplicates by full title+episode string
- Title resolution priority: `series.title` → `seriesTitle` → `title` → path extraction → filename scrub
- Episode numbers from `r.episode` (Sonarr v3 singular) with fallback to `r.episodes[0]`
- Only re-renders when sensor `last_updated` changes — no wasted DOM work

**Changelog:**

| v1 | Initial release — extracted from technology-card section:recently_added |

---

## jellyseerr-card

Jellyseerr search and request card. Search for movies and TV shows via the Jellyseerr API and submit requests directly from the dashboard.

**Config:**
```yaml
type: custom:jellyseerr-card
url: http://192.168.1.x:5055          # Jellyseerr base URL, no trailing slash
api_key: !secret jellyseerr_api_key   # Settings → General → API Key
power_entity: switch.unraid_seerr     # optional — shows server online dot
max_results: 5                        # optional, default 5
```

**Features:**
- Search debounced 400ms — fires after user stops typing
- Results show movie or TV type badge, year, and request button
- Already-requested items show status badge instead of Request button: Pending / Processing / Partial / Available
- Optional server status dot (green/red) driven by any HA switch or binary_sensor
- Requests movies with `mediaType: movie`; TV shows with `seasons: all`
- Clear button (✕) resets search and results instantly
- All API calls use `X-Api-Key` header (no cookie auth)

**Request status codes:**
| Code | Label | Color |
|------|-------|-------|
| 2 | Pending | Amber |
| 3 | Processing | Blue |
| 4 | Partial | Purple |
| 5 | Available | Green |

**Changelog:**

| v1 | Initial release — search, request, status badges, optional power entity |

---

## ps5-card

PlayStation 5 status card showing power state, current game, and wake/power controls. Uses the ha-playstation HACS integration.

**Config:**
```yaml
type: custom:ps5-card
media_player: media_player.playstation_5
name: PlayStation 5                    # optional display name
```

**Setup:** Install `ha-playstation` via HACS, then add the integration under Settings → Integrations.

**Features:**
- Status badge: On (green) / Off (gray) / Unavailable (dim)
- Current game tile shows `media_title` attribute; falls back to `app_name` then "Home screen"
- Wake button enabled only when PS5 is off/standby (`media_player.turn_on`)
- Turn Off button enabled only when PS5 is on (`media_player.turn_off`)
- Disabled buttons use `pointer-events: none` + reduced opacity — no double-fire
- Busy lock (2s) prevents rapid repeated service calls

**Changelog:**

| v1 | Initial release — status, current game, wake/power with busy lock |

---

## steam-card

Steam online status card showing current game and online status per account. Uses the built-in HA Steam integration — no HACS required.

**Config:**
```yaml
type: custom:steam-card
accounts:
  - entity: sensor.steam_123456789
    name: John                         # optional — falls back to profile_name attribute
  - entity: sensor.steam_987654321
    name: Friend
```

**Setup:**
1. Get a free API key at https://steamcommunity.com/dev/apikey
2. HA → Settings → Integrations → Add → Steam
3. Set your Steam friends list to Public during initial setup (can revert after)

**Steam sensor states:**
| State | Meaning |
|-------|---------|
| `in_game` | Playing a game (`game` attribute has title) |
| `online` | Online but not in game |
| `offline` | Offline (`last_online` attribute has ISO timestamp) |

**Features:**
- `in_game`: blue badge + game title in blue
- `online`: green badge
- `offline`: gray badge + "Last seen Xh ago" from `last_online` attribute
- Falls back to `profile_name` attribute if `name` not set in config
- `_patch()` replaces only changed account rows, not full re-render

**Changelog:**

| v1 | Initial release — online status, current game, last seen time |

---


---

## kiosk-displays-card

Wall-panel display control. One row per kiosk — on/off toggle, five brightness pips (20/40/60/80/100), and a schedule countdown showing when the display will next dim or wake. Sleep banner appears when all displays are off with a single-tap "Wake both" action. Quick actions: Both off, Both on, Night (configurable brightness).

Pairs with `kiosk-health-card` and `kiosk-voice-card` — each card is independent and placeable anywhere in a dashboard layout.

### Config

```yaml
type: custom:kiosk-displays-card
displays:
  - name: Front Door
    entity:  light.kiosk_front_door_display   # HA template light
    dim_at:  "22:00"                          # optional — schedule label
    wake_at: "07:00"                          # optional — schedule label
  - name: Garage
    entity:  light.kiosk_garage_display
    dim_at:  "22:00"
    wake_at: "07:00"
night_brightness: 20    # optional — Night button target (default 20)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `displays` | list | ✅ | One entry per kiosk display |
| `displays[].name` | string | ✅ | Label shown in the card |
| `displays[].entity` | string | ✅ | HA template light entity ID |
| `displays[].dim_at` | string | ❌ | Time to show on dim schedule label (HH:MM) |
| `displays[].wake_at` | string | ❌ | Time to show on wake schedule label (HH:MM) |
| `night_brightness` | int | ❌ | Brightness % for Night action (default 20) |

**Changelog:**

| v1 | Initial release |

---

## kiosk-health-card

Read-only monitoring card for kiosk display health. Four tiles: one per display showing API status and Pi CPU temperature, a touch-to-wake grab state tile, and a last-tap tile. Pairs with `kiosk-displays-card`.

### Config

```yaml
type: custom:kiosk-health-card
displays:
  - name: Front Door
    health_sensor: sensor.kiosk_front_door_api_health    # required
    screen_state:  sensor.kiosk_front_door_screen_state  # optional
    temp_sensor:   sensor.kiosk_front_door_cpu_temp      # optional
  - name: Garage
    health_sensor: sensor.kiosk_garage_api_health
    screen_state:  sensor.kiosk_garage_screen_state
    temp_sensor:   sensor.kiosk_garage_cpu_temp
```

| Option | Type | Required | Description |
|---|---|---|---|
| `displays` | list | ✅ | One entry per kiosk display |
| `displays[].name` | string | ✅ | Label shown in the tile |
| `displays[].health_sensor` | string | ✅ | REST health sensor (value: `ok` or error) |
| `displays[].screen_state` | string | ❌ | Screen state sensor — exposes `touch_grab` and `last_activity` attributes |
| `displays[].temp_sensor` | string | ❌ | Pi CPU temperature sensor |

**Changelog:**

| v1 | Initial release |

---

## kiosk-voice-card

Voice satellite monitoring and control. One row per satellite showing online/listening/muted/pending state, mic mute toggle, TTS speaker volume pips (25/50/75/100), and last wake phrase. Section actions: Mute all, Unmute all, Night vol (configurable target).

Designed to work before satellites are configured — rows show "Pending setup" gracefully when entities are absent. Wire up entities progressively as satellites come online.

### Config

```yaml
type: custom:kiosk-voice-card
satellites:
  - name: Family Room
    ip: 192.168.1.210                                      # shown in card UI
    mute_entity:      switch.family_room_sat_mute          # optional
    volume_entity:    number.family_room_sat_volume        # optional (0-100)
    state_entity:     binary_sensor.family_room_sat_listening  # optional
    last_wake_entity: sensor.family_room_sat_last_wake     # optional
  - name: Bedroom
    ip: 192.168.1.211
    mute_entity:      switch.bedroom_sat_mute
    volume_entity:    number.bedroom_sat_volume
    state_entity:     binary_sensor.bedroom_sat_listening
    last_wake_entity: sensor.bedroom_sat_last_wake
night_volume: 25     # optional — Night vol target (default 25)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `satellites` | list | ✅ | One entry per voice satellite |
| `satellites[].name` | string | ✅ | Display name |
| `satellites[].ip` | string | ❌ | IP address shown in row |
| `satellites[].mute_entity` | string | ❌ | Switch entity for mic mute |
| `satellites[].volume_entity` | string | ❌ | Number entity for TTS volume (0-100) |
| `satellites[].state_entity` | string | ❌ | Binary sensor for listening state |
| `satellites[].last_wake_entity` | string | ❌ | Sensor for last wake phrase |
| `night_volume` | int | ❌ | Volume % for Night vol action (default 25) |

### Satellite states

| State | Condition | Avatar colour |
|---|---|---|
| Pending setup | No entities configured | Dim |
| Idle | Mic on, not listening | Green |
| Active / Listening | `state_entity` is `on` | Blue pulse |
| Muted | `mute_entity` is `on` | Red |

**Changelog:**

| v1 | Initial release |



---

## network-devices-card

Network infrastructure monitoring card. Shows UniFi gateway stats, managed switch port grids with PoE budget bars, a PoE port control popup, unmanaged switches as compact pills, and optional coming-soon pending tiles.

### Config

```yaml
type: custom:network-devices-card
gateway:
  name: UniFi Dream Machine
  ip: 192.168.1.1                              # shown in card
  latency_sensor:  sensor.udm_ping_latency     # ms — green <20, amber <60, red ≥60
  uptime_sensor:   sensor.udm_uptime           # seconds or pre-formatted string
  clients_sensor:  sensor.unifi_clients_total
  wan_ip_sensor:   sensor.wan_ip               # optional — masked to xx.xx.xxx.xxx
  wan_sensor:      binary_sensor.wan_online    # optional — WAN dot state

managed_switches:
  - name: USW-24-PoE
    ip: 192.168.1.2
    description: 24 port · PoE+
    uptime_sensor:   sensor.usw24_uptime        # optional
    ports_up:        18                         # count (int) or sensor entity ID
    ports_down:      4
    ports_sfp:       2
    poe_used_sensor: sensor.usw24_poe_power     # watts
    poe_budget:      100                        # watts total
    poe_ports:                                  # opens PoE popup with toggles
      - port: 3
        name: Front Door Kiosk
        entity: switch.usw24_port_3_poe         # switch entity
        power_sensor: sensor.usw24_port_3_power # optional watts
        speed: "1000 Mbps"                      # optional static label

unmanaged_switches:
  - name: USW-Flex · Office
    ip: 192.168.1.4
    ports: 5                                    # optional — shown in pill
    online_sensor: binary_sensor.flex_office    # optional

pending:                                        # optional coming-soon tiles
  - name: Pi-hole
    sub: DNS · block rate
  - name: UPS
    sub: Battery · runtime
```

### PoE popup

Tapping "PoE ports" on any managed switch opens a portal popup showing each configured PoE port with a left-accent-bar row (green = on, amber = high draw >10W, dim = off), wattage, link speed, and a toggle switch. The popup updates live while open.

**Changelog:**

| v1 | Initial release |

---

## piscsi-card

PiSCSI / RaSCSI monitoring via direct REST API — no HA integration needed. Polls the PiSCSI web API every 30s (configurable). Shows daemon status, SCSI device rows with image names, drive type badges, and an eject button with confirmation overlay.

### Config

```yaml
type: custom:piscsi-card
host: 192.168.1.x        # required — PiSCSI IP or hostname
port: 3000               # optional — default 3000
name: Color Classic      # optional — machine name shown in header
poll_interval: 30        # optional — seconds (min 10, default 30)
```

### SCSI device display

| Type code | Badge | Accent |
|---|---|---|
| SCHD | HD | Green |
| SCCD | CD | Blue |
| SCRM / SCMO | MO | Purple |
| SCBR / SCDP | BR / NET | Amber |

Empty SCSI IDs show dimmed "No image mounted" with a disabled eject button.

### Eject flow

1. Tap eject button on a mounted device
2. Confirmation overlay appears with image name and safety reminder
3. Confirm → `DELETE /api/v1/devices/{id}` called, re-poll on completion
4. Cancel → overlay dismissed, no action

### Security

- `host` must match `[a-zA-Z0-9._-]{1,253}` — rejects any malformed input at `setConfig` time
- SCSI IDs validated as integers 0–7 before any API call
- API response filenames inserted via `textContent` (never `innerHTML`)
- Busy lock prevents double-tap eject

**Changelog:**

| v1 | Initial release |

