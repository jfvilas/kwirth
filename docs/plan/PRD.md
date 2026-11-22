# SDSF — un SDSF de z/OS sobre Kubernetes, en una 3270 de 32x80 · PRD

> **ESTADO — DEFINICIÓN CERRADA** (2026-11-22). Decisiones D1–D11 cerradas con el usuario. Abiertos A1–A4
> cerrados.
>
> Documento de definición de producto. **Previo al diseño técnico**: describe qué tiene que pasar y por
> qué, no cómo se implementa. El desglose en fases/streams vivirá en `PLAN.md`, junto a este documento.
>
> Plugin **OSS**: `@jfvilas/kwirth-plugin-sdsf`. Se trabaja en `~/github/kwirth/plugins/sdsf`, un repo anidado
> sin remoto y gitignorado en el core, como depthcharge. Se publica en github.com/jfvilas/kwirth
> (`plugins/sdsf/`, rama master) con `git subtree`. npm
> público y marketplace `manifest.json` raíz de jfvilas. Producto y UI en inglés.

---

## 1. Resumen ejecutivo

Un canal de Kwirth que **es** una sesión de SDSF en una terminal IBM 3278 modelo 3 (32 filas x 80
columnas), con la font 3270 y los colores de la 3270. Pero lo que se ve no son address spaces de z/OS,
sino **pods de Kubernetes**.

El operador de mainframe encuentra lo que se sabe de memoria: `DA` lista lo que corre, `PREFIX` filtra,
`S` delante de una línea abre su salida y `C` lo cancela. PF3 vuelve, PF7/PF8 paginan y la pantalla se
refresca al pulsar Enter. El operador de Kubernetes encuentra un `kubectl get pods` con teclado y
sin escribir los nombres de los pods.

**Criterio de éxito.** Alguien que ha usado SDSF abre la pestaña y, sin leer nada, consigue tres cosas:
1. encontrar sus pods con `PREFIX`;
2. leer el log de uno con `S`;
3. matar otro con `C`.

Y además la captura de pantalla se puede confundir con una sesión real de x3270.

### Qué NO es

| No es | Qué es en realidad |
|---|---|
| Un emulador tn3270 (en V1) | En V1 no habla protocolo 3270: **imita** la pantalla en el navegador, y los datos salen del API de Kubernetes vía Kwirth. **Servir tn3270** a emuladores reales (x3270, PCOMM) queda para la **V2** (D11) |
| Un clon de SDSF completo | Imita los paneles que tienen equivalente en Kubernetes. Lo que no lo tiene (JES2, spool, initiators de JES) no se inventa |
| Un sustituto de magnify o de log | Es **otra forma de mirar** lo mismo, pensada para el teclado y para la nostalgia útil |

---

## 2. El problema

1. **La gente de mainframe que llega a Kubernetes** no tiene ningún punto de apoyo: todas las
   herramientas son o CLI de Unix o consolas web con ratón. SDSF es su herramienta de cada día, y su
   modelo (lista de trabajos, comandos de línea, salida por pasos) encaja casi uno a uno con los pods.
2. **Operar con el teclado** es más rápido que con el ratón, y en Kwirth no hay ninguna vista de pods
   que se maneje entera con el teclado.
3. **Escaparate.** Un SDSF fiel sobre Kubernetes es una demo que se recuerda y se comparte.

## 3. Personas

- **Operador z/OS** que empieza con Kubernetes: lo que busca es reconocer la pantalla.
- **SRE de Kubernetes** con poco tiempo: lo que busca es velocidad de teclado.
- **Público de demo** (LinkedIn, ferias): lo que busca es fidelidad visual.

## 4. Objetivos y no-objetivos

**Objetivos**
- La pantalla es fiel: 32x80, la font 3270, los 7 colores de la 3270 + el color por defecto,
  campos protegidos y sin proteger, cursor de bloque, OIA bajo la fila 32 y bloque de teclado
  (`X SYSTEM`).
- El modelo de interacción es fiel: **block mode**. La pantalla solo cambia al pulsar una tecla AID
  (Enter, PFnn, PA1, Clear), salvo con el auto-refresco `&` de SDSF.
