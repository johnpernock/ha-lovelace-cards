# Dashboard

Main HA Lovelace dashboard YAML — version controlled here alongside the custom cards.

## Deploy

```bash
cp /config/ha-custom-cards/dashboard/dashboard.yaml /config/ha-config/dashboard.yaml
```

Then in HA: **Developer Tools → YAML → Reload Location & Customizations**
or fully reload HA if changes aren't picked up.

## Views

| View | Cards | Notes |
|---|---|---|
| Home | clock, weather, septa, tesla, door-sensor, room-buttons, thermostats, bambu-status, now-playing, calendar | Main daily view |
| Lights / Fans | room-controls-card per room | Full light + fan + blind + thermostat controls |
| Security | camera-layout-card | Panel view |
| Commute | traffic, leave-by, septa (expanded), tesla-commute, charging | Commute day view |
| Technology | network-status, network-speed, access-points, immich, server-health, services, storage, network-controls, printer-ink | All individual extracted cards — no technology-card sections |
| Media | now-playing, appletv-remote, homepod-music, jellyseerr, recently-added, ps5, steam | |
| 3D Printer | bambu-printer-card | Panel view |
| Energy | wallbox, peco, ecoflow | |

## Technology view card migration

The Technology view was previously built using `technology-card` with named sections
(`section: network`, `section: server_health`, etc.) wrapped in `vertical-stack` blocks.
Each section has been migrated to its standalone extracted card. The `vertical-stack`
wrappers were removed — cards are placed directly in each section's `cards:` list.

| Old | New |
|---|---|
| `technology-card section: network` | `network-status-card` |
| `technology-card section: speed` | `network-speed-card` |
| `technology-card section: access_points` | `access-points-card` |
| `technology-card section: immich` | `immich-card` |
| `technology-card section: server_health` | `server-health-card` |
| `technology-card section: services` | `services-card` |
| `technology-card section: storage` | `storage-card` |
| `technology-card section: controls` | `network-controls-card` (v3 pill layout) |
| `technology-card section: ink` | `printer-ink-card` |
| `technology-card section: recently_added` | `recently-added-card` |
| `printer-status-card` (deprecated) | `bambu-status-card` |
