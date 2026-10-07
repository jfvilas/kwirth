# Third parties

## Game engine

The `src/front/core/` directory is an adapted version of the `core` package of
**wuspy/asteroids** (https://github.com/wuspy/asteroids), Copyright (c) 2022
Jacob Jordan, distributed under the MIT license. The full text is in
`LICENSE.upstream` and must be kept.

Changes from the original:

- Removed the dependency on `@pixi/core`. Only six symbols were used
  (`DEG_TO_RAD`, `PI_2`, `ISize`, `IPointData`, `Polygon`, `Rectangle`) plus
  `ObservablePoint`, all of them geometry and constants, none of them rendering.
  They are replaced by `src/front/core/engine/pixi-compat.ts`.
- The prototype extensions that math.ts made through
  `declare module "@pixi/core"` are now declared by merging in
  `pixi-compat.ts` itself.
- `core/src/api/` is not vendored: it belongs to the original project's
  high-score backend and does not apply here.
- `constants.ts`: `LIVES` goes from 5 to 3, which is how the original arcade starts.
  Note that this constant has a double use: besides the initial lives, it is the CAP
  on the lives that can be accumulated with `EXTRA_LIFE_AT_SCORE`, so the maximum
  drops to 3 as well.
- `engine/InputProvider.ts` is kept for its types (`InputState`,
  `controls`, `createEmptyInput`), but its `InputProvider` class is NOT used:
  it attaches listeners to `window`, which inside Kwirth would steal keys from
  the application. The keyboard is handled in `AsteroidsInput.ts`, on the tab
  element.

The rest of the plugin (channel, renderer, input, UI) is original.

## Name

The plugin is called **Asteroids**. "Asteroids" is a registered trademark of Atari for
video games, and the name is used here descriptively: there is no Atari artwork, sound
or ROM in the plugin. The original wuspy code the engine derives from is an
independent vector reimplementation, equally free of Atari material.
