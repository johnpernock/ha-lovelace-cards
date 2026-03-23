# septa-paoli-card

SEPTA Paoli/Thorndale Regional Rail departure and arrival card. Shows the next outbound train with later departures as pills, the next inbound arrival, delay status, and line alerts. Tapping any train opens a detail popup.

---

## How it works

The card reads from HA sensors created by a SEPTA REST integration. Trains are sorted by departure time. Delay strings are parsed to compute adjusted arrival times. The card auto-refreshes every 60 seconds via `setInterval` even if no hass update occurs, so the "minutes until departure" countdown stays accurate.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `outbound` | list | ❌ | Outbound train sensor entity IDs (up to 3 recommended) |
| `inbound` | list | ❌ | Inbound train sensor entity IDs (up to 3 recommended) |
| `inbound_next_station` | list | ❌ | Inbound next-station sensor entity IDs — must match the order of `inbound` |
| `alert` | string | ❌ | Alert sensor entity ID — shown as a banner when the state is non-empty |

---

## Expected sensor attributes

Each train sensor (outbound and inbound) must provide these attributes:

| Attribute | Description |
|-----------|-------------|
| `state` | Scheduled departure time (e.g. `10:22AM`) |
| `orig_arrival_time` | Scheduled arrival time |
| `orig_delay` | Delay string — `On time` or `N min` |
| `orig_train` | Train number |
| `orig_line` | Line name |
| `isdirect` | `"true"` if this is a direct (non-transfer) service |

These are produced by a SEPTA REST sensor in `configuration.yaml` / `rest_sensors.yaml`. Refer to your sensor setup for the full API configuration.

---

## Popup contents

Tapping any train card opens a popup showing:
- Train number and line
- Scheduled departure time
- Scheduled arrival time (with adjusted time shown if delayed)
- Delay status
- Direct / Transfer indicator
- Current next station (inbound trains only)

---

## Full example

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
| v16 | Delay arrival time calculation improved — handles AM/PM edge cases correctly; 60-second auto-refresh tick |
| v15 | Alert banner added |
| v14 | Inbound next-station support |
| v13 | Train detail popup added |
| Earlier | Initial release — outbound/inbound display, delay parsing |
