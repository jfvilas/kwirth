# Flight Map — test metrics history

> **Incremental** record of the test suite, one row per release / tag. A row is **added** at the top on each
> close; rows are **not overwritten**: this is a history.
>
> **How each figure is obtained:**
> - **Harness** = number of tests `npm test` reports (`node --test`).
> - **Coverage** = `COVERAGE=1 npm test` (Node `--experimental-test-coverage`). ⚠️ It is over what the harness
>   **loads** (the back channel, the tab's data, the OpenSky cost and the units), **not** 100% of the code: the
>   React components (`.tsx`) are covered by the e2e, not measured numerically. The report comes from the
>   single test bundle, not mapped back to `src/`.
> - **e2e** = number of spec files (`e2e/tests/*.spec.ts`) and of `test()` cases.

| Date | Version / tag | Harness | Coverage (lines / branches / funcs) | e2e (specs / cases) | Notes |
|---|---|---|---|---|---|
| 2026-10-21 | `0.1.2` (not published) | **23** | **97.05% / 95.59% / 85.59%** | 1 / 12 | **S1: the plugin working on a local Kwirth.** Live aircraft over an area on an OSM map, pointing along their track and coloured by altitude, followed flights first with route and delays, and the OpenSky cost of the setup per day, computed the way the provider charges it. The e2e injects the channel's data through the websocket and holds the real provider's back; it never calls OpenSky, so a run spends no credits. 🐛 The same two as V16 Map (pointer capture, `CLUSTER-1` tab name), plus a cost estimate that ignored the 0.5° widening. |
