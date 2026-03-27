# ha-lovelace-cards

Custom Home Assistant Lovelace cards for a wall-mounted 1200×800 dashboard (iPad/tablet) with mobile support. All cards share a consistent dark-theme design language built on a common set of shared utility modules.

---

## Repository structure

```
ha-lovelace-cards/
├── cards/
│   ├── room-controls-card/
│   │   └── room-controls-card.js
│   ├── bambu-printer-card/
│   │   └── bambu-printer-card.js
│   └── ... (one folder per card)
├── shared/
│   ├── ha-utils.js     — entity helpers, color constants, HVAC meta, fan speed, drag slider
│   ├── ha-styles.js    — shared CSS string exports (card reset, popup, badges, pills, etc.)
│   └── ha-popup.js     — portal popup factory (appends to document.body)
├── ha-config/
│   ├── dashboard.yaml                      — complete Lovelace dashboard (all 8 views)
│   ├── outdoor-lighting-theme-sensor.yaml  — holiday theme template sensor
│   ├── light-groups.yaml                   — custom light groups (yard_spotlights etc.)
│   ├── waze-sensors.yaml                   — ⚠️ deprecated — Waze sensors now configured via UI
│   └── README.md
├── CARDS.md        — per-card config params, entity reference, and changelogs for all 24 cards
├── STYLE-GUIDE.md  — UI principles, color system, component patterns, mockups
└── README.md
```

Each card lives in its own folder. The `shared/` modules are imported directly by card JS files — they do not need to be registered as HA resources separately. Full card documentation is in [`CARDS.md`](CARDS.md).

---

## Shared modules

Three shared ES modules reduce duplication across all cards. New cards should use these from day one. Existing cards are being migrated gradually.

### `shared/ha-utils.js`
Entity state helpers, formatters, color constants, HVAC metadata, fan speed resolution, drag slider factory.

```js
import { COLORS, getState, getVal, getAttr, getNum, isOn, isUnavailable,
         fmtTime, fmtRelative, fmtNum,
         resolveFanSpeeds, getFanPipIndex,
         HVAC_ORDER, HVAC_META, getHvacMeta, getSupportedModes, getNextHvacMode, hvacDotHtml,
         getCoverTheme, attachSlider } from '../../shared/ha-utils.js';
```

### `shared/ha-styles.js`
Named CSS string exports. Import only what you need, or use `CSS_ALL` for everything.

```js
import { CSS_RESET, CSS_POPUP, CSS_BADGE, CSS_UNAVAIL,
         CSS_SECTION, CSS_SLIDER, CSS_TAPPABLE, CSS_PILL,
         CSS_GRIDS, CSS_ALL } from '../../shared/ha-styles.js';

_css() {
  return `${CSS_RESET}${CSS_BADGE}${CSS_TAPPABLE}
    /* card-specific styles */
  `;
}
```

### `shared/ha-popup.js`
Portal popup factory. Portals are appended to `document.body` to escape HA's CSS transforms.

```js
import { createPopupPortal, openPopup, closePopup,
         destroyPopupPortal, popupHeaderHtml } from '../../shared/ha-popup.js';

// Create once
this._portal = createPopupPortal('my-card-overlay', '', () => this._onClose());

// Open / update / close
this._portal.setContent(popupHeaderHtml('Room Controls') + contentHtml);
openPopup(this._portal);
closePopup(this._portal);

// Cleanup
disconnectedCallback() { destroyPopupPortal(this._portal); }
```

---

## Installation

### 1. Copy files to Home Assistant

Copy the entire repo to `/config/www/` on your HA instance. The resulting paths should be:
```
/config/www/cards/room-controls-card/room-controls-card.js
/config/www/shared/ha-utils.js
/config/www/shared/ha-styles.js
/config/www/shared/ha-popup.js
... etc
```

For the `ha-config/` files, copy them to `/config/ha-config/` (alongside `configuration.yaml`) and add the includes described in [`ha-config/README.md`](ha-config/README.md).

