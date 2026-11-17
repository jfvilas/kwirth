# Bridge — two Kwirths that reach each other — PRD

> Producto OSS (`@jfvilas/kwirth-router-bridge`). Es el **router de referencia** del tipo `router` del core
> (`kwirthmagnify/kwirth`, `plans/router-extension/PRD.md`): además de servir, enseña el contrato.
> Estado: **validado** (2026‑11‑15).

## 0. Resumen

`bridge` une **exactamente dos Kwirths como hermanos**. Uno de ellos (o los dos) sabe llegar al otro; con un único
enlace saliente, **cada uno ve al otro en su lista de clusters** y todo Kwirth funciona contra él —pestañas,
canales en vivo, Magnify— aunque uno de los dos esté detrás de NAT o de un firewall.

No tiene panel ni pestaña: se configura en el gestor de **Routers** y habla por la **consola** del core.

**Criterio de éxito:** dos Kwirths, uno sin entrada desde fuera, se ven mutuamente en menos de cinco minutos de
configuración, y un desarrollador que lee su código entiende cómo se escribe un router.

## 1. El problema

Un Kwirth detrás de NAT no se puede añadir a la lista de clusters de otro: no hay URL que lo alcance. Hoy la única
forma es exponerlo (ingress, load balancer) o montar una VPN.

## 2. Objetivo

- Dos Kwirths, A y B. **Basta con que uno alcance al otro.** El que alcanza abre el enlace; por ese enlace el
  tráfico va en los dos sentidos.
- Configuración mínima y a mano: la URL del otro y una access key creada en él.
- Cero dependencias fuera del core.

### No objetivos

- Más de un hermano, hubs, mallas, federación.
- Panel, auditoría, métricas: solo consola.
- Cifrado propio: el enlace va por `wss` (el TLS de quien expone).

## 3. Concepto

```
     Kwirth A (detrás de NAT)                                  Kwirth B (expuesto)
   ┌──────────────────────────┐   1 enlace WebSocket saliente   ┌──────────────────────────┐
   │ bridge  ── peer: B, key ─┼───────────────────────────────►│ bridge  (acepta bridge$peer)│
   │                          │◄═══ HTTP y WS de A hacia B ════│                          │
   │                          │════ HTTP y WS de B hacia A ═══►│                          │
   └──────────────────────────┘          (multiplexado)        └──────────────────────────┘
```

- **Enlace**: un WebSocket de A a `<B>/router/bridge/link`, autenticado con una access key **de B** que lleva el
  scope **`bridge$peer`**. Lleva todo el tráfico, en los dos sentidos.
- **Destino loopback**: lo que llega por el enlace se entrega al **core local** por loopback, como si viniera de un
  navegador. **El core destino autentica y autoriza** con la credencial del usuario, igual que siempre: `bridge`
  no se salta la seguridad de nadie, solo lleva bytes.
- **Entrada de la lista**: en A, B se da de alta con su URL real y la ruta `{ router: 'bridge', clusterUid: <uid de B> }`
  (y al revés en B).

## 4. Casos de uso

1. **Casa ↔ oficina**: el Kwirth de casa (sin entrada) se conecta al de la oficina; desde la oficina se ve el de
   casa.
2. **Laboratorio**: un k3d en un portátil enlazado con un cluster en la nube.
3. **Magnify desktop ↔ Kwirth**: el desktop (siempre detrás de NAT, sin entrada posible) abre el enlace hacia un
   Kwirth de un cluster. El desktop ve ese cluster, y **ese Kwirth ve los clusters locales del desktop** (k3d,
   minikube, contextos del kubeconfig) sin abrir nada en el portátil. Requisito: `bridge` funciona igual en el
   back del desktop (Electron/Tauri) que en un pod — sin dependencias de Kubernetes para guardar su config.

## 5. Requisitos funcionales

**B1 · Scope.** Declara `bridge$peer` ("Bridge · Peer link"): la key que un hermano presenta para enlazar.

**B2 · Config** (diálogo genérico del gestor de Routers):

| Campo | Tipo | Defecto | |
|---|---|---|---|
| `peerUrl` | texto | vacío | URL del otro Kwirth. Vacío = solo acepta enlaces |
| `peerAccessKey` | password | vacío | Key creada **en el otro** con `bridge$peer`; enmascarada con ojo |
| `reconnectSeconds` | número | 10 | Reintento tras un fallo (1–3600) |
| `heartbeatSeconds` | número | 30 | Latido (5–300), en los dos extremos. Por debajo del timeout de inactividad de cualquier proxy en medio (AppGW, ALB, ingress); añadido en 0.1.4 |

**B3 · Enlace.** Con `peerUrl`, abre el enlace y lo mantiene: reconecta cada `reconnectSeconds`, latido cada 30 s.
Al conectar, los dos dicen quiénes son (uid y nombre de cluster, versiones de Kwirth y de `bridge`).

**B4 · Un solo hermano.** Acepta **un** enlace. Uno de otro uid mientras hay uno vivo se rechaza (y se dice en
consola). Si los dos se configuran el uno al otro, **queda el que abre el uid menor**; el otro se cierra sin
reintentar mientras el bueno siga vivo.

**B5 · Túnel.** Multiplexa sobre el enlace: peticiones HTTP (con su respuesta, en streaming) y WebSockets (apertura,
mensajes de texto y binarios, cierre), cada uno con su id. Lo que llega se entrega al core local por loopback.

**B6 · Rutas.** `getRouterData()` = `{ id: 'bridge', pathTemplate: '/{routeTicket}/{clusterUid}', needsTicket: true }`.
Una petición para un `clusterUid` que no es el del hermano conectado → `502` con el motivo.

**B7 · Consola.** Enlace arriba/abajo (con el hermano), rechazos, reintentos y errores del túnel. Nada más.

## 6. Decisiones

| # | Decisión |
|---|---|
| **D1** | Nombre `bridge`, paquete `@jfvilas/kwirth-router-bridge`, en `jfvilas/kwirth/routers/bridge` |
| **D2** | Simétrico: los dos son origen y destino; abre el enlace quien tenga `peerUrl` |
| **D3** | Si los dos lo tienen, queda el enlace que abre el **uid menor** |
| **D4** | Un único WebSocket, multiplexado (HTTP + WS) |
| **D5** | Destino **loopback**: el core destino autentica y autoriza; `bridge` no decide permisos de usuario |
| **D6** | El enlace se autentica con una access key **del otro** con `bridge$peer` |
| **D7** | Solo consola; sin panel ni auditoría |

## 7. Riesgos

- Quien tenga una key con `bridge$peer` de B puede **ser** el hermano de B. Es una credencial a proteger como
  cualquier otra; revocarla (borrar la key) corta el enlace al momento.
- El tráfico de los dos sentidos comparte un socket: un `log` muy ruidoso puede frenar lo demás. Aceptable para un
  router de referencia; se dice en el README.

## 8. Criterios de aceptación

1. A detrás de NAT, B expuesto: con `peerUrl`/`peerAccessKey` en A, los dos se ven en su lista de clusters.
2. Desde A, contra B: lista de pods, una pestaña `log` en vivo, Magnify. Desde B, lo mismo contra A.
3. Borrar la key en B corta el enlace y A lo dice en consola y reintenta.
4. Configurado en los dos lados: un solo enlace.
5. Sin reiniciar Kwirth en ningún paso.
