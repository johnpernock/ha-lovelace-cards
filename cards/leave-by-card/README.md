# leave-by-card

**v1** — "Leave by" departure planner. Reads outbound SEPTA train times and a Waze Travel Time sensor, computes when you need to leave home to catch each train, and colour-codes urgency.

---

## How it works

For each outbound train sensor, the card:
1. Reads the scheduled departure time and delay from sensor attributes
2. Computes the estimated departure (`scheduled + delay`)
3. Subtracts the current Waze drive time to get the "leave by" time
4. Computes how many minutes from now until you need to leave
5. Colour-codes the row: red (leave now / overdue), amber (leave soon), green (comfortable)

Stale trains (estimated departure more than 2 minutes ago) are automatically filtered out. The card refreshes every 30 seconds.

---

## Urgency thresholds

| Colour | Condition |
|--------|-----------|
| Red | Leave within 15 minutes (or already overdue) |
| Amber | Leave within 15–60 minutes |
| Green (dim) | More than 60 minutes away |

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `waze_entity` | ✅ | — | Waze Travel Time sensor entity ID. The card uses `state` (travel time in minutes). |
| `outbound` | ✅ | — | List of outbound SEPTA sensor entity IDs — same list as `septa-paoli-card`. |
| `station` | ❌ | `'Station'` | Station name shown in the header badge next to the drive time. |

---

## Example

```yaml
type: custom:leave-by-card
waze_entity: sensor.commute_to_work
station: Paoli Station
outbound:
  - sensor.paoli_outbound_1
  - sensor.paoli_outbound_2
  - sensor.paoli_outbound_3
```

---

## Changelog

| Version | Changes |
|---------|---------|
| v3 | Card header: font-size 10px uppercase → 17px white bold |
| v1 | Initial release. Stale train filtering, 30s refresh, urgency colour coding, midnight crossover handling. |
| v2 | Touch/mobile audit: added `-webkit-tap-highlight-color:transparent` to `lb-row` |
