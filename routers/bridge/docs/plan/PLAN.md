# Bridge — PLAN

> Cuelga de [PRD.md](PRD.md). Estado (2026‑11‑15): streams validados; **B1–B4 hechos, B5 unitarios en verde (10)**;
> **QA k3d ↔ AKS (core 0.6.119) pasos 1–8 OK**: enlace k3d→AKS, AKS ve k3d por el enlace que abrió k3d, y k3d ve
> AKS por el bridge. Pendientes: el paso 9 (borrar la key `bridge$peer` corta el enlace; el usuario mantiene las
> keys por ahora), la limpieza, y B6 (publicar).
>
> **Abierto (seguridad):** el core destino ve la petición llegar por **loopback**. Si su filtro de IP del login
> admite loopback, una sesión que viene por el bridge lo pasa. Decidir antes de publicar: que el bridge marque
> esas peticiones y el core las trate como externas, o documentarlo.
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
