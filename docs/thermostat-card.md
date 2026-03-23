# thermostat-card

Compact thermostat card designed to be used in a horizontal stack of three. Shows current temperature, target temperature with − / + adjustment buttons, and an HVAC mode indicator that cycles only through modes the entity actually supports.

---

## How it works

The mode button reads the live `hvac_modes` attribute from the entity on every update and filters it against a preferred display order. Only modes the thermostat actually supports are cycled — so a heat-only thermostat will never offer "cool" as an option. If only one mode is available, the button is shown but non-interactive.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity` | string | ✅ | Climate entity ID |
| `name` | string | ❌ | Display name shown above the temperature. Falls back to `friendly_name` |
| `step` | number | ❌ | Temperature change per `−` / `+` tap in °F or °C. Default: `1` |

---

## Mode display

Modes are shown in this preferred order (unsupported modes are skipped):

| Mode | Label | Color |
|------|-------|-------|
| `heat_cool` | Heat / Cool | Orange + blue split dot |
| `auto` | Auto | Orange + blue split dot |
| `heat` | Heat | Orange |
| `cool` | Cool | Blue |
| `fan_only` | Fan | Teal |
| `dry` | Dry | Amber |
| `off` | Off | Gray |

---

## Recommended layout

```yaml
type: horizontal-stack
cards:
  - type: custom:thermostat-card
    entity: climate.main_floor
    name: Main Floor
    step: 1
  - type: custom:thermostat-card
    entity: climate.family_room_2
    name: Family Rm
  - type: custom:thermostat-card
    entity: climate.solarium_mini_split
    name: Solarium
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v4 | Mode cycling reads live `hvac_modes` attribute — never offers unsupported modes; split dot for heat_cool/auto modes |
| v3 | `step` config parameter added |
| v2 | Mode button added with cycle support |
| v1 | Initial release — current temp, target temp, +/− buttons |
