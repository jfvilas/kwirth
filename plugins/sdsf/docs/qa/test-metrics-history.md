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
| 2026-11-22 | `plugin/sdsf@0.1.0` | **85** | **98,05% / 89,69% / 90,74%** | 1 / 14 | **Primer cierre: el MVP del PRD completo.** Es una 3278-3 de 32x80 con la font 3270: block mode, campos con byte de atributo, OIA y el teclado como en PCOMM (Ctrl derecho = Enter). Incluye el menú, el DA con los comandos primarios y los comandos de línea `S`, `?`, `D`, `C` y `CA`, este último con confirmación. El e2e recorre los criterios de aceptación del PRD y saca las capturas del README. Lo que dejó al descubierto: en el menú, Newline desde la línea de comandos vuelve al mismo campo, que es lo correcto, y la aserción se movió al DA. En una corrida otra sesión reinició el back de dev, se cerró el websocket y SDSF respondió `NO RESPONSE FROM KWIRTH`: es el comportamiento esperado, no un fallo. |

## Qué cubre cada fichero del harness

| Fichero | Tests | Qué fija |
|---|---|---|
| `tests/terminal.test.ts` | 15 | El buffer 3270: geometría y direcciones, los campos como bytes de atributo, MDT, protegido/numérico, inserción con overflow, Delete, Backspace, Erase EOF, Tab, Backtab, Home y Newline. El Read Modified de una AID y el bloqueo `X SYSTEM`, que no se quita con Reset. La regla de colores base y la OIA. |
| `tests/keymapper.test.ts` | 7 | El teclado de PC: Ctrl derecho y Ctrl izquierdo solos (al soltarlos) hacen Enter y Reset, y combinados no se capturan. Intro hace Newline. Las F son las PF, con Shift PF13–24. También PgUp/PgDn, las PA, Esc como Clear y que lo que no se mapea vuelva al navegador. |
| `tests/panels.test.ts` | 6 | Los comodines de SDSF, el parser de comandos primarios, los códigos de Pos y DP, StepName, ProcStep, Status y Age, y que las páginas de PF11 recorran todas las columnas. |
| `tests/session.test.ts` | 36 | El diálogo entero sobre una fuente falsa. Menú, READY, DA, filtros, SORT, scroll con cada importe, PF10/PF11, FIND/RFIND, RETRIEVE, `&nn`, métricas ausentes y errores. El browse, el panel `?`, `D`, y `C`/`CA` con la ventana de confirmación, incluida la cola de comandos de línea. |
| `tests/back.test.ts` | 21 | El mapeo de V1Pod, el describe, las métricas a partir de las lecturas del provider y el canal: escalera de scopes, filtro por la key, `NOT_AUTHORIZED` antes de tocar la API, LOG acotado, CANCEL con grace 0 y suscripción a `metrics` mientras hay instancias. |
