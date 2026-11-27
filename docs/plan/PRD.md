# Task Manager — el Administrador de tareas de Windows XP sobre Kubernetes · PRD

> **ESTADO — DEFINICIÓN CERRADA** (2026-11-27). A1–A8 del análisis inicial y A1–A4 del PRD cerrados con
> el usuario (D1–D15). Ingeniería en [PLAN.md](PLAN.md): todo construido en una sola entrega 0.1.0, pendiente de QA.
>
> Documento de definición de producto. **Previo al diseño técnico**: describe qué tiene que pasar y por
> qué, no cómo se implementa. El desglose en fases/streams vivirá en `PLAN.md`, junto a este documento.
>
> Plugin **OSS**: `@jfvilas/kwirth-plugin-tasklist`. Hermano de SDSF (`plugins/sdsf`) y de WRKACTJOB
> (`plugins/wrkactjob`): lo que allí es una pantalla verde de IBM, aquí es la ventana de escritorio más
> reconocible de los 2000. Se trabaja en `~/github/kwirth/plugins/tasklist`, un repo anidado sin remoto y
> gitignorado en el core. Se publica en github.com/jfvilas/kwirth (`plugins/tasklist/`, rama master) con
> `git subtree`. npm público y marketplace `manifest.json` raíz de jfvilas. Producto y UI en inglés.

---

## 1. Resumen ejecutivo

Un canal de Kwirth que **es** el Administrador de tareas de Windows XP: barra de título azul de Luna,
menús `File Options View Windows Shut Down Help`, pestañas `Applications Processes Performance
Networking Users`, la lista de procesos con sus columnas, las gráficas verdes sobre fondo negro y la barra
de estado `Processes: N  CPU Usage: x%  Commit Charge: a / b`. La "máquina" es el **cluster** seleccionado,
y lo que se ve son **pods** como procesos, **Deployments** como aplicaciones y **nodos** como CPUs y
adaptadores de red.

**Criterio de éxito.** Alguien que ha usado Windows XP abre la pestaña y, sin leer nada, consigue:
1. ordenar los procesos por CPU con un clic en la cabecera y ver cuál es el que más gasta;
2. matar uno con `End Process`, pasando por el aviso de XP;
3. ver en `Performance` la CPU y la memoria del cluster moviéndose.

Y además la captura se puede confundir, de un vistazo, con un XP de verdad.

### Qué NO es

| No es | Qué es en realidad |
|---|---|
| Un Task Manager de Windows | Los datos salen del API de Kubernetes y del provider `metrics` vía Kwirth |
| Un `kubectl top` con otro color | Imita la ventana entera: menús, diálogos, menú contextual, Update Speed, Select Columns |
| Un sustituto de magnify | Es **otra forma de mirar** lo mismo, para otro público (y para la demo) |

---

## 2. El problema

1. **Todo el mundo sabe usar el Task Manager.** Es la herramienta de "¿qué está comiendo la máquina?"
   más conocida que existe. Su modelo (procesos con CPU y memoria, matar uno, gráficas de rendimiento)
   encaja casi uno a uno con un cluster.
2. **Escaparate.** Tras SDSF (z/OS) y WRKACTJOB (IBM i), el tercer "dialecto": el del escritorio. La
   familia de "Kubernetes visto como…" es material de demo y de LinkedIn.

## 3. Personas

- **Usuario de Windows** que llega a Kubernetes: busca reconocer la ventana.
- **SRE de Kubernetes**: busca un `top` del cluster que se entienda de un vistazo.
- **Público de demo** (LinkedIn, ferias): busca fidelidad visual, y la serie SDSF + WRKACTJOB + Task Manager.

## 4. Objetivos y no-objetivos

**Objetivos**
- Ventana fiel al Task Manager de XP con el tema **Luna azul** (D7): título, menús, pestañas, ListView
  con cabeceras redimensionables y ordenables, botones, check, gráficas, barra de estado.
