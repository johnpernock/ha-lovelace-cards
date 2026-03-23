# bambu-printer-card

Full Bambu Lab P1S status card. Two-column layout — print status on the left, filament (AMS or external spool) on the right.

---

## How it works

All data comes from the Bambu Lab Home Assistant integration, which exposes each piece of printer data as a separate entity under a common prefix (e.g. `p1s_01p09a3a1100648_print_progress`).

### Status detection

The card reads both `current_stage` and `print_status` to determine the printer state. `current_stage` takes priority when it has a meaningful value. This handles cases where one attribute updates before the other.

Recognized states: `printing`, `idle`, `finish`, `pause`, `failed`, `changing_filament`, `filament_loading`, `filament_unloading`, `heatbed_preheating`, `heating_hotend`, `heating_chamber`, various calibration states, `offline`, `unavailable`.

### AMS vs external spool

The card checks `ams_1_active` and `externalspool_active` to decide which filament panel to show:
- If external spool is active and AMS is not → shows external spool panel
- Otherwise → shows AMS Unit 1 with 4 tray slots

### Active tray detection

The card tries multiple formats to match the `active_tray` attribute to a slot number (`"1"`, `"AMS1/1"`, `"00"`, `"0"`) to handle different firmware versions reporting it differently.

### Progress display

The progress bar and percentage only appear when `print_progress > 0` or `current_stage === 'printing'`. The bar color matches the status color (blue for printing, amber for paused, etc.).

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `printer` | ❌ | `p1s_01p09a3a1100648` | The entity prefix for your printer. Found by looking at any of your printer's entities and removing the trailing `_<sensor_name>`. |

---

## Entity prefix

All entities are constructed as `<printer>_<sensor>`. For example with prefix `p1s_01p09a3a1100648`:

| Sensor suffix | What it reads |
|--------------|--------------|
| `current_stage` | Current print stage |
| `print_status` | Print status |
| `print_progress` | Progress (0–100) |
| `remaining_time` | Remaining time in hours |
| `task_name` | Print job name |
| `nozzle_temperature` | Current nozzle temp |
| `nozzle_target_temperature` | Target nozzle temp |
| `bed_temperature` | Current bed temp |
| `target_bed_temperature` | Target bed temp |
| `current_layer` | Current layer number |
| `total_layer_count` | Total layers |
| `speed_profile` | Speed profile name |
| `ams_1_active` | AMS unit active (on/off) |
| `ams_1_tray_1` through `_tray_4` | AMS slot entities |
| `ams_1_humidity` | AMS humidity % |
| `ams_1_humidity_index` | AMS humidity index |
| `active_tray` | Currently loaded tray |
| `externalspool_active` | External spool active (on/off) |
| `externalspool_external_spool` | External spool entity |

---

## Example

```yaml
type: custom:bambu-printer-card
printer: p1s_01p09a3a1100648
```

---

## Changelog

| Version | Changes |
|---------|---------|
| Current | Active tray detection handles multiple firmware formats; external spool auto-switch; humidity display |
| Earlier | `current_stage` status label mapping improved (better handling of calibration/heating sub-states) |
| Initial | Two-column layout with print status and AMS panel |
