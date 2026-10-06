# Chapete — PLAN

> **Estado: CERRADO** (2026-10-06). S1 entregado como `plugin/chapete@0.1.0`, publicado en npm como
> `@jfvilas/kwirth-plugin-chapete` y listado en el `manifest.json` de este repo. No queda nada pendiente.
> PRD: [PRD.md](PRD.md).

## Streams

| stream | entrega | estado |
|---|---|---|
| S1 | Chapete de punta a punta | ✅ `0.1.0` (2026-10-06): harness 45, e2e 10/10, QA manual validado |

## Lo que el reconocimiento estableció (2026-10-06)

| pregunta | respuesta | dónde |
|---|---|---|
| ¿cómo se crea el plugin? | scaffolder no interactivo: `node tools/create-kwirth-plugin.mjs --id chapete …` | `tools/create-kwirth-plugin.mjs` |
| ¿cómo lee un plugin los LLM del core en el back? | `readStorageCommon(STORAGE_KEY_PROVIDERS, true)` y `readStorageCommon(STORAGE_KEY_LLMS, false)` | `plugins/censor/src/back/index.ts:198,313` |
| ¿cómo los lee el front, en el setup? | `GET ${clusterUrl}/core/aiconfig/llms` con `Bearer accessString` + `X-Kwirth-App` | `back/src/api/AiConfigApi.ts:65`, patrón en `plugins/pinocchio/src/front/PinocchioTabContent.tsx:233` |
| ¿hay selector de LLM hecho? | `LlmSelector({ llms, value, onChange })` | `common-ai/src/front.tsx:131` |
| ¿qué llamada al modelo? | `generateText` de `common-ai/back`, **ya envuelto** en `runWithUsageGuard` | `common-ai/src/back.ts:449` |
| ¿temperatura? | `ILlm.temperature` ya existe: es el valor por defecto que propone el setup | `common-ai/src/index.ts:84` |
| ¿markdown? | `MarkdownViewer` de `common-front` (`react-markdown`) | `common-front/src/MarkdownViewer.tsx` |
| ¿se puede probar sin un LLM real? | sí: el provider `openai-compat` acepta `endpoint`, así que un servidor local falso que conteste a `/v1/chat/completions` sirve para el e2e | `common-ai/src/back.ts:49-53` |

## Un solo stream

Sin streaming ni persistencia, no hay nada que justifique partirlo: un stream que entrega el chat completo
y cierra su CL9.

---

## S1 · Chapete de punta a punta

Entrega: el plugin publicado en npm y en el manifest público, con el chat funcionando contra los LLM del
core.

### Qué se construye

1. **Scaffold** con `--id chapete --name Chapete --publisher @kwirthmagnify --icon Chat
   --website https://kwirthmagnify.dev`. Lo generado es el punto de partida: no se escribe nada a mano que
   el scaffolder ya genere.
2. **Tipos en `src/common/ChapeteTypes.ts`** (🔴 tipos nuevos, a validar):
   ```ts
   export enum EChapeteRole { USER = 'user', ASSISTANT = 'assistant' }
   export interface IChapeteMessage { role: EChapeteRole, content: string }

   // what the instance setup decides, fixed for the whole session
   export interface IChapeteInstanceConfig { llmId: string, temperature: number }

   export enum EChapeteCommand { ASK = 'ask', GETSYSTEM = 'getsystem', SETSYSTEM = 'setsystem' }
   ```
   Las cargas de cada comando (`messages` en ASK, `system` en GET y SET) y la respuesta (`text` o `error`)
   se definen junto a ellos con el mismo patrón que el `Types.ts` que genere el scaffolder.
3. **Setup de la instancia** (`ChapeteSetup.tsx`): `LlmSelector` con los LLM del core y un campo de
   temperatura que toma por defecto la del LLM elegido. Si no hay LLMs, en lugar del selector aparece un
   aviso: *"No LLMs configured. Configure them in Kwirth's AI settings."*, y el OK queda deshabilitado.
4. **Back** (`src/back/index.ts`), sin estado por conversación:
   - `ASK`: resuelve el `ILlm` por `llmId` y los providers desde el storage común, llama a `buildModel` y
     ejecuta `generateText({ model, system, messages, temperature })`. Responde con el texto o con el
     error. Un `UsageLimitError` se manda con su motivo, sin convertirlo en un error genérico.
   - `GETSYSTEM` y `SETSYSTEM`: leen y escriben el system prompt **del canal** con
     `readStorage`/`writeStorage`. Si no hay ninguno guardado, se usa uno por defecto.
   - La parte que arma la llamada se separa en una función pura que recibe `generateText` inyectado,
     para poder probarla en el harness sin red.
