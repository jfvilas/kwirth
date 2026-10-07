# Asteroids — plan y backlog

> **ESTADO — CERRADO** (2026-10-07). Publicado como **OSS**: `plugin/asteroids@0.1.10`, `docs/asteroids@0.1.10`
> y `login/asteroids@0.1.2` en npm público (`@jfvilas`) y en el marketplace de github.com/jfvilas/kwirth
> (ver F6). Hasta la 0.1.9 fue privado (`@iriaoperae`, Nexus y marketplace de IRIA). Queda como backlog
> de ideas (B5, B5b, B6), no como trabajo en curso.
> Registro de **por qué** se hizo así, no de cómo funciona hoy: para eso manda el código y la guía.
> Si algo de aquí contradice lo que ves en el producto, gana el producto. El plan no se borra —
> es append-only —, se marca.

> Documento **vivo y append-only**: las fases cerradas no se borran, se marcan. El backlog se ordena
> por valor, no por antigüedad.

## Qué es

Canal de Kwirth que no consume nada del cluster: un Asteroids vectorial jugable dentro de una
pestaña, con la partida entera en el navegador y una tabla de récords compartida por todo el cluster.

Sirve además como el ejemplo más simple de **canal autónomo** (`cluster:false` + `resourced:false` →
view `none`), el segundo del proyecto después de sugarless.

## Decisiones de arquitectura

| Decisión | Por qué |
|---|---|
| La partida vive en `channelObject.data`, no en React | El `TabContent` se monta y desmonta al cambiar de pestaña. Si el estado viviera en el componente, cambiar de pestaña perdería la partida. |
| El back solo guarda el marcador | Nada del juego viaja por el socket: el juego corre entero en el navegador. El back es únicamente la autoridad de la tabla. |
| Se manda **una** entrada, nunca la tabla | Con un marcador compartido, la copia del front puede estar obsoleta; mandarla entera borraría las partidas de otros. Inserta y recorta el back. |
| Transporte por websocket, no endpoint HTTP | Un endpoint habría obligado a pedir el `ri` al arrancar para construir la URL. El `accessKey` hace falta igual (ver abajo). |
| El teclado se engancha al elemento del tab | La clase `InputProvider` original engancha a `window`, lo que dentro de Kwirth robaría las teclas al resto de la aplicación. |
| El motor viene vendorizado de wuspy/asteroids | Reimplementación vectorial propia bajo MIT, sin material de Atari. Detalles en `NOTICE.md`. |

## Fases

### F1 — Canal jugable ✅ (0.1.0)

Motor vendorizado y despixificado (`pixi-compat.ts`), canal con ciclo start/pause/continue/stop,
renderizador vectorial con dos paletas, teclado y controles táctiles, y diálogo de configuración
(aspect ratio, tema, controles, pausa al perder foco).

### F2 — Marcador compartido ✅ (0.1.0)

Tabla de 10 en un ConfigMap del cluster (`kwirth-store-channel-asteroids-scores`), saneado en el
back, cola de escritura para serializar inserciones, y broadcast a todas las pestañas abiertas.

### F3 — Cierre CL9 ✅ (0.1.0)

Renombrado completo `rocks` → `asteroids`, harness (51 tests), e2e aislado no destructivo (13
casos), guía de uso y administración, y publicación en el Nexus privado.

**Entregado ademas tras el primer cierre:**

- **La guia como extension `docs` publicable** (`@iriaoperae/kwirth-docs-asteroids`), no un markdown
  suelto: docsify, guia de usuario y de administrador separadas, y cuatro capturas reales del dev.
  El `watch` reconstruye el `.tgz` al tocar cualquier pagina.
- **Boton de ayuda** en el dialogo de configuracion, enlazando a su seccion de la guia.
- **La topbar se oculta con el canal parado**: mostraba un marcador a cero que no informaba de nada.
- **Etiquetas del slider de aspect ratio** pegadas a la barra, a ras por los extremos y sin quedar
  tapadas por el thumb.

**Arreglos que salieron de este cierre:**

- **`accessKey` en los comandos.** El canal declaraba `accessString: false` y el `BackScoreStore` no
  metía `accessKey` en sus mensajes. El core descarta **en silencio** todo COMMAND sin él, antes
  siquiera de mirar el canal, así que el marcador no guardaba nada y no había ni un error visible:
  solo un timeout de 5 s que resolvía vacío. Corregido y blindado con un test de regresión.
- **Tamaño del canvas.** El contenedor usaba `height: '100%'`, que colapsa porque el contenedor de
  Kwirth no tiene alto definido, y `resizeCanvas` fijaba ancho y alto a pelo ignorando el aspect
  ratio. Ahora mide su `top` con un `ResizeObserver` sobre `body` y encaja el canvas manteniendo la
  relación de aspecto.
