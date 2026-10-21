# Flight Map

The **Flight Map** plugin draws live aircraft over an area on a map, with details for the flights the user follows. It is a standalone channel (`cluster: false`, `resourced: false`, only the `none` view) that consumes the **flight-status provider**, declared in `requirements.providers` so the core instantiates it when the plugin is installed. It writes nothing and needs no storage.

**Instance config (`IFlightMapInstanceConfig`)** — it is the provider's subscription payload, passed as is:

| Field | Type | Default | Description |
|---|---|---|---|
| `bbox` | `{ lamin, lomin, lamax, lomax }` | the Iberian peninsula: `36.0, -9.5, 43.8, 3.3` | The area, in degrees. The setup requires `lamin < lamax` and `lomin < lomax` |
| `intervalSec` | `number` | `720` | Seconds between polls. The setup requires at least `10`, the provider's own minimum |
| `watch` | `string[]` | `[]` | ICAO callsigns to enrich with details. The setup upper-cases them |

Fixed for the session: the channel is not `modifiable`.

**OpenSky cost.** The setup estimates it the way the provider charges it: the box is widened to a 0.5° grid, and a call costs 1 credit up to 25 square degrees, 2 up to 100, 3 up to 400 and 4 above. The default setup costs 3 credits every 12 minutes, 360 a day, within the anonymous 400.

**Subscription.** On `addObject` each instance subscribes to `flight-status` with its own `IProviderSubscriber`, so the provider polls each tab's box at its own interval. It unsubscribes on `stopInstance`, `deleteObject` and `removeConnection`. If the provider is not there, the tab gets an `error` signal saying so; if the provider rejects the subscription, the tab gets its reason.

**Messages (`IFlightMapMessageResponse`)** — unsolicited `DATA`, one per provider event:

| Field | Description |
|---|---|
| `payloadType` | `positions` or `error` |
| `timestamp` | ISO time of the event |
| `aircraft` | `positions` only: every aircraft in the box, as the provider sends them. Watched callsigns carry `details`, or `null` when no source knows the flight |
| `error` | `error` only: the provider's message. The provider sends it only when the message changes |

A `positions` message **replaces** the aircraft the tab had and clears the last error; an `error` keeps the last positions.

The channel accepts no commands: `processCommand` returns `false`.

See the [Flight Map guide](guide.md).
