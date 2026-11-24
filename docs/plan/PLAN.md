# WRKACTJOB — plan y backlog

> **ESTADO — FASE 3 EN CURSO** (2026-11-24). **MVP (S0–S6) cerrado y publicado** el 2026-11-23 como
> `plugin/wrkactjob@0.1.0` (y `dce/blockterm@0.1.0` / `0.2.0`, SDSF 0.11.0 sobre la DCE); instalación de la DCE
> desde el marketplace de jfvilas validada; capturas de referencia (D11) descartadas. **Fase 3** (más comandos
> de IBM i, [PRD-fase3](PRD-fase3.md), D12–D18): streams S7–S12 en §3; **S7 con el código hecho; S8 validado; S9 validado; S10 validado; S11 con el código hecho y verificado en el dev, falta tu QA**. Cuelga
> del [PRD](PRD.md) y del [PRD-fase3](PRD-fase3.md), y no repite ni su problema ni sus decisiones (D1–D18).
>
> **Dónde vive:**
> - `~/github/kwirth/plugins/wrkactjob`: repo anidado (rama `main`, identidad `jfvilas`) **sin remoto**,
>   gitignorado en el core, como SDSF.
> - `~/github/kwirth/dces/blockterm`: la DCE (D3, D4), también repo anidado sin remoto. `dces/*/` ya está
>   gitignorado en el core.
>
> Los dos suben a master de github.com/jfvilas/kwirth con `git subtree`, desde `~/github/jfvilas/kwirth`
> (`--prefix plugins/wrkactjob` y `--prefix dces/blockterm`). ⛔ Ninguno lleva `origin`.
>
> Documento **vivo y append-only**. Se para al final de **cada stream**: commit, informe y OK antes del
> siguiente.

## 1. Lo que el código ya da (verificado el 2026-11-23)

| Necesidad | Qué hay | Dónde |
|---|---|---|
| Un motor 3270 sin DOM, probado | `Screen3270` (buffer, atributo en posición, geometría), `Terminal3270` (teclado local, lock, AID → Read Modified), `Display3270` (runs de pintado, OIA). Enums con los códigos reales del data stream | `plugins/sdsf/src/common/terminal/` (623 líneas) |
| La pantalla en React | `TerminalView` (escala, cursor, blink, OIA), `KeyMapper` (PCOMM: Ctrl dcho = Enter, Ctrl izdo = Reset, al soltar y solas), `Font3270` (3270font embebida, woff), `Palette` (color / fósforo verde) | `plugins/sdsf/src/front/terminal/` (366 líneas) |
| Lo que ata el motor a SDSF | Solo `ESdsfDisplay` (en `SdsfTypes`), que usan `Palette` y `TerminalView`, y el keyframe `sdsf3270blink` | `common/SdsfTypes.ts:11`, `front/terminal/TerminalView.tsx:26` |
| Consumidores del motor en SDSF | `SdsfSession`, `Painter` y todos los paneles (`common/panels/*`), `SdsfTabContent`, y 4 tests (`terminal`, `keymapper`, `session`, `panels`) | `grep "terminal/"` en `plugins/sdsf` |
| DCE de front | Se registra en `window[DCE_FRONT_FACTORIES][id] = { create }`; el core la crea una vez; el consumidor la lee con `getDce()` | `dces/xyflow/src/front/index.ts` |
| Consumidor de DCE | `DCE_PACKAGES` en el `build.mjs`: el paquete de la DCE se resuelve a `registry[id].instance` y nunca se empaqueta. `requiresExtension: [{ extensionType: 'dce', id, minVersion }]` hace que el core no instale el plugin sin ella | `plugins/nettools/build.mjs:26-38`, `package.json:29-35` |
| ⚠️ El mapeo devuelve la INSTANCIA | Lo que el módulo exporte fuera del objeto (un enum) es `undefined` en runtime, sin fallar al construir | memoria `project_dce_consumer_gotchas` |
| DCE en el dev | `back/kwirth-dev.json` tiene sección `dces` (`"swagger-ui": "../dces/swagger-ui/dist"`). Sin watch: build a mano + reinicio del back | `back/kwirth-dev.json:43` |
| Marketplace de DCE | El core conoce el tipo (`EExtensionType.DCE → 'dces'`). **Ninguna DCE se ha publicado aún desde el manifest de jfvilas**: se comprueba en el S1 | `back/src/tools/MarketplaceManager.ts:22` |
| Scaffolders | `create-kwirth-dce.mjs --id --publisher --sides front`, `create-kwirth-plugin.mjs --dce @jfvilas/blockterm` | `tools/` |
| Lo demás del canal (k8s por `coreApi`, provider `metrics` como `uses`, autorización del canal, fullscreen del core, teclado en el elemento de la pestaña) | Lo mismo que verificó SDSF | `plugins/sdsf/docs/plan/PLAN.md` §1 |

## 2. Arquitectura

| Decisión | Por qué |
|---|---|
| **La instancia de la DCE expone TODO lo de runtime con el mismo nombre con el que el módulo lo exporta**: clases, funciones, enums (como objetos), `TerminalView`. El paquete lleva el contrato (`src/common/BlockTerm.ts`) con los tipos | Así `import { E3270Color, Screen3270 } from '@jfvilas/kwirth-dce-blockterm'` funciona tal cual: el mapeo cambia el módulo por la instancia, y la instancia **tiene** esas propiedades. Resuelve R2 del PRD sin duplicar enums en cada consumidor |
| **Los tests unitarios de los consumidores importan el paquete real** (devDependency), sin mapeo | `tests/run.mjs` empaqueta sin el plugin `kwirth-dce`: los tests corren el motor real, como hoy |
| **DCE solo de front** (`--sides front`), con el motor en `src/common` | El motor corre en el navegador (block mode). La V2 (tn3270/tn5250) añadirá el lado back sin mover el motor |
| **Un motor, dos dialectos**: buffer, campos, cursor y lock comunes; lo que difiere (atributos 5250 —subrayado de entrada, separadores de columna—, Field Exit / Field+/-, error de operador con mensaje en la última fila, AID 5250 —Roll Up/Down, Help—) va en el dialecto | R3: 5250 no es 3270 con otra paleta |
| **`EDisplay` (colour / mono) pasa a la DCE**; `ESdsfDisplay` se borra y SDSF usa el de la DCE | Era lo único que ataba el motor a SDSF. Nada de alias que convivan |
| **Los paneles NO van a la DCE.** El `Painter` de SDSF y los paneles de WRKACTJOB son de cada plugin | La DCE da la terminal, no ISPF ni el UIM de IBM i |
| **WRKACTJOB copia la forma de SDSF**: el front es el emulador, el back solo da datos (`LIST`, `LOG`, `EVENTS`, `END`), la sesión vive en `channelObject.data`, el setup en el `instanceConfig` | Es la arquitectura probada de SDSF (su PLAN §2) |
| **Los mapeadores de k8s del back son de WRKACTJOB**, no se comparten con SDSF | Producen otras columnas (Type D6, Status D7, Function); compartir obligaría a otra DCE de back sin ganancia |

