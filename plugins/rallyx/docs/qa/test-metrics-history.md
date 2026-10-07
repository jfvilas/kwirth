# Rally-X (plugin) — histórico de métricas de test

> Registro **incremental** de la suite del plugin, una fila por **CL9 / tag**. Se **añade** una fila
> arriba en cada cierre (punto 2 de la checklist CL9); **no se sobrescribe** — es un histórico.
>
> **Cómo se obtiene cada dato:**
> - **Harness** = nº de tests que reporta `npm test` (`node --test`) en `plugins/rallyx/`.
> - **Cobertura** = `COVERAGE=1 npm test`.
> - **e2e** = `plugins/rallyx/e2e/` (Playwright aislado, con su propio `.creds.json`).
>   Se lanza con `node_modules\.bin\playwright test` desde ese directorio.

| Fecha | Versión / tag | Harness | Cobertura global (líneas / ramas / funcs) | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|
| 2026-10-06 | `plugin/rallyx@0.1.1` | **6** | 57.76% / 100% / 30.23% | 2 / 16 | **Paso a OSS**: `@jfvilas`, github.com/jfvilas/kwirth, "Rally-X" sin "IRIA", fuera la dependencia privada `@iriaoperae/iria-icons` (no se importaba) y el logo de IRIA Play de la barra de pantalla completa; el tarball lleva por fin README y NOTICE. 🐛 Tres fallos que ya estaban, cazados por los e2e nuevos: (1) **la pausa no pausaba**: `pause` y `pauseOnBlur` solo cambiaban un indicador y Phaser seguía corriendo — el puente del juego decía escuchar "pause/continue/start" pero solo hacía start; ahora pone `game.paused`. (2) **`pauseOnBlur` no podía funcionar**: el iframe vive fuera del contenedor de la pestaña, así que su `blur` saltaba al pinchar el juego para jugar y su `focus` nunca llegaba; ahora decide dónde está el foco de verdad, y solo levanta la pausa que puso él. (3) **Phaser cancela el `mousedown` de su canvas** y con eso impedía que el foco entrara en el iframe: tras usar un menú de Kwirth, pinchar el juego dejaba el teclado fuera. El iframe lo pide con `window.focus()`. Además, Ctrl+Alt+F11 (pantalla completa del core) no llegaba con el foco dentro del juego: el iframe se lo pasa a la página. e2e nuevos: pausa por menú, pausa automática y pantalla completa con el foco dentro. |
| 2026-10-03 | `plugin/rallyx@0.1.0` | **6** | 57.76% / 100% / 30.23% | 2 / 13 | Primer cierre. Plugin de canal privado de pago. Juego Rally-X (Phaser 2.x + RequireJS) bundled en front como text+base64, corre en iframe aislado con srcdoc. Fix crítico: escape de `</script>` en phaser.txt (2 ocurrencias) que rompía el script tag y dejaba el código visible como texto. Back channel autónomo con scores en ConfigMap. Harness cubre el backchannel (instancia, storage, channel data, getInstances). e2e cubre ciclo de vida del canal, iframe/canvas, aspect ratio 4:3 y captures. |

## Qué cubre cada fichero del harness

| Fichero | Tests | Qué fija |
|---|---|---|
| `tests/backchannel.test.ts` | 6 | Instanciación del back, requisito de storage, channel data autónomo (cluster:false, routable:false, resourced:false), conteo de instancias/conexiones vacío, containsInstance/containsConnection negativos. |

## Pendiente sobre la propia suite

- **El guardado de récord no se prueba end-to-end.** Sería destructivo: escribiría en la tabla
  compartida del cluster. El camino está cubierto por el harness a ambos lados.
- **La cobertura de funciones es baja (30.23%)** porque el harness solo cubre el backchannel
  estático. El back de scores (processCommand, sanitize, notifyRecord) requiere un mock de
  websocket más elaborado.
