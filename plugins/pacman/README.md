# Pac-Man — channel plugin for Kwirth

The classic Pac-Man arcade game, playable inside a tab of [Kwirth](https://kwirthmagnify.dev), the
Kubernetes observability and operations platform ([source](https://github.com/kwirthmagnify/kwirth)).

It consumes no cluster data. In Kwirth terms it is an **autonomous channel**: its `getChannelData()`
declares `cluster: false` and `resourced: false`. It asks for no cluster scope and selects no pods.

The game runs entirely in the browser, inside an iframe. The back end only persists the high-score
table, in a ConfigMap of the cluster.

## Installation

Pac-Man is published to npm as `@jfvilas/kwirth-plugin-pacman` and listed in the **jfvilas
marketplace**. If your Kwirth does not list it yet, add this manifest as a marketplace:

```
https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
```

Then install **Pac-Man** from the plugin manager, choose the `none` view and add the `pacman` channel
to a tab.

## What makes it interesting

The game survives tab switches. When the user goes to another Kwirth tab and comes back, the game is
where it was.

- The game instance lives in `channelObject.data`, which Kwirth keeps in the `ITabObject`. That object
  is outside React's render tree and is not destroyed when switching tabs.
- The iframe is repositioned over the tab area on mount and hidden on unmount. Only `stopChannel`
  really destroys it.

## Controls

| Key        | Action                 |
|------------|------------------------|
| Arrows     | move Pac-Man           |
| Space      | insert coin            |
| 1          | start 1 player         |
| 2          | start 2 players        |
| Ctrl+Alt+F11 | Kwirth's fullscreen, also while the game has the focus |

## Configuration

Per instance: automatic pause when the tab loses the focus, and an optional sender to notify when the
record is beaten.

## Sound

The game references sound files (`sounds/*.mp3`) that are **not included** in the plugin (about
1.8 MB of MP3s). The game works without them: the sounds fail silently and the rest of the game is not
affected.

## High scores

They live in the cluster, not in the browser: the back end stores them with `writeStorage`, which ends
up in a ConfigMap `kwirth-store-channel-pacman-scores`. Every user of that Kwirth sees the table, and
it survives changing machines. Without a socket, it falls back to `localStorage`.

## Building

```
npm install
npm run build     # typecheck + dist/front.js + dist/back.js + dist/package.json + the guide tgz
npm run watch     # fast rebuild without typecheck
npm test          # harness
```

## License

The game is a reimplementation by Shaun Williams, distributed under the **GPL v3**, and so is this
plugin, which bundles it. See `NOTICE.md` and `LICENSE.upstream` (both shipped in the package).

- Kwirth: https://kwirthmagnify.dev
- Pac-Man plugin source: https://github.com/jfvilas/kwirth (folder `plugins/pacman`)
