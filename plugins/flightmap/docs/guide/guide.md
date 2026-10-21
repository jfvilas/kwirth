# ✈️ Flight Map (plugin)

> **Type:** Plugin (channel)<br>
> **Package:** `@jfvilas/kwirth-plugin-flightmap`<br>
> **Marketplace:** `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`<br>
> **Requires:** the [flight-status provider](../../../../providers/flight-status) (`@jfvilas/kwirth-provider-flight-status`)<br>
> **Icon:** ✈️

## Overview

**Flight Map** draws the aircraft flying over an area on a map, live, inside a Kwirth tab. Each plane points where it is heading and is coloured by altitude. For the flights you choose to **follow**, it also shows where they come from, where they are going and how late they are.

It is the consumer the **flight-status provider** was missing: the provider talks to OpenSky, AviationStack and FlightAware and keeps their quotas in check; this channel shows what it gets.

## Why it exists

The flight-status provider has no tab of its own. Without a channel that subscribes to it, the only way to see what it produces is `provider-debug`, which prints raw JSON. Flight Map turns that into a map you can read at a glance.

## How it works

- **The back end subscribes to the flight-status provider on behalf of your tab**, with the area, the interval and the flights chosen in the setup. Each tab is its own subscription. Stopping the channel or closing the tab removes it.
- **Positions come from OpenSky**, for the aircraft inside your area only, every so many seconds. Each update replaces the previous one: an aircraft that left the area disappears from the map.
- **Details** (origin, destination, schedule, delays, aircraft type) are scarce, so the provider fetches them **only for the flights you follow**, from AviationStack or FlightAware if they are configured on the provider card.
- **Every call to OpenSky costs credits**: 400 a day without credentials, 4000 with them. The cost of a call grows with the area. The setup tells you how much your choice spends in a day.
- **The map tiles come from OpenStreetMap**, loaded by your browser.

## Getting started

1. Install the **flight-status provider** from the provider manager and **restart Kwirth**. Optionally, set your OpenSky, AviationStack and FlightAware credentials on its card (⚙️).
2. Install **Flight Map** from the plugin manager. It needs no restart.
3. Choose **Cluster** and pick the **flightmap** channel. The view switches to `none` on its own: this is a standalone channel, and the tab is named after it. Click **ADD**.
4. Open the tab's **⚙️ → Start**, choose the area, the interval and the flights to follow, and click **OK**.

## The setup

| Field | Meaning |
|---|---|
| `Area` | A ready-made area — Iberian peninsula, Madrid, Barcelona, Canary Islands, Balearic Islands — or **Custom** |
| `Lat min`, `Lat max`, `Lon min`, `Lon max` | The box itself, in degrees. Editing any of them switches the area to **Custom** |
| `Seconds between updates` | At least 10. Below the field: what one call costs and how many credits a day that is |
| `Flights to follow` | ICAO callsigns, separated by commas or spaces: `IBE3171`, not the `IB3171` printed on the ticket. Upper or lower case, it does not matter |

The default is the Iberian peninsula every 12 minutes: 3 credits a call, 360 a day, within the anonymous quota. To try it quickly, choose **Madrid** with 60 seconds: 1 credit a call, but 1440 a day, which needs OpenSky credentials to last the whole day.

To change the setup, stop the channel and start it again.

## The map

| Colour | What it is |
|---|---|
| 🔴 Red | A flight you follow |
| Light blue | Below 3,000 m |
| Blue | 3,000 to 8,000 m |
| Dark blue | Above 8,000 m |
| ⚫ Grey | On the ground |

The dashed rectangle is the area you asked for.

| Action | How |
|---|---|
| Move around | Drag the map |
| Zoom | The mouse wheel, or the **+** and **−** buttons |
| Back to the whole area | The **⤢** button |
| See an aircraft | Click its plane, or click it in the list |
| Clear the selection | Click an empty spot of the map |

The **list** on the right puts the flights you follow first — with *Not in the area right now* for those that are not — and then every other aircraft. The **details** of the selected one show altitude (feet), speed (knots), heading, country, squawk and ICAO24 address; for a followed flight, also airline, route, status, departure and arrival times with their delays, and aircraft type.

## When something goes wrong

| What you see | What it means |
|---|---|
| `The 'flight-status' provider is not installed: …` | Install the flight-status provider and restart Kwirth, then start the channel again |
| `Provider: …` in orange | The provider reported a problem: usually no credits left for this period, or a source paused after failing. The last positions stay on the map until new ones arrive |
| `Waiting for the first positions…` for a long time | The provider has no OpenSky budget for your area and interval, or cannot reach OpenSky. Try a smaller area or a longer interval |
| `Details pending` on a followed flight | No details source is configured on the provider, or it is out of quota for now |
| `No source knows this flight` | The details sources were asked and do not know that callsign |
| The planes are there but the map is blank | Your browser cannot reach `tile.openstreetmap.org` |

## Related

- [Flight Map reference](reference.md) — instance configuration and messages.
- [flight-status provider](../../../../providers/flight-status/README.md) — sources, quotas and credentials.
