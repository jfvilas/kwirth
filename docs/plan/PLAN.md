# Task Manager — plan

> **ESTADO — S1 Y S2 HECHOS, PENDIENTE DE QA** (2026-11-27). El usuario pidió hacerlo todo seguido y la QA al
> final: S1 y S2 se hicieron de una vez y salen juntos en **una sola versión, 0.1.0** (§5). Sin publicar hasta el OK
> de la QA; mientras, se carga en dev desde `dist` (`back/kwirth-dev.json`). Cuelga del [PRD](PRD.md) (D1–D15) y
> no repite ni su problema ni sus decisiones de producto. **D15: es diversión, no negocio.**
>
> **Dónde vive:** `~/github/kwirth/plugins/tasklist`, repo anidado (rama `main`, identidad `jfvilas`) **sin
> remoto** y gitignorado en el core. Se sube a master de github.com/jfvilas/kwirth con `git subtree`, desde
> `~/github/jfvilas/kwirth`:
> `git pull --ff-only origin master && git subtree pull --prefix plugins/tasklist ~/github/kwirth/plugins/tasklist main && git push origin master`
> (el primer envío, con `git subtree add`). ⛔ No ponerle `origin` al repo anidado.
>
> Documento **vivo y append-only**. Se para al final de **cada stream**: commit, informe y OK antes del
> siguiente.

## 1. Lo que el código ya da (verificado el 2026-11-27)

Lo mismo que verificó SDSF (`plugins/sdsf/docs/plan/PLAN.md` §1) vale aquí: canal `cluster:true,
resourced:false`, `clusterInfo` = cluster seleccionado, COMMAND/REQUEST front↔back, autorización en el canal,
pantalla completa del core, teclado en el elemento de la pestaña, font embebida con loader `dataurl`. Lo nuevo:

| Necesidad | Qué hay | Dónde |
|---|---|---|
| Pods, nodos, namespaces | `clusterInfo.coreApi` (`listPodForAllNamespaces`, `listNode`, `listNamespace`, `deleteNamespacedPod`, `createNamespacedPod`, `deleteNamespace`, `patchNode`) | core `back/src/model/ClusterInfo.ts`; tipado estructural con `Pick<>` como `sdsf/src/back/index.ts:33` |
| Deployments, ReplicaSets, StatefulSets, DaemonSets | `clusterInfo.appsApi` (`AppsV1Api`) | `ClusterInfo.ts:115` |
| Jobs (para `End Process Tree`) | `clusterInfo.batchApi` | `sdsf/src/back/index.ts:37` |
| CPU y memoria por pod | Provider `metrics`: `containerMetricValues` con claves `ns/pod/container/metric`; SDSF ya suma por pod y saca el % del cluster de dos lecturas | `sdsf/src/back/PodMetrics.ts`, `MetricsProviderTypes.ts` |
| Totales del cluster | `IMetricsClusterUsage`: `vcpus`, `memory`, `cpuUsage`, `memoryUsage`, `txmbps`, `rxmbps`, `pods`, `maxPods` | `providers/metrics/src/common` |
| Red por nodo | `IMetricsNode.summary.network` = la interfaz por defecto del nodo (desde la 0.1.4 del provider) con `rxBytes`/`txBytes` | `providers/metrics/src/back/index.ts:82-102` |
| Cordon / uncordon / drain | ⚠️ `nodeCordon`/`nodeDrain` de common-back se tragan errores y usan JSON patch `replace` (falla en un nodo nunca cordoneado). **No se usan**: `patchNode` con merge patch de `spec.unschedulable`, y drain = cordon + borrar los pods del nodo que no son de DaemonSet | memoria de SDSF |
| Velocidad del enlace | **No existe**: el kubelet no la da. `Link Speed` se pinta `1 Gbps` nominal y la utilización se calcula sobre eso (decisión de ingeniería, ver §3) | — |

## 2. Arquitectura