### 2. Register each card as a resource

Go to **Settings → Dashboards → Resources → Add resource** for each card:

| URL | Type |
|-----|------|
| `/local/cards/bambu-printer-card/bambu-printer-card.js` | JavaScript Module |
| `/local/cards/calendar-card/calendar-card.js` | JavaScript Module |
| `/local/cards/camera-layout-card/camera-layout-card.js` | JavaScript Module |
| `/local/cards/charging-card/charging-card.js` | JavaScript Module |
| `/local/cards/clock-card/clock-card.js` | JavaScript Module |
| `/local/cards/door-sensor-card/door-sensor-card.js` | JavaScript Module |
| `/local/cards/ecoflow-card/ecoflow-card.js` | JavaScript Module |
| `/local/cards/garage-door-card/garage-door-card.js` | JavaScript Module |
| `/local/cards/leave-by-card/leave-by-card.js` | JavaScript Module |
| `/local/cards/now-playing-card/now-playing-card.js` | JavaScript Module |
| `/local/cards/peco-card/peco-card.js` | JavaScript Module |
| `/local/cards/printer-status-card/printer-status-card.js` | JavaScript Module |
| `/local/cards/protect-events-card/protect-events-card.js` | JavaScript Module |
| `/local/cards/room-buttons-card/room-buttons-card.js` | JavaScript Module |
| `/local/cards/room-controls-card/room-controls-card.js` | JavaScript Module |
| `/local/cards/septa-paoli-card/septa-paoli-card.js` | JavaScript Module |
| `/local/cards/technology-card/technology-card.js` | JavaScript Module |
| `/local/cards/temp-strip-card/temp-strip-card.js` | JavaScript Module |
| `/local/cards/tesla-card/tesla-card.js` | JavaScript Module |
| `/local/cards/tesla-commute-card/tesla-commute-card.js` | JavaScript Module |
| `/local/cards/thermostat-card/thermostat-card.js` | JavaScript Module |
| `/local/cards/traffic-card/traffic-card.js` | JavaScript Module |
| `/local/cards/wallbox-card/wallbox-card.js` | JavaScript Module |
| `/local/cards/weather-card-nws/weather-card-nws.js` | JavaScript Module |

> **Note for Claude:** When listing cards that need resource version bumps, always present them in **alphabetical order** — that is the order they appear in HA's Resources UI (Settings → Dashboards → Resources), which makes it faster to find and update each one.
| `/local/cards/leave-by-card/leave-by-card.js` | JavaScript Module |

> **Note:** The `shared/` modules do **not** need to be registered. They are imported directly by the card JS files using relative paths.

### 3. Hard refresh
`Ctrl+Shift+R` / `Cmd+Shift+R`

---

## Color palette

| Token | Hex | Meaning |
|-------|-----|---------|
| amber `COLORS.amber` | `#fbbf24` | Lights on, active |
| blue `COLORS.blue` | `#60a5fa` | Fans, info, cool mode |
| purple `COLORS.purple` | `#a78bfa` | Blinds, calibrating |
| orange `COLORS.orange` | `#fb923c` | Heat mode, closing |
| green `COLORS.green` | `#4ade80` | OK, closed, complete, on-time |
| red `COLORS.red` | `#f87171` | Error, open, alert, delayed |
| teal `COLORS.teal` | `#2dd4bf` | Fan-only HVAC mode |

---

## Cards

Full documentation for all cards — config params, entity reference, and changelogs — is in **[CARDS.md](CARDS.md)**.

