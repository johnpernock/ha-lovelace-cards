# ha-lovelace-cards

Custom Home Assistant Lovelace cards for a wall-mounted 1200×800 dashboard (iPad/tablet) with mobile support. All cards share a consistent dark-theme design language built on a common set of shared utility modules.

---

## Repository structure

```
ha-lovelace-cards/
├── cards/
│   ├── room-controls-card/
│   │   ├── room-controls-card.js
│   │   └── README.md
│   ├── bambu-printer-card/
│   │   ├── bambu-printer-card.js
│   │   └── README.md
│   └── ... (one folder per card)
├── shared/
│   ├── ha-utils.js     — entity helpers, color constants, HVAC meta, fan speed, drag slider
│   ├── ha-styles.js    — shared CSS string exports (card reset, popup, badges, pills, etc.)
│   └── ha-popup.js     — portal popup factory (appends to document.body)
├── ha-config/
│   ├── dashboard.yaml                      — complete Lovelace dashboard (all 5 views)
│   ├── outdoor-lighting-theme-sensor.yaml  — template sensor for holiday theme detection
│   ├── light-groups.yaml                   — custom light groups (yard_spotlights etc.)
│   ├── dashboard-README.md                 — dashboard installation + view reference
│   └── README.md
├── docs/
│   └── style-guide.md  — UI principles, color system, component patterns, mockups
└── README.md
```

Each card lives in its own folder alongside its documentation. The `shared/` modules are imported directly by card JS files — they do not need to be registered as HA resources separately.

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
| `/local/cards/room-controls-card/room-controls-card.js` | JavaScript Module |
| `/local/cards/room-buttons-card/room-buttons-card.js` | JavaScript Module |
| `/local/cards/camera-layout-card/camera-layout-card.js` | JavaScript Module |
| `/local/cards/technology-card/technology-card.js` | JavaScript Module |
| `/local/cards/bambu-printer-card/bambu-printer-card.js` | JavaScript Module |
| `/local/cards/printer-status-card/printer-status-card.js` | JavaScript Module |
| `/local/cards/weather-card-nws/weather-card-nws.js` | JavaScript Module |
| `/local/cards/clock-card/clock-card.js` | JavaScript Module |
| `/local/cards/temp-strip-card/temp-strip-card.js` | JavaScript Module |
| `/local/cards/door-sensor-card/door-sensor-card.js` | JavaScript Module |
| `/local/cards/septa-paoli-card/septa-paoli-card.js` | JavaScript Module |
| `/local/cards/thermostat-card/thermostat-card.js` | JavaScript Module |
| `/local/cards/tesla-card/tesla-card.js` | JavaScript Module |
| `/local/cards/calendar-card/calendar-card.js` | JavaScript Module |
| `/local/cards/garage-door-card/garage-door-card.js` | JavaScript Module |
| `/local/cards/wallbox-card/wallbox-card.js` | JavaScript Module |
| `/local/cards/peco-card/peco-card.js` | JavaScript Module |
| `/local/cards/ecoflow-card/ecoflow-card.js` | JavaScript Module |
| `/local/cards/now-playing-card/now-playing-card.js` | JavaScript Module |
| `/local/cards/traffic-card/traffic-card.js` | JavaScript Module |
| `/local/cards/tesla-commute-card/tesla-commute-card.js` | JavaScript Module |
| `/local/cards/charging-card/charging-card.js` | JavaScript Module |

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

See each card's `README.md` in its folder for full documentation, parameters, and changelog.

| Card | Folder | Version |
|------|--------|---------|
| Room Controls | `cards/room-controls-card/` | v35 |
| Room Buttons | `cards/room-buttons-card/` | v4 |
| Camera Layout | `cards/camera-layout-card/` | v1 |
| Technology | `cards/technology-card/` | v11 |
| Bambu Printer | `cards/bambu-printer-card/` | current |
| Printer Status | `cards/printer-status-card/` | v1 |
| Weather (NWS) | `cards/weather-card-nws/` | v2 |
| Clock | `cards/clock-card/` | v3 |
| Temp Strip | `cards/temp-strip-card/` | v3 |
| Door Sensors | `cards/door-sensor-card/` | v5 |
| SEPTA Paoli | `cards/septa-paoli-card/` | v16 |
| Thermostat | `cards/thermostat-card/` | v4 |
| Tesla | `cards/tesla-card/` | v9 |
| Calendar | `cards/calendar-card/` | v4 |
| Garage Door ✦ | `cards/garage-door-card/` | v3 |
| Wallbox | `cards/wallbox-card/` | v1 |
| PECO Energy | `cards/peco-card/` | v1 |
| Ecoflow | `cards/ecoflow-card/` | v1 |
| Now Playing | `cards/now-playing-card/` | v1 |
| Traffic (Commute) | `cards/traffic-card/` | v1 |
| Tesla Commute | `cards/tesla-commute-card/` | v1 |
| Charging | `cards/charging-card/` | v1 |

