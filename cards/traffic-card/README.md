# traffic-card

Commute traffic card using Waze Travel Time sensors. Shows live travel time, delay vs typical, distance, and which route Waze is currently recommending. Detects heavy traffic and shows an incident banner when any route significantly exceeds its typical duration. The "Fastest" badge dynamically moves to whichever home route is quicker right now.

---

## How it works

### Data source
All live data comes from HA's built-in **Waze Travel Time** integration (`sensor` platform). Each sensor polls Waze every ~5 minutes and exposes:
- `state` — current travel time in minutes (with live traffic)
- `attributes.duration` — typical duration (Waze's rolling historical average)
- `attributes.route` — road name Waze selected for this trip
- `attributes.distance` — distance in miles

The card calculates delay as `current − typical`. If the `route` attribute is empty (varies by HA version), the card falls back to `route_label` from your config.

### Incident detection
No Waze incident API is needed. The card detects heavy traffic by comparing each route's current time against its typical. When the delay exceeds `incident_threshold` minutes (default 10), a pulsing red banner appears identifying the affected route and suggesting the alternate if one exists.

### Direction logic
- **To work** — single route, dimmed after `hide_to_work_after` hour (default 12pm) since you're already at the office
- **Home** — all configured routes shown, "Fastest" badge on the lowest current time. Routes are shown full-size when fastest, slightly reduced when not

### Last updated
Reads `last_updated` from whichever entity updated most recently.

---

## HA config required

Add `ha-config/waze-sensors.yaml` sensors to your `configuration.yaml`:

```yaml
sensor: !include ha-config/waze-sensors.yaml
```

Or paste the sensor blocks directly into an existing `sensor:` list.

After saving: **Developer Tools → YAML → Reload** (or restart HA).

Sensors update every ~5 minutes. Allow a few minutes after restart for first readings.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `custom:traffic-card` |
| `to_work` | object | ✅ | Single outbound route config (see below) |
| `home_routes` | list | ✅ | One or more return route configs (see below) |
| `incident_threshold` | number | ❌ | Minutes over typical that triggers the incident banner. Default `10` |
| `hide_to_work_after` | number | ❌ | Hour (24h) after which the to-work row is dimmed. Default `12` |

### `to_work` object

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `entity` | string | ✅ | Waze sensor entity ID (e.g. `sensor.commute_to_work`) |
| `label` | string | ❌ | Destination label shown in the direction header (e.g. `1030 Continental Dr`) |
| `route_label` | string | ❌ | Fallback road name if Waze `route` attribute is empty (e.g. `US-202 N`) |
| `via_label` | string | ❌ | Additional "via" line shown below the route name |

### `home_routes` list item

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `entity` | string | ✅ | Waze sensor entity ID |
| `label` | string | ❌ | Home address label shown in direction header |
| `route_label` | string | ❌ | Fallback road name |
| `via_label` | string | ❌ | Additional "via" line |

---

## Full config example

```yaml
type: custom:traffic-card
incident_threshold: 10
hide_to_work_after: 12
to_work:
  entity: sensor.commute_to_work
  label: 1030 Continental Dr
  route_label: US-202 N
home_routes:
  - entity: sensor.commute_home_via_202
    label: 21 Beryl Rd
    route_label: US-202 S
  - entity: sensor.commute_home_via_rt_30
    label: 21 Beryl Rd
    route_label: Route 30 W
    via_label: via Lancaster Ave
```

---

## Waze sensor attributes reference

Each `sensor.waze_travel_time_*` entity exposes these attributes the card reads:

| Attribute | Description |
|-----------|-------------|
| `state` | Current travel time in minutes (live traffic) |
| `duration` | Typical/historical travel time in minutes |
| `route` | Road name Waze selected (may be empty) |
| `distance` | Distance in miles |

---

## Changelog

| Version | Changes |
|---------|---------|
| v6 | v6 | Card header title: 10px uppercase → 17px white bold |
| v5 | Touch audit: added `-webkit-tap-highlight-color:transparent` to expanded row classes |
| v4 | To-work row dimming after noon removed — always shows at full brightness |
| v3 | hass guard added to `_renderExpanded()` to fix blank times on initial render |
| v2 | `expanded: true` mode — hero/sub row layout matching train card style; colours match delay state |
| v1 | Initial release — live Waze data, incident banner, Fastest badge, to-work dimming, last updated timestamp |
| v5 | Touch/mobile audit: added `-webkit-tap-highlight-color:transparent` to expanded row elements |
| v4 | Fixed blank times in expanded mode — `_renderExpanded()` missing `!this._hass` guard caused render before hass assigned |
| v3 | Removed to-work dimming after noon — always shows at full brightness |
| v2 | Expanded mode (`expanded: true`): hero/sub rows for all routes, green/red delay colouring, Fastest badge on best home route |
