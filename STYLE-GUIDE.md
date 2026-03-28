# UI Style Guide & Design Principles

Shared design language, color system, component patterns, and interaction principles used across all cards. When building new cards or modifying existing ones, follow these conventions so everything feels like it belongs together.

---

## Core philosophy

- **Wall display first.** Designed for 1200×800 (iPad landscape, wall-mounted). Mobile is fully supported but secondary.
- **Transparent backgrounds.** Cards never set their own background color — they inherit the dashboard theme. This lets the HA theme's background show through uniformly.
- **No outer borders on cards.** Both `ha-card` AND the inner `.wrap`/`.card` container must have no border. HA's sections layout and the dashboard theme handle card separation. Internal elements (rows, stat tiles, section blocks, pills) use subtle `rgba(255,255,255,.10–.14)` borders to create structure inside the card.
- **Dark theme assumed.** All colors are tuned for a dark background. Light theme compatibility is not a design goal.
- **Information density over decoration.** Every pixel should earn its place. No padding for padding's sake.

---

## Color palette

All cards use this shared set of semantic colors. Never introduce one-off colors — pick the closest semantic match.

| Token | Hex | RGB | Meaning |
|-------|-----|-----|---------|
| Amber | `#fbbf24` | `251,191,36` | Lights on, active |
| Blue | `#60a5fa` | `96,165,250` | Fans, info, cool mode |
| Purple | `#a78bfa` | `167,139,250` | Blinds, calibrating |
| Orange | `#fb923c` | `251,146,60` | Heat mode, closing |
| Green | `#4ade80` | `74,222,128` | OK, closed, complete, on-time |
| Red | `#f87171` | `248,113,113` | Error, open, alert, delayed |
| Teal | `#2dd4bf` | `45,212,191` | Fan-only HVAC mode |
| Amber-dim | `#fbbf24` at `.35` opacity | — | Warm white color temp |
| Dim white | `rgba(255,255,255,0.35)` | — | Offline, unavailable |

### Using color with backgrounds and borders

Colors are never used at full opacity for backgrounds. Always pair a color with a low-opacity background and a medium-opacity border:

```css
/* Example: green "closed" state */
background: rgba(74, 222, 128, 0.08);
border: 1px solid rgba(74, 222, 128, 0.25);
color: #4ade80;

/* Example: red "open" state */
background: rgba(248, 113, 113, 0.10);
border: 1px solid rgba(248, 113, 113, 0.35);
color: #f87171;

/* Example: blue "info" state */
background: rgba(96, 165, 250, 0.08);
border: 1px solid rgba(96, 165, 250, 0.25);
color: #60a5fa;
```

Background opacity: `0.04–0.10`. Border opacity: `0.18–0.45`. Text/icon: full hex.

---

## Typography

All cards inherit `var(--primary-font-family, -apple-system, sans-serif)` from the HA theme.

| Use | Size | Weight | Notes |
|-----|------|--------|-------|
| Section label / eyebrow | `10px` | `700` | Uppercase, `0.08em` letter-spacing, `rgba(255,255,255,.3)` |
| Room name / card title | `13–15px` | `700` | — |
| Primary value (temp, %) | `28–34px` | `700` | Tight letter-spacing `-1px` to `-1.5px` |
| Secondary value | `18–20px` | `700` | — |
| Body / label | `12–13px` | `400–600` | — |
| Sub-label / meta | `10–11px` | `500–700` | `rgba(255,255,255,.4)` |
| Badge / pill text | `10px` | `700` | Uppercase, `0.05em` letter-spacing |

---

## Spacing & sizing

### Padding standard

All cards use **`14px` horizontal padding** consistently. This prevents visible misalignment between cards stacked in the same column.

- Cards with an inner wrapper (`.wrap`, `.card-body`, etc.): set `ha-card { padding: 0 }` and put `padding: Xpx 14px` on the inner wrapper.
- Cards without an inner wrapper: set `ha-card { padding: Xpx 14px }` directly.
- Strip/row cards (temp-strip, etc.): the outermost flex container gets `padding: 0 14px`; cells get `padding: Ypx 0` (no side padding, let the container handle it).

