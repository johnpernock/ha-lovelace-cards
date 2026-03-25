# charging-card

Unified EV charging card combining Tesla and Wallbox data into one view. Placed below the `tesla-commute-card` on the Commute view.

**Active charging:** pulsing blue status, battery progress bar with charge limit marker, live power (Wallbox kW), session energy (Wallbox kWh), and charging speed in mi/h (Tesla).

**Not charging:** dim status, last session summary with energy added, range added, last known charging speed, and current battery %.

---

## How it works

### Data sources
Each stat is labeled by source so it's clear where it comes from:
- **Wallbox** — `charging_power` (live kW), `added_energy` (session kWh), `added_range` (session mi), `status_description`
- **Tesla** — `battery_level`, `battery_range`, `charge_rate` (mi/h), `time_to_full`, `charge_limit`

### Charging state detection
Reads `tesla.charging_state` entity. State `on`, `true`, or `charging` (case-insensitive) is treated as actively charging.

### Battery progress bar
Shows a gradient fill from 0 → current %, with a thin white tick mark at the charge limit %. This lets you see at a glance both how full the battery is and how far it still has to go to reach the limit.

### Not charging / last session
When idle, shows the Wallbox cumulative session totals (`added_energy`, `added_range`) and the last known Tesla `charge_rate`. The "Last charged X ago" timestamp is derived from the last state change on the `added_energy` sensor.

### `_patch()` system
While charging, all live values (power, energy, rate, battery %) update in-place. If the charging state changes (car finishes or starts charging), a full re-render fires to switch between the active and idle layouts.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `custom:charging-card` |
| `name` | string | ❌ | Vehicle nickname shown in the status banner. Default `Magneton` |
| `wallbox_prefix` | string | ✅ | Wallbox entity prefix (e.g. `wallbox_beryl_pulsar_plus`) |
| `tesla` | object | ✅ | Tesla entity ID map (see table below) |

### `tesla` keys

| Key | Domain | Description |
|-----|--------|-------------|
| `battery_level` | `sensor` | Battery state of charge % |
| `battery_range` | `sensor` | Estimated range in miles |
| `charging_state` | `binary_sensor` or `sensor` | Charging state (`on`/`charging`) |
| `charge_rate` | `sensor` | Live charging speed in mi/h |
| `time_to_full` | `sensor` | Time remaining until charge limit reached |
| `charge_limit` | `sensor` | Charge limit % — sets the progress bar target tick |

### Wallbox entities used (resolved from `wallbox_prefix`)

| Entity suffix | Description |
|---|---|
| `charging_power` | Live charge power in kW |
| `added_energy` | Session energy added in kWh |
| `added_range` | Session range added in miles |
| `status_description` | Human-readable charger status |

---

## Full config example

```yaml
type: custom:charging-card
name: Magneton
wallbox_prefix: wallbox_beryl_pulsar_plus
tesla:
  battery_level:  sensor.magneton_battery
  battery_range:  sensor.magneton_range
  charging_state: binary_sensor.magneton_charging
  charge_rate:    sensor.magneton_charging_rate
  time_to_full:   sensor.magneton_time_charge_complete
  charge_limit:   sensor.magneton_charge_limit
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v2 | Card name label: 15px → 17px white bold |
| v1 | Initial release — active/idle states, battery progress bar with limit tick, Tesla + Wallbox combined stats, `_patch()` for in-place updates |
