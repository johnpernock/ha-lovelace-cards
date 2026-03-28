# Changelog

All notable changes to this project are documented here.
Most recent changes are listed first within each month.

---

## [Mar 2026] — Unavailable/inactive states applied to all media cards

### Changed

Applied the unavailable/inactive state pattern (documented in STYLE-GUIDE.md) to all remaining media cards:

**`appletv-remote-card`**
- Unavailable banner shown below tabs when entity is unavailable
- Transport button rows (`btn-row`) dimmed to `.3` opacity and non-interactive when unavailable
- D-pad and navigation buttons remain interactive (remote commands still work when TV is on but media player integration is down)
- Badge now shows "Unavailable" state correctly (was incorrectly falling through to "Idle")

**`ps5-card`**
- Unavailable banner shown when entity state is `unavailable` or `unknown`
- `.action-btn.disabled` CSS added (`opacity: .3; pointer-events: none`) — Wake and Turn Off buttons were already toggling this class but had no style rule for it

**`now-playing-card`** — no changes. Intentionally collapses to invisible when all players are idle. This is the correct pattern for a card that only has value when something is actively playing.

---

## [Mar 2026] — HomePod group inactive state + unavailable pattern

### Changed

**`homepod-music-card`** — group toggle and group volume now reflect playback state:
- Speaker toggle disabled (opacity .25, pointer-events none) when nothing is playing AND the speaker is not already part of a group. If already grouped, toggle stays enabled so the group can be dissolved even while idle.
- Group volume slider dimmed when only one speaker is active (no group to adjust).
- Unavailable banner shown below header when the coordinator entity is unavailable.

**STYLE-GUIDE.md** — new section documenting the unavailable/inactive state pattern:
- Two distinct states: unavailable (entity down) vs inactive (idle/off but reachable)
- `.unavail-banner` pattern for inline unavailable indication
- `.control-disabled` pattern for opacity + pointer-events on specific controls
- Media card rules table covering transport, volume, group toggle, group volume per state
- Only `homepod-music-card` implements this so far — other media cards to follow

---

## [Mar 2026] — No outer borders + Media view

### Fixed

**Outer border removed from 13 cards** — all cards now follow the no-outer-border rule. The `.wrap`/`.card` shell is borderless on all 45 cards. Internal structure (rows, tiles, pills, sections) still uses `rgba(255,255,255,.10–.14)` borders. Cards fixed: appletv-remote-card, homepod-music-card, jellyseerr-card, kiosk-displays-card, kiosk-health-card, kiosk-voice-card, network-controls-card, network-devices-card, piscsi-card, printer-ink-card, ps5-card, recently-added-card, steam-card.

STYLE-GUIDE.md updated — no-outer-border rule now explicitly covers both `ha-card` and the inner `.wrap`/`.card` container.

### Changed

**Dashboard — Media view added** (`dashboard/dashboard.yaml`). Moved `recently-added-card` from Technology view column 3 to the new Media view. Media view has 3 columns: Now Playing + Apple TV remotes | HomePods + Jellyseerr | Recently Added + PS5 + Steam.

Technology view column 3 now contains: `network-controls-card` and `printer-ink-card` only.

---

## [Mar 2026] — Dashboard migration + version control

### Added

**`dashboard/dashboard.yaml`** — main Lovelace dashboard now tracked in this repo alongside the cards. Includes a `dashboard/README.md` with deploy instructions and a migration table.

### Changed

**Technology view** — complete migration from `technology-card` section instances to individual standalone cards. All `vertical-stack` wrappers removed. Cards placed directly in section `cards:` lists.

| Removed | Replaced with |
|---|---|
| `technology-card section: network` | `network-status-card` |
| `technology-card section: speed` | `network-speed-card` |
| `technology-card section: access_points` | `access-points-card` |
| `technology-card section: immich` | `immich-card` |
| `technology-card section: server_health` | `server-health-card` |
| `technology-card section: services` | `services-card` |
| `technology-card section: storage` | `storage-card` |
| `technology-card section: controls` | `network-controls-card` v3 (pill grid) |
| `technology-card section: ink` | `printer-ink-card` |
| `technology-card section: recently_added` | `recently-added-card` |

