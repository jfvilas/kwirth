# V16 Provider

V16 beacon provider for [Kwirth](https://kwirthmagnify.dev), the Kubernetes observability and operations
platform ([source](https://github.com/kwirthmagnify/kwirth)). It polls the DGT DATEX2 traffic feed and dispatches only what changed:
new situations, updated ones and the ones that were cleared. V16 emergency beacons are flagged, so a
subscriber can ask for just those.

This is an installable kwirth **provider**: a backend-only extension that produces events and fans them out
to the channels, or other providers, that subscribe to it. It has no tab of its own.

## Installation

V16 is open source, published to npm as `@jfvilas/kwirth-provider-v16` and listed in the **jfvilas
marketplace**. If your Kwirth does not list it yet, add this manifest as a marketplace:

```
https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
```

Then install **V16 Provider** from the provider manager. Kwirth needs a restart to load a new provider.
Source code: [github.com/jfvilas/kwirth](https://github.com/jfvilas/kwirth) (folder `providers/v16`).

## What it does

The DGT publishes every active traffic incident in Spain as a DATEX2 v3 `SituationPublication` document,
a few MB with several hundred situations. Forwarding the whole document on every poll would make each
consumer diff it again, so the provider does that work once:

1. **Poll.** Every `intervalSeconds` it downloads the feed. It sends `If-None-Match` with the last ETag, so
   a `304` costs nothing. If the body hash has not changed, the document is not parsed again.
2. **Diff.** It identifies each situation by its DATEX2 `id` and compares its content hash with the one
   from the previous poll.
3. **Dispatch.** Each subscriber gets only what it asked for. A poll with no changes sends nothing.

### How a V16 beacon is recognised

DATEX2 has no dedicated cause type for V16 beacons. The DGT marks them through the
`situationRecordCreationReference` of their records, which starts with `V16_`:

```xml
<sit:situationRecord xsi:type="sit:GenericSituationRecord" id="28359593" version="1">
    <sit:situationRecordCreationReference>V16_8FqVfoM8bnqm-1790402082286_1</sit:situationRecordCreationReference>
```

A situation is a V16 beacon when **any** of its records carries that prefix. At any given moment they are
roughly one situation in ten of the feed (46 of 448 when this was written).

## Subscription

Consumers subscribe through `clusterInfo.getProvider('v16', this).subscribe(subscriber, data)`, where
`data` is:

```json
{
    "v16Only": true
}
```

| Field | Type | Description |
|---|---|---|
| `v16Only` | boolean | Only V16 beacon situations. Absent or `false` means every situation in the feed. |

A provider that consumes this one subscribes from `onProvidersReady()`, never from `startProvider()`, and
unsubscribes in `stopProvider()`.

### Events

Every event reaches `processProviderEvent('v16', event)`:

```json
{
    "type": "update",
    "added":   [ { "@_id": "24048680", "headerInformation": { }, "situationRecord": [ { } ] } ],
    "updated": [],
    "removed": [ "2816645" ]
}
```

| Field | Description |
|---|---|
| `type` | `initial` on the first delivery to a subscriber, `update` afterwards |
| `added` | new situations. On `initial`, every situation in force |
| `updated` | situations already known whose content changed |
| `removed` | ids of situations that are no longer in the feed |

- **`initial`** is always the first thing a subscriber gets, even if it is empty. A subscriber that arrives
  after the first poll gets its own `initial` with the current snapshot, and nobody else receives it again.
- **`update`** is only sent when something that subscriber cares about changed. With `v16Only`, a change
  in a roadworks situation sends nothing.

Situations are the full DATEX2 objects, as the parser leaves them: namespace prefixes stripped
(`sit:situation` becomes `situation`), attributes prefixed with `@_` (so the id is `@_id`), and every value
**as a string**, including numbers. `situationRecord` is always an array, even when there is only one.

## Configuration

The generic provider dialog on the provider card, fed by the `schema` export and `getConfigSchema()`:

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | text | `https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml` | DATEX2 SituationPublication feed |
| `intervalSeconds` | number | `60` | Seconds between two polls, minimum `5` |

The core hands what the dialog saved to `configure()` when it instantiates the provider, so a change takes
effect after a core restart. Invalid values are ignored and the previous value is kept.

> The old `datex2_v36.xml` URL still works: it answers with a permanent redirect to `v37`, and the
> redirect is followed.

### Configuration portability

It implements `exportConfig` / `importConfig`, so its configuration travels in kwirth's configuration file
(**Settings → Kwirth → Export**). Only the URL and the interval travel. The snapshot of situations is
runtime state and stays where it is. There are no secrets. An import is applied live: the next poll
already uses it.

## Management routes

The provider exposes a read-only `configRouter`, which the core mounts **behind accessKey validation**:

| Route | Returns |
|---|---|
| `GET /core/providerconfig/v16/state` | `url`, `intervalSeconds`, `lastPoll` (epoch ms), `lastError`, `situations`, `v16Situations`, `subscribers` |
| `GET /core/providerconfig/v16/situations` | every situation in force |
| `GET /core/providerconfig/v16/situations?v16Only=true` | only the V16 beacons |

These routes are also why the core instantiates the provider at startup when nothing has subscribed yet,
which is what makes it visible in `provider-debug`. The price is `requiresRestart: true`, because the core
only mounts routers while it starts.

Express is not bundled. The build maps it to the core's instance (`global.__kwirth_back__.express`),
because an installed back is loaded from a temp directory where there is no `node_modules`.

## Statistics

`getStats()` reports `subscribers`, `events` (deliveries, one per call to `processProviderEvent`) and
`errors` (failed polls and subscribers that threw).

## Development

```
npm install
npm test               # unit tests, no network (COVERAGE=1 npm test for coverage)
npm run watch          # rebuilds dist on every change (no typecheck)
npm run build          # typecheck + dist
```

Register the provider in `back/kwirth-dev.json` so the core loads it as a dev provider, and restart the
core after every change to `back.js`:

```json
"providers": {
    "v16": "../providers/v16/dist"
}
```

## Publishing

```
npm run build
cd dist
npm publish --access=public
```

Then add the entry to the jfvilas marketplace manifest (`manifest.json` at the repository root). Publish from `dist`,
never from the project root: the core looks for `package.json` and `back.js` at the root of the tarball.

## Layout

```
src/common/V16Types.ts    types shared with consumers: events, subscription, config, state
src/back/Datex2.ts        pure DATEX2 helpers: parse, identify, detect V16, diff
src/back/index.ts         the provider; its default export is the class the core instantiates
tests/v16.test.ts         unit tests against a trimmed capture of the real feed
tests/fixtures/           the capture: one roadworks situation and one V16 beacon
```
