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

### Simplified rooms

`simplified: true` collapses the lights row to a count badge in the header (e.g. "3 / 5 on") with a chevron. Tapping the header opens the full lights popup. Good for bathrooms and utility rooms where you just need a quick on/off overview.

### Fan speed resolution

Priority order:
1. YAML `speeds:` — always wins if you set it
2. `percentage_step` entity attribute (`100 ÷ step = count`) — most reliable for Lutron Caseta
3. `speed_count` entity attribute
4. Default: 4

Always set `speeds:` explicitly for Lutron Caseta fans — their `speed_count` attribute reports an incorrect value.

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
| `sensor` | ❌ | — | Separate temperature sensor to show as a pill (useful for split systems) |
| `sensor_label` | ❌ | — | Two-line label under the sensor pill (use `\n` to split lines) |

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