| Decisión | Por qué |
|---|---|
| **El back hace una foto; el front pinta.** Un comando `SNAPSHOT` devuelve pods (con contenedores y métricas), nodos (capacidad, allocatable, Ready, unschedulable, red), namespaces y, en el S2, Deployments. El front la pide cada `Update Speed` (High 1 s, Normal 2 s, Low 4 s, Paused nada) y con `Refresh Now` | Es lo que hace XP: un sondeo a intervalo fijo. Un solo comando que lee, más uno por acción |
| **Acciones** = un comando cada una: `END_PROCESS`, `END_PROCESS_TREE` (S1); `END_TASK`, `NEW_TASK`, `LOG_OFF`, `SHUT_DOWN` (S2) | Cada una se autoriza en el canal por separado |
| **Las métricas no se piden: llegan.** El canal se suscribe al provider `metrics` y guarda la última lectura; el `SNAPSHOT` la cruza con el API. Sin el provider, CPU y memoria salen vacías y la barra de estado dice `CPU Usage: --` | Dependencia `uses`, como SDSF |
| **PID estable** por uid de pod, asignado por el back de la instancia (contador múltiplo de 4, como Windows) | XP enseña números, y un pod recreado tiene otro PID, que es justo lo que se ve en XP |
| **Ventana Luna propia en `src/front/luna/`**: `Window`, `MenuBar`/`Menu`, `Tabs`, `ListView` (cabeceras ordenables y redimensionables, selección, menú contextual), `Button`, `Checkbox`, `GroupBox`, `Dialog` (aviso, error, propiedades, `Select Columns`), `Graph` (rejilla verde que se desplaza, en `<canvas>`) y `Meter`. **Sin MUI** a la vista | La fidelidad es el producto. MUI pintaría MUI. Son componentes pequeños y se reutilizan en las cinco pestañas |
| **Font**: la Tahoma de Wine (`tahoma.ttf`/`tahomabd.ttf`, LGPL-2.1, métricas compatibles con la de Microsoft), embebida con `dataurl` y su licencia en `src/front/fonts/`. Si al bajarla la licencia no encaja, la alternativa es DejaVu Sans a 11 px | D2: nunca la de Microsoft. Las métricas iguales hacen que las columnas midan lo de las capturas |
| **Iconos SVG propios** en `src/front/luna/icons/` (el de la ventana, el de "aplicación" en `Applications`, el de aviso/error de los diálogos) | D2 |
| **La sesión en `channelObject.data`**: pestaña activa, orden, columnas visibles y anchos, selección, `Update Speed`, `CPU History`, `Show processes from all users` y la historia de las gráficas (los últimos ~100 puntos) | RF11 |
| **Escalera de scopes**: `['', 'tasklist$read', 'tasklist$end', 'cluster', 'admin']`. Abrir = `tasklist$read`; `End Process`/`End Process Tree`/`End Task`/`New Task` = `tasklist$end` más `keyMatchesResource` sobre el namespace; `Log Off` y `Shut Down` = `admin` | Patrón de SDSF/WRKACTJOB. Sin permiso: diálogo `Access is denied.` |
| **`Show processes from all users` sin marcar** = los namespaces que alcanza el accessKey *(como se construyó: oculta los `kube-*`; ver §5)* | XP: sin marcar enseña los del usuario que mira |

### Tipos nuevos (⚠️ a validar por el usuario ANTES de escribir código)

En `src/common/TasklistTypes.ts`:

- `ETasklistCommand`: `SNAPSHOT`, `END_PROCESS`, `END_PROCESS_TREE`, `END_TASK`, `NEW_TASK`, `LOG_OFF`, `SHUT_DOWN`.
- `ETasklistError`: `ACCESS_DENIED`, `NOT_FOUND`, `FAILED`.
- `EShutDownAction`: `STAND_BY` (cordon), `TURN_OFF` (drain), `RESTART` (uncordon).
- `ITasklistMessage` / `ITasklistMessageResponse`: extienden `IInstanceMessage`, como los del scaffolder.
- `ITasklistContainer`: `name`, `image`, `state`, `ready`, `restarts`, `cpu?`, `memory?`.
- `ITasklistProcess`: `uid`, `pid`, `name`, `namespace`, `node`, `phase`, `startTime`, `owner?` (`kind`, `name`), `cpu?`, `cpuTime?`, `memory?`, `peakMemory?`, `ioRead?`, `ioWrite?`, `containers: ITasklistContainer[]`.
- `ITasklistNode`: `name`, `ready`, `unschedulable`, `cpuCapacity`, `cpuAllocatable`, `memoryCapacity`, `memoryAllocatable`, `cpu?`, `memory?`, `rxBytesPerSecond?`, `txBytesPerSecond?`.
- `ITasklistApplication` (S2): `namespace`, `name`, `replicas`, `readyReplicas`.
- `ITasklistUser` (S2): `id`, `name`, `phase`, `pods`.
- `ITasklistSnapshot`: `processes`, `nodes`, `users`, `applications`, `requests` (suma de requests de CPU y memoria, para `Commit Charge`), `metrics` (si el provider está).

