# ha-config

Home Assistant configuration files that support the dashboard cards. These are YAML snippets to be included in your HA `configuration.yaml` — they are not card JS files.

---

## Files

### `outdoor-lighting-theme-sensor.yaml`

Template sensor (`sensor.outdoor_lighting_theme`) that detects the current outdoor lighting holiday theme based on today's date. Used by `room-controls-card`'s `theme_block` and `room-buttons-card`'s `theme_sensor` to show holiday color indicators on the dashboard.

**State:** Current theme name — `Default`, `Christmas`, `Pride Month`, `Independence Day`, etc.

**Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `emoji` | string | Emoji for the current theme (e.g. `🎄`, `🏳️‍🌈`, `🎆`) |
| `is_holiday` | boolean | `true` when any holiday theme is active |
| `accent` | string | Hex accent color for the theme header text |
| `all_outdoor_colors` | list | Color palette for all outdoor lights — used for the home button strip |
| `spotlight_colors` | list | 5 colors, one per tree/maple light in order: `yard_maple`, `corner_tree`, `big_tree`, `bay_window_maple`, `backyard_maple` |
| `front_path_colors` | list | 2 colors for the Hue pedestals: `hue_impress_outdoor_pedestal_1`, `hue_impress_outdoor_pedestal_2` |

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

**Installation:**

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

**Installation:**

```yaml
# configuration.yaml
light: !include ha-config/light-groups.yaml
```

After saving: **Developer Tools → YAML → Groups → Reload** (or restart HA)

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

### `dashboard.yaml`

The complete Lovelace dashboard YAML for all 7 views (Home, Lights/Fans, Cameras, Technology, Commute, Energy, 3D Printer). Paste into the HA raw config editor or use as a `ui-lovelace.yaml` source. See [`dashboard-README.md`](dashboard-README.md) for full installation instructions and a summary of all views and changes.

---

### `waze-sensors.yaml`

Three Waze Travel Time sensors for the `traffic-card`:

| Sensor entity | Route | Direction |
|---|---|---|
| `sensor.commute_to_work` | US-202 N | 21 Beryl Rd → 1030 Continental Dr |
| `sensor.commute_home_via_202` | US-202 S | 1030 Continental Dr → 21 Beryl Rd |
| `sensor.commute_home_via_rt_30` | Route 30 W (avoid_highways) | 1030 Continental Dr → 21 Beryl Rd |

**Installation:**

```yaml
# configuration.yaml
sensor: !include ha-config/waze-sensors.yaml
```

After saving: **Developer Tools → YAML → Reload** (or restart HA). Allow ~5 minutes for first readings.
