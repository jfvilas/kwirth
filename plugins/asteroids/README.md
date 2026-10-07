# Asteroids — a channel plugin for Kwirth

A vector asteroid shooter you can play inside a [Kwirth](https://kwirthmagnify.dev) tab, with a
high-score table shared by everyone on the cluster.

- Kwirth: https://kwirthmagnify.dev — source at https://github.com/kwirthmagnify/kwirth
- Plugin source: https://github.com/jfvilas/kwirth (folder `plugins/asteroids`)
- License: MIT (the game core is an adapted copy of [wuspy/asteroids](https://github.com/wuspy/asteroids), MIT — see `NOTICE.md` and `LICENSE.upstream`)

## Installing it in Kwirth

Asteroids is published on npmjs and listed in the **jfvilas marketplace**:

| Artifact | Package | Installed from |
|---|---|---|
| The channel | `@jfvilas/kwirth-plugin-asteroids` | the plugin manager |
| Its guide | `@jfvilas/kwirth-docs-asteroids` | the docs manager |
| Its login page (optional) | `@jfvilas/kwirth-login-asteroids` | the login manager |

1. If your Kwirth does not list the jfvilas marketplace yet, add it as a marketplace with this
   manifest URL:

   ```
   https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
   ```

2. Open the **plugin manager**, find `asteroids` and install it. No restart is needed
   (`requiresRestart: false`), and it does not depend on any other extension.
3. Optionally, install the guide from the **docs manager** (it is what makes the **?** button of the
   setup dialog work) and the login page from the **login manager**.

## What it is

It does not consume any cluster data. In Kwirth terms it is a **standalone channel**: its
`getChannelData()` declares `cluster: false` and `resourced: false`, the combination the back
handles in its own branch and which makes the ResourceSelector force the `none` view
automatically. It does not ask for cluster scope and it does not select pods.

The websocket is opened and managed by the Kwirth front (one per tab) and handed, already open, to
the plugin in `channelObject.webSocket` when the channel starts. Asteroids sends no game traffic
over it —the game runs entirely in the browser— but it does listen for the back's
`SIGNAL/RESPONSE/START` to keep the instance id, which is what the front later uses to route pause
and stop.

## What makes it interesting

The game survives tab switches. When the user goes to another Kwirth tab and comes back, the ship is
where it was, with its score and its lives.

That is not achieved with DOM tricks but by taking advantage of how Kwirth is built:

- The `AsteroidsGame` instance lives in `channelObject.data`, which Kwirth keeps in the
  `ITabObject`. That object sits in a ref, outside React's render tree, and is not destroyed when
  the tab changes.
- `AsteroidsTabContent` only holds what is tied to the DOM: the canvas, the
  `requestAnimationFrame` loop and the keyboard. All of that is recreated on mount and cleanly
  destroyed on unmount.
- The game lifecycle is mapped onto the methods `IChannel` already defines:

  | Kwirth            | Asteroids                                    |
  |-------------------|----------------------------------------------|
  | `startChannel`    | creates the game, or restarts it if over     |
  | `pauseChannel`    | freezes the tick (rendering continues)       |
  | `continueChannel` | resumes                                      |
  | `stopChannel`     | discards the game, keeps the high score      |

  Switching tabs does **not** call `stopChannel`. That is why the state holds.

## Controls

| Key                  | Action        |
|----------------------|---------------|
| Left arrow / A       | turn left     |
| Right arrow / D      | turn right    |
| Up arrow / W         | thrust        |
| Space                | fire          |
| Shift / H            | hyperspace    |
| Enter                | start         |

You have to click the canvas to give it focus. The keyboard is attached to the tab element, **not**
to `window`: attaching it to `window` would steal keys from Kwirth and from any other open tab.

On mobile, on-screen touch buttons can be enabled from the setup dialog.

In fullscreen mode, where Kwirth hides its tab bar, the channel shows its own bar with the plugin
icon, the channel name and the cluster.

## Configuration

Per instance: aspect ratio of the play area (0.75 to 2.25).

Per channel: theme, touch buttons, and automatic pause when the tab loses focus.

The default theme is **classic**: pure white on black, monochrome, like the original vector game.
The **color** alternative tells the ship, the asteroids, the saucer and the shots apart by color,
which reads faster but is less faithful.

## Technical details

- **Real silhouettes, not collision boxes.** The `hitArea` polygon is drawn, and in this core those
  are the real models: four distinct asteroids with 10 to 12 vertices, the saucer with its dome and
  the ship with its rear notch.
- **Canvas 2D, not WebGL.** Rescaling or reparenting a 2D context does not cause a context loss,
  which is exactly what breaks this use case with WebGL.
- **No WebAssembly.** There is nothing to load asynchronously and no binary assets to resolve: the
  esbuild bundle is self-contained.
- **No Pixi.** The original core used `@pixi/core` only for geometry. It has been replaced by a
  130-line local shim. See `NOTICE.md`.
- The front bundle is around 87 KB unminified.

## Building

```
npm install
npm run build     # typecheck + dist/front.js + dist/back.js + dist/package.json, then docs/asteroids.tgz
npm run watch     # fast rebuild without typecheck
```

To publish, run `npm publish --access=public` on the `dist` folder. `build.mjs` takes the scope
from `publisher` in `package.json`, so the package is published as
`@jfvilas/kwirth-plugin-asteroids`.

## Manifest entry

The marketplace entry points at the npmjs tarball:

```json
{
  "extensionType": "plugin",
  "id": "asteroids",
  "version": "0.1.10",
  "name": "Asteroids",
  "url": "https://registry.npmjs.org/@jfvilas/kwirth-plugin-asteroids/-/kwirth-plugin-asteroids-0.1.10.tgz",
  "description": "Asteroids channel plugin for Kwirth - a vector asteroid shooter playable in a Kwirth tab, with per-tab persistent game state"
}
```

## High-score table

It lives in the cluster, not in the browser: the back stores it with `writeStorage`, which ends up
in a ConfigMap named `kwirth-store-channel-asteroids-scores`. Every user of that Kwirth sees the
table, and it survives changing machines.

It travels over the tab's websocket, not over an HTTP endpoint. An endpoint would have required
asking for the `ri` at start (it arrives in a separate signal that has to be requested) and sending
the accessString on every request; over the socket neither is needed.

Two details shape the design:

- The core only delivers a COMMAND to the back if the channel has **registered the instance**. That
  is why `addObject` records it and `containsInstance` really looks it up. With a no-op there, the
  messages would be dropped without notice.
- The front sends **one entry**, never the whole table. With a shared table its copy may be stale,
  and overwriting it would erase other people's games. The back is the one that inserts, sorts and
  trims, and it also notifies every open tab.

Writes are serialized in an in-process queue. With several kwirth-back replicas there is still a
race: for a high-score table that is an acceptable loss, and if it ever stopped being one, the fix
would be to retry on a ConfigMap version conflict.

If there is no socket, it falls back to `localStorage`. A local table is preferable to the game
crashing.

## Known limitations

- No anti-cheat. The back sanitizes the entry (name, types, range) but trusts the score sent by the
  front, which is JavaScript running in the browser. That is fine for a team table; the core ships a
  `GameLog` that records the whole game and would allow validating it on the server.
- No explosions. The original game disintegrated the ship and the asteroids into loose segments. The
  core does not generate that geometry; it would have to be added in the renderer from the
  `shipDestroyed` and `asteroidDestroyed` events.
- No sound. The core does not include it; it would have to be added in the front with an
  `AudioContext` created after a user gesture and suspended on pause.
- No gamepad. The original core's `InputProvider` supports gamepads; its Gamepad API part, which
  does not depend on `window` listeners, could be reused.

## License

MIT. The game engine derives from wuspy/asteroids (MIT). See `NOTICE.md` and `LICENSE.upstream`.
