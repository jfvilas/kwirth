# PLAN — Rally-X Plugin

**Estado:** ✅ CERRADO (0.1.1, 2026-10-07). Queda el backlog de abajo.
**Versión:** 0.1.1
**Tipo:** plugin OSS (scope `@jfvilas`, repo github.com/jfvilas/kwirth). Hasta la 0.1.0 fue privado
(`@iriaoperae`, Nexus de Plexus).

## Objetivo

Crear un plugin de Kwirth que ejecuta el juego Rally-X (recreación homebrew de Marco Parenzan)
dentro de una pestaña, con persistencia de high-scores en ConfigMap del cluster.

## Arquitectura

- **Front:** iframe aislado con Phaser 2.x + RequireJS + assets inline (data URIs). Machine pattern
  que sobrevive tab switches (host div `position:fixed` en `document.body`).
- **Back:** persiste high-scores en ConfigMap vía `writeStorage`. Notifica al sender configurado
  cuando se bate el récord.
- **Comunicación:** postMessage bridge del iframe al plugin (estado del juego + game-over).
- **Assets:** todo bundleado en el front.js (text + base64), sin peticiones de red.

## Streams

### S1 — Scaffolding y juego base ✅
- [x] Scaffold con `tools/create-kwirth-plugin.mjs`
- [x] Descargar y adaptar el juego upstream (named AMD defines, cookie→localStorage, postMessage bridge)
- [x] Bundlear Phaser + RequireJS + assets como text/base64
- [x] RallyxMachine (iframe manager con attach/detach/dispose)
- [x] RallyxChannel (IChannel impl)
- [x] RallyxTabContent (HUD + game area + scores overlay)
- [x] RallyxSetup (dialog con sender select + pauseOnBlur)
- [x] Back channel (score persistence + notify)
- [x] Fix crítico: escape de `</script>` en phaser.txt (2 ocurrencias rompían el script tag)
- [x] Build (typecheck + esbuild) pasa
- [x] Harness tests (6/6 verdes)
- [x] E2E tests (13/13 verdes)
- [x] Guía docsify (user + admin + credits)
- [x] Capturas generadas (channel-stopped, setup-dialog, game-running)
- [x] Registrado en `back/kwirth-dev.json`
- [x] QA manual validado
- [x] Commit + tag + push
- [x] Publish a Nexus privado (@iriaoperae/kwirth-plugin-rallyx@0.1.0)

### S2 — Paso a OSS (`@jfvilas`) ✅ (0.1.1)
Decidido por el usuario el 2026-10-06: algunos plugins pasan a ser OSS desde github.com/jfvilas/kwirth.
- [x] Copia del estado actual (sin el historial del repo privado) a `jfvilas/kwirth/plugins/rallyx`
- [x] Scope `@jfvilas`, versión 0.1.1, `displayName` "Rally-X" (sin "IRIA")
- [x] Fuera la dependencia `@iriaoperae/iria-icons`: un paquete público no puede depender del Nexus
  privado, y no se importaba en ningún sitio
- [x] Fuera el logo de IRIA Play de la barra de pantalla completa (queda el icono del plugin)
- [x] README, créditos e instalación reescritos para OSS; el build copia README y NOTICE a `dist/`
  (antes el tarball salía sin README)
- [x] 🐛 **La pausa no pausaba**: `pause` y `pauseOnBlur` solo cambiaban un indicador y Phaser seguía
  corriendo. El puente del juego decía escuchar "pause/continue/start" pero solo hacía start; ahora pone
  `game.paused`
- [x] 🐛 **`pauseOnBlur` no podía funcionar**: el iframe vive fuera del contenedor de la pestaña, así que
  su `blur` saltaba al pinchar el juego para jugar y su `focus` nunca llegaba. Ahora decide por dónde está
  el foco de verdad (juego, pestaña o ninguno) y solo levanta la pausa que puso él (`autoPaused`)
- [x] 🐛 **Phaser cancela el `mousedown` de su canvas** y con eso impedía que el foco entrara en el
  iframe: tras usar un menú de Kwirth, pinchar el juego dejaba el teclado fuera. El iframe pide el foco
  con `window.focus()` al pulsar
- [x] Ctrl+Alt+F11 (pantalla completa del core) llega también con el foco dentro del juego: el iframe
  reenvía esa combinación, y solo esa, a la página
- [x] e2e nuevos: pausa por menú, pausa automática y pantalla completa con el foco dentro (15 casos)
- [x] QA manual validado, publish en npm, entrada en el manifest de jfvilas, tag y push
- [x] Entrada retirada del manifest privado de IRIA. Archivar el repo de GitLab queda en manos del usuario

## Pendiente (futuro)
- Cobertura de funciones baja (30.23%) — mock de websocket más elaborado para processCommand
- Guardado de récord no se prueba e2e (sería destructivo)