| Card | Folder | Version |
|------|--------|---------|
| Room Controls | `cards/room-controls-card/` | v96 |
| Room Buttons | `cards/room-buttons-card/` | v31 |
| Camera Layout | `cards/camera-layout-card/` | v9 |
| Technology | `cards/technology-card/` | v25 |
| Bambu Printer | `cards/bambu-printer-card/` | v12 |
| Printer Status | `cards/printer-status-card/` | v7 |
| Weather (NWS) | `cards/weather-card-nws/` | v15 |
| Clock | `cards/clock-card/` | v12 |
| Temp Strip | `cards/temp-strip-card/` | v8 |
| Door Sensors | `cards/door-sensor-card/` | v19 |
| SEPTA Paoli | `cards/septa-paoli-card/` | v40 |
| Thermostat | `cards/thermostat-card/` | v15 |
| Tesla | `cards/tesla-card/` | v22 |
| Calendar | `cards/calendar-card/` | v9 |
| Garage Door ✦ | `cards/garage-door-card/` | v14 |
| Wallbox | `cards/wallbox-card/` | v12 |
| PECO Energy | `cards/peco-card/` | v10 |
| Ecoflow | `cards/ecoflow-card/` | v9 |
| Now Playing | `cards/now-playing-card/` | v11 |
| Traffic (Commute) | `cards/traffic-card/` | v20 |
| Tesla Commute | `cards/tesla-commute-card/` | v15 |
| Charging | `cards/charging-card/` | v12 |
| Protect Events ✦ | `cards/protect-events-card/` | v7 |
| Leave By ✦ | `cards/leave-by-card/` | v13 |

✦ = fully migrated to shared modules (ha-utils, ha-styles, ha-popup)

---

## Views

| View | Path | Layout | Columns |
|------|------|--------|---------|
| Home | `/home` | sections | 3 |
| Lights & Fans | `/lightsfans` | sections | 3 |
| Security | `/security` | sections | 3 |
| Technology | `/technology` | sections | 3 |
| Commute | `/commute` | sections | 3 |
| Energy | `/energy` | sections | 3 |
| 3D Printer | `/3d-printer` | sections | 2 (span) |
| Cameras | `/cameras` | panel | — |

---

## Deployment

The repo includes `deploy.sh` — a script that pulls the latest from git and copies all card JS files to `/config/www/cards/`.

```bash
# One-time: clone the repo on your HA server
cd /config
git clone https://YOUR_USER:YOUR_PAT@github.com/johnpernock/ha-lovelace-cards.git

# Every subsequent deploy
bash /config/ha-lovelace-cards/deploy.sh

# Deploy a single card only
bash /config/ha-lovelace-cards/deploy.sh septa-paoli-card
```

After running: hard refresh your browser. Resource version bumps are optional since a hard refresh bypasses the cache.

---

## Developer workflow (for Claude sessions)

Before committing at the end of any session, always run this checklist:

**1. Syntax check all modified JS files:**
```bash
for f in cards/*/$(basename $f).js; do node --check "$f" && echo "✅ $f" || echo "❌ $f"; done
```

**2. Cross-check JS version headers against CARDS.md:**
Every card's JS file has a version header comment (`v-card-name.js — vN`). This must match the latest `| vN |` entry in that card's CARDS.md changelog. If they're out of sync, bump the JS header to match what was actually deployed.

```bash
# Quick audit — prints JS version vs CARDS.md latest version for every card
python3 - <<'EOF'
import re, os
with open('CARDS.md') as f:
    cards_md = f.read()
for card in sorted(os.listdir('cards')):
    js = f'cards/{card}/{card}.js'
    if not os.path.exists(js): continue
    with open(js) as f:
        f.readline()        # skip opening /**
        line = f.readline() # version is on line 2: " * card-name.js  —  vN"
    js_ver = re.search(r'v(\d+)', line)
    js_ver = js_ver.group(0) if js_ver else '?'
    m = re.search(rf'^## {re.escape(card)}\n', cards_md, re.MULTILINE)
    if not m: continue
    cl = cards_md.find('### Changelog', m.end())
    md_ver = re.search(r'\| (v\d+) \|', cards_md[cl:cl+200])
    md_ver = md_ver.group(1) if md_ver else '?'
    status = '✅' if js_ver == md_ver else '❌ MISMATCH'
    print(f'{status}  {card:40s}  JS={js_ver}  CARDS.md={md_ver}')
EOF
```

