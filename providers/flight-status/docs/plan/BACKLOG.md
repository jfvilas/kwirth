# Backlog — provider Flight Status

**Estado: vivo.** `0.1.3` publicado como **OSS** (2026-10-07, `@jfvilas`, github.com/jfvilas/kwirth); lo que queda
abierto está abajo. Hasta la `0.1.1` fue de pago (`@iriaoperae`, Nexus).

Pendientes vivos. Lo cerrado se queda, con su versión, porque explica por qué está como está.

## Cerrado

### 0.1.3 — `common-back` 0.6.1 (2026-10-07)

`common-back` 0.6.1 hace obligatorio `trace` en `IExtensionLogger`: el logger provisional (el que se usa hasta
que el core pone el suyo) lo gana. Es el barrido que otra sesión aplicó a todos los providers, que cayó en la
copia vieja del repo privado justo cuando este provider se mudaba, y se portó aquí.

### 0.1.2 — paso a OSS (2026-10-07)

Decidido por el usuario: algunos artefactos pasan a ser OSS desde github.com/jfvilas/kwirth. Copia del estado
actual (sin el historial del repo privado), scope `@jfvilas`, "Flight Status Provider" sin "IRIA" — también el
título de su diálogo —, `repository` en el paquete, README con la instalación desde el marketplace de jfvilas, y
el build copia por fin el README al tarball. El **e2e pasa a ser autónomo** (su propio Playwright, config y
helpers): por ser de pago, antes había que copiar el spec a una carpeta privada del core. Retirado del
marketplace privado; el repo de GitLab queda para archivar.

### 0.1.1 — ayuda de suscripción con la península (2026-09-26)

El ejemplo de `getSubscriptionHelp()`, que es lo que pega provider-debug, pasa a ser la **península ibérica**
(`36.0 / -9.5 / 43.8 / 3.3`, `intervalSec: 120`) con cinco callsigns de ejemplo en `watch`. El texto explica el
coste: unos 100 grados cuadrados son 3 créditos por llamada, así que 120 s con credenciales y 720 s en anónimo.
Baleares entra igualmente: una caja no puede dejarla fuera. Los callsigns son ejemplos del formato, no vuelos
comprobados. QA manual validado.

### 0.1.0 — nacimiento (2026-09-26)

Partió de un código inicial (provider público `flights`, `@kwirthmagnify`) que se limpió entero y se convirtió en
artefacto de pago: `@iriaoperae/kwirth-provider-flight-status`, repo propio en `main`, anti-fuga en los tres
sitios del repo público. QA manual validado entero.

- Posiciones ADS-B de **OpenSky** por **bbox** del suscriptor; enriquecimiento (`details`) con **AviationStack** y
  **FlightAware AeroAPI** solo para los callsigns de `watch`. Bboxes cercanos comparten llamada (rejilla 0.5°,
  caché TTL con coalescing).
- Cuota **solo en memoria**, a ritmo a lo largo del periodo, con reserva para peticiones interactivas y
  `assumeOnSchedule` para que un reinicio no regale el mes. Circuit breaker por fuente.
- Configuración propia por `configRouter` (`/config`, `/status`) con diálogo propio (`front.js`).

Decisiones que corrigieron al código inicial:

- 🔴 **Secretos**: redactaba el `GET` (`secretsSet`) y hacía "campo vacío = conservar" en el `PUT`. Ahora el `GET`
  los devuelve **reales**, el `PUT` persiste lo que llega, y en la UI van enmascarados con ojo.
- ⚠️ **`express`**: el `watch.mjs` lo ponía en `external`, y el back no carga desde el tmp del core. Build y watch
  lo mapean **siempre** a `global.__kwirth_back__.express`; es devDependency solo para tipos y tests.
- ⚠️ **`requiresRestart: true`**, no `false`: ver el pendiente de abajo.

Salidas del QA manual:

- El navegador **autorrellenaba** el login de Kwirth en Client ID / Client secret de OpenSky y el Save lo guardaba.
  Secretos con `autocomplete="new-password"` y Client ID con `off`.
- **Save guarda y cierra**; solo se queda abierto si se rechaza la configuración.
- El **error** del Save quedaba bajo el scroll: ahora va fijo sobre los botones.

## Pendiente

### Un consumidor que lo pinte en un mapa

Nadie lo consume todavía, salvo provider-debug para validarlo. El contrato (`getSubscriptionHelp`) ya está
pensado para un canal de mapa: bbox por suscriptor y `watch` para los vuelos que el usuario sigue.

### Instalar en caliente sin reiniciar el core (depende del core)

Hoy lleva `requiresRestart: true`, y es correcto: el core monta el `configRouter` de un provider solo en
`setUpRoutes` (al arrancar) o en `onPluginInstalled` (cuando un **plugin** instalado en caliente lo requiere).
`ProviderApi` llama a `onProviderInstalled` tras `/install` y `/upload`, pero el core crea la API con los callbacks
vacíos (`new ProviderApi(…, {}, …)` en `back/src/index.ts`). Si el core lo implementa, este provider puede pasar a
`requiresRestart: false`. Es un cambio del core, no de aquí.

### Petición interactiva de detalles

`FlightProvider.getDetails` admite prioridad `interactive` (puede tirar de la reserva de cuota), pero el provider
solo enriquece en segundo plano por `watch`. Un consumidor con "clic en un avión" necesitará un camino para
pedir los detalles de un callsign bajo demanda.

### Cuota persistente

La cuota vive en memoria. `assumeOnSchedule` evita regalar el periodo tras un reinicio, pero justo después de
arrancar el enriquecimiento en segundo plano va justo de margen. Si molesta, persistir el contador (ConfigMap)
con escrituras espaciadas.

### e2e del deduplicado de errores

El "un error solo cuando cambia el mensaje" está cubierto por el código y por un test que lo ejercita tras
`updateSubscription`, pero no hay test de varios ticks seguidos con el mismo error: el intervalo mínimo es de
10 s. Con `mock.timers` de `node:test` se puede cubrir sin esperar.