- Los paneles SDSF tienen su mapeo a Kubernetes (§5).
- Todo se hace con el teclado.

**No-objetivos**
- Protocolo tn3270 real, LU2, EBCDIC en el cable, **en V1**. Pasa a V2 (D11).
- Ratón más allá de colocar el cursor con un clic (lo que hace x3270).
- Modelos 2, 4 y 5. Solo el modelo 3 (32x80), por decisión D2.
- Configurar colores en el MVP: va el esquema clásico fijo (§6).

## 5. Conceptos: el mapeo z/OS → Kubernetes

| SDSF / z/OS | Kubernetes |
|---|---|
| Sistema (SYSNAME) | Cluster de Kwirth |
| Address space / job | **Pod** |
| JOBNAME | Nombre del pod (8 caracteres visibles en la columna; el nombre completo con scroll a la derecha y en la columna larga) |
| StepName / ProcStep | Contenedor / init container |
| JobID (`STC12345`, `JOB…`) | `POD`, `JOB` o `STS` + los 5 últimos dígitos derivados del uid (estable por pod) |
| Owner | serviceAccount |
| C (job class) | QoS class (`G`uaranteed, `B`urstable, `E` besteffort) |
| Pos / Status | Phase y reason (`IN`, `NS`, `CRLB`…) |
| DP (dispatching priority) | priorityClass |
| Real | Memoria en uso (Mi) |
| CPU% | CPU en uso / límite |
| SIO, EXCP | Reinicios |
| PREFIX | Filtro de nombre de pod con comodines `*` y `%` |
| DEST | Namespace (`DEST=(ALL)` = todos) |
| SYSOUT de un job (`S`) | Log del contenedor, en un panel de browse ODS |
| `?` (data sets del job) | Lista de contenedores del pod; `S` en uno abre su log |
| Cancel (`C`) | Borrar el pod (`CA` = borrar con grace 0) |
| Display (`D`) | Describe del pod, como mensajes en browse |
| SYSLOG / `LOG` | Events del cluster (fase 2) |
| `ST`, `O`, `H` | Jobs y CronJobs (fase 2) |
| `INIT` | Nodes (fase 2) |

## 6. Requisitos funcionales

**RF1 — Pantalla.** Rejilla de 32x80 celdas monoespaciadas con la font **3270font** (rbanffy, embebida
en el plugin con su licencia). Escala entera o fraccional para ocupar la pestaña sin deformar la
proporción. Fondo negro.

**RF2 — Atributos.** Cada campo tiene estas propiedades:
- protegido o no;
- intensidad: normal, alta u oculta;
- color extendido: azul, rojo, rosa, verde, turquesa, amarillo o blanco;
- highlight: reverse, underscore o blink.

El esquema por defecto sale de las capturas de `reference/` (A1, cerrado):

| Elemento | Color |
|---|---|
| Fondo | Negro |
| Barra de acciones (`Display Filter View Print Options Search Help`) | Blanco, con la letra mnemónica subrayada |
| Separador bajo la barra (fila 2, guiones a todo el ancho) | Azul |
| Línea de título (`SDSF DA …`, `LINE 1-12 (12)`) | Blanco |
| `COMMAND INPUT ===>` y `SCROLL ===>` | Blanco |
| Lo que escribe el usuario en el comando, en `NP` y en `SCROLL` (`PAGE`, `CSR`) | **Rojo** |
| Línea de filtros (`PREFIX=… DEST=(ALL) OWNER=* SYSNAME=*`) | Turquesa |
| Cabeceras de columna | Turquesa; `NP` en azul |
| Datos de identidad (JOBNAME, JobID, Owner) | Azul claro |
| Estados "buenos" (`LOCAL`, `HOLD`, la cola) | Verde |
| Valores que llaman la atención (prioridad alta, afinidad, error) | Rojo |
| Valores neutros de estado (`EXECUTION`) | Blanco |
| Menú principal | Códigos (`DA`, `ST`…) en turquesa, descripciones en azul |
| Línea de teclas PF (`F1=HELP F2=SPLIT F3=END …`, con PFSHOW ON) | Blanco (así salen en `sdsf.png` y `sdsf-status-l.jpg`), en las dos últimas filas |

