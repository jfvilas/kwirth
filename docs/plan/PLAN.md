# SDSF — plan y backlog

> **ESTADO — EN CURSO** (2026-11-22). Validado por el usuario. **S0, S1 y S2 hechos**, pendientes de QA;
> siguiente, el S3. Cuelga del [PRD](PRD.md) y no repite ni su problema ni sus decisiones de producto
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

**S3 — Menú y DA**
- Menú principal (RF2c).
- Panel DA (RF2b, D8) con scroll vertical (PF7/PF8 e importe de SCROLL) y horizontal (PF10/PF11).
- Comandos primarios (RF6): `PREFIX`, `DEST`, `OWNER`, `SORT`, `FIND`/`RFIND`, `TOP`/`BOTTOM`, `&nn`,
  `RETRIEVE` y los equivalentes escritos de las PF (R2).
- Mensajes cortos y largos (RF8); métricas y aviso amarillo (D6).

**S4 — Comandos de línea**
- `?` lleva al panel de contenedores.
- `S` abre el browse del log, con FIND, PF7/PF8, M+PF8 y PF3, y vuelve al DA en la misma posición.
- `D` abre el browse del describe.
- `C`/`CA` abren el pop-up `CONFIRM ACTION` (R4); varias líneas marcadas se ejecutan con un solo
  Enter; sin permiso, `NOT AUTHORIZED`.

**S5 — e2e, documentación y publicación**
- e2e de Playwright con los criterios de aceptación 1–8 del PRD. Es no destructivo: crea su propio
  Deployment de prueba y lo borra al acabar.
- README del plugin, entrada en el `manifest.json` raíz (con `tags`), fila en el README raíz de jfvilas,
  gate y publicación en npmjs con `.npmrc-jfvilas`.
- El README que se ve en GitHub lleva una **sección de capturas** de SDSF ya completo: el menú, el DA, el
  browse de un log, la confirmación de cancelar y la pantalla completa con la OIA. Se hacen sobre el k3d
  de pruebas, sin hosts internos ni datos reales.

## 4. Backlog (fuera del MVP)

- **V2:** `SYSNAME` para cambiar de cluster desde dentro (D10).
- **V2:** servidor tn3270 para emuladores reales (D11). Lo delicado es el puerto TCP: Kwirth solo da
  HTTP/WebSocket a los plugins, así que hay que decidir si va en el plugin, en un router o como Service
  aparte.
- **Fase 2:** `LOG` (events, desde el provider `events`), `ST`/`O`/`H` (Jobs y CronJobs) e `INIT` (nodes).
- **Fase 3:** `X`, exec en el contenedor, como una sesión TSO.
