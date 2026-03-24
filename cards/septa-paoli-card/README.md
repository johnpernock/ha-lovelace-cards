# septa-paoli-card

SEPTA Paoli/Thorndale Regional Rail departures and arrivals card. Shows next outbound train with upcoming trains as pills, next inbound arrival, delay status, and line-wide alerts.

---

## How it works

The card reads from HA REST sensors that poll the SEPTA API. You set up the sensors separately in HA (see sensor setup below) — the card just displays whatever those sensors report.

### Train display

**Outbound (to Philadelphia):**
- Largest slot shows the next departure — time, delay status, train number, service type (direct / transfer)
- Remaining configured sensors show as smaller pills below
- Delay shown in red if > 0 minutes, green "On time" if punctual

**Inbound (from Philadelphia):**
- Shows next inbound train's arrival time and delay
- `inbound_next_station` sensors provide the current station the train is at

### Auto-refresh

The card re-renders every 60 seconds via `setInterval` regardless of HA state pushes, so countdowns stay current.

### Alert banner

When the `alert` sensor has a non-empty, non-unknown value, an amber banner appears at the top of the card with the alert text.

### Tapping a train

Tapping any train tile (outbound or inbound) opens a popup showing:
- Departure and arrival times
- Current station (inbound only)
- Train number and line
- Service type (direct vs transfer)

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `outbound` | ✅ | — | List of outbound sensor entity IDs — first is primary (largest), rest are pills |
| `inbound` | ✅ | — | List of inbound sensor entity IDs |
| `inbound_next_station` | ❌ | — | List of sensors reporting the current station for each inbound train. Must match the order of `inbound`. |
| `alert` | ❌ | — | Sensor entity holding line alert text. Shown as an amber banner when active. |

### Expected sensor attributes

Your REST sensors need to expose these attributes for full functionality:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `state` | Scheduled departure time | `10:22AM` |
| `orig_arrival_time` | Scheduled arrival time | `11:05AM` |
| `orig_delay` | Delay string | `18 min` or `On time` |
| `orig_train` | Train number | `9321` |
| `orig_line` | Line name | `Paoli/Thorndale` |
| `isdirect` | Direct service flag | `"true"` or `"false"` |

---

## HA sensor setup

These sensors are defined in your HA `rest_sensors.yaml` (or equivalent). They poll the SEPTA real-time API.

The basic pattern for a REST sensor:

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

Adjust `req1` (origin), `req2` (destination), and `req3` (number of results) for each sensor.

---

## Example

```yaml
type: custom:septa-paoli-card
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

---

## Changelog

| Version | Changes |
|---------|---------|
| v16 | Popup portalled to `document.body`; improved delay color logic |
| v20 | Touch/mobile audit: added `-webkit-tap-highlight-color:transparent` and `user-select:none` to hero, pill (compact), and expanded train rows |
| v19 | Fixed class body closed prematurely — expanded mode methods were outside the class, causing SyntaxError |
| v18 | Expanded mode (`expanded: true`): full train rows replacing pills, hero + sub row structure, section labels, station badge in header, train number + service meta |
| v17 | SEPTA sort fix — trains sorted by estimated arrival time (scheduled + delay) across all sensors |
| v14 | Added `inbound_next_station` support — current station shown in inbound card and popup |
| v12 | Added `alert` banner support |
| v10 | Added train detail popup on tap |
| v8 | Added inbound section |
| v6 | Added direct/transfer service badge |
| v4 | Added upcoming train pills below primary slot |
| v2 | Added delay coloring (red/green) |
| v1 | Initial release — single outbound departure |

---

### Sort fix — true next-to-arrive train (v17)

**The bug:** The card previously showed trains in sensor order (outbound_1 first, inbound_1 first). If Train A was scheduled 8:00 but running 20 minutes late, and Train B was scheduled 8:15 on time, the card showed Train A as "next" because its scheduled time was earlier — but Train B arrives first.

**The fix:** All trains across all configured sensors are now sorted by **estimated arrival time** = `scheduled_arrival + delay_minutes` before picking the hero. This is the true physical arrival order at the platform regardless of sensor index or scheduled departure order.

**Inbound fix:** Previously only `inbound[0]` was ever read. Now all inbound sensors are read, sorted by estimated arrival, and the one arriving soonest is shown as the hero. The `inbound_next_station` sensor is matched to whichever sensor won the sort.

| Version | Changes |
|---------|---------|
| v17 | Sort fix — `_parseTimeToMins()`, `_delayMins()`, `_estimatedArrivalMins()`, `_sortByEstimatedArrival()` added. All outbound and inbound trains sorted by estimated arrival before hero selection. Next-station sensor matched to winning inbound sensor index. |
