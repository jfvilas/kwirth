# Licenses and attribution

## The plugin

Asteroids is open source under the **MIT** license. Its source code is at
[github.com/jfvilas/kwirth](https://github.com/jfvilas/kwirth), in the `plugins/asteroids` folder.
It is a plugin for [Kwirth](https://kwirthmagnify.dev)
([source](https://github.com/kwirthmagnify/kwirth)).

## The game engine

The plugin's `src/front/core/` directory is an adapted version of the `core` package of
**[wuspy/asteroids](https://github.com/wuspy/asteroids)**, Copyright (c) 2022 Jacob Jordan,
distributed under the **MIT** license. The full license text travels with the plugin in
`LICENSE.upstream` and must be kept.

The changes from the original are detailed in the plugin's `NOTICE.md`. In short:

- The dependency on `@pixi/core` is removed. Only a few geometry symbols and constants were used,
  none of them rendering, and they are replaced by a compatibility module of the plugin's own.
- The high-score backend part of the original project is not included: Kwirth has its own.
- The class that captured the keyboard at window level **is not used**. Inside Kwirth it would steal
  keys from the rest of the application, so the keyboard is handled on the tab element.
- The initial lives drop from 5 to 3, like the original arcade.

The rest of the plugin —channel, renderer, input, interface and high-score table— is original.

## The name

"Asteroids" is a registered trademark of Atari for video games. Here it is used **descriptively**:
the plugin contains no Atari artwork, sounds or ROMs, and the code the engine derives from is an
independent vector reimplementation, equally free of Atari material.