- **Mensaje de canal parado.** Antes se pintaba un canvas negro con un cartel dentro; ahora un
  `EmptyState`, igual que sugarless.
- **Vidas iniciales 5 → 3**, como el arcade original.

### F4 — Guia publicable y pulido de UI ✅ (0.1.1)

La guia deja de ser un markdown suelto y pasa a **extension `docs`**
(`@iriaoperae/kwirth-docs-asteroids`): docsify, guia de usuario y de administrador separadas, y cuatro
capturas reales del dev. El `watch` del plugin reconstruye el `.tgz` al tocar cualquier pagina.

- **Boton de ayuda** en el dialogo de configuracion y en la topbar, con el mecanismo del framework
  (`DialogTitleHelp` / `HelpButton`), cada uno a su seccion. El canal pasa a declarar `clusterUrl`.
- **La topbar se oculta con el canal parado** y lleva linea inferior para leerse como barra.
- **Slider de aspect ratio**: etiquetas pegadas a la barra, a ras por los extremos y sin quedar
  tapadas por el thumb.
- **Spec de capturas** (`zz-capture`). Dejo escrita la trampa que costo el rato: `press()` de
  Playwright hace down+up en unos 10ms y el juego lee la entrada una vez por fotograma (~16ms), asi
  que la pulsacion puede caer entera entre dos frames. El `Enter` de arranque se perdia y la partida
  se quedaba en READY, con el bucle posterior girando en vano. Las teclas de control se mantienen
  pulsadas 120-150ms.

### F5 — Sender, identidad y login ✅ (0.1.2)

- **Sender al batir el record** (B2): se elige sender + configuracion en el setup, y el back avisa
  solo cuando se supera al numero uno. No se anuncia un record que no se haya llegado a guardar.
- **Identidad real en la tabla** (B7): la firma el usuario logado, no un alias tecleado.
- **Login propio** (B1): `@iriaoperae/login-asteroids`, con el fondo generado por codigo — 9 KB
  frente al tope duro de 600 KB, que los logins de iter, montag y excubitor se saltan hoy y por eso
  se instalan sin fondo.
- **Los errores del core ya no se pierden** (B3, en la parte que tocaba a este canal).

**Tres fallos reales que salieron de este bloque, y lo que ensenan:**

1. **El socket capturado.** El store se quedaba con el websocket del primer arranque. Parar y
   arrancar abre otro, y el viejo ya cerrado hacia fallar el envio. Lo cruel es que reiniciar el
   canal es justo lo que uno hace para arreglar las cosas, y era lo que lo rompia. Extraido a
   `socketSender()` para poder fijarlo con un test.
2. **La ruta de los senders sin `/core`.** Copiada de `AlertSetup.tsx`, que la tiene mal: 404, el
   `catch` se lo tragaba y el desplegable salia vacio sin un solo error. Es el mismo fallo que ya
   documenta el comentario de `docsUrl` en common-front.
3. **El canal se tragaba los SIGNAL de error del core.** Arrancar con una view distinta de `none`
   devolvia un error clarisimo, el canal lo aceptaba como arranque bueno y guardaba `instance: ''`.
   El juego se veia y se jugaba, y el fallo aparecia mucho despues disfrazado de "no se pudo guardar
   la puntuacion". Corregido aqui, y ademas **en el core**: la restriccion de view en los canales
   autonomos era gratuita, porque esa rama entrega selectores vacios en todos los casos.

### F6 — Paso a OSS ✅ (0.1.10, 2026-10-07)

Decidido por el usuario el 2026-10-06: algunos plugins pasan a ser OSS desde github.com/jfvilas/kwirth,
publicados en npm bajo `@jfvilas`.

- Copia del estado actual a `jfvilas/kwirth/plugins/asteroids`, **sin** el historial del repo privado.
- Scope `@jfvilas` en los tres paquetes (plugin, guía y login), "Asteroids" sin "IRIA", licencia MIT.
- Fuera la dependencia `@iriaoperae/iria-icons`: un paquete público no puede depender del Nexus, y no
  se importaba en ningún sitio.
- Fuera el logo de IRIA Play de la barra de pantalla completa; queda el icono del plugin.
- **Todo al inglés**: código, tests, e2e, guía, README y NOTICE — también el aviso del récord que manda
  el sender y los logs. El build copia README, NOTICE y `LICENSE.upstream` al tarball.
- La guía pierde la entrada del icono en forma de pieza de puzzle: el icono es un SVG en línea y ya no
  puede faltar en el catálogo del core.
- El login se publica **desde `login/`, no desde `dist/`** (desde `dist/` npm metería el `.tgz` dentro).
- e2e nuevo: la barra de pantalla completa. Capturas de la guía regeneradas.

---

## Backlog---

## Backlog---

## Backlog

### B1 — Extensión de tipo `login` propia ✅ (hecho en 0.1.2)

