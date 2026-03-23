# garage-door-card

Standalone compact garage door toggle card. A single large tap-target button shows the current state and calls the appropriate service. Matches the Tesla card button design language.

---

## How it works

The button reads the cover entity state and maps it to a visual theme (color, label, icon, service). Moving states (opening, closing) show an indeterminate progress bar and disable the button to prevent conflicting commands. A busy flag prevents double-taps from firing multiple service calls.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity` | string | ✅ | Cover entity ID for the garage door |
| `name` | string | ❌ | Display name. Falls back to the entity's `friendly_name` |

---

## States

| State | Color | Label | Tap action |
|-------|-------|-------|-----------|
| `closed` | Green | Closed | `cover.open_cover` |
| `open` | Blue | Open | `cover.close_cover` |
| `opening` | Amber | Opening… | Disabled (in progress) |
| `closing` | Orange | Closing… | Disabled (in progress) |
| `stopped` / unknown | Gray | Stopped | `cover.toggle` |

---

## Full example

```yaml
type: custom:garage-door-card
entity: cover.garage_door
name: Garage
```

### Inside a horizontal stack with thermostats

```yaml
type: horizontal-stack
cards:
  - type: custom:garage-door-card
    entity: cover.garage_door
    name: Garage
  - type: custom:thermostat-card
    entity: climate.main_floor
    name: Main Floor
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v2 | Busy flag prevents double-tap service calls; `stopped` and `unavailable` states handled |
| v1 | Initial release — open/close/opening/closing states, indeterminate progress bar |
