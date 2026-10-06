# Kwirth extensions by jfvilas

This repository holds **open source extensions for [Kwirth](https://kwirthmagnify.dev)**, the Kubernetes
observability and operations platform: plugins (channels) and any other kind of Kwirth extension
(providers, senders, themes…), published to npm under the **`@jfvilas`** scope.

> **Looking for Kwirth itself?** The core — back end, front end, the common libraries and the official
> extensions — lives at **[github.com/kwirthmagnify/kwirth](https://github.com/kwirthmagnify/kwirth)**.
> This repository used to host an early copy of Kwirth; its history is kept, but the code moved there.

## Extensions

| Extension | Type | Package | What it does |
|---|---|---|---|
| [Chapete](plugins/chapete) | plugin | `@jfvilas/kwirth-plugin-chapete` | A plain chat with an LLM, using the LLMs configured in Kwirth |

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