**Home view** — `printer-status-card` (deprecated) replaced with `bambu-status-card`.

All other views (Lights/Fans, Security, Commute, 3D Printer, Energy) unchanged.

---

## [Mar 2026] — network-controls-card v3

### Changed

**`network-controls-card` (v2 → v3)** — complete rewrite.

The card was previously a vertical list of icon+label rows with a chevron. Replaced with a 3-pill-across grid layout matching the kiosk control card suite pattern. Icon sits above a centred label in each pill. Pill colour encodes action severity — neutral for standard restarts, danger (red) for destructive actions, warn (amber) for caution, info (blue) for status, success (green) for safe actions.

Structural fixes from v2: class body was malformed with `_css()` and `_buildControls()` outside the class, a stray `customElements.define('technology-card', TechnologyCard)` line mid-file, and duplicate `_ico()` definitions. All resolved in the clean rewrite.

New config format uses `sections:` with optional `title:` labels per group. Legacy `restart_buttons:` flat list is still accepted and auto-mapped. `danger: true` legacy flag maps to `color: danger`.

Confirmation overlay retained for danger and warn colour pills — auto-triggered unless `confirm: false` is set explicitly.

---

## [Mar 2026] — network-devices-card + piscsi-card

### Added

**`network-devices-card` (v1)**
Network infrastructure monitoring — gateway stats (WAN status, ping latency, uptime, client count), managed switches with port grids and PoE budget bars, unmanaged switches as side-by-side pills, and configurable coming-soon pending tiles. PoE port control popup (via `ha-popup.js` portal) shows per-port rows with left-accent-bar pattern, live wattage, and toggle switches. Supports configurable pending tiles for Pi-hole and UPS once set up. All entity references configurable — gateway sensors, switch sensors, per-port switch entities and power sensors.

**`piscsi-card` (v1)**
PiSCSI / RaSCSI monitoring via direct REST API — no HA integration needed. Polls `/api/v1/devices` and `/api/v1/system/status` every 30s (configurable). Shows daemon status bar, SCSI device rows using the style-guide left-accent-bar pattern (green for HD, blue for CD, purple for MO), and an eject button per device with confirmation overlay. Device type codes mapped to human labels (SCHD→HD, SCCD→CD, SCRM/SCMO→MO). Security: host validated against safe character allowlist, SCSI IDs validated 0–7, API response data via textContent only, busy lock on eject.

### Design standards audit — both cards

| Check | network-devices-card | piscsi-card |
|---|---|---|
| `_patch()` not `_render()` on updates | ✓ | ✓ (patchDevices) |
| `disconnectedCallback` clears interval | ✓ portal destroyed | ✓ clearInterval |
| `_trackDoc` / `_clearDocHandlers` | ✓ | n/a (no doc listeners) |
| `getStubConfig` | ✓ | ✓ |
| `getConfigForm` | ✓ schema | ✓ schema with entity pickers |
| `setConfig` validation | ✓ | ✓ host required + format check |
| `getCardSize` | ✓ computed | ✓ |
| No `innerHTML` with external data | ✓ | ✓ textContent for API data |
| No `eval()` | ✓ | ✓ |
| Input sanitisation | ✓ | ✓ HOST_SAFE_RE, SCSI ID 0-7 |
| 44px touch targets | ✓ | ✓ |
| Active states | ✓ | ✓ |
| `-webkit-tap-highlight-color` | ✓ | ✓ |

---

## [Mar 2026] — Kiosk control card suite

### Added

Three new cards designed as a suite for the kiosk/media technology view. Each card is fully independent — place them in any column layout.

**`kiosk-displays-card` (v1)**
Wall-panel display control. Per-display rows with on/off toggle and five brightness pips (20/40/60/80/100). Sleep banner with "Wake both" when all displays are off. Schedule countdown shows next dim/wake event with live time remaining. Night action sets all displays to configurable brightness. Calls `light.turn_on/off` on HA template lights.

**`kiosk-health-card` (v1)**
Read-only monitoring. Four tiles: API health + uptime + Pi CPU temp per display, touch-to-wake grab state (blue when evdev grab is active), and last tap with time delta. Pulls from REST sensors defined in `ha-display-config.yaml`.

