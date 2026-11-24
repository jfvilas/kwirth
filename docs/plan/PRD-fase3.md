# WRKACTJOB — fase 3: más comandos de IBM i · PRD

> **ESTADO — DEFINICIÓN CERRADA** (2026-11-24). A1–A7 aceptados tal cual («ok a todo») y pasan a D12–D18 (§7). Lo pidió el usuario tras cerrar el MVP: «tn5250 no es necesario de
> momento, pero más comandos de AS400 sí». Amplía el [PRD del MVP](PRD.md) (cerrado) y no repite su
> problema, sus personas ni sus decisiones D1–D11, que siguen en vigor: mismo plugin, misma DCE `blockterm`,
> mismo teclado, misma sesión en block mode. Previo al diseño técnico: los streams están en el
> [PLAN](PLAN.md), fase 3 (S7–S12).

---

## 1. Resumen

Hoy la sesión tiene un solo panel de trabajo, `WRKACTJOB`, y un Main Menu con una entrada. La fase 3 añade
los comandos que un operador de IBM i teclea a diario y que tienen equivalente en Kubernetes, de modo que la
sesión deje de ser «un panel» y pase a ser **un sistema**: el operador entra, mira cómo está la máquina
(`WRKSYSSTS`), qué subsistemas hay (`WRKSBS`), qué dice el operador del sistema (`DSPMSG QSYSOPR`) y qué hay
planificado (`WRKJOBSCDE`), y salta de uno a otro por la línea de comandos o por el menú.

**Criterio de éxito.** Alguien que ha usado un AS/400, sin leer nada:
1. teclea `WRKSYSSTS` y entiende cuánta CPU y memoria tiene ocupadas el cluster y en qué pools (nodos);
2. teclea `WRKSBS`, pone un `8` delante de un subsistema y cae en `WRKACTJOB` de ese subsistema;
3. teclea `DSPMSG QSYSOPR` y ve los avisos del cluster, el más reciente arriba;
4. teclea `WRKJOBSCDE`, retiene (`3`) una entrada y la vuelve a liberar (`6`): el CronJob se suspende y se
   reanuda de verdad.

## 2. Los comandos (propuesta)

Cuatro en la fase 3, los que ya anunciaba el PRD del MVP (§5), con `WRKJOBQ` sustituido por `WRKJOBSCDE`
(D12). Cada uno es un panel 5250 con la estructura de siempre: título, `Type options, press Enter.`, leyenda
de opciones en azul, lista con `Opt`, `More...`/`Bottom`, línea de comandos, teclas de función y fila de
mensajes. Todos aceptan F3, F5, F12, Roll Up/Down y la línea de comandos como `WRKACTJOB`.

### 2.1 `WRKSYSSTS` — Work with System Status

| IBM i | Kubernetes |
|---|---|
| `% CPU used` | CPU en uso del cluster / CPU allocatable de los nodos (provider `metrics`) |
| `Elapsed time` | Desde la última F10 (Restart statistics), como en `WRKACTJOB` |
| `Jobs in system` | Pods en el cluster (los que la clave ve) |
| `Main storage size (M)` | Memoria allocatable de todos los nodos |
| `System ASP` / `% system ASP used` | Almacenamiento: suma de los PersistentVolumes / % reclamado (bound) |
| Tabla de pools: `Sys Pool`, `Pool Size (M)`, `Reserved Size (M)`, `Max Active`, … | **Un pool por nodo** (D13): tamaño = memoria allocatable, reservado = memoria pedida (requests), max active = pods máximos del nodo, y la actividad (`DB Fault`/`Non-DB Fault` → reinicios y pods en `MSGW` del nodo) |

F11 alterna las vistas de la tabla de pools como en IBM i (faults ↔ transiciones ↔ nombre del pool, que aquí
es el nombre del nodo). Sin `metrics`, las cifras de uso salen `*N`, igual que la CPU de `WRKACTJOB` (D17).

### 2.2 `WRKSBS` — Work with Subsystems

| IBM i | Kubernetes |
|---|---|
| Subsistema | Namespace (como en `WRKACTJOB`) |
| `Total Storage (M)` | Memoria pedida por los pods del namespace |
| `Subsystem Pools 1…10` | Los pools (nodos, numerados como en `WRKSYSSTS`) en los que tiene pods |
| `Status` (en la vista F11) | `ACTIVE`; `ENDING` si el namespace está en Terminating |

