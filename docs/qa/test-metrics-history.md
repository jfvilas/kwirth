# KubernetesXP (plugin `tasklist`) — histórico de métricas de test

> Registro **incremental** de la suite del plugin, una fila por **CL9 / tag**. En cada cierre se **añade**
> una fila arriba (punto 2 de la CL9); **no se sobrescribe**, porque es un histórico.
>
> **De dónde sale cada dato:**
> - **Harness**: los tests que cuenta `npm test` (`node --test` sobre los bundles de esbuild) en `plugins/tasklist/`.
> - **Cobertura**: `COVERAGE=1 npm test`, medida con **c8** y llevada a `src/` con los source maps. El back (canal,
>   mapper, uso de métricas), la sesión, los formatos y la colocación de ventanas entran casi enteros; lo que baja
>   la cifra global son los componentes React (ventanas, pestañas, diálogos, controles Luna), que cubre el e2e.
> - **e2e**: `plugins/tasklist/e2e/`, un Playwright aislado con su propio `.creds.json`. Se lanza con
>   `npx playwright test` desde ese directorio. No es destructivo: crea los namespaces `tasklist-e2e` (Deployments,
>   un StatefulSet y un pod suelto) y `tasklist-e2e-logoff`, y los borra al terminar; solo termina, reinicia, edita
>   y crea lo suyo, y Shut Down solo se abre y se cancela. Falla si la página lanza cualquier error.

| Fecha | Versión / tag | Harness | Cobertura (líneas / ramas / funcs) | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|
| 2026-11-28 | `plugin/tasklist@0.1.1` | **47** (+2) | **76% / 87% / 56%** | 1 / 32 (+2) | **El menú de start de XP y el Control Panel (D22–D24).** Start con el usuario de Kwirth, programas (Task Manager, Notepad, All Programs) y sitios (My Cluster, My Namespaces, Control Panel, Run..., About), Log Off en gris y Turn Off Computer, que para el canal. El Control Panel: una ventana de Explorer con los 28 applets de XP, todo deshabilitado. El escritorio arranca sin el Task Manager: una única foto al conectar, refrescos al abrirlo. El e2e lee las filas de una lista de una vez, sin la carrera con su refresco. |
| 2026-11-27 | `plugin/tasklist@0.1.0` | **45** | **77% / 86% / 57%** | 1 / 30 | **Primera versión, todo junto (S1 + S2 + lo pedido en la QA).** Un escritorio XP sobre el cluster: Task Manager (Processes, Applications con Deployments/StatefulSets/DaemonSets, Performance, Networking, Users), Notepad (logs y YAML con el CodeMirror del core), taskbar con Start, ventanas que se mueven, redimensionan, maximizan y minimizan. View Log, Restart, Edit, End Process/Tree/Task, New Task, Log Off de namespace y Shut Down de nodo. Back: `Usage`, `Mapper` e `index` al 96–100% de líneas. |
