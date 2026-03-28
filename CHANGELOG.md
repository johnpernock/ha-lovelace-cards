# Changelog

All notable changes to this project are documented here.
Most recent changes are listed first within each month.

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
