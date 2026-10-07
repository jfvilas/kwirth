# Pac-Man (plugin) — histórico de métricas de test

> Registro **incremental** de la suite del plugin, una fila por **CL9 / tag**. Se **añade** una fila
> arriba en cada cierre (punto 2 de la checklist CL9); **no se sobrescribe**: es un histórico.
>
> **Cómo se obtiene cada dato:**
> - **Harness** = nº de tests que reporta `npm test` (`node --test`) en `plugins/pacman/`.
> - **Cobertura** = `COVERAGE=1 npm test`, sobre el bundle único de tests (el back del canal, los datos y
>   la máquina del front, y el texto del juego, que el test del puente importa entero).
> - **e2e** = `plugins/pacman/e2e/` (Playwright aislado, con su propio `.creds.json`).

| Fecha | Versión / tag | Harness | Cobertura global (líneas / ramas / funcs) | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|
| 2026-10-06 | `plugin/pacman@0.1.1` · `docs/pacman@0.1.1` | **25** | 99.97% / 95.36% / 87.62% | 1 / 10 | **Primer CL9 con tests**: la 0.1.0 salió sin harness, sin e2e y sin guía. **Paso a OSS**: `@jfvilas`, github.com/jfvilas/kwirth, licencia **GPL-3.0-only** (la del juego de Shaun Williams que incluye) con su texto en `LICENSE.upstream`, que el NOTICE prometía y no estaba; fuera el logo de IRIA Play; código, README y NOTICE en inglés, también el aviso del récord y los logs. Guía nueva (usuario y administrador), con las secciones que ya enlazaban sus botones de ayuda. 🐛 **La tabla de récords estaba muerta**: nadie escribía la puntuación, las vidas ni el fin de partida — el juego guarda todo en su cierre y no había puente — así que la cabecera marcaba siempre 0 y ninguna partida llegaba a la tabla. Ahora un puente dentro del cierre del juego publica su estado y obedece la pausa (`executive.togglePause`). 🐛 **La pausa no pausaba**, y `pauseOnBlur` habría pausado el juego al pinchar para jugar (el iframe vive fuera del contenedor): ahora decide por el foco real y solo levanta la pausa que puso él. Ctrl+Alt+F11 llega también con el foco dentro del juego. Las vidas infinitas del modo práctica se pintan `∞`. |