5. **Front** (`ChapeteTabContent.tsx`):
   - Cabecera con el LLM y la temperatura de la sesión, botón *New chat* y botón de ajustes, que abre el
     diálogo del system prompt (Cancel/Save y botón Help, como el resto de diálogos).
   - Lista de mensajes: los del usuario en texto plano y los del asistente con `MarkdownViewer` y botón
     de copiar. Mientras se espera la respuesta, una burbuja *Thinking...*.
   - Caja multilínea: `Enter` envía y `Shift+Enter` hace salto de línea. Se deshabilita mientras hay una
     petición en curso.
   - El historial vive en el estado del componente (D5) y viaja entero en cada `ASK`.
   - Los errores aparecen en la conversación como un mensaje marcado como error, que **no** se envía al
     modelo en los turnos siguientes.
6. **README** del paquete, que el build copia a `dist/`: qué es, cómo se instala en Kwirth, que usa los
   LLM del core y el control de uso, y los enlaces a `https://kwirthmagnify.dev` y al repo.
7. **Manifest público**: la entrada en `plugins/manifest.json`. *(Cambiado al cerrar: ver abajo.)*

### Cómo se valida

- **Harness** (`tests/`): la función pura de la llamada, con un `generateText` falso. Comprueba que el
  system prompt va como `system`, el historial en orden, la temperatura de la instancia y no la del LLM,
  que los mensajes de error no se reenvían, que `UsageLimitError` sale con su motivo y que un `llmId`
  inexistente devuelve un error claro.
- **e2e** (`e2e/`): un servidor falso que contesta a `/v1/chat/completions` con markdown fijo, y un
  provider `openai-compat` de prueba que apunta a él. Cubre: el setup sin LLMs (aviso y OK deshabilitado),
  una pregunta (*Thinking...* y después la respuesta renderizada), un segundo turno (el servidor falso
  comprueba que le llega el historial), *New chat*, guardar el system prompt y verlo aplicado, y un error
  del proveedor visible en la conversación.
- **QA manual** con un LLM real.

### Lo que hay que vigilar

- 🔴 **El e2e no puede destruir la configuración de IA del dev.** Añade su provider y su LLM de prueba
  **sumándolos** a los que haya y los retira al terminar, dejando el resto como estaba. No sobrescribe
  la lista.
- ⚠️ **El system prompt lo puede cambiar cualquiera con acceso al canal**, y afecta a todos. Es lo que
  pide RF8. Si hace falta restringirlo, se resuelve con los scopes del canal, fuera de este stream.
- ⚠️ El build mapea `common-ai/back` al global del core: el `generateText` que corre es el del **core**.
  Hay que comprobar que la versión de `common-ai` instalada en el core ya trae el envoltorio de uso; si no,
  el control de uso no se aplica aunque todo compile.
- ⚠️ Plugin nuevo: `kwirth-common-back` en la **última** versión y la clase del canal declarando
  `implements IChannel` (CL9, punto 8).

### Lo que pasó

- **Canal sin recursos.** El scaffolder genera un canal pensado para pods (`resourced: true`). Chapete se
  dejó como `sender-debug`: `cluster: true`, `resourced: false`, scope `NONE`, y llega por
  `addObject('*all')`.
- **`IInstanceMessage` no declara `accessKey`**, aunque el core descarta un `COMMAND` sin ella. Se añadió
  al tipo del comando (`IChapeteCommandMessage`) para que el compilador lo exija.
- **El icono `Chat` no está en el barrel** de `common-front`: se usa `Forum`.
- **`zod` no hace falta**: Chapete no lo importa, y quien lo necesite lo tiene en `common-ai/back` (que
  reexporta `z`), servido por el core. Se quitó de las dependencias.
- **Diálogos**: el setup copia el de `sender-debug` y el del system prompt usa el mismo armazón (decidido
  por el usuario).
- **e2e no destructivo, y comprobado**: la restauración de la configuración de IA relee la API y falla si
  queda algo del test. Una corrida coincidió con un reinicio del core (por tocar `kwirth-dev.json`) y dejó
  el LLM de prueba puesto; la siguiente lo retiró sola, porque el alta descarta restos de corridas
  anteriores. ⛔ No tocar `kwirth-dev.json` con el e2e en marcha.
- **Cambio de repositorio al cerrar** (decidido por el usuario el 2026-10-06, antes del primer publish):
  el plugin no va a `@kwirthmagnify` ni al repo de Kwirth, sino a **`@jfvilas`** y a
  **[github.com/jfvilas/kwirth](https://github.com/jfvilas/kwirth)**, `plugins/chapete`, con su entrada en
  el `manifest.json` de la raíz de ese repo. Ese repo era una copia antigua de Kwirth: se vació
  (conservando el historial) para alojar extensiones OSS de jfvilas de cualquier tipo. La guía y este
  plan viajaron con el plugin a `docs/`; el core no menciona Chapete.

## Backlog

Vacío. Lo que se descartó a propósito (streaming, persistir conversaciones, tools) está en los
no-objetivos y las decisiones del [PRD](PRD.md); si se quiere, es un PRD nuevo, no un pendiente de este.
