# SDSF — plan y backlog

> **ESTADO — EN CURSO** (2026-11-23). Publicado: `plugin/sdsf@0.9.0` (npm `@jfvilas` y marketplace de
> github.com/jfvilas/kwirth). Hechos el MVP (S0–S5), el S6 (`LOG`), el S7 (`ST`/`O`/`H`), el S7b
> (parámetros del `DA`), el S9 (modelo de terminal y color en el setup) y el S8 (`INIT`). Fase 2 completa.
> Hecho el S10 (el Confirm Action de SDSF). **Fase 3a en curso:** hechos el S11 (`I`, `ULOG`) y el S12 (`JC`, `SR`); queda el S13
> (`RES`, `SP`). Quedan la fase 3 (`X`) y la V2 (SYSNAME, tn3270), en §4. Cuelga del [PRD](PRD.md) y no repite ni su problema ni sus decisiones de producto
> (D1–D11).
>
> **Dónde vive:** `~/github/kwirth/plugins/sdsf`. Es un repo anidado (rama `main`, identidad `jfvilas`)
> **sin remoto** y gitignorado en el core, igual que depthcharge. Se sube a master de github.com/jfvilas/kwirth
> con `git subtree`, desde `~/github/jfvilas/kwirth`:
> `git pull --ff-only origin master && git subtree pull --prefix plugins/sdsf ~/github/kwirth/plugins/sdsf main && git push origin master`.
> ⛔ No ponerle `origin` = jfvilas/kwirth al repo anidado.
>
> Documento **vivo y append-only**: las fases cerradas no se borran, se marcan. Se para al final de
> **cada stream**: commit, informe y OK antes del siguiente.

## 1. Lo que el código ya da (verificado el 2026-11-22)

| Necesidad | Qué hay | Dónde |
|---|---|---|
| Canal sobre el cluster de la cluster list | `cluster:true, resourced:false`, como magnify. El core llama a `addObject(ws, cfg, '*all','*all','*all')` una vez, y `this.clusterInfo` **es** el cluster seleccionado | `common/src/Channel.ts:119-127`, `back/src/index.ts:1242-1247` |
| Acceso a k8s desde el back del plugin | `clusterInfo.coreApi` (`CoreV1Api`). Se tipa con una interfaz estructural local y los tipos de `@kubernetes/client-node` como type-only | magnify `back/index.ts:8-42` |
| Lista de pods | `coreApi.listPodForAllNamespaces()`. Los campos se leen del V1Pod en crudo; no hay helper común | magnify `back/index.ts:854` |
| Log del contenedor (una sola lectura) | `coreApi.readNamespacedPodLog({ name, namespace, container, tailLines })` | magnify `back/index.ts:784` |
| Cancel | `coreApi.deleteNamespacedPod({ name, namespace })`; para `CA`, con `gracePeriodSeconds: 0` | ops `RestartCommand.ts:5-12`, magnify `:1149-1176` |
| Describe | `coreApi.readNamespacedPod`. **No hay** nada que genere un texto al estilo kubectl, así que lo formatea SDSF | ops `GetCommand.ts:4-50` |
| Métricas (D6) | Provider `metrics`: se declara en `requirements.providers: ['metrics']`, va con `metrics:true` en `getChannelData`, y las fotos `IMetricsCluster` llegan en `processProviderEvent` | plugin metrics `back/index.ts:51-117`, `MetricsProviderTypes.ts` |
| Autorización (RF9) | El core **no** comprueba el scope en un canal de cluster: lo decide el canal. Hay una escalera de scopes, `getScopeCatalog`, `scopeAllows` y `keyMatchesResource`, y se usa la key validada en el START, nunca la del mensaje | magnify `MagnifyAuth.ts:15-18`, `:309-315`, `:563-575`; `common/src/ExtensionScope.ts:163-206` |
| Mensajes front ↔ back | COMMAND/REQUEST con `msgtype`, `id`, `command`, `params`. El `instanceId` sale del START SIGNAL RESPONSE | ops `OpsTabContent.tsx:161-170`, `OpsChannel.ts:89-92` |
| Pantalla completa (RF3b) | **Ya existe en el core**: Ctrl+Shift+Enter y el menú de la pestaña. El canal lee `channelObject.isFullscreen`, y **no hace falta tocar el core** | `App.tsx:674-704`, `:3091`; `common-front/src/index.ts:106,123` |
| Teclado (RF4) | Los listeners van en el elemento de la pestaña (`tabIndex=0`), y solo las teclas que se manejan llevan `preventDefault` | asteroids `AsteroidsInput.ts`, `AsteroidsTabContent.tsx:347-389` |
| Font embebida (D3) | Ningún plugin lo hace; el precedente es el tema santander: loader `'.woff2': 'dataurl'`, un `fonts.d.ts` y `@font-face` | `themes/santander/build.mjs:12`, `src/front/index.ts:55-79` |

