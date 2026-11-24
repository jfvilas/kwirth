# WRKACTJOB (plugin) — histórico de métricas de test

> Registro **incremental** de la suite del plugin, una fila por **CL9 / tag**. En cada cierre se **añade**
> una fila arriba (punto 2 de la CL9); **no se sobrescribe**, porque es un histórico.
>
> **De dónde sale cada dato:**
> - **Harness**: los tests que cuenta `npm test` (`node --test` sobre los bundles de esbuild) en `plugins/wrkactjob/`.
> - **Cobertura**: `COVERAGE=1 npm test`, medida con **c8** y llevada a `src/` con los source maps. Los paneles,
>   la sesión, el cron y el back entran enteros. Los componentes React (`WrkactjobChannel`, `TabContent`, el
>   setup) y el socket (`WrkBackSource`) los cubre el e2e; el motor 5250 es de la DCE `blockterm`, que tiene su suite.
> - **e2e**: `plugins/wrkactjob/e2e/`, un Playwright aislado con su propio `.creds.json`. Se lanza con
>   `npx playwright test` desde ese directorio. No es destructivo: crea el namespace `wrkactjob-e2e` (dos pods
>   sanos, uno que falla, un Job y un CronJob suspendido) y lo borra al terminar; solo termina, retiene, libera y
>   lanza lo suyo.

| Fecha | Versión / tag | Harness | Cobertura (líneas / ramas / funcs) | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|
| 2026-11-24 | `plugin/wrkactjob@0.2.0` | **131** | **100% / 96% / 100%** | 1 / 21 | **Fase 3 (S7–S12): más comandos de IBM i.** `WRKSYSSTS` (un pool por nodo), `WRKSBS` y `DSPSBSD`, `DSPMSG QSYSOPR` con F1 (Additional Message Information) y `WRKJOBSCDE` (CronJobs como entradas de planificación: hold, release y submit con su prompt, detalle y última ejecución) sobre un lector de cron propio con zona horaria. Scope nuevo `wrkactjob$schedule`. El harness destapó que la cabecera de los LimitRange y el mensaje de permiso no cabían en 80 columnas; el dev, que `wrap` dejaba un `)` huérfano con los nombres de pod con uid. El fixture del e2e añade su CronJob suspendido; las capturas nuevas solo muestran el fixture y los nodos de k3d. |
| 2026-11-23 | `plugin/wrkactjob@0.1.0` | **61** | 100% de líneas (ramas y funcs no se anotaron) | 1 / 15 | **MVP (S3–S6).** WRKACTJOB con namespaces como subsistemas y pods como jobs, opciones 4, 5, 7 y 8, Main Menu y línea CL, sobre el 5250 de la DCE `blockterm` 0.2.0. Fila escrita en el cierre de la 0.2.0: en el MVP no se abrió el histórico. |
