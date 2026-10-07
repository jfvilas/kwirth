# Kwirth extensions by jfvilas

This repository holds **open source extensions for [Kwirth](https://kwirthmagnify.dev)**, the Kubernetes
observability and operations platform: plugins (channels) and any other kind of Kwirth extension
(providers, senders, themes…), published to npm under the **`@jfvilas`** scope.

> **Looking for Kwirth itself?** The core — back end, front end, the common libraries and the official
> extensions — lives at **[github.com/kwirthmagnify/kwirth](https://github.com/kwirthmagnify/kwirth)**.
> This repository used to host an early copy of Kwirth; its history is kept, but the code moved there.

## Extensions

| Extension | Type | Packages | What it does | Plan |
|---|---|---|---|---|
| [Chapete](plugins/chapete) | plugin | `@jfvilas/kwirth-plugin-chapete` | A plain chat with an LLM, using the LLMs configured in Kwirth | [closed](plugins/chapete/docs/plan/PLAN.md) |
| [Webamp](plugins/webamp) | plugin + guide | `@jfvilas/kwirth-plugin-webamp`, `@jfvilas/kwirth-docs-webamp` | A Winamp 2 music player in a Kwirth tab, with drag-and-drop audio and skins | [closed](plugins/webamp/docs/plan/PLAN.md) |
| [Rally-X](plugins/rallyx) | plugin | `@jfvilas/kwirth-plugin-rallyx` | The 1980s rally maze arcade game, with a cluster-wide high-score table | [closed](plugins/rallyx/docs/plan/PLAN.md) |
| [Pac-Man](plugins/pacman) | plugin + guide | `@jfvilas/kwirth-plugin-pacman`, `@jfvilas/kwirth-docs-pacman` | The classic arcade game, with a cluster-wide high-score table (GPL v3) | [closed](plugins/pacman/docs/plan/PLAN.md) |
| [Asteroids](plugins/asteroids) | plugin + guide + login | `@jfvilas/kwirth-plugin-asteroids`, `@jfvilas/kwirth-docs-asteroids`, `@jfvilas/kwirth-login-asteroids` | A vector asteroid shooter, with a cluster-wide high-score table and its own login page | [closed](plugins/asteroids/docs/plan/PLAN.md) |
| [V16](providers/v16) | provider | `@jfvilas/kwirth-provider-v16` | Spanish DGT traffic incidents (DATEX2), dispatched by differences, with V16 emergency beacons flagged | [live](providers/v16/docs/plan/BACKLOG.md) |
| [Flight Status](providers/flight-status) | provider | `@jfvilas/kwirth-provider-flight-status` | Live ADS-B aircraft positions from OpenSky, enriched with AviationStack and FlightAware AeroAPI under quota | [live](providers/flight-status/docs/plan/BACKLOG.md) |

## Installing them in Kwirth

Every extension here is listed in this repository's marketplace manifest, **[`manifest.json`](manifest.json)**.
Add it to Kwirth as a marketplace and its extensions show up in the extension managers, ready to install:

```
https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
```

## Layout

```
manifest.json          the marketplace: one entry per published version, of every extension type
plugins/<id>/          plugin (channel) extensions
providers/<id>/        provider extensions
...                    one folder per extension type, as in the Kwirth repository
```

Each extension carries its own `README.md`, its tests (`tests/`, `e2e/`) and its plan and guide (`docs/`).

## License

See each extension's package for its license. Kwirth is at [kwirthmagnify.dev](https://kwirthmagnify.dev).
