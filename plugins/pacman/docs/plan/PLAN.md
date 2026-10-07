# PLAN — Pac-Man Plugin

**Estado:** ✅ CERRADO (0.1.1, 2026-10-07). Queda el backlog de abajo.
**Tipo:** plugin OSS (scope `@jfvilas`, repo github.com/jfvilas/kwirth, licencia GPL-3.0-only). La 0.1.0
se publicó como `@kwirthmagnify/kwirth-plugin-pacman` desde el repo del core, sin plan escrito.

## Qué es

Canal autónomo (`cluster:false`, `resourced:false`, view `none`) que sirve el remake de Pac-Man de Shaun
Williams (GPL v3) en un iframe, con la partida sobreviviendo a los cambios de pestaña (máquina en
`channelObject.data`) y una tabla de récords del cluster en el storage del canal.

## Streams

### S1 — Canal jugable (0.1.0) ✅
Publicado sin harness, sin e2e y sin guía, aunque el `postbuild` ya generaba el paquete de docs a partir
de una carpeta `docs/guide` que no existía.

### S2 — Paso a OSS y cierre de verdad ✅ (0.1.1, 2026-10-07)
Decidido por el usuario el 2026-10-06: algunos plugins pasan a ser OSS desde github.com/jfvilas/kwirth.
- [x] Copia a `jfvilas/kwirth/plugins/pacman`; retirado del repo del core
- [x] Scope `@jfvilas` (plugin y guía), versión 0.1.1, licencia `GPL-3.0-only` declarada, y el texto de la
  GPL en `LICENSE.upstream` — el NOTICE lo prometía y no estaba
- [x] Fuera el logo de IRIA Play; queda el icono del plugin
- [x] Código, README y NOTICE en inglés, incluidos el aviso del récord y los logs
- [x] Guía nueva (usuario: qué es, cómo funciona, setup, jugar, récords; admin: instalación, permisos,
  storage, troubleshooting), con las secciones que ya enlazaban sus botones de ayuda
- [x] 🐛 **La tabla de récords estaba muerta**: nadie escribía la puntuación, las vidas ni el fin de
  partida. El juego guarda todo dentro de su cierre `(function(){…})();` y no había puente, así que la
  cabecera marcaba siempre 0 y ninguna partida llegaba a la tabla. Ahora `withBridge()` añade dentro del
  cierre un puente que publica el estado cada 250 ms (solo si cambia) y obedece la pausa; es el único
  cambio en el juego, declarado en el NOTICE
- [x] 🐛 **La pausa no pausaba**; y `pauseOnBlur`, en cuanto la pausa funcionara, habría pausado el juego
  al pinchar para jugar (el iframe vive fuera del contenedor). Ahora decide por el foco real y solo
  levanta la pausa que puso él (`autoPaused`)
- [x] Ctrl+Alt+F11 llega también con el foco dentro del juego; las vidas del modo práctica se pintan `∞`
- [x] Harness (25) y e2e (10), los primeros del plugin; QA manual validado

## Backlog
- **B1 — Sonido.** El juego referencia `sounds/*.mp3` que no se incluyen (~1,8 MB). Decidir si se
  empaquetan (peso del bundle) o se sirven desde el back del canal.
- **B2 — El récord no se prueba e2e**: guardarlo escribe la tabla del cluster y, con sender, avisa a
  personas reales. Lo cubre el harness.