La paleta concreta (los hex de cada color 3270) es la de x3270, con el azul aclarado como en las
capturas, porque el azul puro no se lee sobre negro.

**RF2b — Disposición de los paneles** (calcada de `image-43.jpg` y `sdsf.png`):

| Fila | Contenido |
|---|---|
| 1 | Barra de acciones |
| 2 | Separador |
| 3 | Título: `SDSF DA <cluster> <ns>  PAG 0  CPU/L/Z nn/ nn/ n  LINE a-b (n)` |
| 4 | `COMMAND INPUT ===>` … `SCROLL ===> PAGE` |
| 5 | Filtros activos (si los hay) |
| 6 | Cabeceras de columna |
| 7 a 30 | Datos |
| 31 y 32 | Teclas PF |

**RF2c — Menú principal.** Al abrir el canal aparece el `SDSF PRIMARY OPTION MENU` (`sdsf-status-l.jpg`).
Está adaptado a Kubernetes:
- `DA` lleva a los pods.
- `ST`, `LOG` e `INIT` van a la fase 2.
- `END` sale del canal.

Las opciones sin equivalente en Kubernetes no aparecen. Las de fase 2 se ven, pero responden
`NOT AVAILABLE` en rojo.

**RF3 — OIA.** La línea de estado va bajo la fila 32, como en x3270. Lleva:
- el indicador `4A`;
- el bloqueo `X SYSTEM` mientras se espera respuesta;
- el modo inserción;
- la posición del cursor `fila/columna`.

**RF3b — Pantalla completa.** Un modo de pantalla completa, que se activa y desactiva con una tecla y
con el botón de la pestaña. Así la pestaña es una 3270 de verdad: fondo negro de borde a borde, nada de
la UI de Kwirth, y las 32x80 escaladas al máximo sin deformarse y centradas. Debajo va la línea de
estado (OIA), con:
- el bloqueo o estado del teclado;
- el modo inserción;
- la posición del cursor en formato `fila/columna`, por ejemplo `02/021` como en PCOMM, que se actualiza con cada
  movimiento del cursor.

**RF4 — Teclado.**

| Tecla 3270 | Tecla de PC |
|---|---|
| Enter (la tecla AID, la que envía la pantalla) | **Ctrl derecho**, como en PCOMM y x3270 con teclado de PC |
| PF1–PF12 | F1–F12 |
| PF13–PF24 | Shift+F1–F12 |
| PA1 | Alt+1 |
| Clear | Esc |
| Erase EOF | Fin |
| Ins/Del, Home, Tab/Backtab entre campos sin proteger | Las suyas |
| Newline (cursor al primer campo sin proteger de la línea siguiente; no envía nada) | **Intro**, la del teclado principal y la del numérico |

Las teclas se capturan en el elemento de la pestaña, nunca en `window`, para no robárselas al resto de
Kwirth.

**RF5 — Panel `DA`** (el del MVP). Tiene esta disposición:
- la barra de acciones;
- la línea de título `SDSF DA <cluster>  <ns>  PAG 0  CPU/L …  LINE 1-n (total)`;
- `COMMAND INPUT ===>` con `SCROLL ===> PAGE`;
- las cabeceras;
- una línea por pod, con la columna `NP` de entrada para los comandos de línea.

Se puede desplazar horizontalmente (PF10/PF11) por las columnas que no caben en 80.

**RF6 — Comandos primarios.**
- `DA`, `PREFIX <patrón>`, `OWNER <sa>`, `DEST <ns>` (namespace, `(ALL)` = todos), `SORT <col> A|D`,
  `FILTER`, `FIND` / `RFIND` (PF5).
- `TOP` y `BOTTOM`; `UP`/`DOWN` con importe (`PAGE`, `HALF`, `CSR`, `n`).
- `&nn` es el auto-refresco cada nn segundos, y `&` lo detiene.
- `?` muestra la ayuda.
- `RETRIEVE` (PF12) recupera el último comando.