| Element | Value |
|---------|-------|
| Card horizontal padding | `14px` — **never deviate** |
| Card vertical padding (top/bottom) | `10–18px` depending on card density |
| Section gap | `8–10px` |
| Border radius — card section | `10px` |
| Border radius — pill/badge | `4–6px` |
| Border radius — left accent bar | `0 8px 8px 0` (flat left, rounded right) |
| Border radius — full button | `8–12px` |
| Divider | `1px solid rgba(255,255,255,.07)` |
| Subtle background (inactive) | `rgba(255,255,255,.03–.06)` |
| Subtle border (inactive) | `rgba(255,255,255,.10–.14)` |

---

## Left accent bar pattern

Used on lights rows, thermostat rows, blind pills, garage pills, and popup block headers. Creates a colored left edge while the rest of the element has a rounded right side.

```css
.accent-element {
  border-radius: 0 8px 8px 0;
  border-left: 3px solid <color>;
  /* or use a positioned ::before pseudo-element */
}
```

**Mockup — lights row with accent:**
```
┌──────────────────────────────────┐
│▌ Living Room        ●●●●●○  72% │
└──────────────────────────────────┘
  ↑ 3px amber left bar
```

**Mockup — thermostat row:**
```
┌──────────────────────────────────┐
│▌ 71°  [AC sensor 68°] │ [Heat] − 72 + │
└──────────────────────────────────┘
  ↑ orange left bar
```

---

## Status pill pattern

Used for blinds, garage doors, and similar binary/ternary position states. All pills follow the same structure:

```
 ● Label        sub-label
 ████████░░░░   position bar    ›
```

| State | Dot color | Background | Border |
|-------|-----------|------------|--------|
| Closed / OK | `#4ade80` green | `rgba(74,222,128,.06)` | `rgba(74,222,128,.2)` |
| Open / Active | `#fbbf24` amber | `rgba(251,191,36,.06)` | `rgba(251,191,36,.2)` |
| Moving / Partial | `#60a5fa` blue | `rgba(96,165,250,.06)` | `rgba(96,165,250,.2)` |

**Mockup — blind pill (closed):**
```
┌─────────────────────────────────┐
│ ● Closed    0%                ›│
│ ████████████████████████████   │
└─────────────────────────────────┘
```

**Mockup — blind pill (open at 87%):**
```
┌─────────────────────────────────┐
│ ● Open      87%               ›│
│ ████████████████████░░░░░░░░░  │
└─────────────────────────────────┘
```

---

## Fan pip pattern

Fan speed controls use a row of full-width tap buttons — one per speed step including Off. The fan name sits above as a small uppercase label so buttons span the full card width.

```
CEILING FAN
┌──────┬──────┬──────┬──────┐
│ Off  │  ●   │  ●   │  ●   │  ← pip 0=Off, 1–3=speed dots
└──────┴──────┴──────┴──────┘
              ↑ active pip — teal (#2dd4bf)
```

```css
.fpips { display: flex; gap: 4px; flex: 1; }
.fpip  { flex: 1; height: 44px; border-radius: 7px;
         background: rgba(255,255,255,.05);
         border: 1px solid rgba(255,255,255,.09); }
.fpip-on { background: rgba(45,212,191,.15);
           border-color: rgba(45,212,191,.4); }
```

Inner content per pip:
- **Pip 0 (Off)**: text `"Off"` — `font-size:9px; color:rgba(255,255,255,.25)`
- **Pips 1–N**: 9×9px circle dot — inactive `rgba(255,255,255,.2)`, active `#2dd4bf`

Tapping any pip calls `fan.set_percentage` via `data-idx` / `data-speeds` attributes.
`speeds` in config = total pip count **including** the Off pip (e.g. `speeds:5` → Off + 4 speed steps).

---

### Speed dot pattern (current)

Fan speed buttons now show N dots matching the speed level:
- Speed 0 (Off): "Off" text label
- Speed 1: 1 dot
- Speed 2: 2 dots in a row
- Speed 3: 3 dots in a row
- Speed 4: 4 dots in a 2×2 grid

```css
.fpip-dots-row { display: flex; gap: 4px; align-items: center; justify-content: center; }
.fpip-dots-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
```

Active dots use `#2dd4bf` (teal), inactive use `rgba(255,255,255,.2)`.

## Door pill pattern

Door sensor pills sit inline in the room header, flush beside the room name.

```
Family Room  [● Entry]
```

| State | Dot | Background | Border |
|-------|-----|------------|--------|
| Closed | Green | `rgba(74,222,128,.10)` | `rgba(74,222,128,.3)` |
| Open | Red | `rgba(248,113,113,.12)` | `rgba(248,113,113,.35)` |