## 2. Arquitectura

| Decisión | Por qué |
|---|---|
| **El front es el emulador; el back solo da datos.** El back responde a cuatro comandos: `LIST`, `LOG`, `DESCRIBE` y `CANCEL`. *(Al hacerlo se vio que `CONTAINERS` y `METRICS` sobraban: los contenedores y las métricas viajan dentro de cada pod del `LIST`, y así cada Enter es una sola petición)* | Block mode (D5): el front pide datos al pulsar una tecla AID y pinta. Nada viaja si nadie pulsa una tecla |
| **El motor 3270 y los paneles en `src/common`**, no en el front (D11) | Son TypeScript puro y se prueban sin navegador. Además, el día de la V2 un servidor tn3270 los ejecuta en el back tal cual |
| **Motor 3270 puro** en `src/front/terminal/`, sin React: buffer de 32x80 celdas, campos con atributos, cursor, tabulación entre campos sin proteger, MDT (marca de campo modificado), bloqueo de teclado y OIA | Es la pieza difícil y es lógica pura, así que se prueba con tests unitarios sin navegador. React solo pinta el buffer |
| **Paneles como controladores** en `src/front/panels/`: Menu, DA, Containers, Browse y Confirm. Cada uno pinta su pantalla en el buffer y atiende las teclas AID | Es como funciona ISPF (panel + diálogo). Añadir `ST`, `LOG` o `INIT` en la fase 2 es añadir un panel, sin tocar el motor |
| **Se pinta con DOM**: 32 filas, cada una con un `<span>` por tramo con el mismo atributo, y el tamaño de letra calculado para que 80x33 quepan en la pestaña | El texto con la font 3270 sale nítido a cualquier escala, sin gestionar DPI. Con canvas habría que reimplementar el pintado del texto, y no compensa |
| **La sesión vive en `channelObject.data`**: el buffer, la pila de paneles, los filtros y el último comando | RF10. El `TabContent` se monta y se desmonta al cambiar de pestaña |
| **Font**: 3270font de rbanffy v3.0.1 (`3270-Regular.woff`: la release no trae `.woff2`; BSD-3-Clause), con su `LICENSE-3270font.txt` en `src/front/fonts/`, el loader `dataurl` y una sola `FontFace` registrada con `document.fonts.add` | No depende del tema ni de `CssBaseline`, y se carga una vez por sesión del navegador |
| **Escalera de scopes**: `['', 'sdsf$read', 'sdsf$cancel', 'cluster', 'admin']`. Abrir el canal exige `sdsf$read`, y `C`/`CA` exigen `sdsf$cancel` más `keyMatchesResource` sobre el namespace y el pod | Es el patrón de magnify y ops. Sin permiso, el panel muestra `NOT AUTHORIZED` en rojo (RF9) |
| **Métricas con guarda de presencia**: antes de suscribirse se comprueba que el provider `metrics` está; sin él, se muestra `-` y el aviso amarillo (D6) | Dependencia `uses`, nunca `requires` |

### Tipos nuevos (⚠️ a validar por el usuario)

Viven en `src/common/SdsfTypes.ts` y `src/front/terminal/`:

- `ESdsfCommand`: `LIST`, `LOG`, `DESCRIBE`, `CANCEL`. *(Como se construyó: más `ESdsfError`,
  `ESdsfMetricsState`, `ESdsfQos` e `ISdsfContainer`. En el motor, `I3270FieldAttribute` e `I3270Cell`
  sustituyen a `I3270Field`/`I3270Screen`, porque el campo es un byte de atributo en el buffer, como en
  la 3270 real. Se añadieron `E3270Lock`, `E3270Key`, `I3270KeyAction` e `I3270Input`, que es el Read
  Modified.)*
- `ISdsfMessage` / `ISdsfMessageResponse`: extienden `IInstanceMessage`, igual que lo que genera el
  scaffolder.
- `ISdsfPod`: la fila del DA, ya mapeada en el back. Lleva `jobname`, `name`, `namespace`, `stepName`,
  `procStep`, `jobId`, `owner`, `qos`, `pos`, `dp`, `restarts`, `node`, `created` y `containers[]`.