## 3. Streams

### Fase 0 — DCE `blockterm` y migración de SDSF

**S0 — DCE `blockterm` con el motor 3270.**
- Scaffolder: `node tools/create-kwirth-dce.mjs --id blockterm --name "Block Terminal" --publisher @jfvilas --sides front --tags library,emulator`; `git init -b main` dentro, identidad `jfvilas`.
- Entra el motor de SDSF: `common/terminal/*` y `front/terminal/*` + la font y su licencia. `ESdsfDisplay` → `EDisplay`; el keyframe pasa a `blockterm-blink`. La copia de SDSF se borra en el S1, en el mismo stream en que SDSF pasa a la DCE; entre S0 y S1 SDSF no se toca.
- La instancia expone todo lo de runtime (§2). Contrato tipado en `src/common/BlockTerm.ts`.
- Tests: los de `terminal` y `keymapper` de SDSF pasan a la DCE (cobertura con c8).
- **Hecho cuando:** `npm run build` y `npm test` en verde, y el `dist` registra la factory (grep).
- ✅ **HECHO (2026-11-23).** Lo que salió al construirlo:
  - **`Painter` también va a la DCE.** No es de SDSF: es la forma de poner texto protegido, campos de entrada y atributos en un buffer 3270, y WRKACTJOB lo necesita igual. Corrige la fila "los paneles no van a la DCE" del §2: los paneles no, su pintor sí.
  - `TerminalView` recibe `testId` (SDSF le pasará `sdsf-terminal`, y su e2e no cambia).
  - `dist/` lleva tres cosas: `front.js` (lo que carga Kwirth; React del core), `index.mjs` (ESM, para los unit tests de los consumidores) y `types/` (para su typecheck); `dist/package.json` con `exports` y `types`.
  - Se borró el `watch.mjs` del scaffold: las DCE van sin watch, y el suyo reescribía `dist/package.json` sin los `exports`.
  - Tests: 30 (motor, teclado, paleta y `contract.test.ts`, que falla si un export de runtime no está en la instancia). Cobertura c8 del motor ≥ 85 % líneas; `TerminalView` y `Font3270` son DOM y se validan con el e2e de SDSF en el S1.

**S1 — SDSF consume `blockterm`.**
- 🔴 **Antes de nada se publica `@jfvilas/kwirth-dce-blockterm@0.1.0` en npm** (con gate). SDSF necesita el paquete instalado para su typecheck y sus unit tests, y en este proyecto no hay `file:` ni symlinks: se publica y se instala. Su entrada en el manifest de jfvilas puede esperar al final del stream, con SDSF.
- SDSF borra su `terminal/` y su font, importa del paquete, mapea `@jfvilas/kwirth-dce-blockterm` en `DCE_PACKAGES`, y declara `requiresExtension` con la DCE.
- Dev: la DCE entra en `kwirth-dev.json` → `dces` desde su `dist` (y como SDSF está fuera de `kwirth-dev.json`, la versión de prueba de SDSF se instala aparte; se ve al llegar).
- **Hecho cuando:** los unit tests de SDSF y **su e2e, sin tocar los specs,** pasan contra la DCE; QA visual tuyo de SDSF.
- **Publicación** (con gate, al final del stream): la entrada de `blockterm` 0.1.0 en el `manifest.json` raíz de jfvilas (primera DCE allí: se comprueba que el marketplace la instala), después SDSF 0.11.0.
- 🔶 **Código hecho (2026-11-23)**, commit `e9e4051` en SDSF. `blockterm` 0.1.0 publicada (GET 200). SDSF: typecheck y 146 unit tests en verde; `front.js` sin motor ni font (136 KB) y leyendo `window.__kwirth_dce__['blockterm']`; el back sin referencias a la DCE. **e2e 26/26 con los specs sin tocar**, contra SDSF 0.11.0 desde `dist` y `blockterm` desde dev (`kwirth-dev.json`: `plugins.sdsf` y `dces.blockterm`). Las capturas que regenera el e2e salen idénticas salvo los JobID; no se commitean. `npm install` de la DCE en SDSF con `--legacy-peer-deps` (ERESOLVE previo de los plugins). Falta: QA del usuario → manifest + SDSF 0.11.0.
- ✅ **HECHO (2026-11-23).** QA del usuario validada. SDSF 0.11.0 en npm (GET 200). En github.com/jfvilas/kwirth: subtree pull de `plugins/sdsf`, **subtree add de `dces/blockterm`** (carpeta nueva `dces/`), manifest raíz con `dce/blockterm@0.1.0` (la primera DCE del manifest) y `sdsf@0.11.0` con `requires: blockterm ≥ 0.1.0`, fila en el índice del README, y los tags `plugin/sdsf@0.11.0` y `dce/blockterm@0.1.0`. GitHub ya sirve el manifest nuevo; el filtro del marketplace del core es solo por `extensionType` (`MarketplaceManager.ts:190`). La instalación real de la DCE desde ese marketplace queda por ver en la UI. `sdsf` sale de `kwirth-dev.json`; `blockterm` se queda allí desde `dist` porque el S2 la desarrolla.

### Fase 1 — dialecto 5250

