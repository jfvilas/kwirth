# Depth Charge — a retro arcade game for Kwirth

**Depth Charge** is a channel plugin for [Kwirth](https://kwirthmagnify.dev): a retro destroyer-versus-submarines
arcade game that you play in a Kwirth tab. Sail your destroyer along the surface and drop depth charges on the
submarines patrolling below, before they get you.

The game runs entirely in your browser. The back end only registers the channel instance so Kwirth can pause and
stop it; it does not touch your cluster.

## Controls

The tab has to have the focus (click on it): the keys never leave it, so other tabs and Kwirth itself keep theirs.

| key | action |
|---|---|
| **←** / **A** | move left |
| **→** / **D** | move right |
| **Z** / **Q** | drop a depth charge on the left side |
| **X** / **E** | drop a depth charge on the right side |
| **Enter** / **Space** | start a game |

## Installation

1. In Kwirth, add the **jfvilas marketplace** if it is not there yet:
   `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`
2. From the **plugin manager**, install **Depth Charge**. You can also install it from its npm package,
   `@jfvilas/kwirth-plugin-depthcharge`, or from a local `.tgz` with **Browse…**.
3. Choose the **depthcharge** channel, **ADD**, and start it.

## Development

```bash
npm install
npm run build        # dist/: front.js, back.js, package.json, README.md
```

## Links

- Kwirth: https://kwirthmagnify.dev — source at https://github.com/kwirthmagnify/kwirth
- Depth Charge source code: https://github.com/jfvilas/kwirth (folder `plugins/depthcharge`)
