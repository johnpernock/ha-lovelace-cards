# thermostat-card

Compact thermostat card designed for use in a horizontal stack of 3. Shows current temp, a target setpoint with +/− adjustment buttons, and an HVAC mode indicator that cycles through only the modes the thermostat actually supports.

---

## How it works

### Mode cycling

The card reads the `hvac_modes` attribute directly from the live entity state — it never cycles to modes that aren't supported. Modes are cycled in a fixed preferred order: `heat_cool → auto → heat → cool → fan_only → dry → off`. Only modes present in the entity's attribute appear in the cycle.

If the entity only has one supported mode, the mode button is shown but non-interactive.

### Temperature adjustment

The +/− buttons call `climate.set_temperature` with the current target temperature adjusted by `step`. The call is debounced with a 600ms busy lock to prevent rapid double-taps from queuing multiple service calls.

For `heat_cool` / `auto` mode thermostats that report `target_temp_high` instead of `temperature`, the card uses `target_temp_high` as the display and adjustment target.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | `climate.*` entity |
| `name` | ❌ | friendly_name | Label shown above the current temperature |
| `step` | ❌ | `1` | How many degrees each +/− tap changes the setpoint |

---

## Mode colors

| Mode | Color | Notes |
|------|-------|-------|
| `heat` | Orange | |
| `cool` | Blue | |
| `heat_cool` / `auto` | Orange + Blue split dot | Both colors shown as a split circle |
| `fan_only` | Teal | |
| `dry` | Amber | |
| `off` | Gray | |

---

## Example

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
| v6 | Padding consistency pass — horizontal padding normalized to 14px |
| v5 | Touch audit: added `user-select:none` to tappable elements |
| v4 | Mode cycling now reads live `hvac_modes` attribute — no longer cycles to unsupported modes |
| v3 | Fixed +/− buttons losing their event listeners after HA state push — moved to stable DOM with `_patch()` pattern |
| v2 | Added split dot for heat_cool/auto mode; added `target_temp_high` fallback |
| v1 | Initial release |
