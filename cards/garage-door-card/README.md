# garage-door-card

Standalone compact garage door toggle card. A single large button shows the door state and lets you open or close with one tap.

---

## How it works

The card reads the cover entity state and maps it to a visual theme and service call:

| State | Color | Button action |
|-------|-------|--------------|
| `closed` | Green | `cover.open_cover` |
| `open` | Blue | `cover.close_cover` |
| `opening` | Amber | Disabled (animated progress bar) |
| `closing` | Orange | Disabled (animated progress bar) |
| `stopped` / unknown | Gray | `cover.toggle` |

While the door is moving (`opening` / `closing`), the button is disabled and an indeterminate progress bar animates to show activity. An 800ms busy lock prevents double-taps from firing multiple service calls.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | A `cover.*` entity |
| `name` | ❌ | friendly_name | Override the display name |

---

## Example

```yaml
type: custom:garage-door-card
entity: cover.garage_door
name: Garage
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v2 | Improved icon set — unique SVG for each state (closed panels, open void, up/down arrows); matched Tesla card button design language |
| v1 | Initial release |
