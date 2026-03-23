# calendar-card

Full standalone calendar card with a scrollable event list, multi-calendar support, and event detail popups. This is the full-featured calendar for the dedicated calendar view — see `clock-card` for the smaller inline clock with popup calendar.

---

## How it works

### Event fetching

Events are fetched from each configured calendar entity using HA's REST calendar API (`/api/calendars/<entity>`). The fetch window is `now` to `now + days_ahead`. Events are refreshed every `refresh_interval` minutes in the background. The `max_events` cap prevents overloading the card on busy calendars.

### Event display

Events are grouped by day. Each day section shows:
- Day abbreviation / number / month header
- A count badge if there are 2+ events on that day
- A pulsing dot on the next upcoming event (globally — across all days)
- Past events from today shown dimmed at 38% opacity
- Multi-day events shown only on their start date

### Countdown badges

Each event shows a badge: `today`, `tmrw`, or `+Nd` (number of days away). Today's date column pulses slowly as a visual accent.

### Tapping an event

Tapping opens a detail popup showing:
- Event title
- Calendar name (color-coded)
- Date and time range (or ALL DAY)
- Location (if set)
- Static map thumbnail — requires `google_maps_api_key`. If no API key is configured, a tasteful placeholder is shown instead of a broken image. If there is no location, the location section is hidden entirely.
- Description (if set)

**Important:** The `google_maps_api_key` should be stored in HA's `secrets.yaml` and referenced as `!secret google_maps_api_key` in your dashboard YAML. Never put the key directly in the dashboard config.

### Mobile vs desktop

On mobile (`< 768px`) the card can expand with its content (`mobile_expand: true`). On desktop it stays at `grid_rows` height and scrolls internally.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `calendars` | ✅ | — | List of calendar entries. Each needs `entity` (the `calendar.*` entity ID). Optional: `color` (hex dot color), `name` (display name in event popups). |
| `days_ahead` | ❌ | `14` | How many days ahead to fetch events |
| `max_events` | ❌ | `30` | Hard cap on total events fetched across all calendars |
| `refresh_interval` | ❌ | `5` | Minutes between background event refreshes |
| `grid_rows` | ❌ | `8` | HA grid rows this card occupies — controls height on desktop |
| `show_past_events` | ❌ | `true` | Show earlier-today events dimmed. Set `false` to hide them. |
| `today_color` | ❌ | `#60a5fa` | Accent color for today's date column pulse |
| `show_legend` | ❌ | `false` | Show a color legend below the card listing each calendar |
| `mobile_expand` | ❌ | `true` | On mobile, card grows with content instead of scrolling internally |
| `google_maps_api_key` | ❌ | — | Google Maps Static API key for map thumbnails in event popups. Store in `secrets.yaml`. |

---

## Example

```yaml
type: custom:calendar-card
calendars:
  - entity: calendar.personal
    color: '#60a5fa'
    name: Personal
  - entity: calendar.work
    color: '#a78bfa'
    name: Work
  - entity: calendar.family
    color: '#4ade80'
    name: Family
days_ahead: 14
max_events: 30
refresh_interval: 5
grid_rows: 8
show_past_events: true
today_color: '#60a5fa'
show_legend: false
mobile_expand: true
google_maps_api_key: !secret google_maps_api_key
```

### secrets.yaml

```yaml
google_maps_api_key: YOUR_KEY_HERE
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v4 | Added event detail popup with location, static map thumbnail, description; graceful fallback when no API key or no location |
| v3 | Added `show_past_events`, `mobile_expand`, `show_legend` options; pulsing today accent; globally-next event bold highlight |
| v2 | Multi-calendar support with per-calendar dot colors; countdown badges (today/tmrw/+Nd) |
| v1 | Initial release — single calendar, flat event list |
