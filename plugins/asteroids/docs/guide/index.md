# Asteroids

A vector Asteroids game you can play inside a Kwirth tab, with a high-score table shared by the
whole cluster.

![The channel running](images/game-running.png)

It is the only Kwirth channel that does not look at the cluster: it does not watch namespaces, pods
or containers. The game runs entirely in your browser, and the only thing that leaves it is your
score, which is stored in the cluster so that everyone can see it.

## Where to start

| If you want to... | Go to |
|---|---|
| Understand what it is and why it exists | [What it is and why it exists](user/01-introduction.md) |
| Know where the game lives and why it survives a tab switch | [How it works](user/02-how-it-works.md) |
| Get it running | [Adding and configuring the channel](user/03-setup.md) |
| Learn the controls and what each indicator means | [Playing](user/04-playing.md) |
| Understand the shared table | [The high-score table](user/05-high-scores.md) |
| Install or administer it | [Administrator guide](admin/01-install.md) |

## In one sentence

Add the channel with the `none` view, start it from the tab's gear icon, click the play area and
press Enter. You have three lives.
