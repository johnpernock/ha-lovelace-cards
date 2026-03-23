# technology-card

Modular technology dashboard card. Each card instance renders exactly one section. Add multiple instances in a sections-layout view to build a full tech dashboard.

---

## How it works

The card reads a `section` key from config and renders the matching template. Each section reads entity values from the `entities` map you provide. Some sections (Sonarr/Radarr, Immich) also make REST API calls to their respective services — API keys for these are pulled from HA sensor attributes or separate config keys.

### Speedtest history

The `speed` section maintains an in-memory sparkline history. Every time `set hass` fires with a new speedtest value, it appends to a rolling 20-point buffer. The sparkline only persists for the lifetime of the card instance (i.e. it resets on dashboard reload).

### Service caching

REST API calls (Sonarr, Radarr, Immich) are cached for `_CACHE_TTL` (60 seconds) to avoid hammering the APIs on every `hass` update.

---

## Parameters

### Top-level

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `section` | ✅ | — | Which section to render (see section list below) |
| `entities` | ❌ | — | Map of logical names to HA entity IDs. Required keys depend on section. |
| `title` | ❌ | Auto | Override the section header title |

---

## Sections

### `network`

Shows UniFi access point states, connected client counts, and network/SSID names.

**Entities:**
| Key | Entity |
|-----|--------|
| `ap_office` | `sensor.office_u7_state` |
| `ap_family_room` | `sensor.family_room_u7_state` |
| `clients_office` | `sensor.office_u7_clients` |
| `clients_fr` | `sensor.family_room_u7_clients` |
| `sophienet` | `sensor.sophienet` |
| `sophienet_iot` | `sensor.sophienet_iot` |
| `sophienet_guest` | `sensor.sophienet_guest_2` |

---

### `speed`

Speedtest results with sparkline graph history.

**Entities:**
| Key | Entity |
|-----|--------|
| `speedtest_download` | `sensor.speedtest_download` |
| `speedtest_upload` | `sensor.speedtest_upload` |
| `speedtest_ping` | `sensor.speedtest_ping` |

---

### `access_points`

AP status with restart buttons.

**Entities:**
| Key | Entity |
|-----|--------|
| `ap_office` | `sensor.office_u7_state` |
| `ap_family_room` | `sensor.family_room_u7_state` |
| `restart_office` | `button.office_u7_restart` |
| `restart_fr` | `button.family_room_u7_restart` |
| `restart_dream` | `button.beryl_dream_machine_restart` |

---

### `services`

Unraid Docker service on/off grid. Each switch is a toggle tile.

**Entities:** Map service names to their `switch.unraid_*` entities.

```yaml
section: services
entities:
  sonarr:       switch.unraid_sonarr
  radarr:       switch.unraid_radarr
  jellyfin:     switch.unraid_jellyfin
  immich:       switch.unraid_immich
  seerr:        switch.unraid_seerr
  syncthing:    switch.unraid_syncthing
  jackett:      switch.unraid_jackett
  gitea:        switch.unraid_gitea
  kitchenowl:   switch.unraid_kitchenowl
  profilarr:    switch.unraid_profilarr
  homeassistant: switch.unraid_homeassistant
  homarr:       switch.unraid_homarr
  icloudpd:     switch.unraid_icloudpd
```

---

### `storage`

Unraid server resource usage — CPU, RAM, array, cache bars. Parity check status if active.

**Entities:**
| Key | Entity |
|-----|--------|
| `cpu_util` | `sensor.unraid_cpu_utilization` |
| `cpu_temp` | `sensor.unraid_cpu_temperature` |
| `ram` | `sensor.unraid_ram_usage` |
| `array` | `sensor.unraid_array_usage` |
| `array_state` | `sensor.unraid_array_state` |
| `cache` | `sensor.unraid_cache_usage` |
| `parity` | `sensor.unraid_parity_check` |
| `parity_progress` | `sensor.unraid_parity_check_progress` |
| `parity_speed` | `sensor.unraid_parity_check_speed` |

---

### `ink`

Epson printer ink levels as color-coded bars.

**Entities:**
| Key | Entity |
|-----|--------|
| `black` | `sensor.epson_et_5170_series_black_ink` |
| `cyan` | `sensor.epson_et_5170_series_cyan_ink` |
| `magenta` | `sensor.epson_et_5170_series_magenta_ink` |
| `yellow` | `sensor.epson_et_5170_series_yellow_ink` |

---

### `immich`

Immich photo library stats — photo count, video count, disk used/available.

**Entities:**
| Key | Entity |
|-----|--------|
| `photos` | `sensor.immich_photos_count` |
| `videos` | `sensor.immich_videos_count` |
| `disk_available` | `sensor.immich_disk_available` |
| `disk_size` | `sensor.immich_disk_size` |

---

### `now_playing` / `recently_added`

Recent Sonarr/Radarr activity. Reads from HA REST sensors (`sensor.sonarr_recent`, `sensor.radarr_recent`).

**Entities:**
| Key | Entity |
|-----|--------|
| `sonarr` | `sensor.sonarr_recent` |
| `radarr` | `sensor.radarr_recent` |

---

### `controls`

Generic switch/button grid. Define any entities you want as on/off tiles.

---

## Full example

```yaml
type: custom:technology-card
section: network
entities:
  ap_office:       sensor.office_u7_state
  ap_family_room:  sensor.family_room_u7_state
  clients_office:  sensor.office_u7_clients
  clients_fr:      sensor.family_room_u7_clients
  sophienet:       sensor.sophienet
  sophienet_iot:   sensor.sophienet_iot
  sophienet_guest: sensor.sophienet_guest_2
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v11 | Added `immich` section; added `recently_added` section |
| v10 | Added `now_playing` section (Sonarr/Radarr) |
| v9 | Added parity check status to `storage` section |
| v8 | Added `access_points` section with restart buttons |
| v7 | Added `controls` generic section |
| v6 | Added `ink` section for Epson ink levels |
| v5 | Added `services` section for Unraid Docker switches |
| v4 | Added `storage` section with usage bars |
| v3 | Added sparkline history to `speed` section |
| v2 | Added `speed` section (Speedtest) |
| v1 | Initial release — `network` section |