**S2 — 5250 en `blockterm`.**
- Geometrías 24x80 y 27x132; atributos 5250 (entrada subrayada, separadores de columna, no-display, reverse, colores 5250); Field Exit, Field+/-, Erase Input; error de operador (`X II`) con Reset; AID 5250 (Enter, F1–F24, Roll Up/Down, Help, Clear, Sys Req, Attn); OIA de 5250; paleta mono verde 5251.
- `KeyMapper` 5250 según el RF5 del PRD y D8.
- **Hecho cuando:** unit tests del dialecto en verde y una página de prueba de la DCE (`try`) pinta una pantalla 5250 que tú das por buena. Versión de la DCE 0.2.0 (sin publicar aún).
- 🔶 **Código hecho (2026-11-23)**, commit `654928c` en `blockterm`. Lo que salió al construirlo:
  - 🔴 **La DCE se comparte en RUNTIME.** SDSF 0.11.0, ya publicado, recibe la `blockterm` que esté instalada, no la versión con la que se compiló. Así que una versión nueva **solo añade**: no se quita ni se renombra ningún export y no cambia ninguna firma. `tests/compat.test.ts` congela los exports de la 0.1.0, y lo dicen el README y `BlockTerm.ts`.
  - **Un cristal para los dos terminales:** `Glass` pinta filas de `IGlassRun` (color, reverse, underscore, blink, separador, cursor) y la OIA. `TerminalView` (3270) lo usa conservando sus props; `TerminalView5250` es el segundo envoltorio. El 3270 entra por `glassRow3270`, un adaptador nuevo sin tocar `displayRow`.
  - **El atributo 5250 es el byte real** (0x20–0x3F) en su posición, decodificado con la tabla de color del 5292/3477. **Monocromo (5251):** como el fósforo verde de SDSF (D12), la pantalla en color bajada a dos intensidades (blanco, rojo y amarillo brillan) y no los bits en crudo. Con los bits en crudo, el texto azul de IBM i salía en un 5251 con separadores de columna y parpadeo, y un IBM i nunca le manda colores a un terminal monocromo.
  - **Bug latente del 3270 arreglado en `Glass`:** el tamaño de la font calculado midiendo a 14 px podía desbordar al tamaño final (el avance no escala exacto: a 1100 px de ancho el grid salía 20 px más ancho). Ahora vuelve a medir y encoge en la proporción del desborde. SDSF lo hereda.
  - **Página de prueba:** `npm run try` → `try/out/index.html` (gitignorada). Carga el `dist/front.js` construido con el React de la página y pinta una pantalla tipo WRKACTJOB (`?mono=1`, `?wide=1`); el «host» contesta a la opción 9 con el error de IBM i en la fila 24.
  - Tests: 65 (35 nuevos: motor 5250, pintado, teclado y compatibilidad), con el motor 5250 al 100 % de líneas. **e2e de SDSF 26/26 sobre la DCE 0.2.0** (SDSF 0.11.0 de nuevo en `kwirth-dev.json` mientras duró la prueba).
  - **Tipos nuevos (⚠️ a validar por el usuario):** `IGlassRun`, `IGlassOia`, `IGlassProps`, `IGlassKeys`, `I5250Look`, `I5250FieldFormat`, `I5250Field`, `I5250Cell`, `I5250KeyAction`, `I5250ModifiedField`, `I5250Input`, `I5250FieldStyle`, `ITerminalView5250Props`; enums `E5250Attribute`, `E5250AttributeBit`, `E5250Shift`, `E5250Adjust`, `E5250Aid`, `E5250Lock`, `E5250Error`, `E5250Key`.
  - **Fuera del S2 (backlog):** Attn y Sys Req (no son AID: necesitan una vía de «señal de sesión» que se decide con los paneles), la AID Help sin tecla (F1 es F1; en IBM i, F1 ya es la ayuda), y mandatory enter/fill del FFW (WRKACTJOB no los usa). Los códigos de error de operador `0005`, `0010`, `0012` y `0019` quedan como están: el usuario descartó contrastarlos con capturas reales (D11, 2026-11-24).

### Fase 2 — el MVP de WRKACTJOB

**S3 — Scaffold y back.**
- El PRD y este PLAN se apartan, `node tools/create-kwirth-plugin.mjs --id wrkactjob --name WRKACTJOB --publisher @jfvilas --icon Terminal --tags operations,kubernetes,emulator --dce @jfvilas/blockterm`, y se vuelven a meter; `git init -b main`; `/plugins/wrkactjob/` al `.gitignore` del core.
- Back: `LIST` (namespaces + pods con Type D6, Status D7, Function, User, Pool, Pty, reinicios, contenedores, métricas del provider `metrics` como `uses`), `LOG`, `EVENTS`, `END` (grace = DELAY, `*IMMED` = 0). Autorización del canal con scopes propios (`wrkactjob$read`, `wrkactjob$end`).
- **Hecho cuando:** unit tests de los mapeadores (todos los status y tipos de D6/D7) y de la autorización.
- ✅ **HECHO (2026-11-23)**, commit `6ee2b21` en `plugins/wrkactjob` y `994d6887` en el core (`.gitignore`). Lo que salió al construirlo:
  - El back calca el de SDSF: canal de cluster que autoriza con la key del START, provider `metrics` como `uses` (suscrito solo con instancias abiertas) y errores de la API como `NOT_FOUND`/`FAILED` con el mensaje del API server.
  - `LIST` devuelve solo pods **activos** (fuera `Succeeded` y `Failed`). Con CPU del intervalo, un pod Running sin CPU es `DEQW`; sin cifra (sin provider o con una sola lectura) es `RUN`, porque está corriendo.
  - `MSGW` = un contenedor esperando por CrashLoopBackOff, ImagePullBackOff, ErrImagePull, InvalidImageName, CreateContainer(Config)Error o RunContainerError, o terminado por Error, OOMKilled o ContainerCannotRun. `ContainerCreating` no lo es (es `SCDW`). El mensaje de `7` es el contenedor, la razón, el exit code y lo que dijo; si no dijo nada, el de su última terminación.
  - `END`: `DELAY` 0–999999 (por defecto 30, como ENDJOB) → `gracePeriodSeconds`; `*IMMED` → 0.
  - `program` es el nombre de la imagen del primer contenedor normal, sin registry, ruta, tag ni digest.
  - El front del scaffold sigue siendo el de ejemplo (solo se tocó para que compile); se sustituye en el S4.
  - Tests: 23 y 100 % de líneas.
  - ⚠️ **`blockterm` 0.2.0 sin publicar.** El clasificador de permisos denegó el `npm publish` tres veces. El back solo usa tipos que ya tiene la 0.1.0 (`EDisplay`, `I3270Geometry`), así que la devDependency está en `^0.1.0` por ahora; el `requiresExtension` pide 0.2.0. **El S4 necesita la 0.2.0 publicada** para el typecheck del front (`TerminalView5250`, `Painter5250`…).
  - **Tipos nuevos (⚠️ a validar por el usuario):** `IWrkactjobInstanceConfig` (relleno: `model`, `display`), `EWrkModel` + `WRK_MODEL_GEOMETRY`, `EWrkScope` + escalera y catálogo, `EWrkCommand`, `EWrkError`, `EWrkMetricsState`, `EWrkJobType`, `EWrkJobStatus`, `IWrkContainer`, `IWrkJob`, `IWrkEvent`, `IWrkRequest`, `IWrkactjobMessage` / `IWrkactjobMessageResponse` (rellenos), y en el back `IWrkClusterInfo`, `IWrkInstance`, `IJobUsage`, `IUsage`.

