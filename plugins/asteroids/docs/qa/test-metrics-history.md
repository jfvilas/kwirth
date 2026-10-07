# Asteroids (plugin) — histórico de métricas de test

> Registro **incremental** de la suite del plugin, una fila por **CL9 / tag**. Se **añade** una fila
> arriba en cada cierre (punto 2 de la checklist CL9); **no se sobrescribe** — es un histórico.
>
> **Cómo se obtiene cada dato:**
> - **Harness** = nº de tests que reporta `npm test` (`node --test`) en `plugins/asteroids/`.
> - **Cobertura** = `COVERAGE=1 npm test`. ⚠️ Se mide sobre los **bundles** de test, y el motor de
>   juego vendorizado (`src/front/core/`, de wuspy) entra entero en el bundle de `game.test`. Por eso
>   el total global es bajo y **no es la cifra interesante**: lo que importa es la cobertura de
>   nuestro código, que va en la columna de desglose.
> - **e2e** = `plugins/asteroids/e2e/` (Playwright aislado, con su propio `.creds.json`).
>   Se lanza con `node_modules\.bin\playwright test` desde ese directorio.

| Fecha | Versión / tag | Harness | Cobertura global (líneas / ramas / funcs) | Cobertura de nuestro código | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|---|
| 2026-10-06 | `plugin/asteroids@0.1.10` · `docs/asteroids@0.1.10` · `login/asteroids@0.1.2` | **69** | **66,89% / 89,07% / 68,15%** | `scores` **98,80%**, `backchannel` **98,76%** | 2 / 17 | **Paso a OSS**: `@jfvilas` (plugin, guía y login), github.com/jfvilas/kwirth, "Asteroids" sin "IRIA", fuera la dependencia privada `@iriaoperae/iria-icons` (no se importaba) y el logo de IRIA Play de la barra de pantalla completa; el tarball lleva README, NOTICE y `LICENSE.upstream` (MIT de wuspy/asteroids). Todo el código, los tests, la guía, el README y el NOTICE pasados al inglés — también el aviso del récord que envía el sender y los logs. La guía de *troubleshooting* pierde la entrada del icono en forma de pieza de puzzle: el icono es ya un SVG en línea y no puede faltar en el catálogo del core. e2e nuevo: la barra de pantalla completa (icono y nombre del plugin, sin logo de terceros). |
| 2026-09-12 | `plugin/asteroids@0.1.2` · `docs/asteroids@0.1.2` · `login/asteroids@0.1.0` | **65** | **66,39% / 88,89% / 67,58%** | `scores` **98,80%**, `backchannel` **98,67%** | 2 / 16 | Tercer cierre: sender al batir el record, identidad real en la tabla y **login propio**. Seis tests nuevos, todos de fallos que se habian dado de verdad: el sender solo dispara al batir al numero uno y nunca si la escritura fallo, y el `socketSender` usa el socket VIVO (capturarlo hacia que reiniciar el canal —justo lo que uno hace para arreglar las cosas— perdiera la puntuacion). ⛔ Queda escrito que **ningun e2e puede pulsar SAVE**: guardar un record dispara el sender configurado y manda avisos REALES a personas reales; paso. |
| 2026-09-12 | `plugin/asteroids@0.1.1` · `docs/asteroids@0.1.1` | **51** | **64,03% / 87,62% / 64,67%** | `scores` **98,53%**, `backchannel` **98,52%** | 2 / 15 | Segundo cierre. Sin tests nuevos: el trabajo fue de UI y documentacion. La topbar se oculta con el canal parado (el e2e invierte la asercion que antes exigia verla), boton de ayuda en el dialogo y en la topbar, y arreglo del slider de aspect ratio. La guia pasa de un markdown suelto a **extension `docs` publicable** con cuatro capturas reales. Se anade el spec `zz-capture`, que tuvo un fallo instructivo: `press()` hace down+up en ~10ms y el juego lee la entrada una vez por fotograma (~16ms), asi que el `Enter` de arranque se perdia entre frames y la partida se quedaba en READY. Las teclas de control se mantienen pulsadas 120-150ms. |
| 2026-09-11 | `plugin/asteroids@0.1.0` | **51** | **64,03% / 87,62% / 64,67%** | `scores` **98,53%**, `backchannel` **98,52%** | 1 / 13 | Primer cierre. El plugin nació como `rocks` y se renombró entero a `asteroids` en esta misma sesión. El harness se concentra en lo único que tiene estado compartido —el marcador— y en el contrato del motor que lee la UI. Incluye la **regresión del `accessKey`**: el core descarta en silencio todo COMMAND que no lo lleve, y ese fallo dejó el marcador sin guardar nada sin un solo error visible. El e2e es **no destructivo** a propósito: la tabla de récords es un ConfigMap compartido por todos los usuarios del cluster, así que no envía puntuaciones. |

## Qué cubre cada fichero del harness

| Fichero | Tests | Qué fija |
|---|---|---|
| `tests/scores.test.ts` | 22 | Orden, recorte a 10, `qualifies` (incluido el empate con la última, que **no** entra), saneado de la tabla, y el contrato del `BackScoreStore` con el back: `accessKey` en cada comando, se lee en cada envío y no se congela, se manda **una** entrada y nunca la tabla entera, y resolución sin colgar cuando el socket no traga. |
| `tests/backchannel.test.ts` | 18 | Registro de instancias (sin él el core descarta los comandos), lectura tolerante a almacén vacío o ilegible, persistencia, broadcast a **todas** las pestañas, saneado de lo que manda el front (score ≤ 0, score de texto, nombre con caracteres de control, fecha impuesta por el back) y respuesta garantizada aunque falle la escritura. |
| `tests/game.test.ts` | 11 | El contrato del motor que lee la UI: 3 vidas iniciales, estados `Init`/`Running`, `reset` completo, y que el mundo se dimensiona por `aspectRatio` (área constante) y no en píxeles. |

## Pendiente sobre la propia suite

- **El dibujo del canvas no está medido.** El renderizador vectorial (`AsteroidsRenderer.ts`) y el
  bucle de animación no entran en la cobertura; el e2e llega al tamaño y la relación de aspecto del
  canvas, pero no valida lo que se pinta dentro.
- **El guardado de récord no se prueba end-to-end.** Sería destructivo: escribiría en la tabla
  compartida del cluster. El camino está cubierto por el harness a ambos lados (mensaje del front y
  persistencia del back), pero nadie valida los dos juntos contra un Kwirth real.
- **La física del motor no se prueba.** Es código vendorizado de wuspy, ya probado en origen; aquí
  solo se fija el contrato del que depende la UI.
