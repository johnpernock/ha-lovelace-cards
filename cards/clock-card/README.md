# clock-card

Large clock with live seconds and AM/PM. Optionally shows a next-event strip and opens a full calendar popup when you tap the date.

---

## How it works

### Tick

The card runs a `setInterval` every 1 second to update the time display. The interval is started in `setConfig` and `connectedCallback`, and cleared in `disconnectedCallback`. Only the time portion is updated each tick — the rest of the card is not re-rendered.

### Calendar events

When `calendar_entities` is configured, the card fetches events from each calendar using HA's calendar API (`/api/calendars/<entity>?start=...&end=...`). Events are re-fetched every 5 minutes. Events are stored keyed by date so the popup calendar grid can show colored dots on days that have events.

### Next event strip

If `show_next_event: true` and calendar events are loaded, the card scans all events for the soonest upcoming one and shows its title + a countdown badge (today / tmrw / +Nd) below the time row.

### Popup

Tapping the date side of the card opens a month calendar grid. The grid shows:
- Today highlighted with `today_color` dot and ring
- Days with events showing colored dots (one dot per calendar, up to 3 per day)
- ← / → buttons for month navigation

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `calendar_entities` | ❌ | — | List of calendar entities to load events from. Each entry needs `entity` and optionally `color` (hex dot color, default `#60a5fa`). |
| `show_next_event` | ❌ | `true` (when calendars set) | Show the next upcoming event title + countdown below the time |
| `today_color` | ❌ | `#60a5fa` | Accent color for today's date in the popup calendar grid |

---

## Example

```yaml
type: custom:clock-card
calendar_entities:
  - entity: calendar.personal
    color: '#60a5fa'
  - entity: calendar.work
    color: '#a78bfa'
  - entity: calendar.family
    color: '#4ade80'
show_next_event: true
today_color: '#60a5fa'
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v3 | Added calendar popup with month navigation and event dots; added next-event strip |
| v2 | Added `today_color` option; seconds display refined |
| v1 | Initial release — clock and date display only |
