# weather-card-nws

A weather card built for the NWS (National Weather Service) HA integration, but compatible with any `weather.*` entity. Shows current conditions inline and a rich detail popup on tap.

---

## How it works

### Forecast subscriptions

The card uses Home Assistant's `weather/subscribe_forecast` WebSocket API to receive forecast data — the same method HA's built-in weather card uses. It maintains two subscriptions:

- **`twice_daily`** — used for the 7-day strip and extended forecast
- **`hourly`** — used for the 12-hour scroll in the popup

Subscriptions are set up on the first `hass` assignment and cleaned up in `disconnectedCallback()` to avoid memory leaks.

### Alert banner

When `alert_entity` is configured and its state is anything other than `unavailable`, `unknown`, or an empty/None value, an amber alert banner is shown at the top of the card.

### Popup

Tapping the card (when `tap_action: popup`) opens a bottom sheet (mobile) or centered modal (desktop ≥768px) with:
- Current conditions grid: humidity, dew point, UV index, visibility, pressure, cloud cover
- Hourly forecast strip (12 hours, horizontally scrollable)
- 7-day extended forecast with high/low temps and precipitation probability bars

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | Any `weather.*` entity. Works best with the NWS integration. |
| `name` | ❌ | friendly_name | Override the location name displayed on the card |
| `unit` | ❌ | Entity's unit | Temperature unit: `°F` or `°C` |
| `alert_entity` | ❌ | — | A sensor entity that holds NWS alert text. When active (non-empty, non-unavailable state), an amber alert banner appears on the card. |
| `tap_action` | ❌ | `popup` | `popup` opens the detail popup. `none` disables tapping. |

---

## Example

```yaml
type: custom:weather-card-nws
entity: weather.home
name: Paoli
unit: °F
alert_entity: sensor.nws_alerts
tap_action: popup
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v6 | v6 | Popup max-width normalized to 440px |
| v5 | v5 | Popup: fixed once:true tap-outside listener; body scroll lock on open/close; overscroll-behavior:contain |
| v4 | Touch audit: added `-webkit-tap-highlight-color:transparent` to tap area |
| v3 | Tap hint label ("Tap for detailed forecast") removed — tap still works, label was visual clutter |
| v2 | Added hourly forecast subscription and 12-hour scroll strip in popup; added `alert_entity` banner support |
| v3 | Removed "Tap for detailed forecast" hint label from card — tap still works. Touch/mobile audit: added `-webkit-tap-highlight-color:transparent`. |
| v1 | Initial release — current conditions, 7-day strip, twice-daily popup |
