# V16 Map — test metrics history

> **Incremental** record of the test suite, one row per release / tag. A row is **added** at the top on each
> close; rows are **not overwritten**: this is a history.
>
> **How each figure is obtained:**
> - **Harness** = number of tests `npm test` reports (`node --test`).
> - **Coverage** = `COVERAGE=1 npm test` (Node `--experimental-test-coverage`). ⚠️ It is over what the harness
>   **loads** (the back channel, the DATEX2 extraction, the tab's data and the tile arithmetic), **not** 100% of
>   the code: the React components (`.tsx`) are covered by the e2e, not measured numerically. The report comes
>   from the single test bundle, not mapped back to `src/`.
> - **e2e** = number of spec files (`e2e/tests/*.spec.ts`) and of `test()` cases.

| Date | Version / tag | Harness | Coverage (lines / branches / funcs) | e2e (specs / cases) | Notes |
|---|---|---|---|---|---|
| 2026-10-21 | `0.1.2` (not published) | **38** | **99.20% / 95.54% / 91.78%** | 1 / 10 | **S1: the plugin working on a local Kwirth.** DGT incidents on an OSM map, V16 beacons in red, list newest first, details on click, `snapshot` / `changes` from the v16 provider. The extraction is tested against the provider's real DATEX2 fixture, parsed with the same options. The e2e injects the channel's data through the websocket and holds the real provider's back, so the map shows known situations; one case checks the real snapshot and can be skipped (`V16MAP_E2E_SKIP_LIVE`). 🐛 Two found by hand: a click on a dot did nothing (pointer capture), and the tab was named `CLUSTER-1` (`cluster: true`). |
