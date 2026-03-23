# tesla-card

Tesla vehicle status card. Main card shows battery level, range, lock state, climate, and trunk. Tapping opens a full-detail popup with battery, tire pressure, temperatures, climate controls, seat heating, and vehicle status.

---

## How it works

All entity IDs are defined explicitly in an `entities` map — there is no auto-prefix system. The card guards every entity read, so missing entities simply don't render their section rather than crashing. Service calls are debounced to prevent double-taps from firing twice.

---

## Parameters

### Top-level

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ❌ | Vehicle nickname shown in the card header |
| `tire_warn_psi` | number | ❌ | PSI below which a tire reading shows a warning highlight. Default: `40` |
| `temp_unit` | string | ❌ | `F` or `C`. Default: `F` |
| `entities` | object | ✅ | Entity ID map (see below) |

---

### `entities` map

#### Main card

| Key | Description |
|-----|-------------|
| `battery_level` | Battery percentage sensor |
| `battery_range` | Estimated range sensor |
| `charging_state` | Charging state sensor (e.g. `Charging`, `Disconnected`) |
| `door_lock` | Door lock entity |
| `climate` | Climate entity — used for on/off and target temp |
| `trunk` | Trunk cover entity |

#### Charging (main card + popup)

| Key | Description |
|-----|-------------|
| `charge_rate` | Charge rate sensor (miles/hr or km/hr) |
| `time_to_full_charge` | Time to full charge sensor |

#### Popup — tire pressure

| Key | Description |
|-----|-------------|
| `tire_pressure_fl` | Front left tire pressure |
| `tire_pressure_fr` | Front right tire pressure |
| `tire_pressure_rl` | Rear left tire pressure |
| `tire_pressure_rr` | Rear right tire pressure |

#### Popup — temperatures

| Key | Description |
|-----|-------------|
| `interior_temperature` | Inside cabin temperature |
| `exterior_temperature` | Outside temperature |

#### Popup — climate controls

| Key | Description |
|-----|-------------|
| `front_defrost` | Front defrost switch or binary sensor |
| `rear_defrost` | Rear defroster switch |
| `steering_wheel_heat` | Steering wheel heater switch |

#### Popup — seat heating

| Key | Description |
|-----|-------------|
| `seat_heat_driver` | Driver seat heat select entity |
| `seat_heat_passenger` | Passenger seat heat select entity |

#### Popup — vehicle status

| Key | Description |
|-----|-------------|
| `charge_port` | Charge port door binary sensor |
| `sentry_mode` | Sentry mode switch |
| `odometer` | Odometer sensor |

---

## Full example

```yaml
type: custom:tesla-card
name: Magneton
tire_warn_psi: 40
temp_unit: F
entities:
  battery_level:          sensor.magneton_battery_level
  battery_range:          sensor.magneton_battery_range
  charging_state:         sensor.magneton_charging_state
  charge_rate:            sensor.magneton_charge_rate
  time_to_full_charge:    sensor.magneton_time_to_full_charge
  door_lock:              lock.magneton_door_lock
  climate:                climate.magneton_hvac_climate_system
  trunk:                  cover.magneton_trunk
  charge_port:            binary_sensor.magneton_charge_port_door
  sentry_mode:            switch.magneton_sentry_mode
  odometer:               sensor.magneton_odometer
  interior_temperature:   sensor.magneton_inside_temperature
  exterior_temperature:   sensor.magneton_outside_temperature
  tire_pressure_fl:       sensor.magneton_tire_pressure_front_left
  tire_pressure_fr:       sensor.magneton_tire_pressure_front_right
  tire_pressure_rl:       sensor.magneton_tire_pressure_rear_left
  tire_pressure_rr:       sensor.magneton_tire_pressure_rear_right
  front_defrost:          switch.magneton_defrost
  rear_defrost:           switch.magneton_rear_defroster
  steering_wheel_heat:    switch.magneton_steering_wheel_heater
  seat_heat_driver:       select.magneton_heated_seat_front_left
  seat_heat_passenger:    select.magneton_heated_seat_front_right
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v9 | Popup portalled to `document.body`; service call debounce to prevent double-tap; tire warning PSI configurable |
| v8 | Seat heating select entity support |
| v7 | Climate controls section (defrost, steering wheel heat) |
| v6 | Tire pressure section with per-tire warning highlight |
| v5 | Temperature section; `temp_unit` config |
| Earlier | Battery, lock, trunk, charging state display |
