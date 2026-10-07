# Test Metrics History — Webamp

> Incremental: one row per CL9, the most recent on top, never overwritten.
> **Harness** = `npm test`. **Coverage** = `COVERAGE=1 npm test` (lines / branches / functions), over what the
> harness loads: the back channel. The React front and the iframe are covered by the e2e, not measured.
> **E2E** = spec files / `test()` cases in `e2e/tests`.

| Date | Version | Harness | Coverage (lines / branches / funcs) | E2E (specs / cases) | Notes |
|------|---------|---------|----------|-----------|-------|
| 2026-10-06 | `plugin/webamp@0.1.1` | 6 pass | 100% / 100% / 81.58% | 1 / 2 | Moved to `@jfvilas` and github.com/jfvilas/kwirth. IRIA Play logo removed from the fullscreen bar (the plugin's music note stays), Webamp's MIT license now shipped in the package (`LICENSE.webamp`). 🐛 Webamp was rendered into `document.body`, and its React legacy render REPLACED the body: the help panel, its *Open songs...* / *Load skin...* buttons, the drop overlay and the error box were wiped right after their handlers were attached. It now mounts in its own `#webamp-root`. The old e2e was red because of it, looking for that panel. 🧪 The 3 old harness tests asserted constants defined in the test itself; replaced by 6 that drive the real back channel (first real coverage figure). New e2e case: the fullscreen bar. 🐛 The Webamp iframe keeps the keyboard focus, so the core's Ctrl+Alt+F11 never reached the page while the player was focused: neither in nor out of fullscreen. The iframe now hands that one combination to the parent, which fires it again on `window`; the e2e presses it with the focus inside the player. Spanish identifiers in the iframe script translated. |
| 2026-10-03 | 0.1.0 | 3 pass | — | 1 / 1 | CL9 closure: default layout+doubleSize+vol10%+M3U dropdown+stream picker+icon fix. |
| 2026-10-02 | 0.1.0 | 3 pass | — | 1 / 1 | M3U dropdown from GitHub API+equalizer visible on start. |
| 2026-10-02 | 0.1.0 | 3 pass | — | 1 / 1 | Position+doble view+M3U initial tracks+stream picker dialog+icon fix. |
| 2026-10-02 | 0.1.0 | 3 pass | — | 0 / 0 | Initial scaffold. Backchannel contract tests only. |
