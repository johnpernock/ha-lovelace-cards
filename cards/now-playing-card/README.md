# now-playing-card

Compact now-playing widget for the home view. Shows active media players with title, source app, and room name. Idle players shown as compact dim rows. Collapses to an invisible empty card when all players are idle — no wasted space.

Tapping an active player opens the HA more-info dialog for that entity.

---

## How it works

On every `set hass`, the card checks each player's state. States `playing`, `paused`, and `buffering` are considered active. All others (idle, standby, off, unavailable) are shown as idle rows.

When zero players are active the card renders an empty `ha-card` with no content — identical to the `printer-status-card` idle behavior. This means you can place it at the top of the home view and it disappears when nothing is playing.

Media title resolution priority: `media_series_title` + episode info → `media_title` → `friendly_name`.

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | ✅ | `custom:now-playing-card` |
| `players` | list | ✅ | List of media player definitions |

### `players` item

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `entity` | string | ✅ | `media_player.*` entity ID |
| `name` | string | ❌ | Room/display name. Defaults to entity ID slug |

---

## Full config example

```yaml
type: custom:now-playing-card
players:
  - entity: media_player.family_room
    name: Family Room
  - entity: media_player.master_bedroom
    name: Master Bedroom
  - entity: media_player.office
    name: Office
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v2 | Touch audit: added `user-select:none` to tappable elements |
| v1 | Initial release. Collapses when idle, tap → more-info, TV show episode formatting |
| v2 | Touch/mobile audit: added `user-select:none` to tappable elements |
