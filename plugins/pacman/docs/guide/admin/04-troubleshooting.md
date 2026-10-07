# Troubleshooting

## The game area is black

- **Did you click Start?** The game only appears after starting the channel.
- **Is the game paused?** With *Pause when the tab loses focus* on, a game that does not have the
  keyboard is paused. Click the game area.

## The keyboard does not respond

The game needs the keyboard. **Click the game area** first. If you clicked elsewhere (a menu, another
tab), click the game again.

## The game disappears when switching tabs

Expected: the game is hidden while you are on another tab, and shown again when you come back.

## No sound

Expected: the sound files are not included in the plugin. The game plays without them.

## Scores are not saved

- A notification saying *"The score could not be saved"* means the channel had no connection to the
  back end, or the back end did not answer. Stop and start the channel and try again.
- Check that Kwirth can write ConfigMaps in its namespace: the table lives in one.
- The Kwirth log shows `pacman: could not store the high scores: …` with the reason.

## The record notification does not arrive

- Check that the channel was set up with a sender (⚙ → **Start** → the sender field).
- Only beating the **first place** sends it.
- The Kwirth log shows `pacman: could not notify the record: …` when the sender failed.
