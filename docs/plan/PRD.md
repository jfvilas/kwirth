# WRKACTJOB — un WRKACTJOB de IBM i (AS/400) sobre Kubernetes, en una 5250 · PRD

> **ESTADO — DEFINICIÓN CERRADA** (2026-11-23). Decisiones D1–D11 cerradas con el usuario; los abiertos
> A1–A8 se aceptaron tal cual se propusieron y pasaron a D4–D11. Las capturas de referencia (D11) se
> descartaron el 2026-11-24: no hacen falta. Producto entregado: ver [PLAN](PLAN.md), cerrado.
> **Fase 3 (más comandos de IBM i):** [PRD-fase3.md](PRD-fase3.md), definición cerrada (D12–D18).
>
> Documento de definición de producto. **Previo al diseño técnico**: describe qué tiene que pasar y por
> qué, no cómo se implementa. El desglose en fases/streams vivirá en `PLAN.md`, junto a este documento.
>
> Plugin **OSS**: `@jfvilas/kwirth-plugin-wrkactjob`. Hermano de SDSF (`plugins/sdsf/docs/plan/PRD.md`):
> lo que allí es z/OS sobre una 3270, aquí es IBM i sobre una 5250. Se trabaja en
> `~/github/kwirth/plugins/wrkactjob`, un repo anidado sin remoto y gitignorado en el core. Se publica en
> github.com/jfvilas/kwirth (`plugins/wrkactjob/`, rama master) con `git subtree`. npm público y
> marketplace `manifest.json` raíz de jfvilas. Producto y UI en inglés.

---

## 1. Resumen ejecutivo

Un canal de Kwirth que **es** una sesión de IBM i en una terminal 5250, con su pantalla verde, sus campos
subrayados y su línea de mensajes abajo. El primer panel, y el que da nombre al producto, es
`WRKACTJOB` (Work with Active Jobs). Lo que se ve no son jobs de IBM i, sino **pods de Kubernetes**,
agrupados por **namespace** como los jobs se agrupan por **subsistema**.

El operador de AS/400 encuentra lo que se sabe de memoria: la lista `Subsystem/Job`, un `4` delante de
un job para terminarlo, un `5` para trabajar con él, `F5` para refrescar, `F3` para salir. El operador de
Kubernetes encuentra un `kubectl get pods -A` agrupado por namespace y manejable solo con el teclado.

**Criterio de éxito.** Alguien que ha usado un AS/400 abre la pestaña y, sin leer nada, consigue:
1. encontrar un pod en la lista por su subsistema (namespace);
2. leer su log con `5` → spooled files (o `8`) → `5`;
3. terminar otro con `4`, eligiendo `*CNTRLD` o `*IMMED`.

Y además la captura de pantalla se puede confundir con una sesión real de PCOMM o ACS.

### Qué NO es

| No es | Qué es en realidad |
|---|---|
| Un emulador tn5250 (en V1) | En V1 **imita** la pantalla en el navegador; los datos salen del API de Kubernetes vía Kwirth. Servir tn5250 a emuladores reales queda para la **V2**, como tn3270 en SDSF |
| Un IBM i completo | Imita los paneles y comandos CL que tienen equivalente en Kubernetes. Lo que no lo tiene (bibliotecas, DB2, colas de datos) no se inventa |
| Un sustituto de magnify o de SDSF | Es **otra forma de mirar** lo mismo, para otra comunidad |

---

## 2. El problema

1. **La gente de IBM i que llega a Kubernetes** tiene el mismo problema que la de z/OS, pero es una
   comunidad aparte: no usa SDSF, usa `WRKACTJOB`. Su modelo (subsistemas que contienen jobs, opciones
   numéricas en la columna `Opt`, status de cuatro letras) encaja casi uno a uno con namespaces y pods.
2. **Operar con el teclado** sigue sin tener equivalente en Kwirth fuera de SDSF.
3. **Escaparate.** La "pantalla verde" es el icono más reconocible del AS/400; junto con SDSF, Kwirth
   habla los dos dialectos de IBM.

## 3. Personas

- **Operador de IBM i** que empieza con Kubernetes: busca reconocer la pantalla.
- **SRE de Kubernetes** con poco tiempo: busca velocidad de teclado.
- **Público de demo** (LinkedIn, ferias): busca fidelidad visual, y la pareja SDSF + WRKACTJOB.

## 4. Objetivos y no-objetivos

**Objetivos**
- Pantalla fiel de 5250: 24x80 (y 27x132), campos de entrada **subrayados**, colores de la 5250, línea
  de mensajes en la fila 24, OIA de 5250 debajo (`X II` y similares).
- Modelo de interacción fiel: **block mode**. La pantalla solo cambia al pulsar una tecla AID (Enter,
  Fnn, Roll Up/Down, Help, Clear).