**S4 — `WRKACTJOB` en pantalla.**
- Setup (D10), sesión en `channelObject.data`, panel `WRKACTJOB` (RF3) con subsistemas y jobs sangrados, cabecera `CPU % / Elapsed time / Active jobs`, `More...`/`Bottom`, Roll Up/Down, F5, F10, F11 (D9), F7 Find, línea de comandos (`WRKACTJOB SBS() JOB()`, `SIGNOFF`), mensajes en la fila 24 con bloqueo de error, `Main Menu` con F3 (D5).
- **Hecho cuando:** criterios 1–3, 7, 8 y 10 del PRD; QA tuyo.
- 🔶 **Código hecho (2026-11-23)**, commit `b407576`. Lo que salió al construirlo:
  - `blockterm` 0.2.0 publicada (GET 200); WRKACTJOB depende de `^0.2.0`.
  - **Arranque:** la sesión pinta WRKACTJOB vacío con el teclado en `X SYSTEM` y pide la lista cuando el core confirma el START (`connected()`), porque antes no hay instancia a la que preguntar.
  - **Disposición** (contada desde abajo, igual en 24 y 27 filas): título y sistema en la fila 1, fecha en la 2, estadísticas en la 3, leyenda en la 5 y la 6, cabeceras en la 8, lista hasta r−7, `More...`/`Bottom` en r−6, la línea de comandos en r−5 y r−4, teclas en r−3 y r−2, mensajes en r−1. 10 filas de lista a 24x80 y 13 a 27x132.
  - **Nombres** en mayúsculas y cortados a 10, como en IBM i (R4 del PRD); los completos, en la vista 3 de F11. Las filas `SBS` suman la CPU y los reinicios de sus jobs.
  - **F11:** a 80 columnas rota estado → datos acumulados → nombres; a 132, estado (con los datos acumulados al lado) → nombres.
  - **F7** busca el texto escrito en la línea de comandos. Es una simplificación de la ventana Find de IBM i.
  - **Sin el provider `metrics`:** «Metrics provider not installed…» una vez por sesión. Mientras calienta, las columnas de CPU salen vacías sin aviso.
  - **Errores con el teclado bloqueado hasta Reset:** opción no válida, comando desconocido («Command X in library *LIBL not found.»), parámetro o keyword no válidos, tecla de función que el panel no tiene, y el back diciendo que no o sin responder.
  - **Opciones 4, 5, 7 y 8:** se validan, pero en el S4 responden «Option n not available yet.» (provisional, lo sustituye el S5).
  - **Fuera del S4:** F14 (Include) y F24 (More keys) del RF6; F23 «More options» no tiene sentido sin más opciones.
  - **Verificado en el dev** contra k3d con capturas por la UI: lista agrupada por namespace, opción 9, F11, menú, y CPU tras dos lecturas del provider (cabecera .9, `RUN`/`DEQW`, CPU acumulada).
  - Tests: 44 y 100 % de líneas. `front.js` de 41 KB, que lee la instancia de la DCE.
  - ⚠️ **Incidente:** al meter `wrkactjob` en `kwirth-dev.json` reinicié el core en mitad del e2e de Spectrum (otra sesión, arrancado a las 19:43:48; reinicio a las 19:44:35). La comprobación y la edición se lanzaron en paralelo. Apuntado en la memoria.
  - **Tipos nuevos (⚠️ a validar):** `EWrkPanel`, `EWrkView`, `IWrkRow`, `IWrkFilter`, `IWrkColumn`, `IActiveJobsState`, `IActiveJobsFields`, `IWrkRows`, `IClCommand`, `IWrkDataSource`, `IWrkactjobData` (rellena).

**S5 — Opciones y paneles hijos.**
- `4` → prompt `ENDJOB` (`OPTION`, `DELAY`), `5` → `Work with Job` (status, definición, spooled files, job log), `7` → `Display Message` en `MSGW`, `8` → `Work with Spooled Files` → `5` → `DSPSPLF` (Roll, `F` buscar, `B`/`T`). `WRKJOB` y `ENDJOB` en la línea de comandos, F4 = prompt. Varias opciones a la vez, en orden.
- **Hecho cuando:** criterios 4–6 del PRD; QA tuyo.
- 🔶 **Código hecho (2026-11-23).** Lo que salió al construirlo:
  - **Pila de paneles:** WRKACTJOB (o el menú) es la base; los paneles del job se abren encima. F12 vuelve uno, F3 sale de todos y descarta las opciones pendientes. Al salir del último, corre la siguiente opción tecleada; sin más, la lista se pide de nuevo.
  - **Validación antes de ejecutar nada:** opción desconocida → «Option n not valid.»; opción sobre una fila `SBS` → «Option n not valid for a subsystem.»; `7` sobre un job que no está en `MSGW` → «No messages to display for job X.». Todo en su campo y con el teclado bloqueado.
  - **`4` / `ENDJOB`:** el prompt «End Job (ENDJOB)» (Job name; el subsistema si viene de una fila; How to end `*CNTRLD`/`*IMMED`; delay 1–999999, como ENDJOB). Cada valor erróneo se marca en su campo. Si el back dice que no (sin `wrkactjob$end`), el motivo sale en el prompt. Al terminar: «End of job 123456/USER/NAME requested.» en la lista, refrescada. `ENDJOB JOB() OPTION() DELAY()` en la línea de comandos termina sin prompt.
  - **El número de job** son seis dígitos sacados del uid, estables durante la vida del pod: `number/user/name` como en IBM i.
  - **`5` / `WRKJOB`:** el menú Work with Job: 1 estado, 2 definición (los dos con los datos del `LIST`, sin preguntar al back), 4 spooled files, 10 job log (`EVENTS`).
  - **`7`:** Display Messages con el motivo del `MSGW` en blanco. Sin línea de reply: un contenedor no la admite; el texto dice que se termine el job o se corrija la causa.
  - **`8` / WRKJOB 4:** los contenedores como spooled files: `OPN` si siguen corriendo (se están escribiendo), `RDY` si no. Se incluyen los init. `5` → DSPSPLF (`LOG`).
  - **DSPSPLF / DSPJOBLOG:** un mismo browse. Control `T`, `B`, `+n`, `-n` o un número de línea; Find con Enter o F16 (busca desde la línea siguiente y da la vuelta); Roll; F19/F20 desplazan media pantalla; regla de columnas como la de IBM (el `*` es solo de la columna 1).
  - **F4** abre el prompt de `ENDJOB` o `WRKJOB` con lo tecleado; con otro comando, «Command X cannot be prompted here.». Desde el menú funciona igual, y al salir se vuelve al menú sin pedir la lista.
  - **Nombre de job en un comando:** el nombre completo del pod, en cualquier caja. Si varios namespaces tienen un pod con ese nombre, «More than one job named X: select it from the list.».
  - Tests: 61 y 100 % de líneas. **Verificado en el dev** con capturas por la UI: 5→1 y 2, 8→5 (DSPSPLF), 4 con F12 (sin terminar nada real).
  - **Tipos nuevos (⚠️ a validar):** `IPromptParam`, `IPromptDef`, `EWorkWithJob`, `EJobAttributes`, `ISpooledFileField`, `IBrowse`, `IBrowseFields`; en la sesión, internos, `IFrame` e `IQueued`.