---

## Badge / tag pattern

Small inline badges used for status labels, "Active", "Done", counts.

```css
.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

**Examples:**
```
[PRINTING]   [DONE]   [ACTION NEEDED]   [ACTIVE]   [ON TIME]   [18 MIN LATE]
  blue        green        red            green        green         red
```

---

## Popup pattern

All popups follow the same structure. They are portalled to `document.body` to avoid HA CSS transform clipping.

### Portal container
```css
position: fixed;
inset: 0;
pointer-events: none;
z-index: 9999;
font-size: 16px;   /* reset — escapes HA scaling */
```

### Overlay (backdrop)
```css
position: absolute;
inset: 0;
background: rgba(0, 0, 0, 0.55);
display: flex;
align-items: flex-end;     /* mobile: bottom sheet */
justify-content: center;
pointer-events: all;
```

### Popup sheet
```css
background: var(--card-background-color, #1e1e2a);
border: 1px solid rgba(255, 255, 255, 0.12);
border-radius: 16px 16px 0 0;
border-bottom: none;
padding: 20px;
width: 100%;
max-height: 80vh;
overflow-y: auto;
```

### Desktop override (≥768px)
```css
@media (min-width: 768px) {
  /* overlay */
  align-items: center;
  justify-content: center;
  padding: 24px;

  /* sheet */
  max-width: 420px;
  border-radius: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
```

### Popup anatomy

```
┌─────────────────────────────────────┐
│  ━━━━━   ← drag handle (mobile only)│
│                                     │
│  Section Title              [✕]     │
│  Sub-label or status                │
│  ─────────────────────────────────  │
│                                     │
│  [  Content area — scrollable  ]    │
│                                     │
└─────────────────────────────────────┘
```

**Drag handle** — only shown on mobile (`display:none` at ≥768px):
```css
width: 36px; height: 4px;
background: rgba(255,255,255,0.15);
border-radius: 2px;
margin: 0 auto 16px;
```

**Close button:**
```css
background: rgba(255,255,255,0.08);
border-radius: 50%;
width: 28px; height: 28px;
```

---

## Lights popup pattern

The lights popup (`room-controls-card`) has two tiers of controls — a master "All Lights" block and individual light rows. Both tiers use the same visual language: small uppercase label above, slider + percentage + chevron inline below. No borders, no backgrounds on individual rows.

### All Lights block

Contained in a subtle amber-tinted box (`rgba(251,191,36,.04)` background, `rgba(251,191,36,.12)` border). Label is a `sec-hdr` above the box.

```
ALL LIGHTS
┌─────────────────────────────────────┐
│  [══════════════●]  100%  ❯         │
└─────────────────────────────────────┘
```

### Individual light rows

Flat, no borders, no backgrounds. Rows separated by `gap` only (no dividers). Each row dims to `opacity: 0.5` when the light is off, `opacity: 1` when on.

```
WALL SCONCE                  ← 9px uppercase label, rgba(.35) off / rgba(.65) on
[══════════════●]  100%  ❯   ← slider + pct + chevron inline
```

Layout rules:
- **Name** (`pp-lname`): `font-size:9px`, `font-weight:700`, uppercase, `letter-spacing:.08em`. `display:block` so it sits on its own line above the slider row. Color `rgba(255,255,255,.35)` when off, `rgba(255,255,255,.65)` when on (`.lit` class).
- **Slider row** (`pp-lrow`): `display:flex`, `align-items:center`, `gap:8px`. Contains slider wrap, percentage span, and chevron.
- **No dot** — the colored status dot was removed. On/off state is communicated by opacity and label brightness only.
- **Chevron** — only rendered if the light supports CT or RGB color. Rotates 180° when the color panel is expanded.
- **Color panel** (`pp-color-sec`) — `hidden` by default, toggled by the chevron. Contains CT presets and/or color presets with `pp-clbl` labels.

```css
.pp-lights  { padding: 4px 14px 8px; display: flex; flex-direction: column; gap: 8px; }
.pp-light   { opacity: .5; transition: opacity .15s; padding: 0; }
.pp-light-on{ opacity: 1; }
.pp-lname   { font-size: 9px; font-weight: 700; text-transform: uppercase;
              letter-spacing: .08em; color: rgba(255,255,255,.35);
              padding: 0 0 5px; display: block; }
.pp-lname.lit { color: rgba(255,255,255,.65); }
.pp-lrow    { display: flex; align-items: center; gap: 8px; padding: 0; }
```

### Patch requirement

Individual light state (slider fill, thumb position, percentage, on/off opacity, label brightness) **must be updated in `_patch()`** on every hass update — not only during drag. This ensures the popup stays in sync when lights are changed from another source (voice, automation, another dashboard).

Room on/off toggles use a pill shape with a circular thumb:

```css
.tog {
  border-radius: 99px;        /* fully pill-shaped */
  border: 1px solid;
  transition: background .15s, border-color .15s;
}
.tog-thumb {
  border-radius: 50%;         /* circular thumb */
  transition: left .15s, background .15s;
}
```

State colors:
- **On**: `background: rgba(251,191,36,.25)`, `border-color: rgba(251,191,36,.5)`, thumb `#fbbf24`
- **Off**: `background: rgba(255,255,255,.06)`, `border-color: rgba(255,255,255,.12)`, thumb `rgba(255,255,255,.3)`

Sizes: `lg` = 44×30px, thumb 20×20px, offset 5px. `sm` = 36×24px, thumb 16×16px, offset 4px.

## Interaction states

### Touch / mobile requirements

Every interactive element in every card must have ALL of the following — no exceptions:

```css
-webkit-tap-highlight-color: transparent;  /* removes blue flash on iOS/Android */
user-select: none;                          /* prevents text selection on long press */
cursor: pointer;                            /* shows pointer on desktop */
transition: transform 0.1s, filter 0.12s;  /* smooth active feedback */
```

On `:active` (finger down):
```css
transform: scale(0.96);
filter: brightness(0.9);
```

### Minimum touch target size

Interactive rows, buttons, and pills must have an effective touch height of at least 44px. Achieve this with padding rather than fixed height so content can still flex:

```css
/* Row with 10-12px vertical padding + ~20px content = 44px+ */
padding: 10px 14px;

/* Small buttons: explicit min dimensions */
min-width: 44px;
min-height: 44px;
```

### Drag sliders

Sliders (brightness, current) require both mouse and touch event handling:
```js
el.addEventListener('mousedown', handler);
el.addEventListener('touchstart', handler, { passive: true });
document.addEventListener('mousemove', moveHandler);
document.addEventListener('touchmove', moveHandler, { passive: true });
document.addEventListener('mouseup', upHandler);
document.addEventListener('touchend', upHandler);
```
Also set `touch-action: none` on the track element to prevent scroll interference.

### Tap / press summary

| Property | Value | Purpose |
|----------|-------|---------|
| `-webkit-tap-highlight-color` | `transparent` | No blue flash on mobile |
| `user-select` | `none` | No text selection on long press |
| `transition` | `transform .1s, filter .12s` | Smooth press feedback |
| `:active transform` | `scale(0.96)` | Visual press confirmation |
| `:active filter` | `brightness(0.9)` | Darkens on press |

### Disabled state
Moving/transitioning states (garage door opening, etc.) set `pointer-events: none` or `disabled` attribute on the button. Visual opacity drops to `0.5–0.6`.

### Busy lock
Service calls use a boolean `_busy` flag with a `setTimeout` reset (600–800ms) to prevent double-firing on rapid taps.

---

## Drag slider pattern

Used for brightness and blind position sliders. No `<input type="range">` is used.

```
 ░░░░░████████████████░░░░░░░░░░░
        ↑ custom thumb
```

```js
// Track starts on mousedown/touchstart
// Updates on mousemove/touchmove on document
// Ends on mouseup/touchend on document
// Debounce HA service call 150ms
```

```css
.slider-track {
  height: 6px;
  border-radius: 99px;
  background: rgba(255,255,255,.12);
  position: relative;
  touch-action: none;
  cursor: pointer;
}
.slider-fill {
  height: 100%;
  border-radius: 99px;
  background: <color>;
  pointer-events: none;
}
.slider-thumb {
  position: absolute;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: white;
  top: 50%; transform: translate(-50%, -50%);
  box-shadow: 0 1px 4px rgba(0,0,0,.4);
}
```

---

## HVAC mode colors

Used in `room-controls-card` thermostat row and `thermostat-card`.

| Mode | Color | Dot style |
|------|-------|-----------|
| `heat` | `#fb923c` orange | Solid dot |
| `cool` | `#60a5fa` blue | Solid dot |
| `heat_cool` / `auto` | Orange + blue | **Split dot** — left half orange, right half blue |
| `fan_only` | `#2dd4bf` teal | Solid dot |
| `dry` | `#fbbf24` amber | Solid dot |
| `off` | `rgba(255,255,255,.25)` | Solid dot |

**Split dot HTML:**
```html
<div style="width:8px;height:8px;border-radius:50%;overflow:hidden;display:flex">
  <div style="flex:1;background:#fb923c"></div>
  <div style="flex:1;background:#60a5fa"></div>
</div>
```

---

## Room card structure

Room control cards (Lights & Fans view) use a transparent shell — no background fill, no border on the outer container:

```css
.room {
  border-radius: 10px;
  /* NO border — follows the no-outer-border rule */
  overflow: hidden;
  /* NO background */
}
```

Individual room sections inside the card use `border: 1px solid rgba(255,255,255,.12)` to separate them from each other — this is an internal structural border, not a card shell border.

Room name headers use 17px white bold:

```css
.rlbl {
  font-size: 17px;
  font-weight: 700;
  color: white;
  letter-spacing: -.2px;
}
```

This matches the card name style used in `tesla-commute-card`, `peco-card`, `wallbox-card`, etc. All dashboard card name labels should use this pattern.

## Card structure template

All cards follow this shadow DOM structure:

```js
class MyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    // Full render first time only — patch after
    if (!this.shadowRoot.innerHTML || !prev) { this._render(); return; }
    this._patch();
  }

  getCardSize() { return 3; }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <!-- card content -->
      </ha-card>`;
    this._attachListeners();
  }

  _patch() {
    // Update values in-place — do not rebuild DOM or re-attach listeners
  }

  _css() { return `
    :host { display: block; }
    ha-card {
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }
  `; }
}

