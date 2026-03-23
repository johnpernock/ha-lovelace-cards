# protect-events-card

**v1** — Real-time UniFi Protect smart detection event feed.

Displays a live-updating list of detection events (person, vehicle, animal, package) across all configured cameras. Tapping a row opens a detail popup with the event thumbnail, confidence score, and actions to open the recorded clip or live view.

---

## Screenshot

```
┌─────────────────────────────────────────┐
│ PROTECT EVENTS                    ● LIVE│
│ [All] [Person] [Vehicle] [Animal] [Pkg] │
├─────────────────────────────────────────┤
│▌ ┌──────┐  Front door          97%     │
│  │  👤  │  [PERSON]  just now      ›   │
├─────────────────────────────────────────┤
│▌ ┌──────┐  Driveway            94%     │
│  │  🚗  │  [VEHICLE]  2m ago       ›   │
├─────────────────────────────────────────┤
│  ...                                    │
├─────────────────────────────────────────┤
│ TODAY 47   ACTIVE 2              ALL → │
└─────────────────────────────────────────┘
```

---

## Installation

1. Copy `cards/protect-events-card/` and `shared/` to `/config/www/`
2. **Settings → Dashboards → Resources → Add resource:**

| URL | Type |
|-----|------|
| `/local/cards/protect-events-card/protect-events-card.js` | JavaScript Module |

> The `shared/` modules do **not** need separate registration.

3. Hard refresh: `Ctrl+Shift+R` / `Cmd+Shift+R`

---

## Prerequisites

- **UniFi Protect integration** configured in Home Assistant (built-in, not HACS)
- Cameras must have **RTSP enabled** in UniFi Protect settings
- Integration user must have **Full Management** permission in Protect
- For smart detections (person/vehicle/animal/package): **G4 or AI series cameras** required
  - G3 series cameras only support plain motion

---

## Config

```yaml
type: custom:protect-events-card

# Required — list of camera entity IDs from the UniFi Protect integration
cameras:
  - camera.front_door
  - camera.driveway
  - camera.backyard
  - camera.side_gate
  - camera.garage

# Optional
max_events: 8               # rows shown in the list, default 8
show_motion: false          # include plain motion events (no smart detection), default false
confidence_threshold: 0     # hide events below this confidence %, default 0 (show all)
cameras_view: /cameras      # path to navigate when "All →" is tapped, optional
```

---

## Entity naming convention

By default the card derives sensor IDs by stripping `camera.` from the entity ID:

| Camera entry | Sensors resolved |
|---|---|
| `camera.driveway` | `binary_sensor.driveway_person_detected`, `…_vehicle_detected`, etc. |
| `camera.back_yard` | `binary_sensor.back_yard_person_detected`, etc. |

### Multi-channel cameras (G6 Entry, G4 Doorbell Pro)

Some cameras expose multiple stream entities with suffixes like `_high_resolution_channel` or `_package_camera`, but their detection sensors sit at the device level without those suffixes. Use the `sensor_base` key to override the prefix used for sensor lookup:

```yaml
cameras:
  - entity: camera.g6_entry_high_resolution_channel  # stream to display
    sensor_base: g6_entry                             # prefix for binary_sensor.*_person_detected etc.
  - camera.driveway                                   # plain string still works for standard cameras
```

Without `sensor_base`, passing `camera.g6_entry_high_resolution_channel` would look for
`binary_sensor.g6_entry_high_resolution_channel_person_detected` — which doesn't exist.
With `sensor_base: g6_entry` it correctly resolves `binary_sensor.g6_entry_person_detected`.

If you're unsure of your sensor names, check **Settings → Entities** and filter by `binary_sensor` + your camera name.

---

## Detection types & colors

| Type | Color | Requires |
|---|---|---|
| Person | Amber `#fbbf24` | G4 / AI camera |
| Vehicle | Blue `#60a5fa` | G4 / AI camera |
| Animal | Teal `#2dd4bf` | G4 / AI camera |
| Package | Purple `#a78bfa` | G4 Doorbell Pro |
| Motion | Gray (dim) | Any camera (`show_motion: true`) |

---

## Popup detail

Tapping any event row opens a popup showing:
- Camera name + detection type (color-coded)
- 16:9 thumbnail from the Protect event (fetched ~1.5s after detection)
- 3-column meta strip: camera / type / confidence %
- **Open clip** — fires `hass-more-info` for the camera entity (opens media browser)
- **Live view →** — fires `hass-more-info` for the camera entity (opens live stream)

Thumbnails are fetched from `/api/unifiprotect/thumbnail/{event_id}` — the HA UniFi Protect integration exposes this endpoint automatically. Until the image is ready, a placeholder silhouette is shown.

---

## Footer stats

| Stat | Source |
|---|---|
| **Today N** | Running count of events received since the card was loaded |
| **Active N** | Count of `binary_sensor.*_motion_detected` sensors currently `on` |

> Note: "Today" resets on page reload. For a persistent daily count, add a `counter` helper in HA that increments via automation on each Protect detection event.

---

## Changelog

| Version | Notes |
|---|---|
| v1.1 | `sensor_base` override for multi-channel cameras (G6 Entry, G4 Doorbell Pro). `cameras:` entries now accept `{entity, sensor_base}` objects in addition to plain entity ID strings. |
| v1 | Initial release. Ring buffer, filter pills, thumbnail fetch, portal popup, live state_changed subscription. |