Un login con la estética del juego: fondo vectorial de asteroides y la tipografía del arcade, en la
línea de los logins propios de excubitor, montag e iter.

- Va en `plugins/asteroids/login/`, empaquetado como `.tgz` y publicado junto al plugin.
- ⚠️ Ojo a los límites del renderer de logins, que son estrechos: `login.json` + **un solo**
  `background.png`, el ancho lo manda el contenido, `{provider}` solo se sustituye con un único IdP,
  los themes **no** llegan al login, el fondo en dev queda cacheado ~1 h, y dos `build.mjs` a la vez
  corrompen el `.tgz`.
- Al publicarlo hay que añadirlo al manifest privado como entrada propia (plugin + docs + login son
  tres artefactos separados).

### B2 — Sender al batir el récord ✅ (hecho en 0.1.2)

Notificar por un **sender** configurable cuando alguien entra en la tabla, o solo cuando se bate el
número 1 (a decidir: probablemente configurable).

- El back ya tiene el punto exacto donde engancharlo: el `MSG_SCORE_SUBMIT` de `processCommand`, justo
  después de que la entrada pase el saneado y antes del broadcast, que es donde se sabe si la entrada
  ha desplazado a la anterior primera.
- Requiere configuración del canal desde el front (qué sender, qué instancia, y si notificar todo
  récord o solo el número 1), siguiendo el estándar de configuración de componentes: JSON con
  export/import y configurable desde la UI.
- Decidir el texto del mensaje: nombre, puntuación, nivel y cluster.
- Encaja bien con `teams`, `email-smtp` o `tee`.

### B3 — Surfacear los errores del core en el front ✅ (hecho en este canal; sigue abierto para el core)

Hallazgo del cierre, **no arreglado**: el core manda `sendChannelSignal(ERROR)` cuando rechaza un
comando, pero `wsOnMessage` en `front/src/App.tsx` delega todo a `processChannelMessage` sin mirar el
nivel del signal, y el único canal que los inspecciona es metrics. Por eso el fallo del `accessKey`
fue invisible. Es un arreglo del **core**, no de este plugin, y afecta a todos los canales.

### B4 — Avisar al jugador cuando el marcador no responde ✅ (hecho)

Si el `BackScoreStore` agotaba su timeout de 5 s, la puntuación se perdía sin decir nada. Ahora se
avisa con `channelObject.notify(...)` y se dice qué hacer (parar y arrancar el canal).

Mordió dos veces antes de arreglarse, y las dos con la misma causa: reconstruir `back.js` recarga el
canal en caliente, el core crea una instancia nueva con la lista de instancias **vacía**, y las
pestañas ya abiertas mandan comandos con un `instanceId` que ya no existe. El core los descarta y
nadie se entera. Es dev-only, pero el síntoma —"el marcador no guarda nada"— es indistinguible de un
fallo real.

### B5 — Separar vidas iniciales del tope de vidas

`LIVES` hace doble uso: vidas iniciales **y** tope de vidas acumulables con `EXTRA_LIFE_AT_SCORE`. Al
bajarlo a 3, el máximo alcanzable bajó también a 3. Si se quiere empezar con 3 y poder acumular hasta
5, hay que separarlo en dos constantes (divergiría algo más del motor original).

### B5b — El cartel del canvas se transparenta bajo el panel de récords

El panel de *High scores* se pinta con `opacity: 0.97`, y a través de él se lee el `GAME OVER` que el
renderizador sigue dibujando en el canvas por debajo. Se ve sucio, y se aprecia en la propia captura
de la guía. Arreglo probable: opacidad completa en el panel, o no pintar el cartel mientras el panel
está visible.

### B6 — Cubrir el dibujo del canvas

Ni el renderizador vectorial ni el bucle de animación están medidos. El e2e llega al tamaño y la
relación de aspecto, pero no valida lo que se pinta dentro.

### B7 — Identidad real en la tabla ✅ (hecho)

El nombre ya no se teclea: la tabla la firma el **usuario logado**, que Kwirth inyecta siempre en
`channelObject.userName` sin necesidad de pedirlo en los requirements. El panel muestra *Saving as
&lt;usuario&gt;* y solo queda pulsar SAVE. El tope del nombre sube de 12 a 24 caracteres, porque cortar
a 12 partía identidades reales por la mitad.

⚠️ **La identidad la aporta el front.** El back no puede resolverla por su cuenta: `IInstanceConfig`
solo trae el `accessKey`, y su `id` es un UUID, no un id de usuario. Es decir, alguien que fabricara
un mensaje de websocket a mano podría firmar con otro nombre. Para un marcador de un juego es
asumible, pero conviene saberlo antes de usar esta tabla para algo que importe. Si algún día importa,
haría falta que el core expusiera la identidad al back del canal.