- `ESdsfScope`: la escalera de scopes.
- `E3270Color`: `DEFAULT`, `BLUE`, `RED`, `PINK`, `GREEN`, `TURQUOISE`, `YELLOW`, `WHITE`.
  `E3270Highlight`: `NONE`, `REVERSE`, `UNDERSCORE`, `BLINK`.
- `E3270Aid`: `ENTER`, `PF1`…`PF24`, `PA1`, `PA2`, `CLEAR`.
- `I3270Field`: posición, longitud, `protected`, `intensity`, `color`, `highlight` y `mdt`.
  `I3270Screen`: las celdas, los campos, el cursor y el estado de la OIA.
- `ISdsfPanel`: `paint(screen)` y `onAid(aid, screen)`, que devuelve qué hacer a continuación: seguir,
  ir a otro panel, volver o pedir datos al back.

## 3. Streams

Se para al final de cada uno.

**S0 — Scaffold y esqueleto** · ✅ HECHO (2026-11-22). El scaffold se generó en jfvilas y después se
movió a `kwirth/plugins/sdsf`, a petición del usuario (ver ESTADO). Lleva `metrics:false`, porque ese flag
pide al FRONT la lista de métricas, que SDSF no usa; el provider se declara en `requirements.providers`.
Está cargado en el dev desde `../plugins/sdsf/dist` y sale en `/config/info`.
- Mover `docs/` fuera, ejecutar `create-kwirth-plugin.mjs --id sdsf --name SDSF --publisher @jfvilas`
  desde `~/github/jfvilas/kwirth` y devolver `docs/` a su sitio.
- Poner `cluster:true`, `resourced:false` y `metrics:true`, y declarar `requirements.providers:
  ['metrics']`.
- Bajar la font con su licencia y añadir el loader `woff2` y `fonts.d.ts`.
- Dar de alta el plugin en `back/kwirth-dev.json` (⛔ antes, comprobar que no hay un e2e corriendo).
- Entregable: una pestaña negra que dice `SDSF` con la font 3270.

**S1 — Motor 3270** · ✅ HECHO (2026-11-22). El teclado sigue PCOMM: **Ctrl derecho = Enter**, Ctrl
izquierdo = Reset (los dos al soltarlos y solo si se pulsan solos), **Intro = Newline**, Esc = Clear,
PgUp/PgDn = PF7/PF8 y Alt+1..3 = PA1..3. El panel de prueba es el menú principal: `DA` y las opciones de
fase 2 responden `NOT AVAILABLE`, y lo demás `INVALID COMMAND`.
- Buffer, campos y atributos; cursor y tabulación/backtab; insertar y sobrescribir; Erase EOF;
  mapa de teclado de PC a teclas AID (RF4); bloqueo `X SYSTEM`; OIA con `fila/columna`.
- Pintado DOM con escala y paleta (RF2), y la vista en pantalla completa leyendo `isFullscreen`.
- Tests unitarios del motor.
- Entregable: un panel de prueba con campos editables y la OIA viva.

**S2 — Back** · ✅ HECHO (2026-11-22). La suscripción a `metrics` se hace con el handle
`clusterInfo.getProvider('metrics', this)`: se suscribe al abrirse la primera instancia y se da de baja
al cerrarse la última, en `removeConnection` y en `cleanup`. El `LIST` filtra los pods por
`keyMatchesResource`, y los comandos de un pod rechazan los pods que la key no alcanza antes de tocar la
API. Hay 48 tests y la cobertura (c8) es del 98,65 % en líneas.
- Interfaz estructural de `clusterInfo`.
- `LIST`: mapeo de V1Pod a `ISdsfPod`, con el JobID estable derivado del uid.
- `CONTAINERS`, `LOG` (con `tailLines`), `DESCRIBE` (texto formateado), `CANCEL` y `CANCEL` con
  grace 0.
- Escalera de scopes y `getScopeCatalog`; suscripción a `metrics` con guarda y `cleanup`.
- Tests del mapeo y de la autorización.

**S3 — Menú y DA** · ✅ HECHO (2026-11-22), pendiente de QA. Detalles al hacerlo:
- **Pantallas y comandos:**
  - END o PF3 en el menú lleva al `READY` de TSO; `SDSF` o `SDSF DA` vuelven. Un comando desconocido da `IKJ56500I COMMAND x NOT FOUND`.
  - Un comando que no se ha tocado sigue contando, como en ISPF.
  - PF12 recorre los comandos anteriores, del más reciente al más antiguo.
  - CLEAR repinta sin pedir datos.
  - PA1 para el `&nn`.
