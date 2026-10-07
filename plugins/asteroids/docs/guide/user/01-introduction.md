# What it is and why it exists

Asteroids is a Kwirth channel that is not meant for operating the cluster: it is a game. It is added
like any other channel, takes up its own tab and is played inside it.

It has two reasons to exist, and both are worth knowing.

## 1. A break

The first one is the obvious one. Kwirth is a tool used during long and often tense working days —
watching production logs, chasing a pod that will not start— and having a tab to escape to for five
minutes is not frivolous.

## 2. The simplest example of a standalone channel

The second one is technical. Kwirth was born to observe Kubernetes: almost all its channels ask for
a namespace, some pods, some containers, and the core hands them events about those resources.

Asteroids **asks for nothing**. It declares `cluster: false` and `resourced: false`, and with that the
core treats it as a **standalone channel**: it starts it only once, with the three selectors empty,
and gives it access to no cluster resource at all.

That makes it the smallest possible demonstration that a Kwirth plugin does not have to be a
Kubernetes viewer. Anything that fits in a tab and talks to its own back fits here: a panel for an
external tool, a form, a board. The game is the extreme case, and that is precisely why it is a good
example: if it works without touching the cluster, anything less demanding does too.

> **The `none` view.** It is the natural one for this channel: the namespace, controller, pod and
> container selectors are greyed out because there is nothing to observe. You can choose another
> view and the channel starts just the same, but nothing changes: a standalone channel is **always**
> given empty selectors, so choosing `cluster` does not grant it a single extra permission. Empty
> here means *no resource*, not *all of them*.

## What it does not do

It does not consume cluster resources, does not open ports, does not register HTTP routes, does not
start processes in the back and does not read a single Kubernetes object.

The only thing it writes is a ConfigMap with the high-score table. It is all explained in
[Where the table is stored](../admin/03-storage.md).
