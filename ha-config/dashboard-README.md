# dashboard.yaml

The complete Lovelace dashboard configuration for the wall-mounted display. This is a raw YAML file you paste directly into HA's dashboard editor or manage via `ui-lovelace.yaml`.

---

## Installation

### Option A — Raw config editor (recommended)
1. In HA go to **Settings → Dashboards → your dashboard → ⋮ → Edit → Raw configuration editor**
2. Replace the entire contents with the contents of `dashboard.yaml`
3. Save

### Option B — `ui-lovelace.yaml` (YAML mode)
If your HA instance uses YAML mode dashboards, copy `dashboard.yaml` to `/config/` and reference it:
```yaml
# configuration.yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/cards/room-controls-card/room-controls-card.js
      type: module
    # ... all other card resources
```

---

## Views

| View | Path | Layout | Description |
|------|------|--------|-------------|
| Home | `/home` | sections · 3 col | Clock, weather, SEPTA, Tesla, door sensors, room buttons, thermostats, temp strip, printer status, calendar |
| Lights / Fans | `/lightsfans` | sections · 3 col | Room control cards for all rooms — lights, fans, blinds, thermostats |
| Cameras | `/cameras` | panel | Full-width camera layout — doorbell portrait + 2×2 grid |
| Technology | `/technology` | sections · 3 col | Network, speed, APs, Unraid health, services, storage, ink, media |
| 3D Printer | `/3d-printer` | sections · 2 col | Bambu P1S full status card spanning both columns |

All views use `theme: Amoled+`.

---

## Changes from original dashboard

### Home view — Yard button (`room-buttons-card`)
Added `theme_sensor: sensor.outdoor_lighting_theme` to the Yard button.

On normal nights: **no change** — button looks identical to all others.

On holidays: a holiday color strip appears along the bottom of the button and a small themed label (e.g. `🎄 Christmas`) appears below the state text.

```yaml
- entity: light.all_yard_lights
  name: Yard
  icon: tree
  theme_sensor: sensor.outdoor_lighting_theme   # ← added
```

### Lights / Fans view — Yard room (`room-controls-card`)
Added `theme_block:` to the Yard room. This renders a holiday/schedule indicator block above the lights row showing the current theme and per-zone status.

On normal nights: shows "🌙 Default Schedule · Warm white" with all zones showing warm white bars.

On holidays: shows the holiday name, emoji, accent color, and a row per zone with color swatches and gradient bars:

| Area row | Entity | Notes |
|----------|--------|-------|
| All Outdoor | `light.all_yard_lights` | Full outdoor palette |
| Display Lights | `light.yard_spotlights` | 5 tree/maple lights — requires `ha-config/light-groups.yaml` |
| Front Path | `light.hue_path_lights` | Hue pedestal group |
| Side Path | `switch.yard_light_controller_zone_1` | Switch only — shows On/Off, no color swatches |

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

---

## Prerequisites

Before loading this dashboard, ensure the following are set up in HA:

### Card resources
All 15 custom card JS files registered under **Settings → Dashboards → Resources**. See root `README.md` for the full resource URL list.

### HA config includes
Both files in `ha-config/` must be active:

```yaml
# configuration.yaml
template: !include ha-config/outdoor-lighting-theme-sensor.yaml
light: !include ha-config/light-groups.yaml
```

After adding: **Developer Tools → YAML → Reload Template Entities** and **Reload Groups**.

### Entities required (theme feature)
| Entity | Source |
|--------|--------|
| `sensor.outdoor_lighting_theme` | Created by `ha-config/outdoor-lighting-theme-sensor.yaml` |
| `light.yard_spotlights` | Created by `ha-config/light-groups.yaml` |
| `light.hue_path_lights` | Existing Hue light group |
| `switch.yard_light_controller_zone_1` | Existing zone switch |