Opciones:

| Opción | Hace |
|---|---|
| `5` Display subsystem description (`DSPSBSD`) | Panel con la descripción del namespace: labels, annotations, ResourceQuotas y LimitRanges (las «entradas» y «pools» de la descripción) |
| `8` Work with subsystem jobs (`WRKSBSJOB`) | `WRKACTJOB SBS(ese)`: el MVP ya lo hace, solo es enlazarlo |
| `4` End subsystem (`ENDSBS`) | **Fuera** (D14): en IBM i para todos los jobs; aquí sería borrar el namespace o escalar todo a cero, y ninguna de las dos cosas es lo que el operador espera de un `4` |

### 2.3 `DSPMSG QSYSOPR` — los mensajes del operador del sistema

| IBM i | Kubernetes |
|---|---|
| Cola `QSYSOPR` | Events **Warning** de todo el cluster (los de los namespaces que la clave ve) |
| Mensaje (primer nivel) | `reason` + mensaje del event, recortado a la línea |
| `From . . : job/usuario` | El objeto del event (`Pod/api-7f…`, `Node/worker-2`) y su namespace |
| Fecha y hora | `lastTimestamp` del event; el más reciente **arriba**, como `DSPMSG` |
| Mensaje que necesita respuesta (con `Reply`) | **Ninguno** (D15): los events no se contestan. No se pinta campo de respuesta |

F1 sobre un mensaje (o `5` en la variante `WRKMSG`, D15) abre **Additional Message Information**: el
segundo nivel, con el event entero (tipo, reason, objeto, contador, primera y última vez, mensaje completo).
`DSPMSG` a secas (sin cola) muestra lo mismo que `DSPMSG QSYSOPR`: no hay buzón por usuario. F5 refresca;
F16 (Remove all) **no** se ofrece: los events no se borran desde aquí.

### 2.4 `WRKJOBSCDE` — Work with Job Schedule Entries

| IBM i | Kubernetes |
|---|---|
| Entrada de planificación (`Job`) | **CronJob** (nombre a 10, completo con F11) |
| `Status` `SCD` / `HLD` | Activo / `suspend: true` |
| `Schedule Date`, `Schedule Time`, `Frequency` | La expresión cron traducida cuando cabe en las palabras de IBM i (`*WEEKLY`, `*MONTHLY`, días y hora); si no, la expresión tal cual en `Frequency` como `*CRON` (D16) |
| `Next Submit Date` | La próxima ejecución calculada desde la expresión |
| Job queue / subsistema | El namespace |

Opciones:

| Opción | Hace | Permiso (D18) |
|---|---|---|
| `3` Hold | `suspend: true` | escritura |
| `5` Display details | Panel con el CronJob: schedule, zona horaria, concurrencyPolicy, historial (últimos Jobs con su resultado), imagen | lectura |
| `6` Release | `suspend: false` | escritura |
| `8` Work with last submission | `WRKACTJOB` filtrado a los pods del último Job, si siguen vivos; si no, `No active jobs.` | lectura |
| `10` Submit immediately | Crea un Job desde el CronJob (lo que hace `kubectl create job --from=cronjob/…`) | escritura |
| `4` Remove | **Fuera** (D14): borrar un CronJob no tiene vuelta atrás y no es operación de operador | — |

`3`, `6` y `10` piden confirmación con el panel de prompt (`HLDJOBSCDE`, `RLSJOBSCDE`, `SBMJOB`), como `4`
pide `ENDJOB` en el MVP.

## 3. Menú y línea de comandos

El Main Menu adaptado (D5) crece con lo que de verdad hay. Las entradas del menú real (1 User tasks,
3 General system tasks…) son submenús sin equivalente aquí, así que se numeran seguidas y solo `90` conserva
su número real:

| Opción | Comando |
|---|---|
| `1` | Work with active jobs (`WRKACTJOB`) |
| `2` | Work with subsystems (`WRKSBS`) |
| `3` | Display operator messages (`DSPMSG QSYSOPR`) |
| `4` | Work with system status (`WRKSYSSTS`) |
| `5` | Work with job schedule entries (`WRKJOBSCDE`) |
| `90` | Sign off |

Desde cualquier panel con línea de comandos se teclean los comandos y se apilan como los paneles del
job (F12 vuelve uno, F3 al menú). F4 sobre cualquiera abre su prompt. Comando desconocido: `Command X in
library *LIBL not found.` en la fila de mensajes con el teclado bloqueado (como hoy).

