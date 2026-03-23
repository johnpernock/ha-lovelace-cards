# camera-layout-card

Portrait doorbell on the left, 2×2 camera grid on the right. Built for a 1200×800 wall-mounted display using native `ha-camera-stream` components for live video.

---

## How it works

The card uses HA's built-in `ha-camera-stream` custom element — the same component that powers the built-in picture-glance card. Each stream element receives both `hass` and `stateObj` (the camera entity state) so it can negotiate the correct stream URL internally.

### Render strategy

On first load a full render is done, which creates the stream elements. On subsequent `hass` updates only `_patchStreams()` is called — this re-assigns `hass` and `stateObj` to existing stream elements without re-creating them. This keeps streams alive through HA state updates.

### Empty slots

If fewer than 4 cameras are configured for the grid, remaining slots show a `+ Camera` dashed placeholder. The doorbell slot is always required.

### Scan line effect

A subtle `repeating-linear-gradient` overlay is applied to each cell for a slight CRT/security-camera texture. Pure cosmetic — doesn't affect stream rendering.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `doorbell` | ✅ | — | Doorbell camera object (see below) |
| `cameras` | ❌ | `[]` | List of up to 4 grid camera objects (see below) |
| `height` | ❌ | `680` | Total card height in pixels. Adjust to fit your dashboard row height. |

### Camera object (doorbell and each grid entry)

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | ✅ | — | `camera.*` entity ID |
| `name` | ❌ | friendly_name | Label shown at the bottom of the cell |

---

## Example

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

For 4 grid cameras (future 7-camera layout with G6 Entry + 6 turrets — entity IDs TBD after hardware install):

```yaml
cameras:
  - entity: camera.turret_front_left
    name: Front Left
  - entity: camera.turret_front_right
    name: Front Right
  - entity: camera.turret_back_left
    name: Back Left
  - entity: camera.turret_back_right
    name: Back Right
```

---

## Changelog

| Version | Changes |
|---------|---------|
| Current | `_patchStreams()` on hass updates — streams survive state changes without restart |
| Initial | Initial release — doorbell + 2×2 grid with ha-camera-stream |