En `src/front/` (solo del front):

- `ETasklistTab`: `APPLICATIONS`, `PROCESSES`, `PERFORMANCE`, `NETWORKING`, `USERS` (enum, como pide la regla de tabs).
- `EUpdateSpeed`: `HIGH`, `NORMAL`, `LOW`, `PAUSED`.
- `EProcessColumn`: las columnas de `Select Columns`.
- `ITasklistSession`: lo que se guarda en `channelObject.data` (fila de arriba).

## 3. Decisiones de ingeniería (a validar)

- **`CPU` de un pod** = % sobre la CPU **del cluster** (como hace SDSF), redondeado a entero de dos cifras
  como XP (`00`–`99`). Es fiel: en un cluster grande casi todo sale `00` (PRD §9).
- **`Commit Charge`** = requests de memoria de todos los pods / allocatable de memoria del cluster; `Peak` =
  máximo visto en la sesión. **`PF Usage`** = memoria en uso del cluster.
- **`Link Speed`** = `1 Gbps` nominal en todos los nodos: el kubelet no da la velocidad real.
- **`Users`, `ID`** = número estable por namespace; `Session` = número de pods.

## 4. Streams

| Stream | Contenido | Entrega |
|---|---|---|
| **S1 — MVP** | Arreglos del scaffolder (versión `0.1.0`, JSON una propiedad por línea, `repository`, `requirements.providers: ['metrics']`, scopes). Back: `SNAPSHOT`, `END_PROCESS`, `END_PROCESS_TREE`, métricas, PIDs. Front: componentes Luna, font e iconos, ventana con menús (`File`, `Options`, `View`, `Help`; `Shut Down` en gris), barra de estado, **Processes** (columnas, orden, `Select Columns`, menú contextual, `Properties` con contenedores, aviso y `Access is denied.`, `Show processes from all users`), **Performance** (medidores, historias, `CPU History` por nodo, recuadros con `Handles` y `Kernel Memory` vacíos), `Update Speed`, persistencia. Las pestañas `Applications`, `Networking` y `Users` se ven, vacías. Tests unitarios (mapeos, PIDs, cálculos de §3, ListView) y e2e en `tasklist-e2e` que saca las capturas del README. README con capturas. **Publicar `plugin/tasklist@0.1.0`** | 0.1.0 |
| **S2 — Completo** | **Applications** (Deployments, Status, `End Task`, `Switch To` = ir a `Processes` filtrando, `Go To Process`, `New Task…` con `Create New Task`, menú `Windows`). **Networking** (gráfica por nodo, tabla de adaptadores). **Users** (namespaces, `Log Off`). **Shut Down** (Stand By / Turn Off / Restart sobre el nodo elegido, solo `admin`). Tests y e2e ampliados (el e2e **no** hace `Shut Down` ni `Log Off` sobre nada que no sea suyo: `Log Off` sobre un namespace propio, `Shut Down` solo comprobando el diálogo y el `Access is denied.`). **Publicar `plugin/tasklist@0.2.0`** y cerrar PLAN y PRD | 0.2.0 |

Al final de cada stream: build, tests, e2e, commit en el repo anidado, informe y pasos de QA. Se publica
después del OK de la QA.

## 5. Como se construyó (2026-11-27)

**S1 + S2 hechos, en una sola entrega 0.1.0** (el usuario: "dale a todo seguido, el QA lo haré cuando tengas todo
acabado"). Verificado: typecheck y build; **38 tests unitarios** (back: cobertura de líneas 96–100 % en `Usage`,
`Mapper` e `index`; sesión y formatos 99–100 %); **e2e de 18 casos en verde** contra el dev (k3d), que además
saca las capturas del README.

Desviaciones del plan, todas menores:

- **`Show processes from all users`**: sin marcar oculta los namespaces `kube-*` (los "usuarios del sistema", como
  XP ocultaba SYSTEM / LOCAL SERVICE / NETWORK SERVICE), en el front. Lo que alcanza el accessKey se filtra
  siempre en el back. El plan decía "sin marcar = los namespaces del accessKey", que con una key de admin no
  ocultaba nada. Con ello `ITasklistRequest` ya no lleva `allUsers`. La fila `System Idle Process` solo sale
  marcado (es de SYSTEM) y cuando hay métricas.
- **Icono del canal**: SVG propio (`src/front/icons.tsx` y el `icon` del `package.json`). `ListAlt`, el del
  scaffolder, no está en el barrel de iconos del core y el canal reventaba al pintarse.
- **`Switch To` = `Go To Process`**: los dos llevan a Processes con los pods del Deployment seleccionados.
- **`End Task` y `Log Off` piden confirmación** (XP no la pedía en `End Task`): borran de verdad (PRD §9).
- **Font**: la Tahoma de Wine (paquete `wine-common` de Ubuntu, LGPL-2.1, derivada de Bitstream Vera), embebida
  como `.ttf` (no hay herramienta de woff2 en la máquina). `front.js` ocupa ~480 KB, casi todo la font.
- **Capturas del README**: el dev tiene namespaces de otros productos; antes de cada captura de una lista, el e2e
  oculta en el DOM las filas que no son del fixture (solo en la imagen; el siguiente refresco las repinta).
- Minimizar y cerrar son decorativos (no hay escritorio al que minimizar ni ventana que cerrar: el canal se para
  desde Kwirth). `Exit Task Manager` y lo que no tiene equivalente salen en gris.

### ⚠️ Tipos añadidos además de los validados en §2

Al construir hicieron falta estos, que **no estaban en la lista que validó el usuario** (se avisan aquí y en el
informe):

- Comunes (`src/common/TasklistTypes.ts`): `ITasklistOwner` (kind + name del controlador), `ITasklistRequests`
  (requests de CPU y memoria), `ITasklistMetrics` (CPU, memoria e intervalo del cluster), `ITasklistRequest` (lo
  que manda el front, sin la envoltura del mensaje) y la función `isSystemUser`.
- Back: `ITasklistClusterInfo` y `ITasklistInstance` (como `IWrkClusterInfo`/`IWrkInstance`), `IContainerUsage`,
  `INodeUsage` e `IUsage` (el uso sacado del provider), y las clases `IdRegistry` y `PeakRegistry`.
- Front: `ITasklistDataSource` (la fuente de la sesión, para los tests), `ITasklistHistory` (las series de las
  gráficas), `INewTask`, `EPropertiesTab` y, de la capa Luna, `IMenuItem`, `IMenuBarEntry`, `IListColumn`,
  `IListSort`, `IGraphLine`, más las props de cada pestaña y de la ventana (`IProcessesTabProps`…).
- Tras la QA (D16–D19, 2026-11-27): `IWindowFrame` (dónde está una ventana del escritorio), `INotepadWindow` (un
  Notepad abierto), `TPlacement` (`[x, y, ancho, alto]`), `ILunaWindowProps`, `INotepadWindowProps`,
  `ITaskbarProps`, la constante `APPLICATION_KINDS`; en el protocolo, los comandos `LOG`, `RESTART_PROCESS`,
  `GET_YAML` y `APPLY_YAML`, los campos `containerName`, `tailLines`, `targetKind` y `yaml`, y `kind` en
  `ITasklistApplication`.

### Tras la primera QA (2026-11-27)

El usuario fue pidiendo, sobre lo entregado: fullscreen independiente y menús legibles; ventana movible y
redimensionable (react-draggable y react-resizable, como magnify) con el cerrar deshabilitado; taskbar con Start
(el timón de Kubernetes), minimizar y restaurar; tiny footprint con doble clic; diálogos movibles; scroll bars y
agarre de XP; las métricas de la font corregidas (Wine activa USE_TYPO_METRICS y Chrome subía el texto); View Log,
Restart, Edit y la columna Controller (D16–D18); y el escritorio con varias ventanas y Notepad (D19). `js-yaml` va
en el back (como magnify); CodeMirror NO se empaqueta: viene del core.