**`kiosk-voice-card` (v1)**
Voice satellite monitoring and control. Per-satellite rows showing online/listening/muted/pending state, mic mute toggle, TTS speaker volume pips (25/50/75/100), and last wake phrase. Section actions: Mute all, Unmute all, Night vol. Gracefully handles unconfigured satellites with "Pending setup" state — wire in entities progressively as satellites come online.

### Design notes

Cards were designed through 5 mockup iterations covering: sleep mode banner, per-display schedule countdown, touch-to-wake live state, voice satellite states (idle/listening/muted/pending), mic mute toggle (red when muted for privacy visibility), and volume pips coloured in info-blue to distinguish from display brightness (amber). Pill buttons used throughout — no sliders.

---

## [Mar 2026] — Wire real entity IDs for media cards

### Changed

**`appletv-remote-card` (v2)** — `getStubConfig()` updated with real Apple TV entity IDs:
- Family Room: `media_player.family_room` + `remote.family_room`
- Bedroom: `media_player.master_bedroom` + `remote.master_bedroom`
- Office: `media_player.office` + `remote.office`

**`homepod-music-card` (v2)** — `getStubConfig()` updated with real HomePod entity IDs:
- Family Room: `media_player.family_room_hp`
- Master Bedroom: `media_player.master_bedroom_hp`
- Dining Room: `media_player.dining_hp` *(not kitchen as initially assumed — corrected)*

**`now-playing-card` (v12)** — stub updated to match Apple TV entities.

**`ha-config/dashboard.yaml`** — Media view wired with real entities.

**`ps5-card` and `steam-card`** — integration not yet configured in HA; cards ready but will show unavailable until integrations are added (ha-playstation HACS + built-in Steam integration).

---

## [Mar 2026] — PII audit + address redaction

### Security

**Removed real street addresses from all files.**

A full PII scan across all repos found two real addresses (home and work) embedded in example configs in `CARDS.md`, `traffic-card.js`, `ha-config/dashboard.yaml`, `ha-config/README.md`, and `ha-config/deprecated/waze-sensors.yaml`. All replaced with generic `Home Address` / `Work Address` placeholders.

Files updated:
- `CARDS.md` — traffic-card and tesla-commute-card example configs
- `cards/traffic-card/traffic-card.js` — doc comments + fallback default label
- `ha-config/dashboard.yaml` — Waze sensor route labels
- `ha-config/README.md` — sensor route table
- `ha-config/deprecated/waze-sensors.yaml` — origin/destination fields

All other findings across all four repos were confirmed false positives:
- `1.1.1.1` in kiosk-setup.sh — routing utility, never contacts Cloudflare
- `a1b2c3d4...` — example placeholder in an echo instruction
- `friendly_name: "Kiosk Screen"` — device label, not a person's name
- Generic security sensor labels (Someone Home, Everyone Away, etc.)
- Nest `device_id` — hardware identifier, not personal data

---

## [Mar 2026] — Technology card extractions + getConfigForm + CI

### Added

**9 new standalone cards extracted from `technology-card`:**

Each section that previously required `type: custom:technology-card` with `section: X` is now also available as its own card that can be placed anywhere on any dashboard view independently.

| New card | Replaces |
|---|---|
| `network-status-card` | `technology-card` section: network |
| `network-speed-card` | `technology-card` section: speed |
| `access-points-card` | `technology-card` section: access_points |
| `server-health-card` | `technology-card` section: server_health |
| `services-card` | `technology-card` section: services |
| `storage-card` | `technology-card` section: storage |
| `network-controls-card` | `technology-card` section: controls |
| `immich-card` | `technology-card` section: immich |

`technology-card` itself is unchanged — all existing dashboard configs continue to work.

**`getConfigForm()` on all 40 cards** — enables the native HA visual card editor. Clicking the card in the dashboard UI now opens a form with entity pickers and dropdowns instead of raw YAML. Cards with complex array configs (rooms, buttons, cameras) show a note directing to YAML.

**GitHub Actions CI** (`.github/workflows/ci.yml`):
- Syntax checks all card JS files on every push and pull request
- Checks shared modules
- Verifies deploy.sh CARDS array matches the cards/ directory
- CI badge added to README

### Changed

