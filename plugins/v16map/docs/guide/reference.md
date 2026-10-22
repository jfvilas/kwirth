# V16 Map

The **V16 Map** plugin draws the DGT traffic incidents on a map, with V16 emergency beacons highlighted. It is a standalone channel (`cluster: false`, `resourced: false`, only the `none` view) that consumes the **v16 provider**, declared in `requirements.providers` so the core instantiates it when the plugin is installed. It writes nothing and needs no storage.

**Instance config (`IV16MapInstanceConfig`):**

| Field | Type | Default | Description |
|---|---|---|---|
| `v16Only` | `boolean` | `false` | Passed to the provider as its subscription payload: only V16 beacon situations |

Fixed for the session: the channel is not `modifiable`.

**Subscription.** On `addObject` each instance subscribes to `v16` with its own `IProviderSubscriber`, so the provider keeps one subscription per tab and each tab gets its own `initial`. It unsubscribes on `stopInstance`, `deleteObject` and `removeConnection`. If the provider is not there, the tab gets an `error` signal saying so.

**Messages (`IV16MapMessageResponse`)** — unsolicited `DATA`, one per provider event:

| Field | Description |
|---|---|
| `payloadType` | `snapshot` for the provider's `initial` (replaces everything), `changes` for an `update` |
| `added` | `IV16Point[]`: new situations; on `snapshot`, all of them |
| `updated` | `IV16Point[]`: situations whose content changed |
| `removed` | ids of the situations no longer in the feed |
| `at` | epoch ms the back end received the event |

**`IV16Point`** — a DATEX2 situation reduced by `toPoint` (`src/back/V16Extract.ts`). Fields are searched for by name, because their depth depends on the location type; the first occurrence wins, and latitude and longitude always come from the same point.

| Field | DATEX2 source |
|---|---|
| `id` | `situation/@id` |
| `lat`, `lon` | the first `latitude`/`longitude` pair. Absent when there is none, or when they are not numbers |
| `v16` | any record whose `situationRecordCreationReference` starts with `V16_` |
| `road`, `km` | `roadName`, `kilometerPoint` |
| `cause` | `causeType`, or the first record's `xsi:type` without its namespace |
| `detail` | `vehicleObstructionType`, `accidentType`, `roadMaintenanceType` or `genericSituationRecordName` |
| `municipality`, `province`, `community` | `municipality`, `province`, `autonomousCommunity` |
| `direction` | `tpegDirection` or `directionRelative` |
| `start` | `overallStartTime` |

The channel accepts no commands: `processCommand` returns `false`.

See the [V16 Map guide](guide.md).
