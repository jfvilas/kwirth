# Permissions

Asteroids is, by far, the least privileged channel in Kwirth. This page explains exactly what it can
and cannot do, because the short answer —"nothing"— tends to raise suspicion.

## The scope: `none`

The channel only accepts the `none` scope. In practice:

- **It does not ask for access to namespaces, pods or containers.** The core starts it with the
  three selectors empty, and "empty" here means *no resource*, not *all of them*.
- **It cannot read a single Kubernetes object.** It is not given an API client.
- **It does not receive a cluster-scoped access key.** This is deliberate: the channel has its own
  branch in the core precisely so that it does not go through the `cluster` view path, which does
  grant that privilege. Asking for cluster scope for a channel that will not look at a single pod
  would be an unjustified privilege and noise in the audit.

## Granting or denying the channel

There are no finer permissions to manage: the channel is either allowed as a whole or not at all.

To control it, include or exclude `asteroids` from the user's or group's **enabled channels**, in
Kwirth's access configuration. A user without the channel enabled will not see it in the channel
selector.

## What it does need

Two things, and it is worth knowing why:

| Requirement | What for |
|---|---|
| **Websocket** | It is the transport over which it requests and saves the high-score table. Nothing about the game travels over it. |
| **Access key** | Kwirth requires an access key on **every** command that comes in over the websocket, and rejects it before even looking at which channel it is for. Without it, saving a high score would fail. |

Neither of them gives access to cluster resources: they are the mechanism by which the core
identifies and authorizes the tab's connection.

## Audit

All this channel can write to the cluster is **a single ConfigMap**, the high-score table's. It does
not create, modify or delete anything else. See [Where the table is stored](03-storage.md).