- **`technology-card` (v27→v28)** — `_buildRecentlyAdded` annotated as sharing logic with `recently-added-card`
- **`deploy.sh`** — 9 new cards added to CARDS array
- All existing cards bumped one minor version for `getConfigForm` addition

---

## [Mar 2026] — Security audit pass

### Fixed

**`protect-events-card` (v7→v8) — two fixes:**

1. **`thumbnailUrl` was undefined** — the function was called but never defined, causing a silent `ReferenceError` at runtime so thumbnails never loaded. Defined as a module-level function that constructs the correct HA UniFi Protect API path (`/api/unifiprotect/thumbnail/<eventId>`).

2. **UUID validation on `eventId`** — before constructing the thumbnail URL, `eventId` is validated against a strict UUID regex (`/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i`). Malformed event IDs (which could theoretically be injected via a compromised UniFi Protect integration) are rejected and return `null` — the fetch is skipped entirely.

3. **`src` attribute restricted to `/api/` paths** — `thumbUrl` is checked to start with `/api/` before being placed in `<img src>`. Prevents any non-HA URL from appearing in the img element, even if `thumbUrl` were somehow set to an external value.

### Audit findings (no action required)

All other 30 cards were audited and are clean:
- No `eval()` usage in any card
- No hardcoded API keys or credentials
- No `postMessage` without origin validation
- No external fetch URLs (all calls are same-origin HA API or local Pi API)
- `innerHTML` usage across all cards is with HA state data (trusted source — entity names and states controlled by HA admin, not end users)

---

## [Mar 2026] — Performance audit + configurability pass

### Performance fixes

All 31 cards audited. 5 real issues found and fixed, 26 already clean.

**`room-controls-card` (v96→v97) — critical popup slider leak**
Each popup open was adding 12 document-level event listeners (mousemove/touchmove/mouseup/touchend × 3 sliders) that were never removed. On a wall panel open all day with repeated popup interactions, this accumulated to hundreds of zombie listeners. Fix: added `_trackDoc(event, handler, opts)` helper that registers listeners and stores them for cleanup. Added `_clearDocHandlers()` called on popup close and in new `disconnectedCallback`.

**`room-buttons-card` (v31→v32) — same popup slider leak**
8 document listeners per popup open. Same fix as room-controls-card — `_trackDoc` + `_clearDocHandlers` + `disconnectedCallback`.

**`ecoflow-card` (v9→v10) — drag slider listener leak**
4 document listeners in `_attachListeners()` with no cleanup. Added named handler variables pushed to `_docHandlers[]` array, added `disconnectedCallback` that iterates `_docHandlers` and removes each from document.

**`wallbox-card` (v12→v13) — drag slider listener leak**
Same pattern as ecoflow-card. 4 document listeners, same fix.

**`technology-card` (v26→v27) — unnecessary full DOM rebuild on every hass update**
`_patch()` was calling `haCard.innerHTML = inner` and `this._listen()` on every HA state push, regardless of whether any relevant sensor values changed. Added `_patchKey()` that fingerprints entity `last_updated` timestamps. `_patch()` now returns early when the key matches `_lastPatchKey`, skipping the rebuild entirely.

### Configurability fixes

**`bambu-printer-card` (v12→v13)** — added `setConfig` validation with clear error message when `printer` prefix is missing.

**`bambu-status-card` (v8→v9)** — same validation added.

**`septa-paoli-card` (v40→v41)** — added `setConfig` validation requiring at least one `outbound.trains` or `inbound.trains` sensor array.

### False positives (documented for clarity)

The following were flagged by the initial audit script but are **not** issues:
- `innerHTML` in `_patch()` on `garage-door-card`, `now-playing-card`, `temp-strip-card` — these are targeted SVG/text updates on specific elements, not full re-renders
- `_render()` in `_patch()` on `thermostat-card`, `weather-card-nws` — only called when entity becomes unavailable/null, not on normal updates
- "Hardcoded entities" in all cards — these were `getStubConfig()` example values or `|| 'fallback'` defaults, not actual hardcoded logic
- `leave-by-card`, `septa-paoli-card` `set hass` — guards use DOM query (`querySelector`) which is equivalent and correct

---

## [Mar 2026] — Media view cards + naming pass

### Added

