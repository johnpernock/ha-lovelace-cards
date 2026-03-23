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
| Home | `/home` | sections · 3 col | Clock, weather, now-playing, Tesla, door sensors, room buttons, thermostats, temp strip, printer status, calendar |
| Lights / Fans | `/lightsfans` | sections · 3 col | Room control cards for all rooms — lights, fans, blinds, thermostats |
| Cameras | `/cameras` | panel | Full-width camera layout — doorbell portrait + 2×2 grid |
| Technology | `/technology` | sections · 3 col | Network, speed, APs, Unraid health, services, storage, ink, media |
| Commute | `/commute` | sections · 3 col | Traffic (Waze), SEPTA Paoli/Thorndale line, Tesla + charging cards |
| Energy | `/energy` | sections · 3 col | Wallbox charger, PECO electric bill, Ecoflow River 2 Pro |
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
All 22 custom card JS files registered under **Settings → Dashboards → Resources**. See root `README.md` for the full resource URL list.

### HA config includes
Both files in `ha-config/` must be active:

```yaml
# configuration.yaml
template: !include ha-config/outdoor-lighting-theme-sensor.yaml
light: !include ha-config/light-groups.yaml
```

After adding: **Developer Tools → YAML → Reload Template Entities** and **Reload Groups**.

### New card resources (Energy view + now-playing)
Register these in **Settings → Dashboards → Resources**:
- `/local/cards/wallbox-card/wallbox-card.js`
- `/local/cards/peco-card/peco-card.js`
- `/local/cards/ecoflow-card/ecoflow-card.js`
- `/local/cards/now-playing-card/now-playing-card.js`

### Entities required (theme feature)
| Entity | Source |
|--------|--------|
| `sensor.outdoor_lighting_theme` | Created by `ha-config/outdoor-lighting-theme-sensor.yaml` |
| `light.yard_spotlights` | Created by `ha-config/light-groups.yaml` |
| `light.hue_path_lights` | Existing Hue light group |
| `switch.yard_light_controller_zone_1` | Existing zone switch |

---

## Additional changes (Energy view + now-playing)

### Home view — now-playing card
Added `custom:now-playing-card` above the room buttons grid. Shows what's playing on any of the three Apple TVs. Collapses to invisible when all players are idle.

```yaml
- type: custom:now-playing-card
  players:
    - entity: media_player.family_room
      name: Family Room
    - entity: media_player.master_bedroom
      name: Master Bedroom
    - entity: media_player.office
      name: Office
```

### Energy view (new)
New 6th view at path `/energy` with three cards in a 3-column sections layout:

| Column | Card | Entities |
|--------|------|----------|
| 1 | `wallbox-card` | `wallbox_beryl_pulsar_plus_*` — session energy, range, power, current slider, solar mode, lock |
| 2 | `peco-card` | `peco_electric_*` + `peco_gas_*` — usage bar, forecast, cost, typical comparison |
| 3 | `ecoflow-card` | `river_2_pro_*` — battery, power flows, max charge slider, AC/DC toggles |

---

## Commute view — column 3 (Tesla + charging)

The Commute view was expanded from 2 to 3 columns. Column 3 contains two stacked cards:

### `tesla-commute-card`
Expanded inline Tesla card — all commute-relevant data without opening a popup:
- Battery % (large), range, charge status
- Interior + exterior temperature tiles
- Climate row with inline −/+ stepper and On/Off toggle
- Tire pressure 2×2 grid — red tile when below `tire_warn_psi` (40 PSI)
- Action buttons: Lock · Trunk · Sentry · Odometer

### `charging-card` (stacked below)
Unified Tesla + Wallbox charging card:
- **Active charging:** pulsing blue banner, battery progress bar with charge limit tick mark, power kW (Wallbox), session energy kWh (Wallbox), charging speed mi/h (Tesla), time to full
- **Not charging:** dim status, last session summary (energy, range, speed, current battery %)

Both cards share entity IDs with the existing `tesla-card` on the Home view — no new sensors needed.
