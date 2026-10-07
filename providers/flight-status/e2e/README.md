# End-to-end tests

Isolated Playwright e2e of the Flight Status provider, run against a live Kwirth (by default the dev at
`http://localhost:3000`). It is not part of the provider's build or dependencies.

## Specs

| Spec | What it does |
|---|---|
| `provider-flight-status.spec.ts` | 5 functional tests: configRouter behind accessKey, credentials returned real and pre-filled masked with an eye, saving stores what is on screen (an emptied key is emptied), validation blocking an enabled source with no key, and the quota section plus dialog layout |

It is **non-destructive**: it snapshots the configuration before touching anything and restores it in
`afterAll`, and every value it writes is prefixed `e2e-fs-`. It never subscribes, so no upstream API is
ever called.

## Running it

The provider must be loaded by the core (in dev, registered in `back/kwirth-dev.json`; a provider is
only loaded when the core starts). Put the dev credentials in `e2e/.creds.json` (gitignored):

```json
{ "url": "http://localhost:3000", "user": "admin", "pass": "<dev password>" }
```

Then, from this folder:

```
npm install
node_modules\.bin\playwright test
```