- `WRKACTJOB` con su mapeo a Kubernetes (§5) y las opciones que lo tienen.
- Todo con el teclado.
- **Un solo motor de terminal** para SDSF y WRKACTJOB, en una DCE (D3).

**No-objetivos**
- Protocolo tn5250, EBCDIC en el cable, **en V1**.
- Una pantalla de sign-on con usuario y contraseña: la autenticación es la de Kwirth.
- Ratón más allá de colocar el cursor con un clic.
- Colores configurables en el MVP.

## 5. Conceptos: el mapeo IBM i → Kubernetes

| IBM i | Kubernetes |
|---|---|
| Sistema (nombre arriba a la derecha) | Cluster de Kwirth seleccionado |
| Subsistema (`QBATCH`, `QINTER`…), fila tipo `SBS` | **Namespace** |
| Job | **Pod**, sangrado bajo su subsistema |
| Nombre del job (10 caracteres) | Nombre del pod (10 visibles; el completo en otra vista con F11) |
| User | serviceAccount |
| Type | Tipo según el controlador (D6) |
| CPU % | CPU en uso, del provider `metrics` |
| Function (`PGM-xxx`) | `PGM-` + la imagen del contenedor principal, sin registry ni tag |
| Status (`RUN`, `DEQW`, `MSGW`, `END`…) | Phase y reason (D7) |
| Pool / Pty | Nodo / priorityClass |
| Thread | Contenedor |
| `4=End` → `ENDJOB OPTION(*CNTRLD) DELAY(30)` | Borrar el pod con grace = DELAY; `*IMMED` = grace 0 |
| `5=Work with` → `WRKJOB` | Menú del pod: status, definición, spooled files, job log |
| Spooled files (`WRKSPLF`) | Contenedores del pod; `5=Display` abre su log en `DSPSPLF` |
| Job log (`DSPJOBLOG`) | Events del pod |
| `7=Display message` (job en `MSGW`) | Por qué falla: reason + último mensaje de terminación |
| `QSYSOPR` (`DSPMSG QSYSOPR`) | Events Warning del cluster (fase 2) |
| `WRKSBS` | Namespaces, con número de pods (fase 2) |
| `WRKJOBQ` / `WRKJOBSCDE` | CronJobs y Jobs pendientes (fase 2) |
| `WRKSYSSTS` | Estado del cluster: nodos, CPU, memoria (fase 2) |

## 6. Requisitos funcionales

**RF1 — Pantalla.** Rejilla monoespaciada de 24x80 (modelo 3179-2/3477) o 27x132 (3477-FC, modo
ancho), elegida en el setup como en SDSF. Fondo negro. Font: la de la DCE (D3).

**RF2 — Atributos 5250.** Cada campo tiene: entrada o salida; intensidad normal, alta u oculta
(no-display); color (verde, blanco, rojo, turquesa, amarillo, rosa, azul); subrayado, reverse, blink y
separadores de columna. **Los campos de entrada van subrayados** (es lo que hace reconocible una 5250).
En 5250 el atributo ocupa una posición en pantalla, igual que en 3270: el motor lo modela así.

El esquema de colores de la pantalla estándar de IBM i:

| Elemento | Color |
|---|---|
| Título del panel (`Work with Active Jobs`) | Blanco |
| Nombre del sistema, fecha y hora | Blanco |
| Textos de ayuda (`Type options, press Enter.`) | Azul |
| Leyenda de opciones (`4=End  5=Work with…`) | Azul |
| Cabeceras de columna | Blanco |
| Datos | Verde |
| Campos de entrada (`Opt`, línea de comandos) | Verde subrayado |
| Status que piden atención (`MSGW`) | Blanco de alta intensidad (o rojo en color) |
| Teclas de función | Azul |
| Línea de mensajes (fila 24) | Blanco; los de error, blanco en alta intensidad con el teclado bloqueado |
| `More...` / `Bottom` | Blanco |

**RF3 — Disposición de `WRKACTJOB`** (24x80):

| Fila | Contenido |
|---|---|
| 1 | Título centrado `Work with Active Jobs` y, a la derecha, el nombre del sistema |
| 2 | Fecha y hora, a la derecha |
| 3 | `CPU %:  nn.n   Elapsed time:  hh:mm:ss   Active jobs:  nnn` |
| 5–7 | `Type options, press Enter.` y la leyenda de opciones |
| 9 | Cabeceras: `Opt  Subsystem/Job  User  Type  CPU %  Function  Status` |
| 10–19 | Datos (subsistemas y sus jobs sangrados) |
| 19 | `More...` o `Bottom` a la derecha |
| 20–21 | `Parameters or command` / `===>` y el campo de comando |
| 22–23 | Teclas de función |
| 24 | Línea de mensajes |