**`appletv-remote-card` (v1)** — Apple TV remote with multi-ATV selector tabs, 200px D-pad, 2×4 button grid (Menu/Back/Home/Play + Prev/Next/Vol+/Vol−), drag volume slider, sleep/power button. `_patch()` updates now-playing strip without full re-render. Document-level drag listeners cleaned up on disconnect.

**`homepod-music-card` (v1)** — HomePod group management + music control. Now playing with 5s auto-advancing progress bar, transport controls, per-speaker group toggles (`media_player.join`/`unjoin`), individual volume bars, group master volume slider, configurable favorites grid (4-col, 1–2 rows, emoji + name). Volume debounced 150ms. Document listeners cleaned up on disconnect.

**`recently-added-card` (v1)** — Standalone card extracted from `technology-card` section:recently_added. Sonarr + Radarr recent imports merged and sorted by date. Only re-renders when sensor `last_updated` changes. Includes all Sonarr v3 title + episode resolution fixes.

**`jellyseerr-card` (v1)** — Jellyseerr search + request card. 400ms debounced search, request status badges (Pending/Processing/Partial/Available), optional server power entity dot, clear button. Requests movies as `mediaType:movie` and TV shows with `seasons:all`.

**`ps5-card` (v1)** — PlayStation 5 status via ha-playstation HACS integration. Power state badge, current game tile, wake (when off) and turn off (when on) buttons with 2s busy lock and pointer-events disable on inactive state.

**`steam-card` (v1)** — Steam online status via built-in HA Steam integration (no HACS). Per-account rows: in_game (blue + game title), online (green), offline (gray + last seen time). `_patch()` replaces only changed rows.

### Changed

**`printer-status-card` → `bambu-status-card` (v8)** — Renamed for naming convention clarity. Old folder kept with deprecation notice. `dashboard.yaml` updated.

**Naming convention established:**
- `printer-*` = Epson inkjet (paper printer)
- `bambu-*` = Bambu Lab 3D printer

### Performance fixes

- `appletv-remote-card` + `homepod-music-card`: document-level mousemove/touchmove/mouseup/touchend listeners now stored on instance and removed in `disconnectedCallback()` — previously leaked on every card re-render

---

## [Mar 2026] — Latest (naming pass)

### Added
- **`printer-ink-card`** — standalone Epson printer ink levels extracted from `technology-card`. Four bars (K/C/M/Y), low-ink warning at < 20%. Use independently or alongside the technology cards.

### Changed
- **`printer-status-card` → `bambu-status-card`** — renamed for clarity. The card has always been Bambu Lab 3D printer specific. Naming convention going forward: `printer-*` = Epson inkjet, `bambu-*` = Bambu Lab 3D printer.
- `dashboard.yaml` updated to use `custom:bambu-status-card`

---

## [Mar 2026] — Latest

### Bug fixes

**Door sensor card (v19)**
- Fixed `type: garage` in `doors:` array — cover entity state (`open`/`opening`) now correctly detected for banner count and popup tile
- `_isOpen()` now handles both `binary_sensor` (`on`) and `cover` (`open`/`opening`) entities
- Garage tile in popup now reads entity state directly from `d.entity` instead of requiring separate `garage:` config key
- Banner open count and open names list correctly include garage-type items from the `doors:` array

**Room controls card (v96)**
- Slider thumb (circular handle) now hides (`opacity:0`) when light is off — eliminates the stray dot/bar visible at the right end of the brightness track on the home view

**Popups / buttons (all cards)**
- Popup overlay dim increased from 55% to 85% opacity — more readable on Amoled+ theme
- Popup sheet background changed to true black `#000000` on all cards for proper Amoled display
- Wall display (≥768px) popup modal now has a visible `1.5px solid rgba(255,255,255,0.20)` border — was invisible before
- `room-controls-card`: `mode-btn` (fan mode / swing / preset buttons in thermostat popup) border bumped from `0.5px` (invisible) to `1.5px`
- `room-controls-card`: `rcc-sheet` now has border at ≥768px — was `border:none`
- `room-buttons-card`: popup sheet border at ≥768px now `1.5px solid rgba(255,255,255,0.20)` — was only a bottom border
- `room-buttons-card`: All Lights (`rb-master`) amber border opacity increased for better visibility

