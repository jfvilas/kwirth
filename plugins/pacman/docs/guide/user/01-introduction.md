# What it is

Pac-Man is a **channel plugin** for Kwirth that serves Shaun Williams' remake of the classic arcade
game *Pac-Man* (originally by Namco). The remake is a JavaScript reimplementation: there is no Namco
art, sound or ROM in it.

## Why

Kwirth channels are not only for monitoring and alerts — they can serve interactive content. Pac-Man
shows that a complete game can run inside a Kwirth tab, next to the rest of the platform, without
affecting it.

## How it is packaged

- The game's JavaScript is **bundled inside `dist/front.js`** as text — no external fetch, no CDN.
- At runtime it is injected into an `<iframe>` via `srcdoc`, fully isolated from Kwirth's page.
- The game is served as it is, with one addition inside it: a small bridge that tells the plugin the
  score, the lives, the level and when the game is over, and that lets the plugin pause it.

## Controls

| Key | Action |
|-----|--------|
| `←` `↑` `→` `↓` | Move Pac-Man |
| `Space` | Insert a coin |
| `1` | Start a one-player game |
| `2` | Start a two-player game |
| `Ctrl` `Alt` `F11` | Kwirth's fullscreen — it works also while the game has the keyboard |

Click the game area first to give the game the keyboard.

## Sound

The game references sound files that are **not included** in the plugin. The game plays without them:
the sounds fail silently and nothing else is affected.