**RF4 — OIA de 5250.** Bajo la fila 24, como en PCOMM/ACS: estado del teclado (`X II` input inhibited,
`X SYSTEM` esperando), modo inserción y posición `fila/columna`. Pantalla completa como en SDSF.

**RF5 — Teclado.**

| Tecla 5250 | Tecla de PC |
|---|---|
| Enter (la AID) | **Ctrl derecho**, como en SDSF/PCOMM |
| Field Exit | **Intro** (D8) |
| Field+ / Field- | `+` / `-` del teclado numérico |
| F1–F12 / F13–F24 | F1–F12 / Shift+F1–F12 |
| Roll Up / Roll Down (Page Down / Page Up) | AvPág / RePág |
| Reset (quita el bloqueo de error) | **Ctrl izquierdo** |
| Help | F1 |
| Sys Req / Attn | Shift+Esc / Esc |
| Erase Input | Alt+Fin |

Las teclas se capturan en el elemento de la pestaña, nunca en `window`.

**RF6 — Teclas de `WRKACTJOB`.** `F3=Exit`, `F5=Refresh`, `F7=Find`, `F10=Restart statistics`
(pone a cero el `Elapsed time` y las deltas), `F11=Display elapsed data` (rota las vistas de columnas),
`F12=Cancel`, `F14=Include`, `F24=More keys`. Las que no tienen equivalente no aparecen.

**RF7 — Opciones de línea del MVP.** `4=End`, `5=Work with`, `7=Display message`, `8=Work with spooled
files`. Varias opciones en varias líneas se ejecutan en orden al pulsar Enter, como en IBM i.
- `4` muestra el prompt de `ENDJOB` con `OPTION (*CNTRLD)` y `DELAY (30)` editables; Enter lo ejecuta,
  F12 lo cancela. Es la confirmación fiel (no hay pop-up de confirmación en `WRKACTJOB`).
- `5` abre el menú `Work with Job` con las opciones que tienen equivalente (status, definición, spooled
  files, job log).
- `7` solo sobre un job en `MSGW`; si no, `No messages to display for job` en la fila 24.
- `8` lista los contenedores como spooled files; `5` en uno abre `DSPSPLF` con el log (Roll Up/Down,
  `F` para buscar, `B`/`T` para final y principio, F3 vuelve).

**RF8 — Línea de comandos (subconjunto CL).** `WRKACTJOB SBS(ns) JOB(patrón*)`, `WRKJOB JOB(nombre)`,
`ENDJOB JOB(nombre) OPTION(*CNTRLD|*IMMED) DELAY(n)`, `SIGNOFF` (cierra la sesión del canal).
F4 sobre un comando abre su prompt. Un comando desconocido da `Command xxx in library *LIBL not found.`

**RF9 — Mensajes y errores.** Fila 24, como IBM i. Un error (opción no válida, sin permiso) bloquea el
teclado (`X II` en la OIA) hasta pulsar Reset, y coloca el cursor en el campo erróneo, en reverse.

**RF10 — Autorización.** La decide el **canal** a partir del accessKey de Kwirth. Sin permiso de borrar,
`4` responde `Not authorized to end job xxx.` y no hace nada.

**RF11 — Estado persistente.** La sesión vive en `channelObject.data`, como SDSF: al cambiar de pestaña
y volver se conservan el panel, el scroll y lo escrito.

## 7. Decisiones cerradas

- **D1** (2026-11-23, el usuario) — OSS en github.com/jfvilas/kwirth, scope `@jfvilas`, igual que SDSF:
  repo anidado sin remoto en `plugins/wrkactjob`, subida por `git subtree`.
- **D2** (2026-11-23, el usuario) — Nombre visible **WRKACTJOB**, id `wrkactjob`. Es el comando, igual
  que SDSF es la herramienta. Los demás paneles (`WRKSBS`, `DSPMSG`…) viven dentro del mismo plugin.
- **D3** (2026-11-23, el usuario) — **El motor de terminal es común y va en una DCE.** SDSF y WRKACTJOB
  lo consumen; ninguno lleva su copia. La DCE contiene:
  - el motor de block mode sin DOM (buffer con atributos en posición, campos, cursor, AID, OIA), con un
    **dialecto 3270** y un **dialecto 5250**, y sus códigos reales del data stream (puerta abierta a
    tn3270/tn5250 en V2);
  - en el front, el componente de pantalla, la font, las paletas y el mapeo de teclado.

  El motor de SDSF **se mueve** a la DCE y SDSF pasa a consumirla: no conviven dos motores. SDSF tiene
  que seguir pasando su e2e igual que hoy tras la migración.

## 8. Lo que hay que decir en voz alta

