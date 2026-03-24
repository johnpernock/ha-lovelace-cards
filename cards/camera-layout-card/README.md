# camera-layout-card

**v2** — Portrait doorbell on the left, dynamic 2×N camera grid on the right. Built for a 1200×800 wall-mounted display using native `ha-camera-stream` components for live video.

---

## Layout

```
┌──────────┬────────────────────────────┐
│          │  Driveway  │  Back Garden  │
│  Front   ├────────────┼───────────────┤
│  Door    │  Back Yard │  Garage Side  │
│ (tall)   ├────────────┼───────────────┤
│          │Utility Side│  + Camera     │
└──────────┴────────────┴───────────────┘
  26% wide       74% wide — 2×3 grid
```

Grid rows are derived **automatically** from the number of cameras configured — no extra config needed:

| Cameras | Grid |
|---------|------|
| 1–2 | 2×1 (1 row) |
| 3–4 | 2×2 (2 rows) |
| 5–6 | 2×3 (3 rows) |

Slots without a camera show a dashed `+ Camera` placeholder.

---

## How it works

The card uses HA's built-in `ha-camera-stream` custom element — the same component that powers the built-in picture-glance card. Each stream element receives both `hass` and `stateObj` (the camera entity state) so it can negotiate the correct RTSP(S) stream URL internally.

**Render strategy** — on first load a full DOM render creates the stream elements. On every subsequent `hass` update only `_patchStreams()` is called, which re-assigns `hass` and `stateObj` to existing stream elements without re-creating them. Streams stay alive and uninterrupted through HA state updates.

**Grid sizing** — `grid-template-rows: repeat(N, 1fr)` is computed at render time from `Math.ceil(cameras.length / 2)`. The doorbell column is `width: 26%` — slightly narrower than the previous `29%` to give the 3-row grid better aspect ratios at 680px height.

**Scan line effect** — a `repeating-linear-gradient` overlay is applied to each cell for a subtle CRT/security-camera texture. Purely cosmetic — no effect on stream rendering.

---

## Prerequisites

- **UniFi Protect integration** configured in HA (built-in)
- **RTSP enabled** on each camera in UniFi Protect settings (`Share Livestream`)
- Integration user must have **Full Management** permission in Protect

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `doorbell` | ✅ | — | Doorbell camera (see camera object below). Occupies the tall left column. |
| `cameras` | ❌ | `[]` | List of up to 6 grid cameras. Grid row count is derived from this list length. |
| `height` | ❌ | `680` | Total card height in px. Tune to your dashboard row height. |

### Camera object

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `entity` | ✅ | — | `camera.*` entity ID |
| `name` | ❌ | friendly_name | Label shown at the bottom of the cell |

---

## Example — full 6-camera UniFi Protect setup

```yaml
type: custom:camera-layout-card
height: 680
doorbell:
  entity: camera.g6_entry
  name: Front Door
cameras:
  - entity: camera.driveway
    name: Driveway
  - entity: camera.back_garden
    name: Back Garden
  - entity: camera.back_yard
    name: Back Yard
  - entity: camera.garage_side_yard
    name: Garage Side
  - entity: camera.utility_side_yard
    name: Utility Side
```

This produces a doorbell column on the left and a 2×3 grid on the right (5 cameras + 1 placeholder in the 6th slot).

---

## Example — original 4-camera setup (2×2 grid)

```yaml
type: custom:camera-layout-card
height: 680
doorbell:
  entity: camera.front_doorbell
  name: Front Door
cameras:
  - entity: camera.driveway_camera
    name: Driveway
  - entity: camera.back_left_camera
    name: Back Left
  - entity: camera.back_right_camera
    name: Back Right
```

3 cameras → grid rounds up to 2×2 (4 slots) with 1 placeholder. Identical to v1 behaviour.

---

## Changelog

| Version | Changes |
|---------|---------|
| v3 | Responsive layout: `flex-wrap` on layout container; doorbell and grid columns have `min-width` so they reflow naturally. Below 480px: doorbell stacks above cameras, grid rows auto-size. `min-height` replaces fixed `height` to allow natural stacking |
| v2 | Dynamic grid rows — auto-derived from camera count (supports 1–6 cameras / 1–3 rows). Doorbell column narrowed to 26% for better cell aspect ratios in 3-row layout. `getStubConfig()` updated to UniFi Protect entity IDs. |
| v1 | Initial release — hardcoded doorbell + 2×2 grid with `ha-camera-stream`. `_patchStreams()` on hass updates keeps streams alive. |