- **Columnas:**
  - JOBNAME, StepName, ProcStep y Owner van en mayúsculas y a 8 caracteres, como en z/OS. El nombre entero está en PodName.
  - A la derecha de SIO van dos páginas: `CPU% Status Node Age` y `Namespace PodName` (44). Status y Namespace son nuevas frente a D8: sin ellas no se ve el motivo del fallo ni el namespace con `DEST=(ALL)`.
- **Pos:** IN, LO (corriendo pero no ready), NS (pending), END, ABN, TRM (terminando) y ??.
- **DP:** FF y FE para las prioridades system-*, F8 para las positivas, F0 para 0 y C0 para las negativas.
- **Line commands:** en el S3 responden `NOT AVAILABLE`; llegan en el S4.
- **Protocolo:** el mensaje lleva `accessKey`, porque el core rechaza un COMMAND sin ella. El objetivo va en `podNamespace`/`podName`/`containerName`, no en `namespace`/`pod`/`container`: con esos nombres el core calcula en cada comando los namespaces y pods válidos, que son llamadas a la API para nada.
- **Tipos nuevos** (⚠️ a validar): `ISdsfRequest`, `ISdsfDataSource`, `ESdsfPanel`, `EPrimaryCommand`, `IPrimaryCommand`, `IDaColumn`, `IDaPaintState`, `IDaFields`, `IReadyState`, `EMessageLevel`, `ITextStyle`, `IMenuOption` e `IMenuState`.
- **Tests:** 73 en verde, con una cobertura (c8) del 98,67 % en líneas.
- Menú principal (RF2c).
- Panel DA (RF2b, D8) con scroll vertical (PF7/PF8 e importe de SCROLL) y horizontal (PF10/PF11).
- Comandos primarios (RF6): `PREFIX`, `DEST`, `OWNER`, `SORT`, `FIND`/`RFIND`, `TOP`/`BOTTOM`, `&nn`,
  `RETRIEVE` y los equivalentes escritos de las PF (R2).
- Mensajes cortos y largos (RF8); métricas y aviso amarillo (D6).

**S4 — Comandos de línea** · ✅ HECHO (2026-11-22), pendiente de QA. Detalles al hacerlo:
- **Cola de comandos de línea**, como en SDSF:
  - Varios comandos de línea en un mismo Enter se encolan.
  - Las cancelaciones (`C` y `CA`) van primero y todas juntas, en una sola ventana de `Confirm Action`.
  - Después `S`, `?` y `D`, uno detrás de otro: el siguiente se ejecuta al volver con PF3 del anterior.
  - Un comando de línea desconocido para todos.
  - PF3 en el DA descarta los que queden pendientes.
- **`S` (browse del log):**
  - Muestra el log del contenedor principal (el StepName).
  - Las secuencias ANSI se quitan, los tabuladores se expanden a múltiplos de 8 y los caracteres de control se muestran como punto.
  - Las marcas TOP/BOTTOM OF DATA no se desplazan en horizontal.
  - `FIND` sube la línea encontrada arriba y deja el cursor sobre el texto.
- **`?` (panel de contenedores):** es el JOB DATA SET DISPLAY de la captura, una fila por contenedor.
  - DSID 2.. para los init y 101.. para los regulares, como en JES.
  - `S` en un contenedor abre su log, y PF3 vuelve al panel de contenedores.
  - Enter solo refresca, y avisa si el pod ya no existe.
- **`D` (describe):** el describe del back, en un browse.
- **Ventana de confirmación:** mientras está abierta, el DA de debajo queda protegido y la única entrada es la de la selección.
  - 1 procesa, 2 o PF3 cancelan y cualquier otra cosa da `ENTER 1 OR 2`.
  - Si todo va bien sale `COMMAND ISSUED`. Si algo falla, el primer error va en el mensaje corto y todos los fallos en el largo (PF1).
- **Tipos nuevos** (⚠️ a validar): `ELineCommand`, `IPendingCancel`, `IBrowseState`, `IContainersState` e `IContainerFields`, y los internos de la sesión `IQueuedLine` e `IBrowse`.
- **Tests:** 85 en verde, con una cobertura (c8) del 98,05 % en líneas.
- `?` lleva al panel de contenedores.
- `S` abre el browse del log, con FIND, PF7/PF8, M+PF8 y PF3, y vuelve al DA en la misma posición.
- `D` abre el browse del describe.
- `C`/`CA` abren el pop-up `CONFIRM ACTION` (R4); varias líneas marcadas se ejecutan con un solo
  Enter; sin permiso, `NOT AUTHORIZED`.

