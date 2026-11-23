# WRKACTJOB — a channel plugin for Kwirth

IBM i (AS/400) **Work with Active Jobs** on a 5250 terminal (24x80 or 27x132, in colour or green screen),
inside a [Kwirth](https://kwirthmagnify.dev) tab — except that what it lists are **pods**, grouped by
**namespace** as jobs are grouped by subsystem. Put `4` in front of a job to end it, `5` to work with it, `8` to
read its spooled files (its containers' logs), and press F5 to refresh.

> Work in progress: the back end is done; the 5250 screen comes next. See the [plan](docs/plan/PLAN.md).

- Kwirth: https://kwirthmagnify.dev — source at https://github.com/kwirthmagnify/kwirth
- Plugin source: https://github.com/jfvilas/kwirth (folder `plugins/wrkactjob`)
- License: MIT.
- The 5250 terminal (engine, screen, keyboard and font) comes from the **Block Terminal** DCE,
  `@jfvilas/kwirth-dce-blockterm` ([`dces/blockterm`](https://github.com/jfvilas/kwirth/tree/master/dces/blockterm)),
  which WRKACTJOB requires. It is the same terminal as the SDSF plugin's.

## IBM i → Kubernetes

| IBM i | Kubernetes |
|---|---|
| System name | The cluster picked in Kwirth's cluster list |
| Subsystem (`SBS`) | Namespace |
| Job | Pod |
| User | Service account |
| Type `ASJ` / `BCH` / `SYS` / `BCI` | Pod of a Deployment or StatefulSet / of a Job / of a DaemonSet / a bare pod |
| Status `RUN` / `DEQW` | Running, with / without CPU in the last interval |
| Status `SCDW` | Pending |
| Status `MSGW` | A container failing (CrashLoopBackOff, ImagePullBackOff, OOMKilled…): `7` shows why |
| Status `END` | Being deleted |
| Function `PGM-…` | The main container's image |
| `ENDJOB OPTION(*CNTRLD) DELAY(n)` / `*IMMED` | Delete the pod with grace period n / 0 |
| Spooled files | Containers; `DSPSPLF` shows the log |
| Job log | The pod's events |

CPU figures come from Kwirth's `metrics` provider when it is installed; without it WRKACTJOB works the same,
with no CPU figures.

## Permissions

| Scope | Allows |
|---|---|
| `wrkactjob$read` | Open WRKACTJOB, list the active jobs, read their spooled files and job log |
| `wrkactjob$end` | End jobs (option 4, `ENDJOB`): delete pods |

What a key sees is limited, as everywhere in Kwirth, by the namespaces and pods it reaches.

## Building

```
npm install --legacy-peer-deps
npm run build      # typecheck + dist/
npm test           # unit tests; COVERAGE=1 npm test for c8 coverage
```
