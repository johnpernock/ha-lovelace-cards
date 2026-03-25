# room-controls-card

The main room control card. A single card definition renders all rooms in your home — each room row is built dynamically based on what you configure. Lights, fans, blinds, thermostat, sensors, and garage door all live in one place.

Designed for a 1200×800 wall-mounted display but fully functional on mobile.

---

## How it works

### Rendering

On first load the card does a full render into its shadow DOM. On every subsequent `hass` update it calls `_patch()` instead — this updates only changed values (brightness slider position, temperatures, fan pips, mode button, toggle states) without destroying the DOM or re-attaching event listeners. This is why the +/- temperature buttons and fan pips keep working reliably after HA pushes state changes.

### Popup portalling

All popups (lights detail, blind position, thermostat controls) are injected directly into `document.body` rather than staying inside the shadow DOM. This avoids the popup being clipped by Home Assistant's CSS transforms. The portal container is `position:fixed;inset:0` and the overlay inside is `position:absolute;inset:0`. All popup CSS lives in the portal's own `<style>` block, not in the card's shadow DOM styles.

### Room rows

Each room renders a header (name + door pills) followed by whatever rows are configured:

| Row | Visible when |
|-----|-------------|
| Lights | `lights:` defined |
| Fans | `fans:` list non-empty |
| Blinds | `blinds:` defined |
| Thermostat | `thermostat:` defined |
| Sensor | `sensor:` defined and no thermostat |
| Garage | `garage:` defined |

The room **header** always shows the room name, door pills (if configured), and the on/off toggle. When a thermostat is configured, the header also shows compact **temperature pills** to the right of any door pills:
- **Thermostat pill** — mode dot (colour matches HVAC mode) + current temp + setpoint (e.g. `● 68° → 70°`). Neutral/dim when off, orange-tinted when active.
- **Sensor pill** — bare sensor reading in blue (e.g. `68°`). Only shown when `thermostat.sensor` is configured, giving a separate room temp reading alongside the thermostat.

### Simplified rooms

`simplified: true` collapses the lights row to a count badge in the header (e.g. "3 / 5 on") with a chevron. Tapping the header opens the full lights popup. Good for bathrooms and utility rooms where you just need a quick on/off overview.

### Fan speed resolution

Priority order:
1. YAML `speeds:` — always wins if you set it
2. `percentage_step` entity attribute — speed steps = `round(100 ÷ step)`, total pips = steps + 1 (off)
3. `speed_count` entity attribute — total pips = count + 1 (off)
4. Default: 5 (off + 4 speeds)

`speeds:` in YAML is the **total pip count including off** — e.g. `speeds: 5` gives off + 4 speed pips. Most fans with a reliable `percentage_step` do not need `speeds:` set at all. Only white-series preset-mode fans need it hardcoded.

### Light color modes

CT presets are filtered to the bulb's `min_color_temp_kelvin` / `max_color_temp_kelvin` range. RGB color presets only appear if at least one individual bulb reports `color` or `rgb_color` in `supported_color_modes`. The chevron is hidden if no color-capable bulbs exist in the room.

---

## Parameters

### Top-level

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `rooms` | ✅ | — | List of room objects |
| `ct_presets` | ❌ | 4 built-in | Color temperature preset buttons in lights popup. Each entry: `label`, `kelvin`, `color` (hex swatch) |
| `color_presets` | ❌ | 4 built-in | RGB color preset buttons. Each entry: `label`, `rgb` ([r,g,b]), `color` (hex) |

### Room object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `id` | ✅ | — | Unique key for this room (no spaces — used as DOM ID prefix) |
| `name` | ✅ | — | Display name in the room header |
| `simplified` | ❌ | `false` | Collapse lights to a count badge + header chevron |
| `lights` | ❌ | — | Lights config (see below) |
| `fans` | ❌ | — | List of fan objects |
| `blinds` | ❌ | — | Blinds config |
| `thermostat` | ❌ | — | Thermostat config |
| `sensor` | ❌ | — | Plain temperature sensor (shown only if no thermostat) |
| `garage` | ❌ | — | Garage door config |
| `door` | ❌ | — | Single door sensor — pill in the room header |
| `doors` | ❌ | — | Multiple door sensors — pills in the header |

### Lights object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Main group/area light entity |
| `individuals` | ❌ | `[]` | List of `{ entity, name }` — shown as individual sliders in the popup |
| `no_popup` | ❌ | `false` | Skip the popup — tapping just toggles the group |

### Fan object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Fan entity |
| `name` | ❌ | friendly_name | Label shown left of the pips |
| `speeds` | ❌ | Auto-detected | Number of speed steps excluding off. Set this explicitly for Lutron Caseta. |

### Blinds object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Cover entity |
| `max_position` | ❌ | `100` | Maximum open position — the open tap and popup slider target this value |

### Thermostat object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Climate entity |
| `name` | ❌ | friendly_name | Label on the mode button |
| `sensor` | ❌ | — | Separate temperature sensor — shows as a plain blue temp pill in the room header. Only show if different from the thermostat entity (e.g. a room sensor vs a split-system thermostat). |
| `sensor_label` | ❌ | — | Label for the sensor (used in the inline thermostat block, not in the header pill). |