customElements.define('my-card', MyCard);
```

---

## Section header pattern

Small uppercase labels used to delineate sections within a card body (e.g. "Lights", "Fans", "Thermostat" inside room-controls-card):

```css
.sec-hdr {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: rgba(255,255,255,.28);
  padding: 8px 0 2px;
}
```

Rules:
- Always uppercase via CSS, never in the source string
- `letter-spacing: .08em` minimum — these are small so need extra tracking
- Color no brighter than `rgba(255,255,255,.30)` — purely organisational, not data
- Top padding `8px` to separate from the element above; bottom `2px` to sit close to what it labels
- No border, no background — purely typographic

Used inside popup sheets and card sections to label a group of controls.

```
SECTION LABEL
─────────────────────────
```

```css
.section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 8px;
}
.section-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 10px 0;
}
```

---

## Unavailable / offline state

All cards handle missing or unavailable entities gracefully. Never show broken UI — show a minimal unavailable indicator instead.

```html
<div class="unavail">unavailable</div>
```

```css
.unavail {
  font-size: 12px;
  color: var(--secondary-text-color);
  text-align: center;
  padding: 16px 0;
  opacity: 0.5;
  font-style: italic;
}
```

For sensors that may show `unavailable` or `unknown` state: always check before parsing, and display `—` (em dash) as the fallback value.

---

## Grid layouts

### 2-column grid (popup entity tiles)
```css
display: grid;
grid-template-columns: 1fr 1fr;
gap: 8px;
```

### 3-column grid (door sensors, room buttons)
```css
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 8px;
```

### Temperature 2×2 grid (Bambu card)
```css
display: grid;
grid-template-columns: 1fr 1fr;
gap: 6px;
```

---

## Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| Use semantic color tokens from the palette | Introduce one-off colors |
| Patch values in `_patch()` after first render | Call `_render()` on every hass update |
| Portal popups to `document.body` | Render popups inside shadow DOM |
| Use `border-radius: 0 8px 8px 0` for accent bars | Use full borders on accent elements |
| Read `hvac_modes` from live entity | Hardcode a list of HVAC modes |
| Set `speeds:` explicitly in YAML for Lutron fans | Rely on entity attributes for Lutron Caseta |
| Store API keys in `secrets.yaml` | Hardcode API keys in dashboard YAML |
| Show `—` for unavailable sensor values | Show `null`, `undefined`, or empty string |
| Use `rgba` backgrounds at `.04–.10` opacity | Use solid color backgrounds |
| `touch-action: none` on drag elements | Let browser scroll hijack drag sliders |

---

## Expanded row pattern

Used by `traffic-card` and `septa-paoli-card` when `expanded: true`. Replaces compact pills/tiles with full-height rows that share a consistent structure across both cards — traffic routes and train departures look visually unified on the commute view.

### Row hierarchy

Two row types — hero (primary item) and sub (subsequent items):

```
Hero row  — 12px padding, coloured background/border matching delay state
Sub row   — 9px padding, neutral rgba(.03) background