- **R1 — Tocar SDSF.** D3 obliga a migrar un producto publicado (0.10.0) antes de que WRKACTJOB tenga
  nada propio. Es el primer stream del PLAN y su validación es el e2e de SDSF sin cambios.
- **R2 — Las DCE no tienen watch** y el core las carga una vez al arrancar: cada cambio del motor es
  build a mano + reinicio del back. Y el mapeo de DCE devuelve la **instancia**: los enums del contrato
  no llegan en runtime (hay que declararlos en el consumidor). El motor tiene muchos enums (colores,
  AID, atributos): el contrato de la DCE se tiene que diseñar para eso.
- **R3 — 5250 no es 3270 con otra paleta.** Cambian el subrayado de los campos de entrada, Field Exit /
  Field+/-, el bloqueo de error con Reset, la línea de mensajes y los separadores de columna. El motor
  común tiene que modelarlo, no parchearlo.
- **R4 — 10 caracteres.** Los nombres de pod no caben en el `Job` de 10; la vista completa va con F11.
- **R5 — `4` es destructivo.** Borra pods de verdad. El prompt de `ENDJOB` hace de confirmación.
- **R6 — Teclas del navegador.** Las mismas limitaciones que SDSF (R2 de su PRD); Shift+F11/F12 y
  AvPág/RePág se capturan bien.

## 9. Criterios de aceptación (MVP)

1. La pestaña muestra 24x80 (o 27x132) más la OIA, con campos de entrada subrayados, en claro y en
   oscuro (la terminal siempre es negra).
2. `WRKACTJOB` lista los namespaces como subsistemas `SBS` y sus pods sangrados debajo; `Active jobs`
   cuadra con el número de pods visibles.
3. `WRKACTJOB SBS(kube-system)` deja solo ese subsistema.
4. `8` en un pod → `5` en un contenedor abre su log; Roll Up/Down pagina, F3 vuelve a la misma posición.
5. `4` en un pod abre el prompt de `ENDJOB`; con Enter el pod se borra y, tras `F5`, aparece el nuevo del
   ReplicaSet. Con `*IMMED` se borra con grace 0.
6. Sin permiso, `4` da `Not authorized…`, bloquea el teclado y Reset lo libera.
7. `9` en un pod da `Option 9 not valid.` en la fila 24 con el teclado bloqueado.
8. Al cambiar de pestaña y volver, la sesión sigue igual.
9. SDSF, ya sobre la DCE, pasa su e2e sin cambios en los specs.
10. Nada del teclado se escapa al resto de Kwirth mientras la pestaña tiene el foco.

Cerradas el 2026-11-23, el usuario ("ok a todo"), tal como se propusieron en A1–A8:

- **D4** (era A1) — **La DCE es `blockterm`**: `@jfvilas/kwirth-dce-blockterm`, "Block Terminal". Scope
  `@jfvilas`, publicada en jfvilas/kwirth (`dces/blockterm/`), porque sus dos consumidores son `@jfvilas`.
- **D5** (era A2) — **Arranque**: el canal abre directamente en `WRKACTJOB`; F3 lleva al `IBM i Main
  Menu` adaptado (como el primary option menu de SDSF), donde están los demás comandos. Sin sign-on.
- **D6** (era A3) — **Columna Type**: `SBS` el namespace; `ASJ` (autostart) los pods de Deployment y
  StatefulSet; `BCH` los de Job/CronJob; `SYS` los de DaemonSet; `BCI` los pods sueltos.
- **D7** (era A4) — **Columna Status**: Running con CPU → `RUN`; Running sin CPU → `DEQW`; Pending →
  `SCDW`; CrashLoopBackOff, ImagePullBackOff, Error, OOMKilled → **`MSGW`**; Terminating → `END`.
- **D8** (era A5) — **Teclado**: Intro = Field Exit y Ctrl derecho = Enter, igual que SDSF.
- **D9** (era A6) — **Vistas de F11**: (1) `User Type CPU % Function Status`; (2) `Type Pool Pty CPU
  AuxIO` = nodo, priorityClass, CPU acumulada, reinicios; (3) `Namespace` + nombre completo del pod.
- **D10** (era A7) — **Setup**: modelo `3179-2 (24x80)` (por defecto) o `3477-FC (27x132)`, y `Colour`
  (por defecto) o `Green monochrome (5251)`. Va en el `instanceConfig`, como D12 de SDSF.
- **D11** (era A8) — **Capturas de referencia** en `docs/plan/reference/`, gitignorada y nunca commiteada.
  Hacen falta capturas reales de `WRKACTJOB` (24x80 y 27x132), del prompt de `ENDJOB`, de `WRKJOB` y de
  `DSPSPLF`. Hasta que lleguen, el RF2/RF3 manda.

## 10. Abierto

Nada. Las capturas de D11 se descartaron (2026-11-24).