**3. When listing cards that need resource bumps for the user:**
Always present them in **alphabetical order** — that is the order they appear in HA's Resources UI (Settings → Dashboards → Resources), which makes it faster to find and update each one.

---

## Design reference

See [`STYLE-GUIDE.md`](STYLE-GUIDE.md) for the complete UI principles, color system, component patterns with ASCII mockups, CSS snippets, and do's and don'ts.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full structured version history.

| Date | Summary |
|------|---------|
| Mar 2026 | **Bug fixes & refactoring.** Popup overlay opacity increased to 85%, popup backgrounds set to true black for Amoled+. Wall display popup border fixed (was invisible). `room-controls-card` mode-btn border fixed. Tesla commute odometer button now colored when value present. Technology card network banners and ink bar visibility improved. Recently Added title detection expanded. Weather card condition label normalization fixed (Partlycloudy → Partly Cloudy). `protect-events-card` refactored from 1669-line standalone to 619-line import-based card. `waze-sensors.yaml` moved to `deprecated/`. Session memory file removed from repo. |
| Mar 2026 | **Performance audit — `_patch()` added to all 24 cards.** Every card now separates initial render from incremental updates. Cards that were fully rebuilding their shadow DOM on every HA state push — `thermostat-card`, `door-sensor-card`, `now-playing-card`, `bambu-printer-card`, `traffic-card`, `tesla-card`, `room-buttons-card`, `technology-card`, `temp-strip-card`, `garage-door-card`, `printer-status-card` — now update only changed values in-place. `septa-paoli-card` set hass fixed to not double-render alongside its 60s interval. `leave-by-card` fixed to not call `_render()` from both `set hass` and the interval simultaneously. `weather-card-nws` patches inline values and forecast strip without rebuilding the full style block. |
| Mar 2026 | **room-buttons-card v6 — lights/fans popup matches lights & fans view.** Home view room buttons now open a full-featured popup with master brightness slider + individual light sliders (exact `pp-light` pattern from room-controls-card) and fan pip dot buttons (exact `fpip` pattern). Stats moved to bottom. Dashboard `buttons` config updated with `lights` and `fans` for all 12 room buttons. |
| Mar 2026 | **Padding consistency pass.** `room-controls-card` v74, `clock-card` v4, `door-sensor-card` v9, `garage-door-card` v5, `weather-card-nws` v7, `calendar-card` v5, `thermostat-card` v6, `temp-strip-card` v4 — all horizontal padding normalized to 14px. |
| Mar 2026 | **room-controls-card v71–v73 — individual lights popup polish.** Flat rows with uppercase name label above slider, color dot indicator, gap spacing (no dividers), live patch on every hass update. |
| Mar 2026 | **camera-layout-card v5.** Loading placeholder (camera icon + name on dark bg) behind each stream while RTSP connects. |
| Mar 2026 | **Popup consistency pass.** `room-controls-card` v70: expand chevrons bare; off individual light rows dimmed to 65% opacity; brightness % hidden when off; subtitle "X of Y on" → "X / Y"; sheet max-width 440px. All popup cards normalized to 440px max-width: `septa-paoli-card` v24, `tesla-card` v11, `weather-card-nws` v6, `door-sensor-card` v8. |
| Mar 2026 | **Popup fixes — scroll lock + bottom sheet consistency across all cards.** Fixed `once:true` tap-outside listeners, body scroll lock on open/close, `overscroll-behavior:contain` on all popup elements. |
| Mar 2026 | **Room card polish + responsive camera.** Thermostat grey backgrounds removed; +/− buttons transparent; thermostat block auto-hides when entity missing. `camera-layout-card` v4: responsive stacking breakpoint raised to 700px. |
| Mar 2026 | **Dashboard-wide header redesign + fan pip dots.** Room card background removed; room name 17px white bold; speed pip buttons show N dots matching speed. Header style applied across all cards. |
| Mar 2026 | **SEPTA compact mode extra trains.** `septa-paoli-card` v21: `show_next_trains: true` param — compact mode shows subsequent train pills. |
| Mar 2026 | **UniFi Protect event feed card + Security view.** `protect-events-card` — real-time smart detection feed with ring buffer, filter pills, thumbnail fetch, portal popup. Security view added. |
| Mar 2026 | **Touch/mobile audit across all cards.** `-webkit-tap-highlight-color:transparent` and `user-select:none` added everywhere. `deploy.sh` script added. |
| Mar 2026 | **Bug fixes.** `tesla-commute-card` v4: fixed `ReferenceError: ents is not defined` in `_patch()`. |
| Mar 2026 | **Expanded commute view + leave-by-card.** `traffic-card` v2 — `expanded: true` hero/sub row layout. `septa-paoli-card` v18 — `expanded: true` full train rows. New `leave-by-card`. |
| Mar 2026 | **camera-layout-card v2 — dynamic 2×N grid.** Grid rows auto-derived from camera count. Updated to UniFi Protect G6 entities. |
| Mar 2026 | **Expanded Tesla + charging cards on Commute view.** `tesla-commute-card`, `charging-card`. Commute view expanded to 3 columns. |
| Mar 2026 | **SEPTA sort fix + Commute view.** SEPTA v17 — trains sorted by estimated arrival time. Dedicated Commute view added. |
| Mar 2026 | **Traffic commute card.** `traffic-card` — live Waze data, incident banner, Fastest badge. |
| Mar 2026 | **Four new cards + Energy view.** `wallbox-card`, `peco-card`, `ecoflow-card`, `now-playing-card`. Energy view added. |
| Mar 2026 | **Dashboard YAML added.** Full `dashboard.yaml` committed to `ha-config/`. |
| Mar 2026 | **Outdoor lighting theme indicator.** Template sensor, light groups, `theme_block:` and `theme_sensor:` config options. |
| Mar 2026 | **Repo restructure.** Cards moved to per-card folders. `shared/` modules created. Style guide added. |
| Mar 2026 | **Major refactor session.** Popup portalling; `_patch()` system; fan speed priority; light color mode detection. |
| Earlier 2026 | Tesla popup sections; technology-card expansion; calendar map thumbnails; septa popup; thermostat live modes. |
| Late 2025 | Initial versions of all cards. Core architecture established. |

