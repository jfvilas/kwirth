# Flight Status Provider

Flight status provider for [Kwirth](https://kwirthmagnify.dev), the Kubernetes observability and
operations platform ([source](https://github.com/kwirthmagnify/kwirth)) — live ADS-B positions from
OpenSky, enriched on demand with AviationStack and FlightAware AeroAPI under in-memory quota control.

## Installation

Flight Status is open source, published to npm as `@jfvilas/kwirth-provider-flight-status` and listed
in the **jfvilas marketplace**. If your Kwirth does not list it yet, add this manifest as a marketplace:

```
https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
```

Then install **Flight Status Provider** from the provider manager (Kwirth needs a restart to load a new
provider) and configure it from its gear icon. The OpenSky, AviationStack and AeroAPI credentials are
your own. Source code: [github.com/jfvilas/kwirth](https://github.com/jfvilas/kwirth) (folder
`providers/flight-status`).

## What it is

Installable kwirth **provider** (`@jfvilas/kwirth-provider-flight-status`): a
backend extension that produces events and fans them out to the channels that subscribe to it. A
provider has no tab of its own; this one ships a configuration dialog (`front.js`) that the provider
manager opens from the gear icon.

## How it works

The provider does **not** broadcast every flight in the world. Each subscriber says what it wants to
receive — a geographic box, an interval and, optionally, a list of callsigns to follow closely — and
the provider polls on behalf of that subscriber alone.

```
subscriber ──{ bbox, intervalSec, watch }──▶ flight-status
                                               │ every intervalSec
                                               ├─▶ OpenSky /states/all (bbox snapped to a 0.5° grid, cached, coalesced)
                                               └─▶ for each aircraft whose callsign is in 'watch':
                                                     AviationStack or AeroAPI (cached 12 h; "not found" cached 1 h)
subscriber ◀──{ type: 'positions', aircraft: [...] }──┘
```

- **Positions** come from OpenSky, for the aircraft inside the subscriber's bbox only.
- **Details** (origin, destination, schedule, delays, aircraft type) are the scarce resource, so they
  are fetched only for the callsigns in `watch` — never for the whole box.
- Subscribers with nearby bboxes **share calls**: the box is widened to a 0.5° grid, the response is
  cached for `positionTtlSec` and concurrent requests for the same key share one upstream call. Each
  subscriber then gets the result filtered back to the box it asked for.

### Quotas

Every source has a budget: OpenSky in daily credits (400 anonymous / 4000 with credentials; 1 to 4
per call depending on the bbox area), AviationStack in monthly requests (about 100 on the free plan),
AeroAPI in monthly dollars.

The budget is **paced**: at any moment, background polling may only have spent the elapsed share of
the period plus one burst slice (one day on monthly quotas, one hour on daily ones). Part of each
budget is kept in reserve for interactive requests. When a tick has no budget left it is skipped and
the subscriber gets one `error` event.

The accounting lives **in memory only**. It survives configuration changes, but not a restart of the
core; on start the provider assumes it was going at the planned pace, so a restart never hands out
the whole month again. OpenSky resyncs itself with its `X-Rate-Limit-Remaining` header on the first
call.

A source that fails is paused by a circuit breaker (exponential backoff from 1 to 30 minutes, or the
`Retry-After` the API sends), and the next source with that capability is tried.

## Subscription

A channel subscribes through its provider handle (`clusterInfo.getProvider('flight-status', this)`)
with this payload — the example `getSubscriptionHelp()` publishes, the Iberian peninsula:

```json
{
    "bbox": { "lamin": 36.0, "lomin": -9.5, "lamax": 43.8, "lomax": 3.3 },
    "intervalSec": 120,
    "watch": ["IBE3171", "VLG1001", "AEA5023", "IBS3902", "ANE8410"]
}
```

A box cannot leave the Balearic Islands out, so they come along. The box is about 100 square degrees and
costs **3 OpenSky credits per call**: with credentials (4000 a day) an interval of 120 s is comfortable;
anonymous (400 a day) only holds one call every 12 minutes, so use `intervalSec: 720`. The watched
callsigns (Iberia, Vueling, Air Europa, Iberia Express, Air Nostrum) are examples: flights change every
day, replace them with the ones you want to follow.

| Field | Type | Required | Description |
|---|---|---|---|
| `bbox` | object | yes | Latitudes/longitudes of the box, in degrees. `lamin < lamax`, `lomin < lomax` |
| `intervalSec` | number | no | Seconds between polls. Default 30, minimum 10 (lower values are raised) |
| `watch` | string[] | no | ICAO callsigns as broadcast by the aircraft (`IBE3171`, not the IATA `IB3171`) to enrich with details |

`updateSubscription` replaces the payload and restarts the polling. The contract is also published
through `getSubscriptionHelp()`, which is what `provider-debug` shows.

### Events

Delivered to `processProviderEvent('flight-status', event)`:

```json
{
    "type": "positions",
    "timestamp": "2026-09-26T10:00:00.000Z",
    "bbox": { "lamin": 36.0, "lomin": -9.5, "lamax": 43.8, "lomax": 3.3 },
    "aircraft": [
        {
            "icao24": "34718e",
            "callsign": "IBE3171",
            "originCountry": "Spain",
            "lat": 42.2,
            "lon": -8.1,
            "baroAltitudeM": 10000,
            "onGround": false,
            "velocityMs": 230,
            "trackDeg": 180,
            "lastContact": 1700000001,
            "source": "opensky",
            "details": {
                "callsign": "IBE3171",
                "flightIata": "IB3171",
                "origin": { "icao": "LEMD", "iata": "MAD", "name": "Madrid" },
                "destination": { "icao": "LEVX", "iata": "VGO", "name": "Vigo" },
                "status": "active",
                "departureDelayMin": 12,
                "source": "aviationstack",
                "fetchedAt": "2026-09-26T09:58:00.000Z"
            }
        }
    ]
}
```

`details` appears only on watched callsigns, and is `null` when no source knows the flight. While a
source has no budget to enrich, the aircraft comes without `details` and it is retried on the next tick.

Failures arrive as `{ "type": "error", "timestamp", "message" }`, **only when the message changes**,
so a paused source does not flood the subscriber.

## Configuration

Gear icon on the provider card → dialog served by the provider itself (`/core/providerconfig/flight-status`,
behind accessKey validation).

| Section | Field | Description |
|---|---|---|
| OpenSky | Client ID / Client secret | OAuth2 client credentials. Both empty = anonymous (400 credits/day) |
| | Daily credits | 0 = automatic (400 anonymous / 4000 with credentials) |
| AviationStack | Enabled / Access key / Requests per month | Enrichment. The free plan only allows plain HTTP: the key travels in clear |
| AeroAPI | Enabled / API key / Monthly budget (USD) / Cost per call (USD) | Enrichment, billed in money |
| Cache | Positions cache (s) / Details cache (h) | TTLs of the two caches. Positions at least 5 s |

The dialog also shows the quota of every source: used, limit and what the pace allows right now,
refreshed every 10 seconds.

**Save** validates, stores and applies the configuration at once, and closes the dialog. If the
configuration is rejected — an enabled source with no key, OpenSky with only one of its two credentials,
a number out of range — the dialog stays open and the reason shows right above the buttons. **Cancel**
closes without saving. Changes apply hot, with no restart: running subscriptions pick up the new sources
on their next tick, and the quota already spent is kept.

The browser never autofills the dialog: credential fields opt out of password autofill
(`autocomplete="new-password"`) and the OpenSky Client ID out of username autofill, so a saved Kwirth
login can never end up stored as the OpenSky credentials.

Credentials are handled like any other field: `GET /config` returns them, the dialog shows them masked
with an eye toggle, and `PUT /config` stores what arrives. They are persisted apart from the rest —
credentials in a Secret (`flight-status-creds`), everything else in a ConfigMap (`flight-status-config`).

With no storage injected by the core, the configuration is read from environment variables:
`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `AVIATIONSTACK_KEY`, `AEROAPI_KEY`.

⚠️ `requiresRestart: true`: installing the provider hot does not mount its configuration router — the
core only mounts it on start (or when a plugin that requires it is installed). Restart the core after
installing or upgrading.

## Development

```
npm install --legacy-peer-deps
npm run watch    # rebuilds dist/ on every change, no typecheck
npm test         # unit tests (node --test)
npm run build    # typecheck + dist/back.js + dist/front.js + dist/package.json
```

`express` is **never bundled and never external**: build and watch map it to the core's shared
instance (`global.__kwirth_back__.express`), so the `configRouter` is a Router of the same express the
core mounts it on. It is a devDependency only for types and for the tests.

Publishing: `npm publish --access=public` from `dist/` to npmjs, then add the entry to the jfvilas
marketplace manifest (`manifest.json` at the repository root).