**S5 — e2e, documentación y publicación** · ✅ HECHO (2026-11-22).
- **e2e:** 14 casos en `e2e/tests/01-sdsf.spec.ts`, en una sola página por corrida. Es no destructivo: crea el
  namespace `sdsf-e2e` con `demo` (dos pods, init y sidecar) y lo borra. Saca las 6 capturas del README en
  `docs/screenshots/`, filtradas a esos pods.
- **README y tarball:** el README las enlaza con URL raw de GitHub, para que también se vean en npmjs.
  `build.mjs` copia a `dist/` el README y la licencia BSD-3 de la font.
- **Métricas:** histórico y PNG en `docs/qa/`.
- **Lección:** dos corridas a la vez se pisan el namespace (el `afterAll` de una borra el de la otra).
  Antes de lanzar, comprobar que no hay otro Playwright vivo.
- e2e de Playwright con los criterios de aceptación 1–8 del PRD. Es no destructivo: crea su propio
  Deployment de prueba y lo borra al acabar.
- README del plugin, entrada en el `manifest.json` raíz (con `tags`), fila en el README raíz de jfvilas,
  gate y publicación en npmjs con `.npmrc-jfvilas`.
- El README que se ve en GitHub lleva una **sección de capturas** de SDSF ya completo: el menú, el DA, el
  browse de un log, la confirmación de cancelar y la pantalla completa con la OIA. Se hacen sobre el k3d
  de pruebas, sin hosts internos ni datos reales.

## 3b. Fase 2 (después del MVP)

Decidido con el usuario el 2026-11-22:
- **LOG:** los events salen de la API directamente (`listEventForAllNamespaces` del `coreApi` del core) en
  cada Enter, no del provider `events`.
- **INIT:** el drain (`P`) va sin scopes nuevos: exige `admin`. `sdsf$read` y `sdsf$cancel` se quedan.
- 🔴 **El cliente de Kubernetes NUNCA va en el bundle:** solo `import type`, y todo pasa por lo que da el
  core.

Se publica cada stream con su versión.

**S6 — `LOG`** · ✅ HECHO y validado por QA (2026-11-22). Publicado como `plugin/sdsf@0.2.0`.
- **Fallo encontrado en el QA:** salir del LOG con PF3 no paraba el `&nn`, que seguía refrescando el panel
  al que volvías. Ahora salir del LOG lo para, igual que salir del DA.
- **PA1 = Alt+1** no llega a la página en Chrome para Linux, que lo usa para cambiar de pestaña. Para
  parar el `&nn`, `&` + Enter. Está apuntado en el README.
- **Formato:** cada event es una línea de SYSLOG: N/W, sistema, yyddd, hh:mm:ss.th UTC, JobID del pod,
  cuenta y luego reason, objeto y mensaje. El reason va delante del objeto porque es lo que cabe en 79
  columnas: la primera versión lo dejaba fuera de pantalla.
- **Colores:** verde Normal, amarillo Warning y rojo los Warning de fallo (BackOff, Failed, Unhealthy,
  Evicted, OOM…).
- **Navegación:**
  - Se abre al final.
  - Enter sigue el log si estabas abajo y, si habías subido, te deja donde estabas.
  - PREFIX y DEST filtran por nombre del objeto y por namespace.
  - `&nn` lo refresca solo y PA1 lo para.
  - PF3 vuelve al panel de origen (menú o DA).
- **Back:** el comando `EVENTS` filtra por la key: el pod si el event es de un pod, el namespace en los
  demás. Los objetos sin namespace, como los nodes, solo los ve una key sin restricción de namespace.
- **Tipos nuevos** (⚠️ a validar): `ISdsfEvent` y `ESdsfCommand.EVENTS`.

**S7 — `ST`, `O` y `H` (Jobs y CronJobs)** · ✅ VALIDADO (2026-11-23), publicado como 0.3.0.
- **Paneles:**
  - `ST` lista todos los Jobs y CronJobs; `O` solo los Jobs terminados; `H` solo los CronJobs suspendidos.
  - Columnas: JOBNAME, JobID, Owner, Prty (parallelism), Queue (EXECUTION, PRINT, INPUT o HOLD), C
    (J o C), Status y Age. Con PF11: Schedule, CronJob, Dur y Namespace; después, JobName.
  - Primero los Jobs y luego los CronJobs.
