# Block Terminal

A **dynamic core extension** (DCE) for [Kwirth](https://kwirthmagnify.dev) that gives other extensions an
IBM **block-mode terminal**: the engine, with no DOM, and the screen that paints it in the browser.

It is the terminal of the [SDSF](https://github.com/jfvilas/kwirth/tree/master/plugins/sdsf) plugin (a 3270),
and of WRKACTJOB (a 5250). There is one glass for both, so neither plugin carries its own copy.

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

And the **5250** (since 0.2.0), the same way:

| Piece | What it does |
|---|---|
| `Screen5250` | The display buffer, 24x80 or 27x132: screen attribute bytes (0x20–0x3F) on their own positions, and the format table of input fields, each with its Field Format Word (bypass, shift, monocase, right adjust, field exit required) |
| `Terminal5250` | The operator's side: typing checked against the field's shift, monocase, insert mode, Field Exit / Field+ / Field- (right adjust and sign), Erase EOF, Erase Input, operator errors with their code (`X II 0005`) until Reset, and the host's error message on the error line, which Reset gives back |
| `Painter5250` | Lays out panels as IBM i display files do: constants after their attribute byte, input fields underlined |
| `displayRow5250`, `attributeLook`, `oiaOf5250` | The attribute byte decoded with the colour table of the 5292 / 3477 (green, white, red, turquoise and yellow with column separators, pink, blue); on a monochrome 5251, the colour screen in two intensities |
| `TerminalView5250` | The React component, on the same glass as the 3270 |
| `KeyMapper5250` | PCOMM's 5250 layout: right Ctrl = Enter, left Ctrl = Reset, Intro = Field Exit, numpad + / - = Field+ / Field-, PgDn / PgUp = Roll Up / Roll Down, Alt+End = Erase Input |

Both terminals are painted by `Glass`, which takes rows of runs (`IGlassRun`) and the OIA.

The engines live in `src/common` and their enums carry the real data-stream codes (AIDs, colours,
highlights, 5250 attribute bytes and shift codes), so a tn3270 or tn5250 server can be built on the same
model one day.

## Compatibility

The instance is **shared at runtime**: every consumer installed in a Kwirth gets the version of this DCE that
is installed there, not the one it was built against. So a new version only **adds** — no export is removed or
renamed, and no signature changes. `tests/compat.test.ts` keeps the frozen list of the 0.1.0 exports.

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
npm run try        # builds try/out/index.html: the BUILT front.js painting a sample 5250 screen (?mono=1, ?wide=1)
```

There is no watch: Kwirth loads a DCE once, when it starts, so every change is a build and a restart of the
Kwirth back end.

Install it from **☰ → Manage extensions → DCE** in Kwirth.

## Licence

MIT. The 3270 font is [rbanffy/3270font](https://github.com/rbanffy/3270font), BSD-3-Clause, embedded with
its licence (`LICENSE-3270font.txt`).
