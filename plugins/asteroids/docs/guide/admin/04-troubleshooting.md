# Troubleshooting

## For users

| Symptom | Cause and solution |
|---|---|
| The game does not respond to the keyboard | The play area does not have the focus. Click on it. It is, by far, the most common cause: the channel only listens to its own element, so as not to steal keys from the rest of Kwirth. |
| It says *"Asteroids not started"* | The channel has been added but not started. Tab gear icon → **Start**. |
| The score bar is not visible | Same as above: it appears when the channel starts, because when stopped it could only show zeros. |
| The ship keeps flying when switching tabs | **Pause when the tab loses focus** is disabled in the channel configuration. |
| The game looks small and centred | That is normal. The canvas respects the configured aspect ratio; if the height is the limiting side, there is spare space on the sides. |
| My high score does not appear | Most likely you did not beat the last entry in the table: with the table full you have to beat it; a tie does not get in. |
| The table is empty | Normal on a new cluster: the table is per cluster and starts empty. |
| *"The score could not be saved"* | The score did not reach the plugin's back. See the next section. |

## For administrators

### The score is not saved

If a player saves a high score and, instead of the table updating, Kwirth shows the error
*"The score could not be saved: … Stop and start the channel and try again."*, the command **did
not reach the plugin**. The message says which of the two failures happened:

| Detail in the message | Meaning |
|---|---|
| *the channel is not connected* | The tab's websocket is not open, so the command could not even be sent. It fails instantly. |
| *the server did not answer* | The command was sent, but no answer arrived within five seconds. This points to the core discarding the command before it reached the plugin. |

The core rejects every command that comes in over the websocket without a valid access key,
**before** looking at which channel it is for, and it also discards commands addressed to an
instance it does not know.

What to check:

1. That the user's session is still alive. An expired session is the usual cause: reloading and
   logging in again is enough.
2. That the channel is really started. A tab that lost its connection and did not reconnect sends
   commands that no longer correspond to any registered instance.
3. In the core log, messages like `No access key received` or
   `Instance '<id>' ... not found for command` at the time of saving. The browser console also logs
   `[asteroids] score not saved:` with the failure, the instance id and the socket state.

In all three cases the solution is the same: **stop and start the channel again**, which renews
the instance and the authorization.

### After updating the plugin, the open tab stops saving

Same symptom, similar cause. When the plugin's back reloads, the registered instances are lost, and
the tabs that were open keep an identifier that no longer exists.

It is not a data problem and nothing needs to be touched: stopping and starting the channel in each
open tab solves it. The high scores already saved are not affected.

### The dialog's **?** icon does not open anything

The documentation package is missing. Install `@jfvilas/kwirth-docs-asteroids` from the docs manager
(it is in the jfvilas marketplace); see [Installation](01-install.md).