- **Comandos de línea:**
  - `S` y `?` sobre un Job van a su pod más nuevo; sobre un CronJob, al pod de su ejecución más reciente.
    Si no hay pod, `NO OUTPUT`.
  - `D` hace el describe del Job o del CronJob.
  - `C`/`CA` los borran con propagación Background (se llevan sus pods), siempre con confirmación.
  - PF3 desde el browse o desde `?` vuelve a la tabla de origen.
- **Comandos primarios:** `DA`, `ST`, `O` y `H` cambian de tabla desde cualquier panel. Al pasar del DA a
  una tabla de Jobs (o al revés) se reinician el orden y las columnas.
- **Refactor:**
  - El panel de tabla pasa a ser genérico (`paintTable<T>`, `IDaColumn<T>`) y DA y ST lo comparten.
  - El protocolo nombra el objetivo `targetNamespace`/`targetName` más `objectKind`, sin dejar el nombre
    viejo conviviendo.
  - El back usa el `batchApi` del core (solo `import type`).
- **Tipos nuevos** (⚠️ a validar): `ESdsfObjectKind`, `ESdsfJobState`, `ISdsfJob`, `ESdsfCommand.JOBS`,
  `ICancelTarget` y, en la sesión, `ILineTarget`, `ITablePaintState<T>` e `ITableFields<T>`.

**S7b — Parámetros del `DA`** (como en z/OS: tipo, posición, `O…`, `NO…`, `ALL`/`ALLT`/`ALLP`) · ✅ VALIDADO
(2026-11-23), publicado como 0.4.0.
- Módulo puro `panels/DaFilter.ts`; un parámetro mal puesto da `PARAMETER INVALID` y el DA sigue como
  estaba. Los parámetros se quedan mientras se navega por el DA; `DA` a secas y `SDSF DA` vuelven al DADFLT.
- **Arreglo del front** (lo destapó el e2e): el clic calculaba la celda con el ancho medido de la font,
  que se queda corto, y hacia la derecha caía una columna más allá. Ahora usa el tamaño real de la rejilla.
- **Tipos nuevos** (⚠️ a validar): `EDaType`, `EDaPosition` e `IDaFilter`.
- **Tipos:** `JOB` = pods de un Job; `STC` = pods con controlador (salvo DaemonSet); `TSU` = pods sueltos;
  `INIT` = pods de DaemonSet (el agente de cada nodo, lo más parecido a un initiator).
- **Posiciones:** `IN` = Running y Ready; `OUT` = Pending sin nodo; `READY` = Pending con nodo (creando
  contenedores); `TRANS` = Running sin Ready o Terminating. Los terminados (`END`/`ABN`) solo con `ALL`.
- **Reglas de IBM:** incluir por tipo/posición; `O…` limita (uno solo); `NO…` excluye; `ALL`/`ALLT`/`ALLP`
  no se combinan; máximo cuatro parámetros; si chocan gana el último.
- **`DA` sin parámetros** = `DADFLT (IN,OUT,TRANS,READY,STC,TSU,JOB)`: sin DaemonSets ni terminados. El
  típico de IBM no lleva `READY`, pero entonces un pod arrancando en su nodo desaparecería del DA.
- Fuente: IBM, *Display Active Users panel (DA)* (z/OS 2.4) y `DADFLT` en *SDSF Operation and Customization*.

**S9 — La terminal en el setup (D12)** · ✅ VALIDADO (2026-11-23), publicado como 0.5.0.
- **Setup** (`requirements.setup: true`): Model (3278-2, 3278-3, 3278-5) y Display (Colour, Green
  phosphor), con `Set as default`, OK y CANCEL, tamaño fijo y ayuda a la sección *The terminal* del README
  (SDSF no tiene guía docsify). Un workspace guardado sin modelo arranca en 3278-3 en colour.
- **Geometría:** `SdsfSession` recibe la `I3270Geometry` del modelo. El layout deja de usar constantes de
  32x80: `rowPfKeys`, `scrollCol`, `commandLength`, `dataRows` (16/24/19), `browseHeight`, `browseWidth`
  (79/131), `containerRows`, las marcas TOP/BOTTOM a lo ancho, READY a lo ancho y la ventana de confirmación
  centrada (más arriba en 24 filas).
- **Mono:** `displayCell`/`displayRow` con `mono`: dos niveles (GREEN normal, WHITE brillante); la paleta
  verde pinta esos dos en fósforo, y la OIA también.