- Las cinco pestañas con su mapeo a Kubernetes (§5).
- Acciones con sus diálogos de XP (confirmación de `End Process`, `Create New Task`, `Select Columns`).
- Ratón y teclado como en XP (Supr = End Process, flechas en la lista, menú contextual).

**No-objetivos**
- Otros temas (oliva, plata, Windows Classic): **no**, solo el clásico de XP (D7).
- Varios clusters en una ventana: un canal = una máquina (D10).
- Recursos de Microsoft: ni el logo de Windows, ni sus iconos, ni la font Tahoma (D2).

## 5. Conceptos: el mapeo Windows XP → Kubernetes

| Windows XP | Kubernetes |
|---|---|
| La máquina (lo que se administra) | Cluster de Kwirth seleccionado (D10) |
| Proceso (`Image Name`) | **Pod** (D3) |
| `PID` | Número estable que se asigna a cada pod (por uid) durante la sesión |
| `User Name` | **Namespace** |
| `CPU` (00–99) | CPU del pod sobre la capacidad del cluster, del provider `metrics` |
| `Mem Usage` (K) | Working set del pod |
| Threads (columna opcional) | Número de contenedores |
| Propiedades de un proceso | Ventana de propiedades del pod, con sus **contenedores** (D3) |
| `System Idle Process` | 100 − CPU del cluster (fila fija, como en XP) |
| `Show processes from all users` | Sin marcar: solo los namespaces del accessKey; marcado: todos |
| Aplicación (`Applications`, `Task`) | **Deployment** (D4) |
| Status `Running` / `Not Responding` | Réplicas listas = deseadas / menos de las deseadas |
| `End Task` | Borrar el Deployment (D5) |
| `Go To Process` | Salta a `Processes` con sus pods seleccionados |
| CPU (gráfica por CPU) | **Nodo** (`One Graph Per CPU` = una por nodo) |
| `PF Usage` / Physical Memory | Memoria usada / capacidad y allocatable de los nodos |
| `Commit Charge` (Total / Limit / Peak) | Requests / allocatable / pico de requests en la sesión |
| Totals `Handles` / `Threads` / `Processes` | Vacío (D13) / contenedores / pods |
| Adaptador de red (`Networking`) | Interfaz por defecto de cada **nodo** (la del provider `metrics`) |
| `Link Speed` / `State` | Velocidad de la interfaz si se conoce / `Operational` = nodo Ready |
| `Users` | **Namespaces** (D11) |
| `Shut Down` → Stand By / Turn Off / Restart | Cordon / drain / uncordon de un nodo, solo admin (D6) |
| `View → Update Speed` (High/Normal/Low/Paused) | Intervalo de refresco (1 s / 2 s / 4 s / pausado) |

## 6. Requisitos funcionales

**RF1 — Ventana.** Marco de Luna azul: barra de título con degradado, icono propio y el texto
`Task Manager`, botones minimizar/maximizar/cerrar (decorativos salvo lo que diga el PLAN). Menús
`File Options View Windows Shut Down Help` (el de `Windows` solo aparece en `Applications`, como en XP).
La ventana ocupa la pestaña del canal y se adapta a su tamaño.

**RF2 — Barra de estado.** `Processes: N | CPU Usage: x% | Commit Charge: aM / bM`, siempre visible.

**RF3 — Processes.** Columnas por defecto `Image Name`, `User Name`, `CPU`, `Mem Usage`; `View → Select
Columns…` abre el diálogo de XP con las que tienen equivalente (`PID`, `CPU Time`, `Mem Usage`, `Peak Mem
Usage`, `Threads`, `I/O Reads`, `I/O Writes`…; el PLAN cierra la lista). Orden por cabecera, columnas
redimensionables, selección con ratón y flechas. Menú contextual: `End Process`, `End Process Tree`
(D14), `Properties` (RF4). Botón `End Process` y check `Show processes from all users`.

**RF4 — Propiedades del pod.** Ventana de propiedades al estilo XP (pestañas, `OK`/`Cancel`): datos del
pod y la lista de sus contenedores con imagen, estado, reinicios, CPU y memoria. *Nota de fidelidad:* el
Task Manager de XP no tenía `Properties` en el menú de procesos (llegó con Vista); se añade porque es la
forma natural de ver los contenedores (D3).

