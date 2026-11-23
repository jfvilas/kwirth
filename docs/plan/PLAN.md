# WRKACTJOB — plan y backlog

> **ESTADO — EN CURSO** (2026-11-23). PLAN aprobado. **Hecho el S0** (DCE `blockterm`, commit `6848a35` en
> su repo; `0.1.0` publicada en npm). **Hecho el S1** (SDSF 0.11.0 sobre la DCE, publicado). **Hecho el S2**
> (`blockterm` 0.2.0, commit `654928c`; QA y tipos validados; ⚠️ **sin publicar**: el clasificador de permisos
> bloqueó el `npm publish`; publicada después, con el OK explícito del usuario). **Hecho el S3** (scaffold y back,
> commit `6ee2b21`). **S4: código hecho** (commit `b407576`), pendiente del QA del usuario. Cuelga del [PRD](PRD.md) y no repite ni su problema ni sus decisiones de
> producto (D1–D11).
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
  - **Fuera del S2 (backlog):** Attn y Sys Req (no son AID: necesitan una vía de «señal de sesión» que se decide con los paneles), la AID Help sin tecla (F1 es F1; en IBM i, F1 ya es la ayuda), y mandatory enter/fill del FFW (WRKACTJOB no los usa). ⚠️ Los códigos de error de operador `0005`, `0010`, `0012` y `0019` hay que contrastarlos con capturas reales (D11 del PRD).

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

**S6 — e2e, README y publicación.**
- e2e propio (namespace `wrkactjob-e2e` que crea y borra; sin coincidir con el e2e de SDSF, que borra el suyo).
- README de GitHub con capturas (como SDSF); docs.
- **Publicación** (gate): `blockterm` 0.2.0, luego `wrkactjob` 0.1.0, manifest de jfvilas, tags y subtree.

## 4. Backlog (después del MVP)

- **Fase 3:** `WRKSBS` (namespaces), `DSPMSG QSYSOPR` (events Warning), `WRKJOBQ` / `WRKJOBSCDE` (Jobs pendientes y CronJobs), `WRKSYSSTS` (nodos y uso del cluster).
- **V2:** tn5250 (y tn3270 para SDSF) sobre el mismo motor de `blockterm`, con su lado back; cambio de sistema (cluster) desde dentro.

## 5. Riesgos del plan

- **S1 toca un producto publicado.** Si el e2e de SDSF no pasa sin tocar los specs, el S1 no se cierra.
- **Primera DCE en el manifest de jfvilas** (S1): si el marketplace no la instala desde ahí, hace falta un cambio en el core. Eso es de otra sesión; se avisa y no se toca desde aquí.
- **DCE sin watch:** cada cambio en `blockterm` = `npm run build` a mano, grep en `dist`, reinicio del back, y solo entonces el QA.