- **Arreglo del front** (lo destapó el 27x132): el tamaño de la font se calculaba con el ancho medido de la
  font, que se queda corto; en 132 columnas la rejilla se salía de la pestaña. Ahora se mide en una fila
  pintada.
- **Tipos nuevos** (⚠️ a validar): `ESdsfModel`, `ESdsfDisplay`, `SDSF_MODEL_GEOMETRY`, `I3270Geometry`
  (sustituye a `MODEL3_ROWS`/`MODEL3_COLS`) y los campos `model` y `display` de `ISdsfInstanceConfig`;
  `display` en `ISdsfData`.

**S12 — `JC` y `SR` (fase 3a)** · ✅ VALIDADO (2026-11-23), publicado como 0.9.0.
- **`JC`:** `SDSF JOB CLASS DISPLAY ALL CLASSES`, una PriorityClass por fila, la de más prioridad arriba:
  `JobClass` (el nombre a 8), `Prio`, `Default`, `Preempt` (`LOWER`/`NEVER`, este en amarillo), `Pods` (los
  que alcanza la key), `Age`, `ClassName`; con PF11, `Description`. `?` = el DA de los pods de la clase, de
  todos los tipos (`CLASS=` en la línea de filtros; PF3 vuelve al JC); `D` = describe (con sus pods).
- **`SR`:** `SDSF SYSTEM REQUESTS DISPLAY ALL`, los CSR sin `Approved` ni `Denied`, numerados por llegada
  como los reply IDs de z/OS (`01`, `02`…): `ReplyId`, `Type` (`CSR`), `Age`, `Name`, `Requestor`; con PF11,
  `Signer` y `Usages`. Solo `D` (describe con el PEM del request). Responder (`R`: aprobar o denegar) va a la
  V2 (D15): el core no expone `CertificatesV1Api`.
- **Back:** `schedulingApi` (`listPriorityClass`, `readPriorityClass`) y, para los CSR, el `crdApi` genérico
  por grupo/versión/plural (`certificates.k8s.io/v1/certificatesigningrequests`); solo `import type`.
- **Menú** como el de SDSF: `SR` y `JC` bajo `LOG`, con la fila de `MAS` en blanco entre ellos.
- **Refactor:** las columnas de cada familia salen de un solo `familyColumns()` (SORT y PF10/PF11 ya no
  repiten un ternario por familia); `filterLine` recibe el estrechamiento ya formado (`NODE=…`/`CLASS=…`).
- **Tipos** (⚠️ a validar): `ESdsfPanel.JC`/`SR`, `EPrimaryCommand.JC`/`SR`, `ESdsfCommand.CLASSES`/`REQUESTS`,
  `ESdsfObjectKind.PRIORITY_CLASS`/`CSR`, `CLUSTER_SCOPED_KINDS`, `ISdsfJobClass`, `ISdsfSystemRequest`,
  `JC_LINE_COMMANDS`/`SR_LINE_COMMANDS`.

**S11 — `I` y `ULOG` (fase 3a)** · ✅ VALIDADO (2026-11-23), publicado como 0.8.0.
- **`I` (Input queue):** `SDSF INPUT QUEUE DISPLAY ALL CLASSES`, de la familia del ST (mismas columnas y
  comandos). Lo que espera a ejecutarse: CronJobs `SCHEDULED` y Jobs `WAITING` (estado nuevo: sin
  `startTime`, cola `INPUT`, turquesa).
- **`ULOG`:** browse de lo que hizo el operador en la sesión. Una línea por acción (C, CA, S, Z, P), por cada
  descartada en la ventana y por cada `SET CONFIRM` (también el de la opción 3): sistema, hora UTC,
  acción y objeto, y la respuesta (en rojo si fue un rechazo). Sin fecha para que la respuesta quepa en 79
  columnas; lo largo, con PF11. `ULOG CLOSE` lo vacía; PF3 vuelve al panel de origen.
- **Menú** como la captura del usuario: `I` bajo `DA`, `LOG` tras una fila en blanco y `ULOG` a la derecha.
- **Tipos** (⚠️ a validar): `ESdsfJobState.WAITING`, `ESdsfPanel.INPUT`, `EPrimaryCommand.INPUT` y `ULOG`,
  `ISdsfUlogEntry` (time, command, target, response, ok).

