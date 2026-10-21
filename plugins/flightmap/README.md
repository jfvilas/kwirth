# Flight Map — live aircraft on a map

**Flight Map** is a channel plugin for [Kwirth](https://kwirthmagnify.dev) that draws the aircraft flying
over an area on a map, live, right inside Kwirth, with route and delays for the flights you follow.

It is fed by the **flight-status provider**, which gets positions from OpenSky and flight details from
AviationStack or FlightAware, keeping their quotas in check. Flight Map subscribes to it on behalf of each
tab, with that tab's area, interval and followed flights.

## Features

- Every aircraft in the area on an OpenStreetMap map, pointing along its track and coloured by altitude.
- Ready-made areas (Iberian peninsula, Madrid, Barcelona, Canary Islands, Balearic Islands) or your own box.
- The OpenSky cost of your setup per day, before you start it.
- Flights to follow by ICAO callsign, highlighted and listed first, with origin, destination, schedule and
  delays.
- Details of any aircraft: altitude, speed, heading, country, squawk.
- Drag to move, mouse wheel to zoom, one button to see the whole area again.

## Requirements

- The **flight-status provider** (`@jfvilas/kwirth-provider-flight-status`), installed and with Kwirth
  restarted. Your own OpenSky, AviationStack and FlightAware credentials go on its card; all are optional.
- Outbound access from the cluster to OpenSky, and from your browser to `tile.openstreetmap.org`.

## Installation

1. In Kwirth, add the **jfvilas marketplace** if it is not there yet:
   `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`
2. From the **provider manager**, install **Flight Status Provider** and restart Kwirth.
3. From the **plugin manager**, install **Flight Map**. You can also install it from its npm package,
   `@jfvilas/kwirth-plugin-flightmap`, or from a local `.tgz` with **Browse…**.
4. Choose the **flightmap** channel (the view switches to `none` on its own), **ADD**, and start it.

## Instance setup

| field | meaning |
|---|---|
| **Area** | a ready-made area, or **Custom** |
| **Lat min / Lat max / Lon min / Lon max** | the box, in degrees |
| **Seconds between updates** | at least 10; the field says what it costs a day |
| **Flights to follow** | ICAO callsigns, like `IBE3171` |

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
- Flight Map source code: https://github.com/jfvilas/kwirth (folder `plugins/flightmap`)
- Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
