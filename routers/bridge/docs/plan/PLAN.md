# Bridge — PLAN

> Cuelga de [PRD.md](PRD.md). Estado: **CERRADO** (2026‑11‑15), publicado `@jfvilas/kwirth-router-bridge@0.1.0`.
> B1–B6 hechos; unitarios 10/10; **QA k3d ↔ AKS (core 0.6.119) pasos 1–10 OK**: enlace k3d→AKS, AKS ve k3d por el
> enlace que abrió k3d, k3d ve AKS por el bridge, borrar la key `bridge$peer` corta el enlace.
>
> **0.1.1** (2026‑11‑16): un hermano que **vuelve** (su back se reinició y el enlace viejo murió sin cierre) ya no
> se rechaza como duplicado. Los dos enlaces los había abierto el mismo lado, así que la regla del uid más bajo
> no podía elegir y el receptor se quedaba con el viejo, muerto, rechazando el nuevo con `4409` cada pocos
> segundos (visto con el back de dev de k3d reiniciándose contra AKS). Ahora el nuevo sustituye al viejo; la regla
> del uid sigue para cuando se marcan los dos. Unitarios 11/11 (el nuevo, comprobado que falla sin el arreglo).

## Backlog

- ✅ **Hecho en 0.1.2** (2026‑11‑16), lo de abajo: ante un enlace nuevo del mismo lado se hace ping al actual
  (`PROBE_MS`, 5 s): si contesta se queda y el nuevo se rechaza; si no, el nuevo lo sustituye. Y el campo **«Dial
  only from host»** elige qué instancia marca (las demás esperan y lo dicen; cada tarjeta enseña su host).
  Unitarios 13/13.
- **0.1.3** (2026‑11‑17): fuera **«Dial only from host»** (decisión del usuario). Era para su dev, donde el back de
  dev y el pod comparten store; eso se resuelve cargando bridge en el dev desde su `dist` (`kwirth-dev.json`,
  `routers`), sin instalarlo del marketplace, para que el pod no lo ejecute. Se queda el **ping al enlace actual**,
  que vale en producción con varias réplicas. Unitarios 12/12.
- **Dos instancias del mismo Kwirth se quitan el enlace** (2026‑11‑16, visto con 0.1.1). Dos Kwirth con la misma
  configuración y el mismo cluster uid (el back de dev y el pod del mismo k3d, que comparten store; o un Kwirth con
  **varias réplicas**) marcan los dos al hermano. Con 0.1.0 el receptor se quedaba con el primero y rechazaba al
  otro cada `reconnectSeconds`; con 0.1.1 («el nuevo del mismo lado sustituye al viejo») **se quitan el enlace el
  uno al otro** cada pocos segundos. Arreglo propuesto (0.1.2): ante un enlace nuevo del mismo lado, hacer **ping
  al actual** y esperar unos segundos — si contesta, es otra instancia: se queda el actual y el nuevo se rechaza
  con su motivo; si no, estaba muerto (un reinicio): el nuevo lo sustituye. Aun así no decide QUÉ instancia se
  queda el enlace; para eso haría falta que una de ellas no arranque el router. No se hace por ahora (decisión del
  usuario, 2026‑11‑16: el caso que lo destapó es solo de su entorno de dev).

- ✅ **Hecho 2026‑11‑17, publicado `router/bridge@0.1.4`, QA del usuario OK** (dev ↔ AKS: el campo de latido se
  aplica en caliente; con el back de dev congelado, AKS da por muerto el entrante y el dev se reenlaza solo): el latido hace ping a **el** enlace sea quien sea quien lo
  abrió; el pong se escucha al adoptarlo (antes solo al marcar). Un entrante que no contesta en dos latidos se
  cierra y el hermano vuelve a marcar. Unitarios 14/14 (dos nuevos, con `mock.timers` sobre el `setInterval`;
  el del entrante muerto falla sin el arreglo). Y el latido es **configurable**, campo *Heartbeat every
  (seconds)* (`heartbeatSeconds`, 30 por defecto, 5–300), a petición del usuario: AppGW, ALB y los ingress
  cortan un WebSocket inactivo cada uno con su timeout. Cambiarlo se aplica al momento sin tirar el enlace.
  Unitarios 15/15.
  **El receptor no vigila sus enlaces entrantes** (2026‑11‑16): solo hace ping quien marca (`beat()`). Un enlace
  entrante muerto sin cierre lo sigue dando por vivo hasta que el hermano vuelve (ya se sustituye, 0.1.1) o un
  timeout del ingress lo cierra; mientras, su cluster no responde. Hacer ping también a los entrantes.

- **Filtro de IP del login y loopback** (detectado al cerrar). El filtro solo actúa en `POST /login`; las rutas
  se usan con access keys, que no pasan por él. Pero un `/login` hecho a mano a través del bridge llega al core
  destino por loopback y pasa donde loopback está permitido (Magnify desktop siempre; o loopback en la lista o en
  los proxies de confianza). Documentado en el README. Dos arreglos posibles:
  - **A (bridge):** el destino no entrega `/login` (403) y no reenvía `X-Forwarded-For`/`X-Real-IP`/`Forwarded`.
  - **B (core, genérico):** el core da a cada router una marca para lo que entrega por loopback, y trata ese
    tráfico como externo. Va en el backlog del core (`plans/router-extension`).