┌──────────────────────────────────────────────┐
│ NEXT DEPARTURE                               │
│ 8:30 PM                  ARRIVES 30TH ST    │   ← hero row (green bg)
│ Train 9327 · Direct      9:16 PM   [On Time]│
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ 9:41 PM                  ARRIVES 30TH ST    │   ← sub row (neutral)
│ Train 9329 · Local       10:48 PM  [+18m]   │
└──────────────────────────────────────────────┘
```

### Row colour rules

Row background and border colour follows the same semantic scheme as the existing hero block pattern — green for on-time, red for delayed:

| State | Background | Border |
|-------|-----------|--------|
| On time (hero) | `rgba(74,222,128,.07)` | `rgba(74,222,128,.25)` |
| Delayed (hero) | `rgba(239,68,68,.08)` | `rgba(239,68,68,.35)` |
| On time (sub) | `rgba(255,255,255,.03)` | `rgba(255,255,255,.07)` |
| Delayed (sub) | `rgba(239,68,68,.06)` | `rgba(239,68,68,.2)` |

### Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Section label (eyebrow) | 9px | 700 | `rgba(255,255,255,.3)` uppercase |
| Hero time | 26px | 600 | White or delay color |
| Hero AM/PM suffix | 13px | 500 | `rgba(255,255,255,.35)` |
| Sub time | 18px | 600 | `rgba(255,255,255,.75)` or delay tint |
| Sub AM/PM suffix | 10px | 500 | `rgba(255,255,255,.3)` |
| Meta line (train/route) | 10px | 400 | `rgba(255,255,255,.3)` |
| Arrival label (eyebrow) | 9px | 700 | `rgba(255,255,255,.3)` uppercase |
| Arrival time (hero) | 14px | 600 | White or `#f87171` if delayed |
| Arrival time (sub) | 13px | 600 | White or `#f87171` if delayed |
| Badge | 10px | 700 | Semantic color, uppercase, 5px radius |

