# SDSF (plugin) — histórico de métricas de test

> Registro **incremental** de la suite del plugin, una fila por **CL9 / tag**. En cada cierre se **añade**
> una fila arriba (punto 2 de la CL9); **no se sobrescribe**, porque es un histórico.
>
> **De dónde sale cada dato:**
> - **Harness**: los tests que cuenta `npm test` (`node --test` sobre los bundles de esbuild) en `plugins/sdsf/`.
> - **Cobertura**: `COVERAGE=1 npm test`, medida con **c8** y llevada a `src/` con los source maps. El motor
>   3270, los paneles, la sesión y el back entran enteros. Los componentes React (`TerminalView`, `TabContent`)
>   y el socket (`SdsfBackSource`) los cubre el e2e.
> - **e2e**: `plugins/sdsf/e2e/`, un Playwright aislado con su propio `.creds.json`. Se lanza con
>   `node_modules/.bin/playwright test` desde ese directorio. No es destructivo: crea el namespace
>   `sdsf-e2e`, que lleva un Deployment de dos pods, y lo borra al terminar.

| Fecha | Versión / tag | Harness | Cobertura (líneas / ramas / funcs) | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|
| 2026-11-23 | `plugin/sdsf@0.4.0` | **117** | **98,47% / 91,76% / 89,71%** | 1 / 17 | **S7b, los parámetros del `DA`**, como los documenta IBM: tipos `JOB`, `STC`, `TSU` e `INIT` (pods de Job, con otro dueño, sueltos y de DaemonSet), posiciones `IN`, `OUT`, `READY` y `TRANS`, sus formas `O…` y `NO…`, y `ALL`/`ALLT`/`ALLP`. Admite hasta cuatro, una sola `O` y `ALL` va sola; si chocan, gana el último. `DA` a secas es el DADFLT: todo lo activo salvo los DaemonSets. Los pods terminados solo salen con `ALL` o `ALLP`. El caso e2e nuevo destapó un fallo del front: el clic se calculaba con el ancho medido de la font, que se queda corto, y hacia la derecha caía una columna más allá. Ahora usa el tamaño real de la rejilla, y el e2e lo comprueba en las columnas 21 y 77. |
| 2026-11-22 | `plugin/sdsf@0.3.0` | **110** | **98,40% / 91,30% / 89,43%** | 1 / 16 | **S7, los paneles `ST`, `O` y `H`.** Muestran Jobs y CronJobs como trabajos batch, con la Queue de JES (EXECUTION, PRINT, INPUT o HOLD) y su Status. `O` son los Jobs terminados y `H` los CronJobs suspendidos. `S` y `?` sobre un Job van a su pod más nuevo, y sobre un CronJob al pod de su ejecución más reciente. `D` hace el describe y `C`/`CA` lo borran con sus pods, con confirmación. El panel de tabla del DA pasa a ser genérico (`paintTable<T>`) y el protocolo nombra el objetivo `targetNamespace`/`targetName` más `objectKind`. El back usa el `batchApi` del core. El fixture del e2e añade un Job que termina y un CronJob suspendido. |
| 2026-11-22 | `plugin/sdsf@0.2.0` | **95** | **98,16% / 90,19% / 91,21%** | 1 / 15 | **S6, el panel `LOG`.** Muestra los events del cluster como un SYSLOG de z/OS: N/W, sistema, yyddd, hora UTC, JobID del pod, cuenta y, al final, reason, objeto y mensaje. El reason va delante porque es lo que cabe en 79 columnas. Colores: verde Normal, amarillo Warning y rojo los Warning de fallo. Se abre al final, Enter sigue el log si estabas abajo y `&nn` lo deja corriendo. PREFIX/DEST filtran. El back lo lee con `listEventForAllNamespaces` del `coreApi` del core, filtrado por la key: el pod si es un event de pod, el namespace en los demás. Caso e2e nuevo con su captura. Otra sesión reinició el back de dev en mitad de una corrida (503 en el login). |
| 2026-11-22 | `plugin/sdsf@0.1.0` | **85** | **98,05% / 89,69% / 90,74%** | 1 / 14 | **Primer cierre: el MVP del PRD completo.** Es una 3278-3 de 32x80 con la font 3270: block mode, campos con byte de atributo, OIA y el teclado como en PCOMM (Ctrl derecho = Enter). Incluye el menú, el DA con los comandos primarios y los comandos de línea `S`, `?`, `D`, `C` y `CA`, este último con confirmación. El e2e recorre los criterios de aceptación del PRD y saca las capturas del README. Lo que dejó al descubierto: en el menú, Newline desde la línea de comandos vuelve al mismo campo, que es lo correcto, y la aserción se movió al DA. En una corrida otra sesión reinició el back de dev, se cerró el websocket y SDSF respondió `NO RESPONSE FROM KWIRTH`: es el comportamiento esperado, no un fallo. |

## Qué cubre cada fichero del harness

| Fichero | Tests | Qué fija |
|---|---|---|
| `tests/terminal.test.ts` | 15 | El buffer 3270: geometría y direcciones, los campos como bytes de atributo, MDT, protegido/numérico, inserción con overflow, Delete, Backspace, Erase EOF, Tab, Backtab, Home y Newline. El Read Modified de una AID y el bloqueo `X SYSTEM`, que no se quita con Reset. La regla de colores base y la OIA. |
| `tests/keymapper.test.ts` | 7 | El teclado de PC: Ctrl derecho y Ctrl izquierdo solos (al soltarlos) hacen Enter y Reset, y combinados no se capturan. Intro hace Newline. Las F son las PF, con Shift PF13–24. También PgUp/PgDn, las PA, Esc como Clear y que lo que no se mapea vuelva al navegador. |
| `tests/panels.test.ts` | 14 | Los comodines de SDSF, el parser de comandos primarios, los códigos de Pos y DP, StepName, ProcStep, Status y Age, y que las páginas de PF11 recorran todas las columnas. |
| `tests/session.test.ts` | 51 | El diálogo entero sobre una fuente falsa. Menú, READY, DA, filtros, SORT, scroll con cada importe, PF10/PF11, FIND/RFIND, RETRIEVE, `&nn`, métricas ausentes y errores. El browse, el panel `?`, `D`, y `C`/`CA` con la ventana de confirmación, incluida la cola de comandos de línea. |
| `tests/back.test.ts` | 30 | El mapeo de V1Pod, el describe, las métricas a partir de las lecturas del provider y el canal: escalera de scopes, filtro por la key, `NOT_AUTHORIZED` antes de tocar la API, LOG acotado, CANCEL con grace 0 y suscripción a `metrics` mientras hay instancias. |
