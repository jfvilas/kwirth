# SDSF — a channel plugin for Kwirth

z/OS SDSF on an IBM 3278 model 3 terminal (32x80), inside a [Kwirth](https://kwirthmagnify.dev) tab —
except that what it lists are **pods** instead of address spaces. Type `DA`, put `S` in front of a
pod to browse its log and `C` to cancel it, page with PF7/PF8 and come back with PF3.

![The DA panel](https://raw.githubusercontent.com/jfvilas/kwirth/master/plugins/sdsf/docs/screenshots/da.png)

- Kwirth: https://kwirthmagnify.dev — source at https://github.com/kwirthmagnify/kwirth
- Plugin source: https://github.com/jfvilas/kwirth (folder `plugins/sdsf`)
- License: MIT. The 3270 font is [rbanffy/3270font](https://github.com/rbanffy/3270font) (BSD-3-Clause,
  `LICENSE-3270font.txt`), embedded in the bundle.

## What it is

| SDSF / z/OS | Kubernetes |
|---|---|
| System | The cluster picked in Kwirth's cluster list |
| Address space / job (JOBNAME) | Pod |
| StepName / ProcStep | Container / init container |
| JobID (`STC12345`, `JOB12345`, `TSU12345`) | Stable id from the pod uid; JOB for Jobs, TSU for bare pods, STC for the rest |
| Owner | Service account |
| C (class) | QoS class: G, B or E |
| Pos | IN (ready), LO (running, not ready), NS (pending), END, ABN, TRM (terminating) |
| DP | Priority, in hex: FF/FE for the system-critical classes |
| Real / CPU% | Memory (MiB) and CPU, from Kwirth's `metrics` provider |
| SIO | Restarts |
| DEST | Namespace |
| SYSOUT (`S`) | Container log, in a browse |
| Job data sets (`?`) | The pod's containers |
| Cancel (`C` / `CA`) | Delete the pod (CA: grace period 0), always confirmed |

The screen behaves like a real 3270: **block mode** (nothing moves until you press an AID key),
protected and unprotected fields, the 3270 base colours, insert mode, and the OIA status line under
row 32 with the keyboard lock (`X SYSTEM`) and the cursor position.

## Using it

Open SDSF with the **cluster** view on the cluster you want, start it, and you are on the primary
option menu. `DA` lists the pods.

**Primary commands** (on `COMMAND INPUT ===>`):

| Command | Does |
|---|---|
| `DA` | Active pods |
| `PREFIX api*` · `OWNER sa*` | Filter by pod name or service account; `*` any string, `%` one character; `*` alone resets |
| `DEST kube-system` · `DEST (ALL)` | One namespace, or all |
| `SORT col [A\|D]` | Sort by any column (`SORT sio d`); `SORT` alone goes back to the natural order |
| `FIND text` · `RFIND` (PF5) | Find in the rows, or in a browse |
| `TOP` · `BOTTOM` · `UP n` · `DOWN n` · `LEFT` · `RIGHT` | Scroll; PF7/PF8 and PF10/PF11 do it with the SCROLL amount (PAGE, HALF, DATA, CSR, MAX or a number) — `M` + PF8 goes to the end |
| `&nn` · `&` | Refresh every nn seconds; stop it (PA1 stops it too) |
| `RETRIEVE` (PF12) | The commands typed before |
| `END` (PF3) · `RETURN` (PF4) | Back; END on the menu leaves to TSO `READY` (type `SDSF` to come back) |

**Line commands** (in the `NP` column of a row, then Enter):

| Command | Does |
|---|---|
| `S` | Browse the log of the main container |
| `?` | List the containers; `S` on one browses its log |
| `D` | Browse the pod described, with its events |
| `C` · `CA` | Cancel (delete) the pod, after a confirmation window; CA with no grace period |

Several line commands in one Enter run as SDSF runs them: the cancels together through one
confirmation, then the rest one after the other, each when PF3 comes back from the previous one.

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

It is published on npmjs as `@jfvilas/kwirth-plugin-sdsf` and listed in the jfvilas marketplace. If
your Kwirth does not list it yet, add it as a marketplace with this manifest URL:

```
https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json
```

Then install `sdsf` from the plugin manager. No restart is needed. It **uses** Kwirth's `metrics`
provider for the `Real` and `CPU%` columns when it is installed; without it SDSF works the same and
says the metrics are not available.

## Permissions

| Scope | Allows |
|---|---|
| `sdsf$read` | Open SDSF, list pods, browse logs, describe pods |
| `sdsf$cancel` | Also cancel (delete) pods |

`cluster` and `admin` reach everything. Pods are always limited to the namespaces and pods the access
key covers.

## Screenshots

The primary option menu:

![Primary option menu](https://raw.githubusercontent.com/jfvilas/kwirth/master/plugins/sdsf/docs/screenshots/menu.png)

A container log, with `S`:

![Output display](https://raw.githubusercontent.com/jfvilas/kwirth/master/plugins/sdsf/docs/screenshots/browse.png)

The pod's containers, with `?`:

![Job data set display](https://raw.githubusercontent.com/jfvilas/kwirth/master/plugins/sdsf/docs/screenshots/containers.png)

Cancelling a pod, with `C`:

![Confirm action](https://raw.githubusercontent.com/jfvilas/kwirth/master/plugins/sdsf/docs/screenshots/confirm.png)

Full screen, with the OIA under row 32:

![Full screen](https://raw.githubusercontent.com/jfvilas/kwirth/master/plugins/sdsf/docs/screenshots/fullscreen.png)

## Building

```
npm install --legacy-peer-deps
npm run build      # typecheck + dist/
npm test           # unit tests; COVERAGE=1 npm test for c8 coverage
```

The e2e (`e2e/`, Playwright) runs against a live Kwirth with its own `.creds.json`; it creates the
`sdsf-e2e` namespace and deletes it at the end.