## 4. No-objetivos

- **tn5250** (decidido por el usuario: no de momento).
- Comandos destructivos de alcance amplio: `ENDSBS`, `RMVJOBSCDE`, `PWRDWNSYS`, borrar mensajes.
- Comandos sin equivalente honesto en Kubernetes (bibliotecas, `WRKOBJ`, DB2, colas de datos, `WRKSPLF`
  de todo el sistema).
- Parámetros posicionales en la línea de comandos (sigue como en el MVP: solo `PARAM(valor)`).

## 5. Candidatos para después (no fase 3)

Para no perderlos; ninguno entra salvo que el usuario lo pida.

| Comando | Sería |
|---|---|
| `WRKJOBQ` | Una cola por namespace con sus pods en `SCDW` (Pending); flojo frente a `WRKJOBSCDE` |
| `WRKDSKSTS` | PersistentVolumes como unidades de disco: tamaño, % usado (si hay métrica), estado |
| `NETSTAT *CNN` | Services y sus puertos como conexiones TCP/IP |
| `WRKUSRPRF` | ServiceAccounts como perfiles de usuario, con sus roles como autorizaciones especiales |
| `DSPLOG` (QHST) | Todos los events (no solo Warning) como el historial del sistema |

## 6. Lo que hay que decir en voz alta

- **R1 — El back crece.** Hoy el canal pide pods, logs, events de un pod y borra pods. La fase 3 necesita
  namespaces, nodos, PersistentVolumes, events de todo el cluster, ResourceQuotas/LimitRanges y CronJobs
  (leer, parchear `suspend`, crear un Job). Son comandos nuevos en `EWrkCommand`; se diseñan en el PLAN.
- **R2 — Permisos.** Hasta ahora solo había leer y terminar jobs. Hold/Release/Submit escriben (D18).
- **R3 — Lo que ve la clave.** `WRKSYSSTS` y la tabla de pools hablan de nodos, que son de cluster: con una
  clave limitada a unos namespaces, las cifras de cluster no se pueden calcular o enseñan lo que no debe
  (D17).
- **R4 — La traducción cron → IBM i** no es total. Lo que no se traduce se enseña crudo, no se aproxima.

## 7. Decisiones cerradas

Cerradas el 2026-11-24, el usuario («ok a todo»), tal como se propusieron (A1–A7 → D12–D18):

| # | Pregunta | Decisión |
|---|---|---|
| **D12** (era A1) | ¿Qué comandos entran en la fase 3? | Los cuatro de §2: `WRKSYSSTS`, `WRKSBS`, `DSPMSG QSYSOPR`, `WRKJOBSCDE`. `WRKJOBQ` se cambia por `WRKJOBSCDE` (encaja mucho mejor con los CronJobs) y queda en §5 |
| **D13** (era A2) | ¿Pool = nodo en `WRKSYSSTS` y `WRKSBS`? | Sí, numerados del 1 en adelante por nombre de nodo (el `Pool` de `WRKACTJOB` ya es el nodo). En IBM i los pools son de memoria, no máquinas; es la libertad más grande del mapeo |
| **D14** (era A3) | ¿`4=End subsystem` en `WRKSBS` y `4=Remove` en `WRKJOBSCDE`? | No: ninguno de los dos. Se valida como opción, pero responde `Option 4 not valid.` (se ve en la leyenda que no está) |
| **D15** (era A4) | ¿`DSPMSG` o `WRKMSG`? | `DSPMSG QSYSOPR` (el que teclea todo operador) con F1 para el segundo nivel; `WRKMSG` como alias que abre lo mismo |
| **D16** (era A5) | Cron que no cabe en las frecuencias de IBM i | `*CRON` en `Frequency` y la expresión en `Schedule Time`/detalles (opción `5`) |
| **D17** (era A6) | Clave sin permiso de cluster en `WRKSYSSTS` | Se calcula solo sobre lo que la clave ve (pods, sus namespaces); las cifras de nodos y almacenamiento salen `*N`, y en la fila de mensajes `Not authorized to some system values.` |
| **D18** (era A7) | Permiso para Hold/Release/Submit | Un scope nuevo `wrkactjob$schedule` entre `read` y `end` en la escalera (no borra nada, pero cambia y lanza). Validado por el usuario |
