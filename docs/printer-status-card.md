# printer-status-card

Compact Bambu Lab print status widget for the home view. Only visible when something is actively happening — it renders nothing when the printer is idle, so it takes up zero space in your layout.

---

## How it works

On every update the card checks the printer's current state. If the printer is idle, offline, or unavailable, the card returns a zero-padding transparent `ha-card` — invisible in the layout. Only when the printer is printing, paused, finished, or has an error does the card render its content.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `printer` | string | ❌ | Entity ID prefix. Default: `p1s_01p09a3a1100648` |

Same entity prefix system as `bambu-printer-card`.

---

## States and display

| Condition | Display |
|-----------|---------|
| **Printing** | Blue dot · "Printing · {task name}" · time remaining · progress bar |
| **Paused** | Amber dot · "Paused · {task name}" · time remaining · progress bar |
| **Finished** | Green dot · "Print complete" · task name · "Done" badge |
| **Error** | Red dot · "Printer Error" · error description · "Action needed" badge |
| **Idle / Offline / Unavailable** | Empty card (zero height) |

---

## Full example

```yaml
type: custom:printer-status-card
printer: p1s_01p09a3a1100648
```

Place this near the top of your home view. It will silently disappear when the printer is not in use.

---

## Changelog

| Version | Changes |
|---------|---------|
| v1 | Initial release — zero-height idle state; printing/paused/finished/error display modes |
