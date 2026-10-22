# 📍 V16 Map (plugin)

> **Type:** Plugin (channel)<br>
> **Package:** `@jfvilas/kwirth-plugin-v16map`<br>
> **Marketplace:** `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`<br>
> **Requires:** the [v16 provider](../../../../providers/v16) (`@jfvilas/kwirth-provider-v16`)<br>
> **Icon:** 📍

## Overview

**V16 Map** draws the traffic incidents published by Spain's DGT on a map, inside a Kwirth tab. **V16 emergency beacons** — the flashing light that replaces the warning triangle on Spanish roads — are drawn in red, ahead of everything else.

It is the consumer the **v16 provider** was missing: the provider polls the DGT's DATEX2 feed and works out what changed; this channel shows it.

## Why it exists

The v16 provider has no tab of its own. Without a channel that subscribes to it, the only way to see what it produces is `provider-debug`, which prints raw DATEX2 JSON. V16 Map turns that into something you can read at a glance: where the incidents are, which ones are beacons, and what changed in the last poll.

## How it works

- **The back end subscribes to the v16 provider on behalf of your tab**, one subscription per tab, so each tab has its own filter. Stopping the channel or closing the tab removes the subscription.
- **The first message is the whole picture**: every situation in force. After that, the provider only sends **what changed** — new situations, updated ones and the ones that were cleared — and nothing at all when the feed did not change.
- **The DATEX2 situations are reduced in the back end** to what the map needs: coordinates, road and kilometre, cause, place and start time. Your browser never receives the full DATEX2 tree.
- **How often it refreshes is the provider's business**, not the channel's: 60 seconds by default, configured on the provider card.
- **The map tiles come from OpenStreetMap**, loaded by your browser.

## Getting started

1. Install the **v16 provider** from the provider manager and **restart Kwirth** (a new provider needs a restart).
2. Install **V16 Map** from the plugin manager. It needs no restart.
3. Choose **Cluster** and pick the **v16map** channel. The view switches to `none` on its own: this is a standalone channel, and the tab is named after it. Click **ADD**.
4. Open the tab's **⚙️ → Start**, choose whether you want only the V16 beacons, and click **OK**.

The first snapshot arrives as soon as the provider has polled the feed once.

## The setup

| Field | Meaning |
|---|---|
| `Only V16 emergency beacons` | Off: every incident in the feed (roadworks, accidents, weather…). On: only the situations raised by a V16 beacon, roughly one in ten |

To change it, stop the channel and start it again.

## The map

| Colour | What it is |
|---|---|
| 🔴 Red | A V16 emergency beacon |
| 🟣 Purple | An accident |
| 🟠 Orange | Roadworks and road maintenance |
| 🔵 Blue | Weather and road conditions |
| ⚫ Grey | Anything else |

| Action | How |
|---|---|
| Move around | Drag the map |
| Zoom | The mouse wheel, or the **+** and **−** buttons |
| Back to the whole country | The **⤢** button |
| See an incident's details | Click its dot, or click it in the list |
| Clear the selection | Click an empty spot of the map |

The **list** on the right has every situation, newest first. A situation the DGT publishes without coordinates is listed with *No location* and is not drawn. Clicking a situation in the list centres the map on it.

The **header** says how many situations and beacons there are, when the last message arrived, and what the last change brought: `+added ~updated −removed`.

## When something goes wrong

| What you see | What it means |
|---|---|
| `The 'v16' provider is not installed: …` | Install the v16 provider and restart Kwirth, then start the channel again |
| `Waiting for the first snapshot from the v16 provider...` for a long time | The provider cannot reach the DGT feed. Check its URL on the provider card and the cluster's outbound access |
| The dots are there but the map is blank | Your browser cannot reach `tile.openstreetmap.org` |

## Related

- [V16 Map reference](reference.md) — instance configuration and messages.
- [v16 provider](../../../../providers/v16/README.md) — the feed, the polling and how a beacon is recognised.
