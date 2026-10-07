# Permissions

Pac-Man is an autonomous channel — it does not access cluster resources. What it needs from Kwirth is
minimal:

| Requirement | Why |
|---|---|
| `accessString` | Every score command over the websocket carries it; the core drops commands without it |
| `clusterUrl` | The setup lists the senders of that Kwirth |
| `webSocket` | Reading and submitting scores |
| `setup` | The setup dialog (sender, pause on focus loss) |
| `notifier` | In-app notifications, such as a score that could not be saved |
| storage | The back end keeps the high-scores table in Kwirth's storage |

## RBAC

The plugin defines no RBAC rules of its own. Access is controlled by Kwirth's standard channel
permissions — any user who can add a channel to a tab can play Pac-Man.