### Row dividers

Between sub rows: `height: 1px; background: rgba(255,255,255,.05); margin: 0 10px`

Between sections (outbound/inbound): `height: 1px; background: rgba(255,255,255,.07); margin: 8px 14px 0`

### `expanded` parameter convention

All cards that support both compact and expanded layouts use a single `expanded: boolean` YAML parameter defaulting to `false`. The compact render path is always preserved — `expanded: true` is an additive mode, never a replacement of the original card.

```yaml
# Compact (default) — home view, sidebar use
type: custom:septa-paoli-card
outbound: [...]

# Expanded — commute view, full-column use
type: custom:septa-paoli-card
expanded: true
outbound: [...]
```

New cards that need both modes should follow this same pattern. The expanded render should be triggered at the top of `_render()` before any other logic:

```js
_render() {
  if (!this._config.entity) return;
  if (this._config.expanded) { this._renderExpanded(); return; }
  // ... compact render continues
}
```

---

## Known inconsistencies and resolutions

This section tracks design decisions that are intentionally inconsistent across cards and explains why.

### `.wrap` vs `.card` as outer container name

Some cards use `.wrap` (now-playing, protect-events, leave-by) and others use `.card` (bambu, peco, wallbox, ecoflow, charging, traffic, septa) as the class name for the outer container inside `ha-card`. Both are correct. The important rule is that **neither `ha-card` nor `.wrap`/`.card` should have a `border`**. Both must be borderless — `ha-card` is always `transparent`, `box-shadow: none`, `border: none`, and `.wrap`/`.card` is always `border: none` as well. Internal structure is created with bordered inner elements (rows, stat tiles, pills) not the card shell. New cards should prefer `.wrap` for consistency.

### Tap states — not all cards have them

