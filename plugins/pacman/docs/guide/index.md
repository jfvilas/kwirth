# Pac-Man

**Pac-Man** is a Kwirth channel plugin that brings the classic arcade game to your Kwirth workspace.
The game runs entirely in the browser — there is no cluster resource involved.

The game is Shaun Williams' accurate JavaScript remake of the original arcade machine. It runs at full
speed inside an isolated `<iframe>`, so the game's code never interferes with Kwirth's React/MUI front
end.

## What you get

- The full Pac-Man arcade game: eat the dots, avoid the ghosts, eat the power pellets to chase them
- A score, lives and level bar above the game, always up to date
- A high-scores table persisted in the cluster (ConfigMap), shared by every user of that Kwirth
- Optional notification through a sender when the all-time record is beaten
- An optional automatic pause when you leave the game
- The game survives tab switches — switch to another Kwirth tab and back, your game is still there

## Quick start

1. Install the plugin (see [Installation](admin/01-install.md))
2. Add a Pac-Man channel to a tab, with the view `none`
3. Click **Start**, then click the game area to give it the keyboard
4. Press `Space` to insert a coin and `1` to start a one-player game
5. Use the arrow keys to move Pac-Man