**RF7 — Comandos de línea del MVP.**
- `S` abre el browse del log. Es el panel ODS, con FIND, PF7/PF8 y M+PF8 para ir al final, y PF3 vuelve.
- `?` lista los contenedores.
- `D` muestra el describe.
- `C`/`CA` cancela. Pide confirmación en un pop-up 3270 (`CONFIRM ACTION`), como SDSF con
  `SET CONFIRM ON`. Con varias líneas marcadas, se ejecutan todas al pulsar Enter.

**RF8 — Mensajes.** El resultado de cada acción aparece arriba a la derecha (`COMMAND ISSUED`,
`NO ROWS MATCH`), como el short message de ISPF. PF1 sobre el mensaje abre su versión larga.

**RF9 — Autorización.** La decide el **canal** a partir del accessKey de Kwirth. Sin permiso de borrar,
`C` responde `NOT AUTHORIZED` en rojo y no hace nada.

**RF10 — Estado persistente.** La sesión vive en `channelObject.data`, no en React. Al cambiar de pestaña
y volver, se conservan el panel, el scroll, el PREFIX y el campo de comando.

## 7. Decisiones cerradas

- **D1** — OSS en github.com/jfvilas/kwirth, scope `@jfvilas`. Sin dependencias de `@iriaoperae`.
- **D2** — Terminal IBM 3278 **modelo 3, 32x80**, sin elegir otros modelos.
- **D3** — Font **3270font** de rbanffy, embebida en el plugin junto a su fichero de licencia.
- **D4** — MVP = `DA` + `S` (log) + `C`/`CA` + `D` + `?`. `LOG`, `ST`/`O`/`H` e `INIT` van a la fase 2,
  y `X` (exec en el contenedor, como una TSO session) a la fase 3.
- **D5** — Block mode estricto. Los datos no se mueven solos; refrescar es pulsar Enter o usar `&nn`.
  Es lo fiel, y además hace que leer una lista larga sea estable.
- **D6** — **Las métricas (`Real`, `CPU%` y `CPU/L` del título) salen del provider `metrics` de
  Kwirth.** No se leen del metrics-server ni de ninguna otra fuente propia. El canal lo consume con el
  contrato de providers: lo declara, se suscribe cuando el core avisa de que los providers están
  listos y se da de baja al parar. Pods, logs, borrado y describe salen de la API del cluster, con las
  utilidades del core.

  El provider es **dependencia opcional** (`uses`, nunca `requires`), porque Kwirth no corre siempre
  sobre Kubernetes. Sin él, el canal funciona igual, pero las columnas de métricas salen como `-` y un
  aviso **visible** en amarillo dice `METRICS PROVIDER NOT AVAILABLE`. Un número quieto que parece real
  es peor que un hueco.
- **D7** — Nombre visible **SDSF**, id `sdsf`. Es la sigla (System Display and Search Facility) y el
  nombre del producto, sin más rodeos. No lleva logos ni copyright de terceros en pantalla.
- **D8** — Columnas del `DA`, en este orden y calcadas de la captura de un DA real:
  `NP JOBNAME StepName ProcStep JobID Owner C Pos DP Real Paging SIO`. La columna `SIO` lleva los
  reinicios, y `Paging` sale como `0.00`, porque Kubernetes no pagina. A la derecha, con PF11, van
  `CPU%`, `PodName` (el nombre completo), `Node` y `Age`. *(Al construirlo, el 2026-11-22, se añadieron
  `Status` y `Namespace`. Quedan dos páginas: `CPU% Status Node Age` y `Namespace PodName`. Sin Status no
  se ve por qué falla un pod, y sin Namespace no se distinguen los pods con `DEST=(ALL)`.)*
- **D9** — **Emulación pura de una 3278-3**: no hay teclado PF en pantalla. Se usa solo el teclado
  físico.
- **D10** — En V1 el canal trabaja sobre **el cluster seleccionado en la cluster list** de Kwirth. El
  nombre de ese cluster sale en el título, en el sitio del SYSNAME. Cambiar de cluster desde dentro
  con `SYSNAME` queda para la **V2**. Por eso el namespace se filtra con `DEST`, no con `SYSNAME`.