### Sensor object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Any sensor whose state is a number |

### Garage object

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Cover entity for the garage door |

### Door pill (single)

```yaml
door:
  entity: binary_sensor.front_door
  name: Entry
```

### Door pills (multiple)

```yaml
doors:
  - entity: binary_sensor.front_door
    name: Front
  - entity: binary_sensor.back_door
    name: Back
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v72 | Fixed pp-lrow flex-direction was column — changed to row so dot/name/slider/pct/chevron all sit on one horizontal line; dot size 9→11px |
| v71 | Individual light rows in popup: borders/backgrounds removed; dot indicator (amber=on, grey=off) added left of name; flat single row with divider lines; slider and chevron inline |
| v72 | Fixed pp-lrow flex-direction was column — changed to row so dot/name/slider/pct/chevron all sit on one horizontal line; dot size 9→11px |
| v71 | Popup individual light rows: removed bordered box, added color dot before name (reflects current rgb/CT/on state), flat single row layout with name+slider+pct+chevron. Added _lightDotColor() helper that maps rgb_color and color_temp_kelvin to a display color. |
| v70 | v70 | Popup improvements: expand chevrons bare (no box); off individual lights dimmed to 65% opacity; pct hidden when off; subtitle "X of Y on" → "X / Y"; sheet max-width 500→440px |
| v72 | Fixed pp-lrow flex-direction was column — changed to row so dot/name/slider/pct/chevron all sit on one horizontal line; dot size 9→11px |
| v71 | Individual light rows in popup: borders/backgrounds removed; dot indicator (amber=on, grey=off) added left of name; flat single row with divider lines; slider and chevron inline |
| v72 | Fixed pp-lrow flex-direction was column — changed to row so dot/name/slider/pct/chevron all sit on one horizontal line; dot size 9→11px |
| v71 | Popup individual light rows: removed bordered box, added color dot before name (reflects current rgb/CT/on state), flat single row layout with name+slider+pct+chevron. Added _lightDotColor() helper that maps rgb_color and color_temp_kelvin to a display color. |
| v70 | Individual lights in popup: removed border/background; name now uppercase label above slider row; slider thumb min 4%; pct empty when off; expand chevron moved to name row right |
| v69 | Popup sheet header: added top padding (was 0); title 16px→17px white bold matching dashboard style |
| v68 | Fixed: All Lights expand chevron was missing data-room attribute so rid was undefined and the expand block never toggled |
| v67 | Color/CT expand now checks master group entity first — HA light groups report their own supported_color_modes so the expand arrow appears even when some individuals are plain dimmers or switches |
| v66 | v66 | Overlays: body scroll lock added to _openOverlay and _closeOverlay |
| v65 | Added "Blinds" and "Garage" sec-hdr labels above those sections |
| v64 | Removed "Fans" section header — fan name labels above each pip row are sufficient |
| v63 | Theme area buttons dim when off: opacity 0.5, lower background and border opacity |
| v62 | All Lights slider no longer dims when off — opacity removed from initial render and patch cycle |
| v61 | Thermostat block auto-hides when entity does not exist in HA states — no config change needed |
| v60 | Thermostat block: removed grey backgrounds from tstat-block base and tstat-off state. +/− adj buttons background transparent (border only). Slider thumb minimum position capped at 4% |
| v59 | Reverted fan section: always show "Fans" sec-hdr + each fan name label |
| v58 | Reverted to always show Fans header with individual fan name labels |
| v57 | No card background (transparent, border rgba(.12)); room name 17px white bold (17px, letter-spacing); speed pip buttons show N dots matching speed — 1/2/3 dots in a row, 4 dots in 2×2 grid |
| v56 | Popup master block matches inline view: toggle and count text removed, slider spans full width with thumb capped at 96%, left accent bar replaced with subtle full border, "All Lights" sec-hdr label added above slider |
| v55 | Cache bust — no code changes |
| v54 | Toggle pill-shaped: border-radius changed from 8px to 99px; thumb border-radius changed from 4px to 50% (circular) |
| v53 | All Lights slider: border and background removed — sits flat with no container styling; padding reduced to vertical only |
| v52 | Left accent bar removed from All Lights slider — replaced with subtle full border; border-radius changed to 8px all round |
| v51 | Added "Lights" and "Thermostat" section headers (small uppercase labels) above each section for clarity |
| v50 | Slider thumb capped at 96% left — no longer overlaps popup chevron at full brightness. Switch entities filtered from color/CT support check so rooms with mixed light+switch entities correctly show color expand |
| v49 | Theme area buttons: removed wrapper padding/border/background — buttons fill full card width via rbody padding; inactive button bg raised to .05 opacity for visibility |
| v48 | Theme block redesigned: slider bar rows replaced with 4-column tap button grid. Color dots above label, subtle border when area is on |
| v47 | Light row left padding increased 9→14px — slider now has breathing room from accent bar |
| v46 | Sensor temp pill removed from inline thermostat body (still in header pill). light-row left padding adjusted for flush border-left. Removed duplicate `let sensor` declaration |
| v45 | rbody horizontal padding 0→10px; blind-pill and garage-status side margins removed; light-row margin-top added; itog-lbl ellipsis; climate temp display empty when off |
| v44 | Light/fan layout fixes: individual light buttons span full card width (padding on container, no side margin); All Lights label removed from slider row; individual light tiles font 11→12px, gap 6→8px, padding 9→10px for easier mobile reading |
| v43 | Fan name moved above buttons as small uppercase label; buttons now span full row width |
| v42 | Fan pips replaced with dot tap buttons — teal dot when active, "Off" text on pip 0, full-width flex layout, name above. Individual light toggle grid added below master bar (3-col amber dots, live-patched). Thermostat controls right-aligned: mode badge left, adj buttons pushed right with margin-left:auto. Popup drawers: opening one closes all others. |
| v41 | CT (white temp) presets also switched to 2-column grid |
| v40 | Color presets 2-column grid everywhere (all-lights and per-light popup) |
| v39 | Header sensor pill: bare blue temp reading shown when `thermostat.sensor` is configured |
| v38 | Header sensor pill added — `thermostat.sensor` value appears in header (with text label, superseded by v39) |
| v37 | Header thermostat pill: compact `● cur° → set°` pill in room header with mode dot. Inline thermostat shrunk (34px adj buttons, 24px cur temp) for mobile. |
| v36 | Fixed room-toggle not firing — `_togHtml` now sets `data-room` attribute derived from element ID |
| v35 | Fan pip count off by 1 — `_fanSpeeds()` now returns `round(100/step) + 1` to include off pip. Dashboard speeds configs updated. |
| v34 | Popup portalling to `document.body` — fixes clipped/scaled popups on HA dashboards with CSS transforms |
| v33 | `set hass` now calls `_patch()` instead of `_render()` — fixes +/− temp buttons and fan pips stopping after first hass update |
| v32 | Fixed fan pip click not registering — `closest('[data-action]')` returned null for pip divs; added explicit `closest('.fpip')` check |
| v31 | Fixed popup not opening — `.hidden { display:none!important }` blocked `style.display='flex'`; switched to `classList.remove('hidden')` |
| v30 | Fixed config mutation crash — `room._simplifiedMeta` mutated HA's frozen config object; moved state to `this._simplifiedMeta[room.id]` |
| v28 | Fixed fan SVG signal icon not refreshing in patch — now calls `pip.innerHTML = this._signal(...)` when active pip changes |
| v27 | Fixed garage pill showing "Unknown" at startup — added handling for `unavailable` and `stopped` states |
| v26 | Fixed Lutron Caseta fan pip count — `speed_count: 2` was overriding YAML `speeds: 4`; corrected priority order |
| v24 | Fixed HVAC cycling to unsupported modes — now reads live `hvac_modes` attribute instead of filtering a static list |
| v22 | Fixed light popup CSS not rendering — popup HTML is portalled outside shadow DOM; moved all popup CSS to portal `<style>` block |
| v20 | Added blind status pill (green=closed, amber=open, blue=moving) and garage status pill |
| v18 | Added door sensor pills in room header (`door:` and `doors:` config) |
| v16 | Added `simplified: true` and `no_popup: true` |
| v14 | Left accent bars on all rows; removed outer room card border |
| v12 | Inline drag sliders with 150ms debounce replaced click-to-set brightness |
| v10 | Added `sensor:` row for plain temperature |
| v8 | Added thermostat row with inline −/+ and mode cycling |
| v6 | Added blinds row |
| v4 | Added fan pips with signal-bar design |
| v2 | Added lights row with master toggle and brightness bar |
| v1 | Initial release |

---

### `theme_block` object

Optional. Adds a holiday/schedule indicator block above the lights row. Reads from a `sensor.outdoor_lighting_theme` template sensor (see `ha-config/outdoor-lighting-theme-sensor.yaml`).

When the sensor state is `Default` the block shows "🌙 Default Schedule / Warm white". When a holiday is active it shows the holiday name, emoji, accent color, and a row per configured area with color swatches, a gradient fill bar, and on/off/brightness state.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sensor` | string | ✅ | Entity ID of the outdoor lighting theme sensor |
| `areas` | list | ✅ | List of area rows to show inside the block |

#### `theme_block.areas` item

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label` | string | ✅ | Display label for the area row (e.g. `All Outdoor`) |
| `entity` | string | ✅ | Entity ID used to read current on/off/brightness state |
| `color_attr` | string | ✅ | Attribute name on the sensor that holds this area's color array (e.g. `all_outdoor_colors`, `spotlight_colors`, `front_path_colors`) |
| `type` | string | ❌ | Set to `switch` for switch entities — disables color swatches, shows On/Off only |
| `count` | number | ❌ | If set, the "On" state label shows e.g. `5 on` instead of just `On`. Useful for light groups |

**Example config:**

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
      type: switch
```

| Version | Changes |
|---------|---------|
| v35 | `theme_block:` added — holiday theme indicator with per-area color swatches, gradient bars, and state labels. `_buildThemeBlock()` and `_patchThemeBlock()` added. Fully patched on every hass update without re-render. |
