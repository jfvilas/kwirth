# Backlog — provider V16

**Estado: vivo.** `0.1.2` publicado como **OSS** (2026-10-07, `@jfvilas`, github.com/jfvilas/kwirth); lo que queda
abierto está abajo. Hasta la `0.1.0` fue de pago (`@iriaoperae`, Nexus).

Pendientes vivos. Lo cerrado se queda, con su versión, porque explica por qué está como está.

## Cerrado

### 0.1.2 — `common-back` 0.6.1 (2026-10-07)

`common-back` 0.6.1 hace obligatorio `trace` en `IExtensionLogger`: el logger provisional (el que se usa hasta
que el core pone el suyo) lo gana. Es el barrido que otra sesión aplicó a todos los providers, que cayó en la
copia vieja del repo privado justo cuando este provider se mudaba, y se portó aquí.

### 0.1.1 — paso a OSS (2026-10-07)

Decidido por el usuario: algunos artefactos pasan a ser OSS desde github.com/jfvilas/kwirth. Copia del estado
actual (sin el historial del repo privado), scope `@jfvilas`, "V16 Provider" sin "IRIA", `repository` en el
paquete y README con la instalación desde el marketplace de jfvilas. **Primer e2e** (4 casos): las dos rutas de
solo lectura tras accessKey y su forma, y el nombre en el gestor de providers; sin suscribirse, así que no sondea
la DGT. Retirado del marketplace privado; el repo de GitLab queda para archivar.

### 0.1.0 — nacimiento (2026-09-26)

Portado desde un borrador sobre el andamiaje de `create-kwirth-provider` (modo `schema`) y convertido en
artefacto de pago: `@iriaoperae`, repo propio, anti-fuga en el repo público. Validado en vivo contra el feed de
la DGT con provider-debug (QA manual 7/7).

- Sondea el feed DATEX2 v3 de la DGT y reparte **solo lo que cambia**: `initial` y después `update` con altas,
  modificaciones y bajas.
- Filtro por suscriptor `v16Only`. Una V16 es la incidencia con algún `situationRecordCreationReference` que
  empieza por `V16_`: DATEX2 no tiene tipo de causa propio para las balizas.
- `configRouter` de solo lectura (`/state`, `/situations`), para que el core lo instancie sin consumidor.

## Pendiente

### Instalar en caliente sin reiniciar el core (depende del core)

Hoy lleva `requiresRestart: true`, y es correcto: el core monta el `configRouter` de un provider solo en
`setUpRoutes` (al arrancar) o en `onPluginInstalled` (cuando un **plugin** instalado en caliente lo requiere).
`ProviderApi` llama a `onProviderInstalled` tras `/install` y `/upload`, pero el core crea la API con los
callbacks vacíos (`new ProviderApi(…, {}, …)` en `back/src/index.ts`). Un provider instalado suelto entra en
`registeredProviders` y no se instancia ni se monta hasta reiniciar.

Si el core implementa `onProviderInstalled` (instanciar, `configure`, `startProvider` y
`mountProviderConfigRouter`), este provider puede pasar a `requiresRestart: false`. Es un cambio del core,
no de aquí.

### Un consumidor

Nadie lo consume todavía, salvo provider-debug para validarlo. El contrato de eventos está pensado para que el
consumidor no tenga que volver a calcular el diff.

### Campos normalizados en el evento

Hoy cada incidencia viaja como el objeto DATEX2 completo, en crudo y sin prefijos. Un consumidor que solo quiera
posición, carretera y hora tiene que navegar el perfil de la DGT, que cambia entre versiones (v36 → v37).
Cuando haya un consumidor real, valorar añadir un resumen normalizado junto al objeto crudo: id, tipo de causa,
V16 sí/no, carretera, punto kilométrico, coordenadas y hora de creación. No hacerlo antes de saber qué campos
necesita.