---

## License

[MIT](LICENSE)

---

## Related Repositories

| Repo | Purpose |
|---|---|
| [ha-lovelace-cards](https://github.com/johnpernock/ha-lovelace-cards) | This repo — dashboard cards displayed on the kiosk |
| [ha-pi-dashboard](https://github.com/johnpernock/ha-pi-dashboard) | Kiosk OS setup — Pi hardware, browser_mod, display API |
| [ha-kiosk-popup-automation](https://github.com/johnpernock/ha-kiosk-popup-automation) | browser_mod popup cards — NWS alerts, doorbell, SEPTA delays |
| [ha-voice-sattelite](https://github.com/johnpernock/ha-voice-sattelite) | Voice satellite installer — LVA + ReSpeaker, ESPHome protocol |
| [ha-outdoor-light-automation](https://github.com/johnpernock/ha-outdoor-light-automation) | Dusk-to-dawn + 13 holiday theme outdoor lighting automations |
| [ha-hue-lutron-sync-automation](https://github.com/johnpernock/ha-hue-lutron-sync-automation) | Hue Dimmer and Lutron Caséta button sync automations |
| [ha-blind-automation](https://github.com/johnpernock/ha-blind-automation) | Cloud/temperature/comfort-aware blind control automations |
| [ha-camera-automation](https://github.com/johnpernock/ha-camera-automation) | UniFi Protect multi-camera recording and alert automations |
| [ha-temperature-fan-automation](https://github.com/johnpernock/ha-temperature-fan-automation) | Temperature-based ceiling fan speed automations |