**S6 — e2e, README y publicación.**
- e2e propio (namespace `wrkactjob-e2e` que crea y borra; sin coincidir con el e2e de SDSF, que borra el suyo).
- README de GitHub con capturas (como SDSF); docs.
- **Publicación** (gate): `blockterm` 0.2.0, luego `wrkactjob` 0.1.0, manifest de jfvilas, tags y subtree.
- 🔶 **e2e y README hechos (2026-11-23)**, commits `2fa42e7` y `31ffa79`:
  - e2e: 15 tests en 40 s con los criterios del PRD (salvo el 6, «sin permiso», que cubren los unit tests: el usuario del dev es admin). Fixture propio en `wrkactjob-e2e`; solo lista ese subsistema.
  - «Active jobs» y «CPU %» son estadísticas del **sistema**, como en IBM i: no cambian con `SBS()`.
  - Capturas del README (`docs/screenshots/`, 10) sacadas por el e2e: solo el fixture, el cluster y el nodo de k3d.
  - El `build.mjs` del scaffold no copiaba el README a `dist`: ahora lo copia (el tarball lleva 4 ficheros).
  - `blockterm` 0.2.0 ya está en npm; falta su entrada en el manifest de jfvilas.
- ✅ **PUBLICADO (2026-11-23)**, con el OK del usuario. `@jfvilas/kwirth-plugin-wrkactjob@0.1.0` en npm (GET 200 a los ~10 min). En github.com/jfvilas/kwirth: subtree pull de `dces/blockterm` (0.2.0), **subtree add de `plugins/wrkactjob`**, manifest raíz con `wrkactjob@0.1.0` (con `requires: blockterm ≥ 0.2.0`) y `dce/blockterm@0.2.0`, filas en el índice del README, y los tags `plugin/wrkactjob@0.1.0` y `dce/blockterm@0.2.0`. `wrkactjob` y `blockterm` salen de `kwirth-dev.json` (lo pidió el usuario): en dev se instalan del marketplace de jfvilas, que es además la prueba pendiente de que instala una DCE de ese manifest.

### Fase 3 — más comandos de IBM i ([PRD-fase3](PRD-fase3.md))

Lo común a todos los streams de la fase:
- **Sin tocar `blockterm`.** Todo lo de la fase es del plugin; si un stream necesitara algo de la DCE, se para y se dice (una versión nueva de la DCE solo añade, y obliga a publicarla antes).
- **Back:** cada comando nuevo es un `EWrkCommand` nuevo y una ampliación del `Pick` de `IWrkClusterInfo` (`coreApi`, `batchApi`, `storageApi` del `ClusterInfo` del core, solo tipos). Para los CronJobs se reutilizan `cronJobStatus` y `cronJobTrigger` de `common-back/KubernetesTools.ts` si el runtime del core (`__kwirth_back__`) los expone; si no, se llama a `batchApi` igual que ellos, sin copiar lógica.
- **Front/sesión:** cada comando es un `EWrkPanel` nuevo en la pila de `WrkSession`, con su fichero en `src/common/panels/`; la línea de comandos y F4 los reconocen en cualquier panel que la tenga. F3 vuelve al menú, F12 uno atrás.
- **Por stream:** unit tests con c8 al nivel del MVP (100 % de líneas en `common`), build, verificación en el dev con capturas por la UI y QA tuyo. Los tipos nuevos se listan para tu validación.
- **Dev:** `wrkactjob` vuelve a `kwirth-dev.json` (desde `dist`) mientras dure la fase, comprobando antes, **en un turno aparte**, que no hay un Playwright vivo; sale al publicar.

**S7 — Back de la fase 3 y el scope `wrkactjob$schedule`.**
- Comandos: `SYSTEM` (nodos con allocatable, memoria pedida y pods máximos; PersistentVolumes; uso del provider `metrics`), `SUBSYSTEMS` (namespaces con estado, memoria pedida y nodos donde tienen pods), `SUBSYSTEM_DESCRIPTION` (labels, annotations, ResourceQuotas, LimitRanges de un namespace), `MESSAGES` (events Warning de los namespaces que ve la clave, el más reciente primero), `SCHEDULES` (CronJobs con schedule, zona, suspend, concurrencyPolicy, último schedule e historial de Jobs), `HOLD` / `RELEASE` (`suspend`), `SUBMIT` (Job desde el CronJob).
- `wrkactjob$schedule` entra en `EWrkScope`, en la escalera entre `read` y `end` (D18) y en el catálogo de scopes. `HOLD`/`RELEASE`/`SUBMIT` lo exigen; una clave con `end` lo incluye por escalera.
- D17: nodos y PersistentVolumes solo con una clave de nivel `cluster` o superior; si no, la respuesta lo marca (no autorizado a esas cifras) y el resto se calcula con lo que la clave ve.
- Todo filtrado por los namespaces que alcanza la clave (`keyMatchesResource`), como `LIST`.
- **Hecho cuando:** unit tests de los mapeadores y de la autorización de cada comando (incluido D17 y la escalera), 100 % de líneas en el back.
- 🔶 **Código hecho (2026-11-24).** Lo que salió al construirlo:
  - **`cronJobStatus` / `cronJobTrigger` de `common-back` no se usan:** el runtime los expone, pero se tragan el error (lo loguean y vuelven bien), así que un Hold que falla le diría al operador que ha ido. Se llama a `batchApi` como ellos. `SUBMIT` hace lo que `kubectl create job --from=cronjob/…`: el Job lleva la ownerReference al CronJob (así su historial y WRKACTJOB lo ven como una de sus ejecuciones) y la anotación `cronjob.kubernetes.io/instantiate: manual`; nombre `<cronjob>-manual-<epoch>`, cortado a 63.
  - **Patch con `op: add`** en `/spec/suspend` (como el cordon de SDSF): `replace` falla si el objeto guardado no tiene el campo.
  - **Qué alcanza la clave:** un CronJob se comprueba como un pod con su nombre (los patrones de pods de la clave se comparan con él: sus pods se llaman como él). Un subsistema se ve si la clave lo alcanza por nombre **o** alcanza algún pod suyo (una clave limitada a unos pods no tiene namespace propio, pero ve los subsistemas en que corren). Un mensaje: el de un pod, por el pod; el de otro objeto con namespace, por el namespace; el de un objeto de cluster (un nodo), solo con nivel `cluster` (D17).
  - **`SYSTEM` por debajo de `cluster`** ni siquiera pide nodos ni volúmenes: `restricted`, pools vacíos, sin ASP, y la CPU es la suma de los jobs que alcanza.
  - `DSPMSG`: los 1000 events Warning más recientes como mucho (`MAX_MESSAGES`).
  - `quantityOf` es copia de la de SDSF (`Quantity.ts`): un plugin no importa otro y las librerías comunes no tienen una. La memoria pedida de un pod cuenta como el scheduler: sus contenedores juntos o su init más grande.
  - Tests: 84 (23 nuevos), 100 % de líneas y funciones (c8). Typecheck limpio, también de los tests.
  - **Tipos nuevos (⚠️ a validar):** `EWrkScope.SCHEDULE`; en `EWrkCommand`: `SYSTEM`, `SUBSYSTEMS`, `SUBSYSTEM_DESCRIPTION`, `MESSAGES`, `SCHEDULES`, `HOLD`, `RELEASE`, `SUBMIT`; `IWrkPool`, `IWrkStorage`, `IWrkSystem`, `EWrkSubsystemStatus`, `IWrkSubsystem`, `IWrkQuotaItem`, `IWrkLimitItem`, `IWrkSubsystemDescription`, `IWrkMessage`, `EWrkRunStatus`, `IWrkScheduleRun`, `IWrkSchedule`; campos nuevos en `IWrkactjobMessageResponse` (`system`, `subsystems`, `description`, `messages`, `schedules`, `submitted`); en el back, `IPodJob`.

