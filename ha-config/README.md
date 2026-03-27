# ha-config

Home Assistant configuration files and dashboard YAML that support the cards. These are not card JS files — they go in `/config/` alongside `configuration.yaml`.

---

## Configuration includes

### `outdoor-lighting-theme-sensor.yaml`

Template sensor (`sensor.outdoor_lighting_theme`) that detects the current outdoor lighting holiday theme. Used by `room-controls-card`'s `theme_block` and `room-buttons-card`'s `theme_sensor`.

```yaml
# configuration.yaml
template: !include ha-config/outdoor-lighting-theme-sensor.yaml
```

After saving: **Developer Tools → YAML → Template Entities → Reload**

---

### `light-groups.yaml`

Custom light groups used by the outdoor lighting cards.

| Group entity | Members | Description |
|---|---|---|
| `light.yard_spotlights` | `light.yard_maple`, `light.corner_tree`, `light.big_tree`, `light.bay_window_maple`, `light.backyard_maple` | All 5 tree and maple spotlights |

```yaml
# configuration.yaml
light: !include ha-config/light-groups.yaml
```

After saving: **Developer Tools → YAML → Groups → Reload** (or restart HA)

---

### `deprecated/waze-sensors.yaml` ⚠️ Deprecated

Kept for reference only. Waze Travel Time sensors are now configured through the HA UI integration, not via `configuration.yaml`.

**Current setup:** Go to **Settings → Integrations → Add Integration → Waze Travel Time** and add each sensor manually:

| Sensor entity | Direction |
|---|---|
| `sensor.commute_to_work` | 21 Beryl Rd → 1030 Continental Dr |
| `sensor.commute_home_via_202` | 1030 Continental Dr → 21 Beryl Rd |
| `sensor.commute_home_via_rt_30` | 1030 Continental Dr → 21 Beryl Rd |

Do **not** add `sensor: !include ha-config/waze-sensors.yaml` to `configuration.yaml` — this will cause a HA startup error.

---

## Outdoor lighting theme sensor

`sensor.outdoor_lighting_theme` — detects the current outdoor lighting holiday theme based on today's date. Used by `room-controls-card`'s `theme_block` and `room-buttons-card`'s `theme_sensor`.

**State:** Current theme name — `Default`, `Christmas`, `Pride Month`, `Independence Day`, etc.

**Attributes:**

| Attribute | Description |
|-----------|-------------|
| `emoji` | Emoji for the current theme (e.g. `🎄`) |
| `is_holiday` | `true` when any holiday theme is active |
| `accent` | Hex accent color for theme header text |
| `all_outdoor_colors` | Color palette for all outdoor lights |
| `spotlight_colors` | 5 colors, one per tree/maple light in order |
| `front_path_colors` | 2 colors for the Hue pedestals |

**Holidays covered:**

| Holiday | Trigger |
|---------|---------|
| New Year's Day | Jan 1 |
| Valentine's Day | Feb 14 |
| St. Patrick's Day | Mar 17 |
| Easter | Floating Sunday (algorithmic) |
| Memorial Day | Last Monday in May |
| Juneteenth | Jun 19 |
| Pride Month | All of June except Jun 19 |
| Independence Day | Jul 4 |
| Halloween | Oct 31 |
| Veterans Day | Nov 11 |
| Thanksgiving | 4th Thursday in November |
| Christmas | Dec 25 |
| New Year's Eve | Dec 31 |

---

## All outdoor light entities reference

| Entity ID | Description | Type |
|-----------|-------------|------|
| `light.yard_maple` | Front maple tree | Color light |
| `light.corner_tree` | Corner tree | Color light |
| `light.big_tree` | Big tree | Color light |
| `light.bay_window_maple` | Bay window maple | Color light |
| `light.backyard_maple` | Backyard maple | Color light |
| `light.yard_spotlights` | Group — all 5 tree/maple lights | Light group |
| `light.hue_impress_outdoor_pedestal_1` | Front path pedestal 1 | Color light |
| `light.hue_impress_outdoor_pedestal_2` | Front path pedestal 2 | Color light |
| `light.hue_path_lights` | Group — front path pedestals | Light group |
| `light.all_yard_lights` | Group — all yard lights | Light group |
| `switch.yard_light_controller_zone_1` | Side path lights zone | Switch (no color) |

---

## Dashboard

`dashboard.yaml` — the complete Lovelace dashboard for all 8 views. Paste into HA's raw config editor or use as `ui-lovelace.yaml`.

All views use `theme: Amoled+`.

### Installation

**Option A — Raw config editor (recommended)**

1. **Settings → Dashboards → your dashboard → ⋮ → Edit → Raw configuration editor**
2. Replace the entire contents with `dashboard.yaml`
3. Save

**Option B — `ui-lovelace.yaml` (YAML mode)**

```yaml
# configuration.yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/cards/room-controls-card/room-controls-card.js
      type: module
    # ... all other card resources
```

### Views

| View | Path | Layout | Description |
|------|------|--------|-------------|
| Home | `/home` | sections · 3 col | Clock, weather, now-playing, Tesla, door sensors, room buttons, thermostats, temp strip, printer status, calendar |
| Lights / Fans | `/lightsfans` | sections · 3 col | Room control cards for all rooms — lights, fans, blinds, thermostats |
| Security | `/security` | sections · 3 col | Col 1–2 (span): camera-layout-card. Col 3: protect-events-card |
| Commute | `/commute` | sections · 3 col | Col 1: traffic-card (expanded) + leave-by-card. Col 2: SEPTA Paoli (expanded). Col 3: tesla-commute-card + charging-card |
| Technology | `/technology` | sections · 3 col | Network, speed, APs, Unraid health, services, storage, ink, media |
| Energy | `/energy` | sections · 3 col | Wallbox charger, PECO electric bill, Ecoflow River 2 Pro |
| 3D Printer | `/3d-printer` | sections · 2 col | Bambu P1S full status card spanning both columns |
| Cameras | `/cameras` | panel | Full-panel camera-layout-card |

### Prerequisites

**Card resources** — all 24 card JS files registered under **Settings → Dashboards → Resources**. See root `README.md` for the full URL list.

**HA config includes** — add to `configuration.yaml`:

```yaml
template: !include ha-config/outdoor-lighting-theme-sensor.yaml
light: !include ha-config/light-groups.yaml
```

After adding: **Developer Tools → YAML → Reload Template Entities** and **Reload Groups**.

### Fan speed configuration

Most fans resolve speed dynamically from `percentage_step`. Only white-series preset-mode fans need `speeds:` hardcoded:

| Fan | Config | Reason |
|-----|--------|--------|
| `fan.white_series_lightfan_module` (dining) | `speeds: 5` | Unavailable state, no `percentage_step` |
| `fan.white_series_lightfan_module_2/3` (family) | `speeds: 4` | preset_mode based, step=33.33 |

### Key dashboard configuration notes

**Home view — Yard button (`room-buttons-card`)**

```yaml
- entity: light.all_yard_lights
  name: Yard
  icon: tree
  theme_sensor: sensor.outdoor_lighting_theme
```

**Lights / Fans view — Yard room (`room-controls-card`)**

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

**Security view — 2 columns + panel**

| Column | Card | Notes |
|--------|------|-------|
| 1–2 (span) | `camera-layout-card` | G6 Entry + 5 G6 Turrets, height 640px |
| 3 | `protect-events-card` | All 6 cameras. `cameras_view: /security` |

Camera height is 640px in the sections layout (vs 680px in the panel Cameras view) because the sections layout adds chrome.

**Home view — now-playing card**

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