- **Respuestas HTTP en streaming** (v1 las manda enteras).
- **Varios hermanos** (hoy uno): si alguna vez se quiere, sin hub (eso es Ianus).
> Contrato del core: `IRouter` (`@kwirthmagnify/kwirth-common-back` ≥ 0.6.16), core con el tipo `router`
> (`kwirthmagnify/kwirth`, `plans/router-extension`).

## Cómo funciona

```
 Kwirth A (dial)                                               Kwirth B (accept)
 bridge ── wss://B/…/router/bridge/link ─────────────────────► core B: key de B con bridge$peer → bridge
          Authorization: Bearer <peerAccessKey>                (ACCESS_KEY) — si no, el core rechaza

 hello { uid, name, kwirthVersion, bridgeVersion }  ⇄  hello { … }      ← los dos se conocen

 navegador en A ─► core A /router/bridge/<ticket>/<uid de B>/config/info
                   core A valida el ticket, quita el segmento ─► bridge A: '/<uid B>/config/info'
                   bridge A ─[req id=7 GET /config/info + cabeceras]─► bridge B
                   bridge B ─► fetch http://localhost:<puerto B>/<root>/config/info (loopback)
                               ← core B autentica con la key DE B que lleva la petición
                   bridge B ─[res id=7 200 + cuerpo]─► bridge A ─► navegador
```

- **Simétrico:** por el mismo enlace B usa a A igual (sus entradas apuntan a A con ruta `bridge` y el uid de A).
- **Destino loopback:** el bridge destino nunca decide permisos de usuario; el core destino autentica y autoriza
  con la credencial que trae la petición, como siempre.
- **Quién puede usar la ruta en origen:** las llamadas con **ticket** o **loopback** (el core ya respondió por la
  sesión). Una access key solo sirve para **el enlace** (`/link`, con `bridge$peer`).

## Protocolo del enlace (v1, mensajes JSON sobre un WebSocket)

| Tipo | Campos | |
|---|---|---|
| `hello` | `v`, `uid`, `name`, `kwirthVersion`, `bridgeVersion` | al abrir, los dos |
| `req` | `id`, `method`, `path`, `headers`, `body?` (base64) | petición HTTP |
| `res` | `id`, `status`, `headers`, `body?` (base64) | su respuesta (v1: entera, sin streaming) |
| `wso` | `id`, `path`, `headers` | abrir un WebSocket en el otro lado |
| `wsa` | `id` | abierto |
| `wsm` | `id`, `data`, `binary` | un mensaje (base64 si binario) |
| `wsc` | `id`, `code?`, `reason?` | cerrado (o no se pudo abrir), en cualquier sentido |
| `bye` | `reason` | el otro lado deja el enlace (p. ej. el uid mayor cede) |

Cabeceras: se pasan tal cual menos las *hop-by-hop* (`connection`, `upgrade`, `host`, `content-length`…).

## Streams

**B1 · Esqueleto.** `create-kwirth-router.mjs --publisher @jfvilas --dir routers/bridge`; config `peerUrl`,
`peerAccessKey` (password), `reconnectSeconds` (10); scope `bridge$peer`; `getStatus()` (enlazado con quién,
o por qué no); `ws` va dentro del bundle (cliente con cabeceras; el core no lo presta).

**B2 · Enlace.** Marcar (con `peerUrl`) y aceptar (`/link` con `bridge$peer`); `hello`; **un solo hermano**
(otro uid con uno vivo → rechazo); los dos configurados → **se queda el que abre el uid menor** (`bye` al otro);
reintento cada `reconnectSeconds`; latido (ping) cada 30 s; `applyConfig` reabre en caliente; consola: arriba,
abajo, rechazos, reintentos.

**B3 · HTTP por el túnel.** `routerRequest` → `req` → el otro hace `fetch` a su loopback → `res`. Un uid que no
es el del hermano → `502` con el motivo; sin enlace → `503`; timeout 60 s → `504`.

**B4 · WebSocket por el túnel.** `routerWebsocket` → `wso` → el otro abre su WebSocket de loopback → `wsa` /
`wsm` / `wsc` en los dos sentidos. Al caer el enlace se cierran todos los que llevaba.

**B5 · Tests.** Unitarios con dos bridges en el mismo proceso (un WebSocket de verdad entre ellos) y un core
falso de loopback (HTTP + WS). QA con **dos Kwirths**: k3d (dev) ↔ AKS — ⚠️ AKS necesita una imagen del core
construida desde `master` (el tipo `router` no está en la que tiene). También vale Magnify desktop ↔ k3d.

**B6 · Publicar.** `@jfvilas/kwirth-router-bridge` en npmjs, entrada en el `manifest.json` raíz, README.
