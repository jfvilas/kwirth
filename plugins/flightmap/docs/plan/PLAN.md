# Flight Map — PLAN

> **Status: OPEN.** S1 built and tried on a local Kwirth (0.6.94, kind) installed from a `.tgz`; not published
> to npm yet. It closes the *"a consumer that draws it on a map"* item of the
> [flight-status provider backlog](../../../../providers/flight-status/docs/plan/BACKLOG.md).

## Streams

| stream | delivery | status |
|---|---|---|
| S1 | Flight Map end to end | 🟡 `0.1.2`: harness 23, e2e 12 cases written, QA by hand on a local Kwirth; npm publish pending |

## What the reconnaissance established

| question | answer | where |
|---|---|---|
| how does a channel get the provider instantiated? | declaring it in `requirements.providers`: flight-status exposes no router, so nothing else creates it | core `back/src/index.ts`, hot install of plugins |
| what does a subscriber ask for? | `{ bbox, intervalSec, watch }`: the provider polls on behalf of that subscriber alone | `providers/flight-status/README.md` |
| what does an event carry? | `positions` with every aircraft in the box (`details` only on watched callsigns), or `error`, sent only when the message changes | `providers/flight-status/src/common/FlightStatus.ts` |
| what does a call cost? | the box is widened to a 0.5° grid; 1 credit up to 25 square degrees, 2 up to 100, 3 up to 400, 4 above | `providers/flight-status/src/back/lib/sources/opensky.ts` |
| can it be installed without npm? | yes: **Browse…** in the plugin manager, which posts the `.tgz` to `/core/plugin/upload` | core `back/src/api/PluginApi.ts` |

## S1 · Flight Map end to end

### What is built

1. **Back**: a standalone channel (`cluster: false`) that subscribes to `flight-status` per instance with the setup as its payload, and forwards `positions` and `error` to the tab. It unsubscribes on stop, delete and disconnection.
2. **Front**: setup with ready-made areas, the box, the interval with its OpenSky cost per day, and the flights to follow; a tile map with planes pointing along their track and coloured by altitude, the requested box outlined, a list with the followed flights first, and the details of the selected aircraft.
3. **Harness**: the channel contract, subscription, delivery and unsubscription with a fake provider, the tab's data, the OpenSky cost and the units.
4. **e2e**: against a running Kwirth, with the channel's data **injected** through the websocket. There is no test against OpenSky on purpose: it would spend the anonymous quota, and its answer changes from one minute to the next.

### How it is validated

- `npm test` — harness.
- `cd e2e && npx playwright test` — with `e2e/.creds.json` (`url`, `user`, `pass`, `cluster`).
- By hand on the local Kwirth: Madrid every 60 s, a plane selected by clicking it.

### What happened

- 🐛 **Clicking a plane did nothing**, and **the tab was named `CLUSTER-1`**: the same two bugs as V16 Map, since both share the map and the channel skeleton. Fixed in both.
- The setup's cost estimate first ignored the 0.5° widening and said 2 credits for the peninsula, which the provider charges at 3. It widens the box the same way now.

## Backlog

- Publish to npm and tag `plugin/flightmap@0.1.2`.
- Trails: the last positions of the followed flights.
- Change the area by dragging the map, with `updateSubscription`, without restarting the channel.
