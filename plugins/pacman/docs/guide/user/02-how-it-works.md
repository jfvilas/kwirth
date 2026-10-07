# How it works

## Architecture

Pac-Man is an **autonomous channel**: `cluster: false`, `resourced: false`, no endpoints. The game runs
entirely in the browser — the back end only stores and serves the high-scores table.

### Front

1. **PacmanMachine** creates a `position:fixed` `<div>` on the page, holding an `<iframe>`.
2. The iframe's `srcdoc` carries the whole game, inline.
3. The game canvas keeps the arcade's 224×288 aspect ratio and is scaled to fit the tab. A
   `ResizeObserver` repositions it when the window changes size.
4. The machine lives in the channel's data, **outside React's tree**. When you switch Kwirth tabs the
   tab content unmounts but the machine survives: it is just hidden, and shown again where you left it.
5. A bridge inside the game reports, every quarter of a second and only when something changed, the
   score, the lives, the level and whether the game-over screen is showing. That feeds the bar above
   the game and offers the score to the high-scores table when a game ends.
6. The same bridge obeys the pause: pausing the channel, or the automatic pause, freezes the game
   itself — the screen stays, nothing moves.

### Back

The back end is a small channel that:

- Stores the high scores in a ConfigMap through Kwirth's storage (key `pacman-scores`)
- Answers the commands that read the table and submit a score
- Sanitises, sorts and trims the table to 10 entries
- Optionally notifies through a sender when the first place is beaten

Submissions are queued, so two games ending at the same time do not overwrite each other.
