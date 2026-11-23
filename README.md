# Block Terminal

A **dynamic core extension** (DCE) for [Kwirth](https://kwirthmagnify.dev) that gives other extensions an
IBM **block-mode terminal**: the engine, with no DOM, and the screen that paints it in the browser.

It is the terminal of the [SDSF](https://github.com/jfvilas/kwirth/tree/master/plugins/sdsf) plugin (a 3270),
and of WRKACTJOB (a 5250). There is one engine for both, so neither plugin carries its own copy.

## What it brings

| Piece | What it does |
|---|---|
| `Screen3270` | The presentation space: rows x cols, a field attribute byte on its own position, as on the real terminal. Any geometry: 24x80, 32x80, 27x132 |
| `Terminal3270` | The operator's side: typing, moving, tabbing, erasing, insert mode and the keyboard lock are all local; only an AID sends the screen (a Read Modified) |
| `Painter` | Lays out panels ISPF style: protected text, input fields, character attributes |
| `displayRow`, `displayCell`, `oiaOf` | What the operator sees, worked out from the buffer: runs of equal appearance, the 3270 base-colour rule, a monochrome 3278 brought down to two intensities, the OIA line |
| `TerminalView` | The React component: paints the buffer with the 3270 font, scales the grid to its tab, shows the cursor and the OIA, handles full screen |
| `KeyMapper` | The PC keyboard as PCOMM lays it out: right Ctrl = Enter, left Ctrl = Reset, Intro = Newline, F1–F24, Alt+1/2/3 = PA1–PA3 |
| `paletteOf`, `EDisplay` | Colour (3279) or green phosphor (3278) |

The engine lives in `src/common` and its enums carry the real data-stream codes (AIDs, colours,
highlights), so a tn3270 server can be built on the same model one day.

## Consuming it

1. Depend on the package for its types: `npm install --save-dev @jfvilas/kwirth-dce-blockterm`.
2. Import from it as from any package:

   ```ts
   import { Terminal3270, Painter, TerminalView, E3270Color, EDisplay } from '@jfvilas/kwirth-dce-blockterm'
   ```

3. Map the package to the DCE in the consumer's `build.mjs` (`DCE_PACKAGES`), so the browser build reads
   the instance Kwirth keeps instead of bundling a copy:

   ```js
   const DCE_PACKAGES = { '@jfvilas/kwirth-dce-blockterm': 'blockterm' }
   ```

   The instance carries every runtime export of the package under the same name (classes, functions and
   the enums as objects), so the named imports work unchanged. The unit tests run without the mapping and
   get the real engine from `index.mjs`.

4. Declare the dependency, so Kwirth will not install the consumer without it:

   ```json
   "requiresExtension": [{ "extensionType": "dce", "id": "blockterm", "minVersion": "0.1.0" }]
   ```

## Building

```
npm install
npm run build      # typecheck + dist/front.js (what Kwirth loads) + dist/index.mjs and dist/types (for consumers)
npm test           # COVERAGE=1 npm test for coverage
```

There is no watch: Kwirth loads a DCE once, when it starts, so every change is a build and a restart of the
Kwirth back end.

Install it from **☰ → Manage extensions → DCE** in Kwirth.

## Licence

MIT. The 3270 font is [rbanffy/3270font](https://github.com/rbanffy/3270font), BSD-3-Clause, embedded with
its licence (`LICENSE-3270font.txt`).
