# SDSF — a channel plugin for Kwirth

z/OS SDSF on an IBM 3278 model 3 terminal (32x80), inside a [Kwirth](https://kwirthmagnify.dev) tab —
except that what it lists are **pods** instead of address spaces. Type `DA`, put `S` in front of a
pod to browse its log and `C` to cancel it, page with PF7/PF8 and come back with PF3.

- Kwirth: https://kwirthmagnify.dev — source at https://github.com/kwirthmagnify/kwirth
- Plugin source: https://github.com/jfvilas/kwirth (folder `plugins/sdsf`)
- License: MIT. The 3270 font is [rbanffy/3270font](https://github.com/rbanffy/3270font) (BSD-3-Clause,
  `src/front/fonts/LICENSE-3270font.txt`), embedded in the bundle.

> **Status: under construction (0.1.0, not published yet).** The terminal, the keyboard and the back are
> done; the DA panel, the log browse and the line commands are next.

## What it is

| SDSF / z/OS | Kubernetes |
|---|---|
| System | The cluster picked in Kwirth's cluster list |
| Address space / job (JOBNAME) | Pod |
| StepName / ProcStep | Container / init container |
| JobID (`STC12345`, `JOB12345`, `TSU12345`) | Stable id from the pod uid; JOB for Jobs, TSU for bare pods, STC for the rest |
| Owner | Service account |
| C (class) | QoS class |
| DEST | Namespace |
| SYSOUT (`S`) | Container log, in a browse |
| Cancel (`C` / `CA`) | Delete the pod (CA: grace period 0), always confirmed |

The screen behaves like a real 3270: **block mode** (nothing moves until you press an AID key),
protected and unprotected fields, the 3270 base colours, insert mode, and the OIA status line under
row 32 with the keyboard lock (`X SYSTEM`) and the cursor position.

## Keyboard

Laid out as PCOMM and x3270 do on a PC keyboard:

| 3270 key | PC key |
|---|---|
| **Enter** (sends the screen) | **Right Ctrl** |
| Newline | Intro / Enter |
| Reset | Left Ctrl |
| Clear | Esc |
| PF1–PF12 / PF13–PF24 | F1–F12 / Shift+F1–F12 |
| PF7 / PF8 | also PgUp / PgDn |
| PA1 / PA2 / PA3 | Alt+1 / Alt+2 / Alt+3 |
| Erase EOF | End |
| Insert mode | Insert |

The two Ctrl keys act only when pressed and released on their own, so Ctrl+C and Kwirth's
Ctrl+Shift+Enter (full screen) keep working. In full screen the terminal takes the whole window.

## Installing it in Kwirth

It will be published on npmjs as `@jfvilas/kwirth-plugin-sdsf` and listed in the jfvilas marketplace:

```
https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
```

No restart is needed. It **uses** Kwirth's `metrics` provider for the `Real` and `CPU%` columns when it
is installed; without it SDSF works the same and says the metrics are not available.

## Permissions

| Scope | Allows |
|---|---|
| `sdsf$read` | Open SDSF, list pods, browse logs, describe pods |
| `sdsf$cancel` | Also cancel (delete) pods |

`cluster` and `admin` reach everything. Pods are always limited to the namespaces and pods the access
key covers.

## Screenshots

*(Coming when the plugin is complete.)*

## Building

```
npm install --legacy-peer-deps
npm run build      # typecheck + dist/
npm test           # unit tests; COVERAGE=1 npm test for c8 coverage
```
