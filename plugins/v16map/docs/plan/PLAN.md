# V16 Map — PLAN

> **Status: OPEN.** S1 built and tried on a local Kwirth (0.6.94, kind) installed from a `.tgz`; not published
> to npm yet. It closes the *"a consumer"* item of the
> [v16 provider backlog](../../../../providers/v16/docs/plan/BACKLOG.md).

## Streams

| stream | delivery | status |
|---|---|---|
| S1 | V16 Map end to end | 🟡 `0.1.2`: harness 38, e2e 10 cases written, QA by hand on a local Kwirth; npm publish pending |

## What the reconnaissance established

| question | answer | where |
|---|---|---|
| how does a channel get the provider instantiated? | declaring it in `requirements.providers`: v16 exposes no router, so nothing else creates it. On a hot install the core creates it on the spot | core `back/src/index.ts`, hot install of plugins |
| how does it subscribe? | `clusterInfo.getProvider('v16', this)` → `subscribe(subscriber, { v16Only })`, one subscriber object per instance | core `back/src/model/ClusterInfo.ts`, `plugins/provider-debug/src/back/index.ts` |
| what does an event carry? | `{ type: initial \| update, added, updated, removed }`, situations as the XML parser leaves them | `providers/v16/src/common/V16Types.ts` |
| where are the coordinates? | at a depth that depends on the location type: searched for by name | `providers/v16/tests/fixtures/datex2-v3.xml` |
| can it be installed without npm? | yes: **Browse…** in the plugin manager, which posts the `.tgz` to `/core/plugin/upload` | core `back/src/api/PluginApi.ts` |
| a map library? | no: an uploaded plugin's `front.js` is stored in a ConfigMap, so the map is drawn by hand with OSM tiles and SVG | core `back/src/tools/PluginManager.ts` |

## S1 · V16 Map end to end

### What is built

1. **Back**: a standalone channel (`cluster: false`) that subscribes to `v16` per instance, reduces each DATEX2 situation to an `IV16Point` (`V16Extract.ts`) and sends `snapshot` / `changes` messages to the tab. It unsubscribes on stop, delete and disconnection.
2. **Front**: setup (`v16Only`), a tile map (`TileMap.tsx`, with its arithmetic in `TileMath.ts`), dots coloured by cause, a list newest first and the details of the selected situation.
3. **Harness**: the extraction against the real DATEX2 fixture and hand-made shapes, the channel contract, subscription, delivery and unsubscription with a fake provider, the tab's data and the tile arithmetic.
4. **e2e**: against a running Kwirth, with the channel's data **injected** through the websocket, so the map shows known situations; one test checks the real provider's snapshot and can be skipped.

### How it is validated

- `npm test` — harness.
- `cd e2e && npx playwright test` — with `e2e/.creds.json` (`url`, `user`, `pass`, `cluster`).
- By hand on the local Kwirth: the real feed on the map, a beacon selected by clicking it.

### What happened

- 🐛 **Clicking a dot did nothing.** The map captures the pointer to drag, and a captured pointer's `pointerup` reports the map, not the dot, as its target. The marker is now read on `pointerdown`.
- 🐛 **The tab was named `CLUSTER-1`.** The channel was declared `cluster: true`, copied from chapete, so the selector did not switch to `none` and named the tab after the view. Now it is standalone, like asteroids, and only accepts `none`.
- The coverage runner bundled `fast-xml-parser` (used only by the tests to read the fixture) and counted it as code: 64% instead of 99%. It is external now.

## Backlog

- Publish to npm and tag `plugin/v16map@0.1.2`.
- Filter by province or cause from the tab, without restarting the channel.
- Draw linear situations (from/to) as a line instead of their first point.
