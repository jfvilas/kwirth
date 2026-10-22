# V16 Map — DGT traffic incidents on a map

**V16 Map** is a channel plugin for [Kwirth](https://kwirthmagnify.dev) that draws the traffic incidents
published by Spain's DGT on a map, right inside Kwirth, with **V16 emergency beacons** highlighted.

It is fed by the **v16 provider**, which polls the DGT's DATEX2 feed and works out what changed. V16 Map
subscribes to it on behalf of each tab and shows the result.

## Features

- Every incident in force on an OpenStreetMap map, coloured by cause; V16 beacons in red.
- Optionally, only the V16 beacons.
- A list newest first, and the details of the selected incident: road and kilometre, place, cause, direction
  and start time.
- Live updates: only what changed reaches the tab, and the header says what the last change brought.
- Drag to move, mouse wheel to zoom, one button to see the whole country again.

## Requirements

- The **v16 provider** (`@jfvilas/kwirth-provider-v16`), installed and with Kwirth restarted.
- Outbound access from the cluster to the DGT feed, and from your browser to `tile.openstreetmap.org`.

## Installation

1. In Kwirth, add the **jfvilas marketplace** if it is not there yet:
   `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`
2. From the **provider manager**, install **V16 Provider** and restart Kwirth.
3. From the **plugin manager**, install **V16 Map**. You can also install it from its npm package,
   `@jfvilas/kwirth-plugin-v16map`, or from a local `.tgz` with **Browse…**.
4. Choose the **v16map** channel (the view switches to `none` on its own), **ADD**, and start it.

## Instance setup

| field | meaning |
|---|---|
| **Only V16 emergency beacons** | off: every incident in the feed; on: only those raised by a V16 beacon |

## Development

```bash
npm install
npm run build        # dist/: front.js, back.js, package.json
npm test             # harness; COVERAGE=1 npm test for coverage
cd e2e && npm install && npx playwright test   # against a running Kwirth, see e2e/playwright.config.ts
```

The guide is in [docs/guide](docs/guide/guide.md).

## Links

- Kwirth: https://kwirthmagnify.dev — source at https://github.com/kwirthmagnify/kwirth
- V16 Map source code: https://github.com/jfvilas/kwirth (folder `plugins/v16map`)
- Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