✦ = fully migrated to shared modules (proof of concept)

---

## Views

| View | Path | Layout | Columns |
|------|------|--------|---------|
| Home | `/home` | sections | 3 |
| Lights & Fans | `/lightsfans` | sections | 3 |
| Cameras | `/cameras` | panel | — |
| Technology | `/technology` | sections | 3 |
| Commute | `/commute` | sections | 3 |
| Energy | `/energy` | sections | 3 |
| 3D Printer | `/3d-printer` | sections | 2 (span) |

---

## Design reference

See [`STYLE-GUIDE.md`](STYLE-GUIDE.md) for the complete UI principles, color system, component patterns with ASCII mockups, CSS snippets, and do's and don'ts.

---

## Changelog

| Date | Summary |
|------|---------|
| Mar 2026 | **Expanded Tesla + charging cards on Commute view.** `tesla-commute-card` — expanded inline version of tesla-card showing battery, interior/exterior temps, climate stepper, tire pressure grid, and action buttons (lock/trunk/sentry/odometer) all without a popup. `charging-card` — unified Tesla + Wallbox card placed below; active state shows battery progress bar with charge limit tick, live power (Wallbox), session energy (Wallbox), charging speed mi/h (Tesla); idle state shows last session summary. Commute view expanded from 2 to 3 columns. |
| Mar 2026 | **SEPTA sort fix + Commute view.** SEPTA card v17 — trains now sorted by estimated arrival time (scheduled + delay) across all sensors so the true next-to-arrive train is always shown first. Inbound now reads all sensors not just index 0. SEPTA and traffic cards moved from Home view to new dedicated Commute view (2-col, traffic left / SEPTA right). |
| Mar 2026 | **Traffic commute card.** `traffic-card` using Waze Travel Time sensors — live travel time, delay vs typical, distance, Waze route name, dynamic Fastest badge across home routes, incident banner when delay exceeds threshold, to-work row dims after noon. Three Waze sensors added to `ha-config/waze-sensors.yaml`. Card added to Home view column 1. |
| Mar 2026 | **Four new cards + Energy view.** `wallbox-card` (Beryl Pulsar Plus — session energy, range, power, current slider, solar mode, lock); `peco-card` (PECO electric + gas billing — usage bar, forecast, cost, typical comparison); `ecoflow-card` (River 2 Pro — battery, power flows, max charge slider, AC/DC toggles); `now-playing-card` (Apple TV / media players — collapses when idle, tap → more-info). New Energy view added to dashboard with all three energy cards. Now-playing card added to Home view above room buttons. |
| Mar 2026 | **Dashboard YAML added.** Full `dashboard.yaml` committed to `ha-config/` covering all 5 views (Home, Lights/Fans, Cameras, Technology, 3D Printer). Includes theme changes to Yard room and Yard button. `dashboard-README.md` documents all views, prerequisites, and the two specific changes made. |
| Mar 2026 | **Outdoor lighting theme indicator.** New `ha-config/` folder with template sensor (`sensor.outdoor_lighting_theme`) covering 13 holidays + Default. New `light.yard_spotlights` light group. `room-controls-card` gains `theme_block:` config — Option B zone indicator with color swatches, gradient bars, and per-area state (All Outdoor, Display Lights, Front Path, Side Path). `room-buttons-card` gains `theme_sensor:` on buttons — holiday color strip + name label, hidden on Default nights. |
| Mar 2026 | **Repo restructure.** Cards moved to per-card folders. `shared/` modules created (`ha-utils.js`, `ha-styles.js`, `ha-popup.js`). `garage-door-card` fully migrated as proof of concept. Per-card `README.md` docs added. Style guide added. |
| Mar 2026 | **Major refactor session.** Popup portalling; `_patch()` system; fan speed priority; light color mode detection; left accent bars; blind/garage/door pills; HVAC live mode reading. |
| Earlier 2026 | Tesla popup sections; technology-card expansion; calendar map thumbnails; septa popup; thermostat live modes. |
| Late 2025 | Initial versions of all cards. Core architecture established. |