- **D11** — **V2: SDSF sirve tn3270**, para que un emulador real (x3270, PCOMM, Vista) se conecte a él.
  Hace falta:
  - telnet con TERMINAL-TYPE `IBM-3278-3-E`, BINARY y EOR;
  - el data stream 3270 (Erase/Write, WCC, SBA, SF/SFE, SA, IC; Read Modified de vuelta) en EBCDIC CP037;
  - una pantalla de logon propia, porque tn3270 no autentica (la access key de Kwirth);
  - un puerto TCP expuesto en el Service.

  En V1 **solo se deja la puerta abierta, sin coste**:
  - el motor 3270 y los paneles viven en `src/common`, sin DOM;
  - el buffer modela la 3270 de verdad: el byte de atributo ocupa su posición;
  - los colores, highlights y AID llevan sus códigos reales del data stream.

  El servidor sería un codificador más sobre el mismo motor.

## 8. Lo que hay que decir en voz alta

- **R2 — Teclas del navegador.** No todas se dejan capturar. F5 y F1 sí, con `preventDefault`. F11 y F12
  dependen del navegador, y en Electron/Tauri van bien. Ctrl+W y Ctrl+T no se pueden capturar nunca.
  No hay teclado en pantalla (D9). Para las PF que el navegador no deje capturar, la vía es la
  equivalencia de ISPF: escribir el comando en `COMMAND INPUT`, por ejemplo `END` = PF3, `DOWN` = PF8
  o `RIGHT` = PF11. En pantalla completa y en el escritorio (Electron/Tauri) se capturan todas.
- **R3 — 8 caracteres.** Los nombres de pod son largos (`api-7d9f8b6c4-x2kq9`). Si se truncan a 8 como
  JOBNAME, quedan ambiguos. La columna JOBNAME de 8 es lo fiel; el nombre completo está en la columna
  `PodName` (con PF11) y en el título del browse.
- **R4 — `C` es destructivo.** Borra pods de verdad. Por eso la confirmación va activa por defecto y no
  se puede desactivar en el MVP.
- **R5 — "Fiel" es subjetivo.** Se resuelve con las capturas de `reference/` (A1): el RF2 está sacado
  de ellas, y la comparación se hace contra ellas.

## 9. Criterios de aceptación (MVP)

1. La pestaña muestra exactamente 32x80 celdas más la OIA, con la font 3270, en claro y en oscuro (el
   terminal es siempre negro).
2. `PREFIX api*` + Enter deja solo los pods que empiezan por `api`, y el título dice `LINE 1-n (n)`.
3. `S` en un pod abre su log; PF8 pagina, `F error` + PF5 busca, PF3 vuelve a `DA` en la misma posición.
4. `C` en un pod pide confirmación. Al confirmar, el pod se borra y aparece `COMMAND ISSUED`; tras Enter,
   la lista muestra el pod nuevo del ReplicaSet.
5. Sin permiso, `C` da `NOT AUTHORIZED` y no borra nada.
6. Al cambiar de pestaña y volver, la sesión sigue igual.
7. En pantalla completa solo se ve la terminal, sin nada de Kwirth. La OIA está debajo y la posición
   del cursor que muestra cambia al moverlo con las flechas, con Tab o con un clic.
8. Nada del teclado se escapa al resto de Kwirth mientras la pestaña tiene el foco.

## 10. Abierto

- **A1** — ~~Capturas de referencia~~ **CERRADO** (2026-11-22). Están en `docs/plan/reference/`. Son
  capturas públicas con copyright de terceros, así que la carpeta está en el `.gitignore` y **no se
  commitea**. Falta una del pop-up de confirmación de cancelar; mientras no llegue, se hace con el
  estilo ISPF estándar.
- **A2** — Columnas del `DA`. **CERRADO**: ver D8.
- **A3** — Teclado PF en pantalla. **CERRADO**: no hay; es emulación pura de una 3278-3 (D9).
- **A4** — Cluster. **CERRADO**: el seleccionado en la cluster list; `SYSNAME` queda para la V2 (D10).
