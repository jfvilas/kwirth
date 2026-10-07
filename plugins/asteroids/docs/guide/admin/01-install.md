# Installation

Asteroids is open source and published on **npmjs**. It is listed in the **jfvilas marketplace**,
so it is installed from Kwirth's own extension managers.

## Requirements

- A Kwirth with the jfvilas marketplace configured (see below).
- Nothing else. The plugin needs no database, no provider and no other extension: its
  `requiresExtension` field is empty.

## Adding the marketplace

If your Kwirth does not list the jfvilas marketplace yet, add it as a marketplace with this manifest
URL:

```
https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
```

## Installing

From **Extensions → Plugins** (the plugin manager), look for `asteroids` in the jfvilas marketplace
and install it.

Asteroids consists of three artifacts, each installed from its own manager:

| Artifact | Package | Manager |
|---|---|---|
| The channel | `@jfvilas/kwirth-plugin-asteroids` | Plugins |
| This guide | `@jfvilas/kwirth-docs-asteroids` | Docs |
| The login page (optional) | `@jfvilas/kwirth-login-asteroids` | Logins |

Installing the guide is optional for playing, but it is what makes the **?** icon of the setup
dialog work.

The login page is purely cosmetic: a login screen with the game's look, which opens the Asteroids
channel after authentication.

## No restart

The plugin declares `requiresRestart: false`, and it is true: it registers no HTTP routes of its own
on the server, so the core does not need to restart for it to become operational. Installed hot, it
is available immediately.

## Uninstalling

Uninstalling it **does not delete the high-score table**: the ConfigMap survives, and reinstalling
the plugin brings it back as it was. To delete it you have to do it by hand; see
[Where the table is stored](03-storage.md).

## Which version is installed

In **Extensions → Plugins**, the Asteroids card shows the installed version. The back and front
versions always go together: they are the same package.

## Source code

The source is at [github.com/jfvilas/kwirth](https://github.com/jfvilas/kwirth), in the
`plugins/asteroids` folder.