**S8 — Main Menu y `WRKSYSSTS`.**
- Main Menu con 1–5 y 90 (PRD-fase3 §3). La línea de comandos reconoce `WRKSBS`, `DSPMSG` (con o sin `QSYSOPR`), `WRKMSG`, `WRKSYSSTS` y `WRKJOBSCDE`; F4 sobre ellos abre su prompt (los que tienen parámetros) o el panel.
- `WRKSYSSTS` (PRD-fase3 §2.1): cabecera (`% CPU used`, `Elapsed time`, `Jobs in system`, `Main storage size`, `System ASP`, `% system ASP used`), tabla de pools = nodos numerados por nombre (D13), F11 con sus vistas, F10, F5; `*N` sin `metrics` y sin permiso de cluster, con el mensaje de D17. A 132 columnas, las vistas que caben juntas.
- **Hecho cuando:** criterio 1 del PRD-fase3; tests de la tabla de pools con 1 y con más nodos que filas (Roll); QA tuyo.
- 🔶 **Código hecho (2026-11-24).** Lo que salió al construirlo:
  - **WRKSYSSTS es un panel sobre la base** (como los del job): F12 vuelve uno, F3 vuelve a donde se llamó (WRKACTJOB o el menú). Tecleado sobre sí mismo se refresca; `RESET(*YES)` reinicia el tiempo transcurrido, igual que F10. F4 sobre él lo ejecuta: no tiene prompt aquí.
  - **WRKACTJOB tecleado sobre un panel cierra todos los paneles:** es la base, no un panel encima. Simplificación frente a IBM i, que lo anidaría. *(Sustituido en el S9: los paneles se apartan y F12 en WRKACTJOB vuelve a ellos.)*
  - **ENDJOB tecleado sobre un panel** deja ese panel pintado con el mensaje (antes solo existía sobre la base, que se refresca).
  - **Cifras:** `% CPU used`, `Elapsed time`, `Jobs in system`, `Main storage size (M)` (la memoria allocatable de los nodos); a la derecha `Auxiliary storage:` con `System ASP` (G) y `% system ASP used` (cuatro decimales, como IBM i). `*N` lo que no se sabe o no se puede ver.
  - **Pools a 80 columnas, tres vistas con F11:** faults (`Pool Size`, `Reserved Size`, `Max Active`, `DB Fault` = jobs en MSGW, `Non-DB Fault` = reinicios), actividad (`Active`, `CPU %`, `Used Size`: no hay transiciones en Kubernetes, así que es el uso) y nombres (el nodo). A 132, todo en una vista y F11 no está.
  - **D17:** con `restricted`, sin pools («(No pools to display)»), `*N` en almacenamiento y memoria, y «Not authorized to some system values.» en cada refresco. El aviso de que falta el provider `metrics` sale una vez por sesión, en el panel que lo descubra primero.
  - **Main Menu:** 1–5 y 90 con una línea en blanco encima, como IBM i. La entrada 3 es `DSPMSG MSGQ(QSYSOPR)` (forma con keyword; la posicional llega en el S10).
  - **WRKSBS, DSPMSG, WRKMSG, WRKJOBSCDE:** «Command X not available yet.» hasta sus streams (provisional, como las opciones en el S4).
  - Tests: 95 (11 nuevos), 100 % de líneas (c8). Versión del plugin **0.2.0** y `wrkactjob` en `kwirth-dev.json` desde `dist` (sin commitear en el core hasta el cierre de la fase).
  - **Verificado en el dev** (k3d, 2 nodos, sin PersistentVolumes) con capturas por la UI: las tres vistas, el menú y su opción 4. La CPU sale `*N` hasta que el provider `metrics` tiene dos lecturas (~1 min tras abrir el canal); luego `% CPU used`, la CPU y la memoria usada por pool. Salió que los puntos de la columna derecha acababan en «.  :»: el ancho de la etiqueta tiene que ser impar, como el de la izquierda.
  - **Tipos nuevos (⚠️ a validar):** `ESystemView`, `ISystemStatusState`, `EWrkPanel.SYSTEM_STATUS` y, internos de la sesión, `ISystemFrame` y el campo `systemStatus` de `IFrame`.