**S10 — El Confirm Action de SDSF (D14)** · ✅ VALIDADO (2026-11-23), publicado como 0.7.0.
- Una ventana por acción, en orden: `Line number` (la fila de la tabla) y el JOBNAME (el ID en INIT). La letra
  sigue en la NP de cada fila pendiente. Selección pre-rellenada con `1` (un Enter sin tocar procesa: el campo
  no viaja y se toma como 1). `2`, PF3 y PF12 descartan esa acción; `3` la procesa y apaga la confirmación,
  así las que quedan van sin ventana. PF1 dice qué hace la acción (la ventana no lo dice, como en SDSF).
- `SET CONFIRM ON|OFF` (comando primario nuevo); cada sesión arranca con la confirmación activada.
- Pintado: marco con `┌─┐│└┘` (están en la font 3270) en amarillo, desde la fila de cabeceras y 13 columnas
  antes del borde derecho, 42x14; cabe en el 3278-2. Sale `Painter.window`, que ya no usa nadie.
- **Tipos** (⚠️ a validar): `IPendingAction` gana `line` y `jobname`; `EPrimaryCommand.SET`; `ACTION_HELP`.

**S8 — `INIT` (nodes, con drain para `admin`)** · ✅ VALIDADO (2026-11-23), publicado como 0.6.0.
- **Panel** `SDSF INITIATOR DISPLAY  ALL CLASSES`: `ID` (corto y único: el nombre sin lo que comparten todos
  los nodos, p. ej. `AGENT`/`SERVER` en k3d), `Status` (`ACTIVE`, `HALTED` = cordoned con pods, `DRAINED` =
  cordoned y vacío salvo DaemonSet/estáticos, `INACTIVE` = no Ready), `Classes` (roles), `Pods` (solo los que
  alcanza la key), `CPU%` y `Real` del provider de métricas (sobre la CPU allocatable del propio nodo),
  `CPUs`, `MemGB`, `Version`; con PF11, `IP`, `Age` y `NodeName`. PREFIX filtra por nombre; SORT, FIND, &nn.
- **Comandos de línea, como SDSF (decisión del usuario):** `S` = start (uncordon), `Z` = halt (cordon), `P` =
  drain (cordon + eviction de cada pod salvo DaemonSet y estáticos; respeta los PDB y reporta los rechazados);
  los tres solo `admin` y siempre con la ventana de confirmación. `D` = describe (`kubectl describe node`, con
  los pods y events que alcanza la key). `?` = el DA de los pods del nodo, de todos los tipos (`NODE=` en la
  línea de filtros), y PF3 vuelve al INIT. `C`/`CA` no son del INIT, y `Z`/`P` no son del DA.
- **Ver el INIT** = `sdsf$read`; los nodos no tienen namespace (decisión del usuario).
- **Back:** `listNode`, `readNode`, `patchNode` y `createNamespacedPodEviction` del `coreApi` del core (solo
  `import type`). El cordon es JSON patch `add` (no `replace`, que falla si el nodo nunca tuvo
  `spec.unschedulable`). No se usan `nodeCordon`/`nodeDrain` de common-back porque se tragan los errores.
- **CPU por nodo:** suma de deltas contenedor a contenedor, así un pod que termina no anula la cifra del nodo
  (fallo visto en el e2e con el nodo server).
- **Refactor:** la ventana de confirmación sirve para cualquier acción: `ICancelTarget`/`IPendingCancel` pasan
  a `IActionTarget`/`IPendingAction`. El menú pierde el campo `available` (todo existe ya).
- **Tipos nuevos** (⚠️ a validar): `ISdsfNode`, `ESdsfNodeStatus`, `ESdsfNodeAction`, `ESdsfCommand.NODES` y
  `NODE`, `ESdsfObjectKind.NODE`, `ESdsfScope.CLUSTER`/`ADMIN`, `ISdsfRequest.nodeAction`,
  `ISdsfMessageResponse.nodes`/`evicted`, `ELineCommand.HALT`/`PURGE`, `INodeUsage`, y los renombrados
  `IActionTarget`/`IPendingAction`.

## 4. Backlog (fuera del MVP)

- **V2:** `SYSNAME` para cambiar de cluster desde dentro (D10).
- **V2:** servidor tn3270 para emuladores reales (D11). Lo delicado es el puerto TCP: Kwirth solo da
  HTTP/WebSocket a los plugins, así que hay que decidir si va en el plugin, en un router o como Service
  aparte.
- **Fase 2:** `LOG` (events, desde el provider `events`), `ST`/`O`/`H` (Jobs y CronJobs) e `INIT` (nodes).
- **Fase 3:** `X`, exec en el contenedor, como una sesión TSO.
