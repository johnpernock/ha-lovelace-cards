# tesla-card

Tesla vehicle status card. Shows battery, lock, climate, and trunk status inline. Tapping opens a detailed popup with battery info, tire pressures, temperatures, climate controls, seat heating, and vehicle status.

---

## How it works

The card reads individual sensor, lock, climate, cover, switch, and select entities — the Tesla integration in HA exposes each piece of vehicle data as a separate entity. The card assembles them into a unified view.

### Battery display

The inline card shows a battery bar that fills proportionally to `battery_level`. Color shifts from green (>50%) to amber (20–50%) to red (<20%). While charging, a pulse animation plays and the charge rate / time-to-full are shown.

### Popup sections

The popup is divided into collapsible sections. Each section only renders if you've configured the relevant entities:

| Section | Requires |
|---------|---------|
| Battery | `battery_level`, `battery_range` |
| Tire Pressure | `tire_pressure_fl/fr/rl/rr` |
| Temperature | `interior_temperature`, `exterior_temperature` |
| Climate Controls | `climate`, `front_defrost`, `rear_defrost`, `steering_wheel_heat` |
| Seat Heating | `seat_heat_driver`, `seat_heat_passenger` |
| Vehicle Status | `door_lock`, `trunk`, `charge_port`, `sentry_mode`, `odometer` |

### Tire pressure warnings

Tires below `tire_warn_psi` show a red warning indicator. Default threshold is 40 PSI.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `name` | ❌ | `Model Y` | Vehicle nickname shown on the card |
| `tire_warn_psi` | ❌ | `40` | PSI below which a tire shows a warning badge |
| `temp_unit` | ❌ | `F` | Temperature unit: `F` or `C` |
| `entities` | ✅ | — | Map of logical names to HA entity IDs (see below) |

### Entity map

| Key | Domain | Description |
|-----|--------|-------------|
| `battery_level` | `sensor` | State of charge (%) |
| `battery_range` | `sensor` | Estimated range |
| `charging_state` | `sensor` | Charging status text |
| `charge_rate` | `sensor` | Current charge rate (shown while charging) |
| `time_to_full_charge` | `sensor` | Time remaining to full charge |
| `door_lock` | `lock` | Vehicle door lock |
| `climate` | `climate` | HVAC — used for on/off toggle and target temp |
| `trunk` | `cover` | Trunk/frunk cover |
| `charge_port` | `binary_sensor` | Charge port door open/closed |
| `sentry_mode` | `switch` | Sentry mode on/off |
| `odometer` | `sensor` | Odometer reading |
| `interior_temperature` | `sensor` | Interior cabin temp |
| `exterior_temperature` | `sensor` | Outside temp |
| `tire_pressure_fl` | `sensor` | Front left tire pressure |
| `tire_pressure_fr` | `sensor` | Front right tire pressure |
| `tire_pressure_rl` | `sensor` | Rear left tire pressure |
| `tire_pressure_rr` | `sensor` | Rear right tire pressure |
| `front_defrost` | `switch` | Front windshield defrost |
| `rear_defrost` | `switch` | Rear window defrost |
| `steering_wheel_heat` | `switch` | Steering wheel heater |
| `seat_heat_driver` | `select` | Driver seat heat level |
| `seat_heat_passenger` | `select` | Passenger seat heat level |

All entity keys are optional — sections that have no configured entities are hidden.

---

## Example

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
  seat_heat_driver:       select.magneton_heated_seat_driver
  seat_heat_passenger:    select.magneton_heated_seat_passenger
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v12 | Padding consistency pass — horizontal padding normalized to 14px |
| v11 | Popup max-width normalized to 440px |
| v10 | v10 | Popup: fixed once:true tap-outside listener; body scroll lock on open/close |
| v9 | Added steering wheel heat; popup sections are now conditionally hidden based on configured entities |
| v8 | Added seat heating section with select entity support |
| v7 | Added climate controls section (defrost switches, target temp) |
| v6 | Added tire pressure section with `tire_warn_psi` threshold and warning badge |
| v5 | Added temperature section (interior/exterior) |
| v4 | Popup portalled to `document.body` — fixes clipping on HA dashboards |
| v3 | Charge animation added while charging; charge rate and time-to-full shown inline |
| v2 | Added full popup with battery and vehicle status |
| v1 | Initial release — inline battery bar, lock, climate, trunk |
