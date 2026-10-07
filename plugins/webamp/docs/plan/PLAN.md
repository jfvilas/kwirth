# PLAN — Webamp Plugin

## Estado: ✅ CERRADO (0.1.1, 2026-10-07)

Publicado como OSS: `@jfvilas/kwirth-plugin-webamp@0.1.1` y su guía `@jfvilas/kwirth-docs-webamp@0.1.1`,
desde github.com/jfvilas/kwirth y su marketplace. Ver S7.

## Objetivo

Crear un plugin OSS `webamp` para Kwirth: un reproductor de música Winamp 2
clon (Webamp de Jordan Eldredge) que corre en un iframe dentro de una pestaña
de Kwirth, con drag-and-drop de audio y skins.

## Streams

### S1 — Scaffolding y estructura base ✅
- [x] Ejecutar `tools/create-kwirth-plugin.mjs --id webamp`
- [x] Copiar `webamp.js` (webamp-offline) a `src/front/webamp/webamp.txt`
- [x] Personalizar `package.json` (icono, deps, scripts)
- [x] Personalizar `build.mjs` / `watch.mjs` (loader `.txt`, globals)
- [x] Crear `build-docs-tgz.mjs`
- [x] Crear `.gitignore`, `README.md`, `NOTICE.md`

### S2 — Back channel ✅
- [x] Back minimalista (solo contrato IChannel, sin storage ni processCommand)
- [x] Tracking de instancias

### S3 — Front channel ✅
- [x] `WebampMachine.ts` — gestor del iframe (patrón galaga: host div + attach/detach/dispose)
- [x] `WebampChannel.tsx` — ciclo de vida start/pause/continue/stop
- [x] `WebampTabContent.tsx` — área del iframe + HUD + fullscreen bar
- [x] `WebampSetup.tsx` — diálogo de configuración minimal
- [x] `WebampConfig.ts` / `WebampData.ts` — config y estado
- [x] `icons.tsx` / `IriaPlayLogo.tsx` — icono y logo

### S4 — Tests y docs ✅
- [x] Test unitario del backchannel (3 tests, pasan)
- [x] Guía docsify (user + admin + credits)
- [x] README.md con enlace a Kwirth

### S5 — Build y verificación ✅
- [x] `npm install --legacy-peer-deps`
- [x] `npm run build` — typecheck OK, front.js + back.js + dist/package.json
- [x] `npm test` — 3/3 pass
- [x] `build-docs-tgz.mjs` — docs/webamp.tgz generado

### S6 — E2e y QA ✅ (cerrado dentro de S7)
- [x] Estructura e2e (playwright config + helpers)
- [x] QA manual con el usuario (2026-10-07)
- [x] Capturas de pantalla: descartadas — la guía no referencia ninguna imagen, y añadir capturas que
  ninguna página usa no aporta. Si una página las necesita, se añaden con ella
- [x] Histórico de métricas (con cobertura por primera vez)

### S7 — Paso a OSS (`@jfvilas`) ✅ (0.1.1, 2026-10-07)
Decidido por el usuario el 2026-10-06: algunos plugins pasan a ser OSS desde github.com/jfvilas/kwirth.
- [x] Copia a `jfvilas/kwirth/plugins/webamp`; retirado del repo del core
- [x] Scope `@jfvilas` (plugin y guía), versión 0.1.1, `repository` en el paquete
- [x] Fuera el logo de IRIA Play de la barra de pantalla completa; queda el icono de nota musical
- [x] La licencia MIT de Webamp, que faltaba, va en `LICENSE.webamp` y en el tarball junto al NOTICE
- [x] 🐛 Webamp se montaba sobre `document.body` y su render (React legacy) **sustituía el body**: se
  borraban el panel de ayuda, sus botones *Open songs…* / *Load skin…*, la capa de soltar y la caja de
  errores, justo después de engancharles los manejadores. Ahora se monta en `#webamp-root`
- [x] 🐛 Con el foco dentro del reproductor, Ctrl+Alt+F11 no llegaba a la página: el iframe lo reenvía
- [x] Los 3 tests del harness comprobaban constantes del propio test; sustituidos por 6 sobre el canal real
- [x] Identificadores en castellano del script del iframe traducidos

## Notas

- El plugin es OSS (repo público, npm público con scope `@jfvilas`; antes `@kwirthmagnify` 0.1.0)
- `requiresRestart: false` — el back no necesita reinicio
- El Webamp library (~940 KB) se bundlea como texto en `front.js`
- No hay storage ni scores — el reproductor es stateless desde el servidor
- El iframe sobrevive tab switches (patrón machine en `channelObject.data`)
