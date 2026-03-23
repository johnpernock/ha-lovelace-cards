# printer-status-card

Compact Bambu Lab printer status widget for the home view. Only renders when the printer is actively doing something — returns an invisible empty card when idle, so it takes up no layout space.

---

## How it works

The card checks the printer state on every `hass` update. If the printer is idle and no error is active, it renders an empty transparent card with zero padding — effectively invisible in the dashboard layout.

### States that trigger a visible card

| State | What shows |
|-------|-----------|
| Printing | Blue dot, job name, time remaining, progress bar, percentage |
| Paused | Amber dot, "Paused", time remaining, progress bar |
| Finished | Green dot, "Print complete", job name, Done badge |
| Error (HMS / print error) | Red dot, "Printer Error", error description, "Action needed" badge |

### Idle / offline

When `current_stage` is `unavailable`, `offline`, or missing — or the printer is otherwise idle — the card renders as an empty `<ha-card>` with no visible content. This means you can leave it in your dashboard at all times and it only appears when relevant.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `printer` | ❌ | `p1s_01p09a3a1100648` | Entity prefix for your printer |

---

## Example

```yaml
type: custom:printer-status-card
printer: p1s_01p09a3a1100648
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v1 | Initial release — compact status widget for home view |