**RF5 — End Process.** Diálogo de aviso de XP (`WARNING: Terminating a process can cause…` adaptado a un
pod) con `Yes`/`No`. Sin permiso, el diálogo de error de XP `Unable to Terminate Process` / `Access is
denied.`

**RF6 — Applications.** Lista `Task` / `Status` de Deployments. Botones `End Task`, `Switch To`, `New
Task…`. Menú contextual: `Switch To`, `End Task`, `Go To Process` (el resto, gris). `New Task…` abre el
diálogo `Create New Task` (D12).

**RF7 — Performance.** Medidores `CPU Usage` y `PF Usage` con su historia, recuadros `Totals`, `Physical
Memory (K)`, `Commit Charge (K)`, `Kernel Memory (K)` (este último vacío, D13). `View → CPU History →
One Graph, All CPUs / One Graph Per CPU` (por nodo). La historia se acumula mientras el canal está vivo.

**RF8 — Networking.** Una gráfica por nodo con su `% Network Utilization` y la tabla `Adapter Name`,
`Network Utilization`, `Link Speed`, `State`.

**RF9 — Update Speed.** `View → Refresh Now` y `Update Speed` como en XP; `Paused` congela todo.

**RF10 — Autorización.** La decide el **canal** a partir del accessKey de Kwirth. Lo que no se puede hacer
sale en gris o da el diálogo de `Access is denied.`

**RF11 — Estado persistente.** La sesión vive en `channelObject.data`: al cambiar de pestaña y volver se
conservan la pestaña activa, el orden, las columnas, la selección y la historia de las gráficas.

## 7. Decisiones cerradas

- **D1** (2026-11-27, el usuario) — OSS en github.com/jfvilas/kwirth, scope `@jfvilas`, igual que SDSF y
  WRKACTJOB: repo anidado sin remoto en `plugins/tasklist`, subida por `git subtree`.