**Tesla commute card (v15)**
- Action buttons (lock, trunk, sentry, climate) now work correctly — `_attachListeners()` was already re-called after `_patch()` (confirmed working)
- Odometer button now shows blue color (`#60a5fa`) and blue background/border when a value is present — was always dim regardless of value
- Odometer color updates live in `_patch()` — no full re-render needed

**Technology card (v25)**
- Network status banners (Internet / WiFi rows) background opacity increased from 6% to 10%, border from 35% to 45% — clearly visible on wall display
- Recently Added: expanded title detection — now checks `series.title` → `seriesTitle` → top-level `title` → path extraction → filename scrub (in that priority order). Avoids showing raw filenames when Sonarr API returns data in alternate formats
- Recently Added: improved filename scrub regex — strips `WEB-DL`, `WEBRip`, `PROPER`, `REPACK` and other release group patterns
- Ink bar track background increased from 8% to 18% opacity — readable on wall display
- Added `static getStubConfig()` for card picker support

**Weather card (v15)**
- Condition label normalization now strips hyphens and underscores before MAP lookup — fixes `partlycloudy` and hyphenated NWS states showing as raw strings
- Added NWS-specific condition mappings: `partly-cloudy`, `mostly-cloudy`, `chance-rain`, `chance-snow`, `scattered-tstorms`, `light-rain`, `freezing-rain`, `mixed-rain-snow` and more
- Fallback capitalizer now also lowercases the tail of each word for consistent casing

**Protect events card (v7)**
- Refactored from standalone (shared modules inlined) to using imports from `shared/` — reduced from 1,669 lines to 619 lines
- Bug fixes to shared modules now automatically apply to this card


**Door sensor card (v19)**
- `_garageCfg()` helper added — garage can now be defined either as a separate `garage:` config key OR as an entry in the `doors` array with `type: garage`. Both work identically for banner open state, alert count, and popup tile. Fixes the HA editor configuration error when garage is placed in the doors array.
- Banner correctly counts garage as open and shows name in the open list when using `type: garage` in doors array

**Tesla card (v22)**
- Removed `.batt-nub` battery terminal cap element — the small bright bar that appeared at the right end of the battery indicator on the home card


**room-buttons-card (v31)**
- Popup header restyled to match `room-controls-card`: edge-to-edge with `border-bottom: 1.5px solid rgba(255,255,255,.35)`, zero top padding, flush to popup edge
- Close button increased from 28px to 44px (easier to tap on wall display)
- Sheet padding changed from `20px` to `0 0 16px` — content sections handle their own horizontal margins
- Master slider (`rb-master`) margin updated to `10px 14px 6px` matching `pp-master` in room-controls
- Individual lights grid (`itog-grid`) margin updated to `4px 14px 8px` for consistent horizontal alignment
- Fan section padding `4px 14px 8px` for consistent horizontal alignment  
- Wall display max-width 420px → 440px to match room-controls popup width

**Popup consistency (all cards)**
- `door-sensor-card`, `tesla-card`, `clock-card`, `septa-paoli-card`: popup overlay dim fixed to 85% and sheet background set to true black `#000000` — these were missed in the initial pass


**Technology card (v26)**
- Recently Added: fixed Sonarr episode number extraction — was checking `r.episodes[0]` (array) but Sonarr v3 API returns `r.episode` (singular object) with `includeEpisode=true`. All 3 episodes of the same show were collapsing to one entry due to missing episode numbers making titles identical.
- Also checks `r.episodeNumber` directly on the record as a fallback
- Increased max displayed items from 3 → 5 so a batch of same-show episodes doesn't push out movies

### Repository hygiene
- Deleted `ha-config/session-memory-2026-03-23.md` (should never have been committed)
- Added `ha-config/session-memory-*.md` to `.gitignore`
- Moved `ha-config/waze-sensors.yaml` to `ha-config/deprecated/` — Waze Travel Time sensors are now configured via the HA UI integration

---

## [Earlier 2026]

Tesla popup sections; technology-card expansion; calendar map thumbnails; SEPTA popup; thermostat live mode detection.

---

## [Late 2025]

Initial versions of all cards. Core architecture established. Dark theme, shared color palette, Web Components pattern.
