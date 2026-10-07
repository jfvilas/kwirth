# V16 Provider — histórico de métricas de test

> Registro **incremental** de la suite del provider, una fila por **CL9 / tag**. Se **añade** una fila
> arriba en cada cierre (punto 2 de la checklist CL9); **no se sobrescribe** — es un histórico.
>
> **Cómo se obtiene cada dato:**
> - **Harness** = nº de tests que reporta `npm test` (`node --test`) en `providers/v16/`.
> - **Cobertura** = `COVERAGE=1 npm test`, sobre el código propio del back (`src/`): `fast-xml-parser` y
>   express se externalizan en `tests/run.mjs` para no medir código ajeno. El provider es back-only: no hay
>   front que medir.
> - **e2e** = este provider no tiene suite e2e automatizada aparte (mismo criterio que `aws`/`longhorn`):
>   es back-only y su única entrada es un feed HTTP público, así que la suite unitaria cubre el contrato
>   —parseo, detección V16, diff y reparto por suscriptor— contra una **captura recortada del feed real** y
>   un `fetch` simulado. La **validación en vivo** se hace con **provider-debug** contra el feed de la DGT.
>   Se anota como `0 / 0`.

| Fecha | Versión / tag | Harness | Cobertura (líneas / ramas / funcs) | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|
| 2026-10-07 | `provider/v16@0.1.1` | **20** | 99.50% / 97.25% / 93.00% | 1 / 4 | **Paso a OSS**: `@jfvilas/kwirth-provider-v16`, github.com/jfvilas/kwirth (`providers/v16`), "V16 Provider" sin "IRIA", README de instalación desde el marketplace de jfvilas. **Primer e2e** (antes 0): las dos rutas de solo lectura tras accessKey (`/state`, `/situations`), su forma, y el nombre en el gestor de providers — sin suscribirse, así que no sondea la DGT y no depende de que esté accesible. ⚠️ El nombre se comprueba exacto: un Kwirth con el marketplace de IRIA registrado ofrecía aún la 0.1.0 como "IRIA V16 Provider", y eso es del entorno. |
| 2026-09-26 | `provider/v16@0.1.0` | **20** | 99.50% / 97.25% / 93.00% | 0 / 0 | **Nacimiento del provider**, portado desde un borrador sobre el andamiaje de `create-kwirth-provider` (modo `schema`) y convertido en artefacto privado (`@iriaoperae`, repo propio, anti-fuga). Sondea el feed DATEX2 de incidencias de la DGT y reparte **solo lo que cambia** (`initial` + `update` con altas, modificaciones y bajas), con filtro `v16Only` por suscriptor. 🔴 **El borrador no habría encontrado nunca una sola incidencia**: buscaba la raíz de DATEX2 **v2** (`d2LogicalModel > payloadPublication`) en un feed que es **v3** (`d2:payload > sit:situation`, con prefijos de namespace). Ahora se quitan los prefijos y se aceptan las dos raíces. 🔴 **Las balizas V16 no tienen tipo de causa propio en DATEX2**: la DGT las marca con `situationRecordCreationReference` empezando por `V16_` (46 de 448 incidencias en la prueba en vivo). Otros arreglos, cada uno con su test: un sondeo en vuelo al parar ya no se reprograma (timer zombi); `scheduleNext` limpia el handle previo (el huérfano dejaba la suite colgada 60 s); `fetch` con timeout de 30 s; `importConfig` con el contrato real (`applied/skipped/warnings`); schema con `label` y exportado a nivel de módulo; valores del XML como **strings crudos** (la conversión numérica convertía ids en números y se comía ceros a la izquierda); y la URL por defecto pasa a `v37`, porque `v36` responde con 301. `configRouter` de solo lectura (`/state`, `/situations`) para que el core lo auto-instancie sin consumidor y se vea en provider-debug; por eso `requiresRestart: true`. Express **no** se bundlea: se mapea a `global.__kwirth_back__.express` (verificado en `dist/back.js`). |