- **D2** (2026-11-27, el usuario) — Id `tasklist`, nombre visible **Task Manager** (no "Windows Task
  Manager"). Iconos SVG propios, sin el logo de Windows; font libre parecida a Tahoma, nunca la de Microsoft.
- **D3** (2026-11-27, el usuario) — **Proceso = pod.** Los contenedores se ven en las propiedades del pod.
- **D4** (2026-11-27, el usuario) — **Aplicación = Deployment.**
- **D5** (2026-11-27, el usuario) — `End Task` borra el Deployment.
- **D6** (2026-11-27, el usuario) — `Shut Down` actúa sobre un nodo: Stand By = cordon, Turn Off = drain,
  Restart = uncordon. Solo `admin`.
- **D7** (2026-11-27, el usuario) — **Solo el aspecto clásico de XP** (Luna azul, el de las capturas). Sin
  selector de temas.
- **D8** (2026-11-27) — Datos de Kubernetes por el `coreApi` del core (solo `import type` de
  client-node); métricas del provider `metrics` de Kwirth, nunca de metrics-server.
- **D9** (2026-11-27) — `User Name` = namespace.
- **D10** (2026-11-27, el usuario) — Un canal = un cluster (la "máquina").
- **D11** (2026-11-27, el usuario) — Pestaña **`Users` = namespaces** (coherente con D9). Columnas de XP:
  `User` = namespace, `ID` = número estable, `Status` = `Active` (o `Terminating`), `Client Name` = vacío,
  `Session` = número de pods. `Log Off` = borrar el namespace (con confirmación, solo `admin`);
  `Disconnect` y `Send Message…` en gris.
- **D12** (2026-11-27, el usuario) — **`New Task…`** abre `Create New Task` y crea un pod a partir de una
  imagen, como `kubectl run`: `Open:` = imagen, más namespace y nombre. Lleva su propio permiso.
- **D13** (2026-11-27, el usuario) — **`Handles` y `Kernel Memory` vacíos de momento** (el recuadro se
  pinta, sin valores).
- **D14** (2026-11-27, el usuario) — **`End Process Tree` borra el controlador del pod** (su Deployment —
  subiendo desde el ReplicaSet —, StatefulSet, DaemonSet o Job), con el aviso de XP. Un pod sin dueño se
  borra él solo.
- **D15** (2026-11-27, el usuario) — **Es diversión, no negocio: el menor número de streams posible.** Dos
  entregas, no tres fases (§8).
- **D16** (2026-11-27, el usuario) — En el menú contextual de un proceso, **View Log** (el log del contenedor,
  las últimas 1000 líneas, en Notepad, solo lectura; submenú si hay varios contenedores; `tasklist$read`) y
  **Restart** (el pod se sustituye: con controlador se borra y el controlador crea otro; suelto, se borra, se
  espera a que desaparezca y se crea de nuevo con su spec; `tasklist$end`).
- **D17** (2026-11-27, el usuario) — **Applications con columna Controller**: las aplicaciones son ahora
  Deployments, StatefulSets y DaemonSets (cambia D4). End Task borra el que sea; Not Responding sigue siendo
  réplicas listas < deseadas (en un DaemonSet, nodos listos < nodos que debe ocupar).
- **D18** (2026-11-27, el usuario) — **Edit** en el menú contextual de procesos y aplicaciones: el YAML del
  objeto (sin managedFields, con su resourceVersion) en Notepad; File → Save o Ctrl+S hace un replace. El
  editor es el de Kwirth (CodeMirror, el que el core presta a los plugins, como magnify). `tasklist$end`.
- **D19** (2026-11-27, el usuario) — **Escritorio con varias ventanas**: Notepad es una ventana más (se mueve,
  se redimensiona, maximiza, minimiza y cierra; un botón en la taskbar por ventana; la de delante, con la barra
  de título viva). Se abre también en blanco desde **Start → Notepad**; uno en blanco no tiene dónde guardar.

## 8. Entregas

| Entrega | Contenido |
|---|---|
| **MVP** | Ventana Luna, barra de estado, `Processes` (columnas, orden, `Select Columns`, `End Process`, `End Process Tree`, `Properties` con contenedores, `Show processes from all users`), `Performance`, `Update Speed` |
| **Completo** | `Applications` (`End Task`, `Go To Process`, `New Task…`), `Networking`, `Users` y `Shut Down` |

*(2026-11-27: el usuario pidió las dos seguidas y la QA al final; salen juntas como 0.1.0.)*

## 9. Lo que hay que decir en voz alta

- **Marca.** El Task Manager y Luna son de Microsoft. Imitamos el aspecto con recursos propios (D2); el
  nombre visible no lleva "Windows".
- **`CPU` de un pod sobre el cluster** da números muy pequeños en clusters grandes (todo `00`, como en XP
  con un proceso ocioso). Es fiel, pero puede decepcionar en la demo. El PLAN tiene que decidir la base.
- **Borrar un Deployment** con `End Task` es destructivo de verdad (no vuelve, a diferencia de un pod que
  recrea su controlador). Lleva confirmación y depende del permiso del canal.
- **Historia de las gráficas** solo existe mientras el canal está abierto: al abrirlo, las gráficas
  empiezan vacías, como en XP.

## 10. Criterios de aceptación

1. Las capturas de la ventana (Processes, Performance) se confunden de un vistazo con las de referencia.
2. Ordenar por `CPU`, seleccionar un pod y `End Process` → aviso → `Yes` → el pod desaparece (o lo recrea
   su controlador con otro `PID`).
3. Sin permiso de borrar, `End Process` da `Access is denied.` y no borra nada.
4. `Properties` de un pod enseña sus contenedores con su estado.
5. `Update Speed → Paused` congela lista y gráficas; `Refresh Now` las actualiza una vez.
6. Cambiar de pestaña de Kwirth y volver conserva el estado (RF11).
7. e2e propio en un namespace `tasklist-e2e`, que además saca las capturas del README.

## 11. Abierto

Nada. A1–A4 se cerraron el 2026-11-27 y pasaron a D11–D14.