Cards with purely informational rows (temp-strip, clock, weather inline) intentionally omit `:active` scale/brightness since there is nothing to tap. Cards with interactive rows (room-controls, tesla, protect-events, door-sensor) must include the tap pattern on every tappable element:

```css
.my-tappable {
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s, filter 0.12s;
  cursor: pointer;
  user-select: none;
}
.my-tappable:active {
  transform: scale(0.96);
  filter: brightness(0.9);
}
```

### `data-room` on toggle elements

All interactive elements that rely on the click handler reading `el.dataset.room` must have `data-room` explicitly set. The `_togHtml()` helper in `room-controls-card` derives the room ID from the element ID — do not rely on event bubbling to supply room context.

### Outer container background

The outer `.card` or `.wrap` container must not have a colored background. Background opacity should only be used on **inner** elements (rows, stat boxes, hero blocks). `rgba(color, 0.04–0.10)` tints are permitted on inner sections but not on the card shell itself.

---

## Room header pills

Room headers in `room-controls-card` support two types of compact pills displayed between door pills and the on/off toggle. Pills are text-free or number-only — no labels in the header.

### Thermostat pill

Shows mode dot + current temp + setpoint when a thermostat is configured:

```
● 68° → 70°
```

- **Mode dot** (7px circle): orange=heat, blue=cool, split orange/blue=heat_cool, purple=auto, teal=fan, amber=dry, neutral=off
- **Current temp**: primary text color
- **Arrow + setpoint**: `rgba(255,255,255,.25)` arrow, `#fb923c` setpoint
- **Pill background**: `rgba(251,146,60,.15)` when active, `rgba(255,255,255,.10)` when off
- **Border**: `rgba(251,146,60,.25)` when active, `rgba(255,255,255,.07)` when off

### Sensor pill

Shows a bare temp reading in blue when `thermostat.sensor` is configured (room sensor separate from thermostat entity):

```
68°
```

- Color: `#60a5fa`
- Background: `rgba(96,165,250,.08)`
- Border: `rgba(96,165,250,.18)`
- No label text — number only

### When each pill appears

| Config | Thermostat pill | Sensor pill |
|--------|----------------|-------------|
| `thermostat:` only | ✅ | — |
| `thermostat:` + `sensor:` | ✅ | ✅ |
| No thermostat | — | — |

---

## Media card patterns

### ATV selector tab pattern

Used in `appletv-remote-card` to switch between devices within a single card instance.

```css
.tab {
  flex: 1; height: 32px; border-radius: 7px;
  font-size: 11px; font-weight: 700;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10);
  color: rgba(255,255,255,.4);
}
.tab.active {
  background: rgba(96,165,250,.12); border-color: rgba(96,165,250,.35); color: #60a5fa;
}
```

### Speaker toggle row pattern

Used in `homepod-music-card` for grouping speakers.

Active speaker row (in group): blue tint background + blue toggle
Inactive speaker row: neutral background, gray toggle, muted name

```css
.spk.on { background: rgba(96,165,250,.06); border-color: rgba(96,165,250,.25); }
.tog.on { background: rgba(96,165,250,.25); border-color: rgba(96,165,250,.5); }
.tog.on .tog-dot { background: #60a5fa; }
```

### Jellyseerr request status badge colors

| Status | Color | Token |
|--------|-------|-------|
| Pending | Amber `#fbbf24` | `rgba(251,191,36,…)` |
| Processing | Blue `#60a5fa` | `rgba(96,165,250,…)` |
| Partial | Purple `#a78bfa` | `rgba(167,139,250,…)` |
| Available | Green `#4ade80` | `rgba(74,222,128,…)` |

### D-pad sizing

| Size | Ring diameter | Center diameter | Arrow zone |
|------|---------------|-----------------|------------|
| Standard (wall display) | 200px | 72px | 76×76px |

Arrow zones must be large enough for comfortable wall-panel touch: 76px minimum.

### Naming convention

| Prefix | Device |
|--------|--------|
| `printer-*` | Epson inkjet (paper printer) |
| `bambu-*` | Bambu Lab 3D printer |
| `appletv-*` | Apple TV |
| `homepod-*` | HomePod / AirPlay speakers |
| `ps5-*` | PlayStation 5 |
| `ps5-*` | PlayStation 5 |
| `steam-*` | Steam / PC gaming |

**Card prefixes:**
- `ps5-card` = PlayStation 5 cards
- `steam-card` = Steam / PC gaming cards