**S9 — `WRKSBS` y `DSPSBSD`.**
- `WRKSBS` (§2.2): subsistemas con `Total Storage (M)` y sus pools (los números de `WRKSYSSTS`), F11 al estado. Opción `5` → `Display Subsystem Description` (menú de la descripción: atributos = labels/annotations, entradas de pool = ResourceQuotas, límites = LimitRanges; cada una con su panel de solo lectura). Opción `8` → `WRKACTJOB SBS(ns)` encima en la pila. `4` → «Option 4 not valid.» (D14).
- **Hecho cuando:** criterio 2 del PRD-fase3; QA tuyo.
- 🔶 **Código hecho y verificado en el dev (2026-11-24).** Lo que salió al construirlo:
  - **WRKSBS** (por el menú, `WRKSBS` o F14 de vuelta a WRKSYSSTS): `Total Storage (M)` (`.00` como IBM i) y las columnas de pools 1–10, cada una con el **número de pool del sistema**. La numeración la da el back (`poolNames`): todos los nodos por nombre con nivel `cluster` (la misma de WRKSYSSTS), por debajo los nodos de los jobs que la clave alcanza. F11: estado, jobs y el nombre completo del namespace. A 132, todo junto y sin F11. Sin leyenda ni validez para `4` (D14).
  - **Varias opciones a la vez** se validan antes de correr ninguna y corren en orden, cada una al dejar la anterior; al acabar, la lista se pide de nuevo (como WRKACTJOB).
  - **`8` y WRKACTJOB tecleado sobre un panel:** los paneles se apartan y **F12 en WRKACTJOB vuelve a ellos**; F3 va al menú y los deja. Sustituye la simplificación del S8 (que cerraba todos los paneles).
  - **DSPSBSD** (opción `5` o `DSPSBSD SBSD(nombre)`): el menú de IBM i con 1 Operational attributes (estado, creación, pools, labels y annotations) y 2 Pool definitions (pool del subsistema, pool del sistema, nodo); las entradas 3–10 de IBM i no tienen equivalente, así que **3 y 4 son propias: Resource quota entries y Limit range entries**. Cada una es una lista de solo lectura con Roll y «Press Enter to continue.». En la línea de selección, un número que no es entrada es «Selection n not valid.»; otra cosa se ejecuta como comando.
  - **F4 sobre WRKSBS o DSPSBSD los ejecuta**, como WRKSYSSTS.
  - **Back:** `SUBSYSTEMS` y `SUBSYSTEM_DESCRIPTION` devuelven `poolNames`; la descripción trae sus `pools`. `SUBSYSTEM_DESCRIPTION` ya no usa `listNamespacedPod`: lista todos los pods una vez (para los pools y la numeración) y de ahí sale si la clave alcanza el subsistema.
  - `rowsOf` acepta solo la altura (`Pick<Screen5250, 'rows'>`): los tamaños de página se calculan sin pantalla.
  - **Verificado en el dev** con capturas por la UI: WRKSBS (9 subsistemas, pools 1 y 2 = agent y server), F11, `5` con sus cuatro entradas y `8` sobre kube-system con F12 de vuelta. La primera pasada falló en la `8` porque el back de dev se reinició a mitad (12:14:58, ajeno); la segunda, limpia. Salió que la cabecera de los LimitRange no cabía en 80 columnas.
  - Tests: 108 (13 nuevos), 100 % de líneas (c8).
  - **Tipos nuevos (⚠️ a validar):** `poolNames` en `IWrkactjobMessageResponse`, `pools` en `IWrkSubsystemDescription`; `ESubsystemOption`, `ESubsystemsView`, `ISubsystemsState`, `ISubsystemsFields`, `ESubsystemDescription`, `IDisplayList`; `EWrkPanel.SUBSYSTEMS`, `SUBSYSTEM_DESCRIPTION`, `DISPLAY`; internos de la sesión, `ISubsystemsFrame`, `IDescriptionFrame` y los campos `subsystems`, `description`, `display` de `IFrame`.

**S10 — `DSPMSG QSYSOPR`.**
- Panel `Display Messages` (`Queue . . . : QSYSOPR`, `Program . . : *DSPMSG`), mensajes en orden inverso, sin campo de Reply (D15); F1 con el cursor sobre un mensaje → `Additional Message Information` (event completo); F5; Roll. `WRKMSG` abre lo mismo. Mensaje del panel cuando no hay ninguno: `No messages available.`
- **Hecho cuando:** criterio 3 del PRD-fase3; QA tuyo.
- 🔶 **Código hecho y verificado en el dev (2026-11-24).** Lo que salió al construirlo:
  - **Comandos:** `DSPMSG`, `DSPMSG QSYSOPR` (posicional), `DSPMSG MSGQ(QSYSOPR)` y `WRKMSG` abren lo mismo; también `*SYSOPR`, `*WRKUSR` y `*USRPRF` (no hay cola por usuario, D15). Otra cola: «Message queue X in *LIBL not found.». El menú (3) teclea `DSPMSG QSYSOPR`. F4 sobre ellos los ejecuta.
  - **Posicionales en el parser CL:** solo para los comandos de `POSITIONAL` (hoy `DSPMSG` y `WRKMSG` → `MSGQ`) y solo antes de cualquier keyword, como CL. El resto de comandos sigue rechazándolos.
  - **El panel:** Queue/Library/Program arriba, una instrucción para F1 (sin «Type reply»: no hay respuesta, D15), y cada mensaje como «Pod X in subsystem Y: Reason - texto», con las líneas siguientes dos columnas más adentro. **Se pagina por mensajes enteros** (uno no se parte entre páginas; uno más largo que la página se corta). Sin mensajes: «No messages available.». Enter sale (no hay nada que contestar), F5 refresca. No tiene línea de comandos.
  - **F1** con el cursor en cualquier línea de un mensaje abre **Additional Message Information**: Message ID (la reason), tipo, fecha de envío y primera, ocurrencias, objeto, subsistema (`*NONE` para un nodo), programa (el componente) y el texto completo. Fuera de un mensaje: «Position the cursor on a message, then press F1.».
  - **`wrap` corregido para todos los paneles:** una palabra más larga que la línea (el nombre de un pod con su uid, frecuente en los events) ahora llena lo que queda de la línea en que empieza; antes bajaba a una línea propia y dejaba un `)` huérfano. Lo destapó la prueba en el dev.
  - Tests: 116 (8 nuevos), 100 % de líneas (c8).
  - **Tipos nuevos (⚠️ a validar):** `IOperatorMessagesState`; `EWrkPanel.OPERATOR_MESSAGES` y `MESSAGE_DETAILS`; `POSITIONAL` (el mapa de posicionales del parser); internos de la sesión, `IOperatorMessagesFrame` y los campos `operatorMessages` y `detail` de `IFrame`.

**S11 — `WRKJOBSCDE`.**
- Parser de cron propio en `common` (5 campos, listas, rangos, pasos, nombres de días/meses y `@hourly`…; sin dependencias): la próxima ejecución y la traducción a las frecuencias de IBM i (`*WEEKLY`, `*MONTHLY`, días y hora) o `*CRON` con la expresión (D16).
- Panel `Work with Job Schedule Entries` (§2.4) con `SCD`/`HLD`, fecha/hora, frecuencia, próximo envío; F11 al nombre completo. Opciones `3` (prompt `HLDJOBSCDE`), `6` (`RLSJOBSCDE`), `10` (`SBMJOB`), `5` (detalle e historial), `8` (pods del último Job en WRKACTJOB, o `No active jobs.`), `4` no válida (D14). Sin `wrkactjob$schedule`, el motivo sale en el prompt como en `ENDJOB`.
- **Hecho cuando:** criterio 4 del PRD-fase3; tests del parser con las expresiones de los CronJobs típicos (cada minuto, horas fijas, días laborables, mensual, rangos con paso, nombres, zona horaria); QA tuyo (Hold/Release/Submit sobre un CronJob de prueba propio, nunca uno ajeno).
- 🔶 **Código hecho y verificado en el dev (2026-11-24).** Lo que salió al construirlo:
  - **Cron propio (`common/Cron.ts`)**, como el controlador (robfig/cron estándar): cinco campos, listas, rangos, pasos (`n/paso` hasta el final), nombres, 7 = domingo, `?`, macros `@yearly`…`@hourly`, y los dos campos de día restringidos = cualquiera de los dos. La **próxima ejecución** recorre el reloj de pared en la zona del CronJob (UTC si no da ninguna: la del controlador) saltando días y horas que no casan, y relee el reloj tras cada salto, así que el cambio de hora sale solo (probado: 29-3-2026 en Madrid). Un horario imposible (30 de febrero) da «sin próxima» en vez de quedarse en bucle; una zona desconocida, también.
  - **D16, en palabras de IBM i:** una hora al día todos los meses → `*WEEKLY` con fecha `*ALL` (todos los días), `*MON` (uno) o `*SELECT` (varios, detallados en el 5); un día del mes → `*MONTHLY` con ese día; lo demás → `*CRON` con la expresión ocupando Date y Time.
  - **El panel:** dos líneas de leyenda (como IBM i) y cabecera en dos líneas, así que la lista empieza en la fila 10; `HLD` en blanco, como `MSGW`. Leyenda sin `2=Change` ni `4=Remove` (D14). F11: subsistema, nombre completo y cron; a 132, todo junto y sin F11.
  - **Opciones**, validadas todas antes de correr ninguna y en orden como en WRKSBS: `3` sobre una HLD, `6` sobre una SCD y `8` sin ejecuciones se rechazan en su campo con el mensaje de IBM i («already held», «not held», «No submission…»). `3`, `6` y `10` abren su prompt (`HLDJOBSCDE`, `RLSJOBSCDE`, `SBMJOB`) con el nombre y el subsistema; el nombre tecleado tiene que ser el de la entrada; F12 en el prompt la salta sin hacer nada. Al acabar, «Job schedule entry X held./released.» o «Job <job> submitted.» en la lista refrescada.
  - **`8`** abre WRKACTJOB con `SBS(ns) JOB(<último job>-*)`: los pods de un Job se llaman `<job>-<sufijo>`, y con el guion no entra otro job cuyo nombre empiece igual. F12 vuelve a WRKJOBSCDE.
  - **`5`** es una lista de solo lectura: el panel de lista del S9 sale a `panels/DisplayList.ts` con una línea de cabecera libre (antes llevaba el subsistema) y lo usan los dos.
  - Los prompts de las opciones no son comandos de la línea de comandos (no están en `PROMPTS`). Ya no queda ningún comando «not available yet»: se borró esa lista.
  - **El mensaje de permiso del back se acortó** («Not authorized: job schedule entries need the 'wrkactjob$schedule' scope»): el anterior no cabía en la fila de mensajes.
  - **Verificado en el dev** con un CronJob propio en un namespace temporal (`wrkactjob-s11`, suspendido, L-V 02:30 Europe/Madrid; creado y borrado por la prueba): lista, `6` (suspend → false), `3` (→ true), `10` (Job `nightly-backup-manual-…` creado), `5` y `8` (su pod en WRKACTJOB), con capturas.
  - Tests: 131 (15 nuevos: 5 del cron), 100 % de líneas (c8).
  - **Tipos nuevos (⚠️ a validar):** en `Cron.ts`, `ICron`, `EScheduleFrequency`, `IScheduleWords`; en el panel, `EScheduleOption`, `EScheduleStatus`, `EScheduleView`, `IScheduleEntriesState`, `IScheduleEntriesFields`; `HLDJOBSCDE_PROMPT`, `RLSJOBSCDE_PROMPT`, `SBMJOB_PROMPT`; `IDisplayList.header` (sustituye a `subsystem`); `EWrkPanel.SCHEDULE_ENTRIES`; internos de la sesión, `IScheduleFrame` y los campos `schedules` y `schedule` de `IFrame`.

**S12 — e2e, README y publicación de la 0.2.0.**
- e2e ampliado en `wrkactjob-e2e`: el fixture añade un CronJob (suspendido de inicio, nunca lanza nada solo) y un event Warning propio; specs de los cuatro comandos, el menú y Hold/Release/Submit sobre ese CronJob. Lo de cluster (`WRKSYSSTS`) se comprueba por estructura, no por cifras.
- README: tabla de comandos, opciones, el scope `wrkactjob$schedule`, capturas nuevas sacadas por el e2e.
- **Publicación** (gate): `wrkactjob` 0.2.0 (`requires` sigue en `blockterm ≥ 0.2.0`), manifest de jfvilas, tag `plugin/wrkactjob@0.2.0`, subtree; `wrkactjob` sale de `kwirth-dev.json`.

## 4. Backlog (después del MVP)

- **Después de la fase 3** (PRD-fase3 §5): `WRKJOBQ`, `WRKDSKSTS`, `NETSTAT *CNN`, `WRKUSRPRF`, `DSPLOG`; F14/F24, Attn/Sys Req, mandatory enter/fill del FFW.
- **V2 (no de momento, lo dijo el usuario el 2026-11-24):** tn5250 (y tn3270 para SDSF) sobre el mismo motor de `blockterm`, con su lado back; cambio de sistema (cluster) desde dentro.

## 5. Riesgos del plan

- **S1 toca un producto publicado.** Si el e2e de SDSF no pasa sin tocar los specs, el S1 no se cierra.
- **Primera DCE en el manifest de jfvilas** (S1): si el marketplace no la instala desde ahí, hace falta un cambio en el core. Eso es de otra sesión; se avisa y no se toca desde aquí.
- **DCE sin watch:** cada cambio en `blockterm` = `npm run build` a mano, grep en `dist`, reinicio del back, y solo entonces el QA.
