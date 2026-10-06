# Chapete — PRD

> **ESTADO — entregado** (2026-10-06, `plugin/chapete@0.1.0`). Documento de PRODUCTO: qué se hace y por
> qué. El cómo está en el [PLAN](PLAN.md).

## Resumen ejecutivo

**Chapete** es un plugin (canal) **público** de Kwirth para **chatear con un LLM**, y nada más: una caja
de texto, la conversación y las respuestas, como ChatGPT o Claude. Usa los LLM que el administrador ya
configuró en el core, así que no tiene configuración de proveedores propia.

**Criterio de éxito**: un usuario con un LLM configurado en Kwirth abre Chapete, elige el modelo, escribe,
ve un indicador *Thinking...* mientras el modelo trabaja, recibe la respuesta formateada (markdown y
código) y puede seguir la conversación con contexto. Todo sin configurar nada en el plugin.

## El problema

Kwirth ya habla con LLMs en ocho sitios, pero **siempre para algo**: Pinocchio analiza eventos, Censor
clasifica logs, Agora conversa sobre el clúster con sus tools. No hay sitio donde **preguntar a secas**.
Un operador que quiere redactar un manifiesto, entender un mensaje de error o pedir un comando acaba
abriendo otra pestaña con otro chat, **con otra cuenta y otra clave**, fuera del control de uso que Kwirth
ya aplica a sus LLMs (el control de uso de IA del core, plan `ai-usage-control` del repo de Kwirth).

## Para quién

**Cualquier usuario de Kwirth con acceso al canal.** No hace falta que sea administrador: el LLM lo
configuró otro, y Chapete solo lo usa.

## Objetivos y no-objetivos

**Objetivos**
- Chat de texto con un LLM de los configurados en el core, con varios turnos y contexto.
- Respuesta **completa de una vez**, con un indicador *Thinking...* mientras llega, y renderizada en
  markdown con bloques de código.
- Que el tráfico pase por el **control de uso** del core, como cualquier otra llamada de IA de Kwirth.

**No-objetivos** (fuera, a propósito)
- **Tools, agentes y contexto del clúster.** Chapete no lee Kubernetes ni llama a aitoolsets: para eso
  está Agora. Si algún día se quiere, es otra decisión y otro PRD.
- **Streaming.** La respuesta llega entera; ver D4.
- Adjuntos, imágenes y voz.
- Configuración propia de providers o API keys: se usan las del core.
- Compartir conversaciones entre usuarios.

## Conceptos

| concepto | qué es |
|---|---|
| **LLM** | un `ILlm` de los configurados en el core (`STORAGE_KEY_LLMS`), resuelto con `buildModel` |
| **conversación** | lista ordenada de mensajes `user`/`assistant` que se envía entera al modelo en cada turno |
| **system prompt** | texto opcional que precede a la conversación; uno por defecto, editable |

## Requisitos funcionales

1. **RF1 · Selector de LLM en el setup de la instancia** (decidido por el usuario el 2026-10-06), con
   los LLM del core. El LLM queda fijo para esa sesión del canal y la cabecera del chat solo lo muestra.
   Si no hay ningún LLM, el setup lo avisa y dice dónde configurarlos, en vez de enseñar un selector vacío.
2. **RF2 · Caja de entrada** multilínea: `Enter` envía y `Shift+Enter` hace salto de línea. Se
   deshabilita mientras hay una respuesta en curso.
3. **RF3 · *Thinking...***: al enviar, el mensaje del usuario aparece enseguida y debajo un indicador
   *Thinking...* que se sustituye por la respuesta completa cuando llega.
4. *(retirado: el botón Stop solo tenía sentido con streaming)*
5. **RF5 · Markdown** en las respuestas (`MarkdownViewer` de `common-front`), con bloques de código y un
   botón de copiar.
6. **RF6 · Nueva conversación**: vacía el historial.
7. **RF7 · Errores visibles**: un tope de uso alcanzado (`UsageLimitError`) o un fallo del proveedor
   aparecen **en la conversación**, con el motivo, y no como un spinner que no termina.
8. **RF8 · System prompt, uno para todo el canal** (decidido por el usuario el 2026-10-06). Es el mismo
   para todos los usuarios y todas las instancias. Se guarda en el storage del canal y se edita desde un
   diálogo de configuración del canal.
9. **RF9 · Parámetros del modelo en el setup de la instancia** (decidido por el usuario el 2026-10-06).
   La temperatura (y los demás parámetros que se decidan en el PLAN) se fijan **al arrancar el canal**, en
   el setup de la instancia, y valen para toda esa sesión. Si no se fijan, se usan los valores por defecto
   del modelo.

## Decisiones

- **D1 · Público, fuera de kwirthmagnify** (cambiado por el usuario el 2026-10-06, antes de publicar).
  Paquete `@jfvilas/kwirth-plugin-chapete` en npm público, código en
  [github.com/jfvilas/kwirth](https://github.com/jfvilas/kwirth) (`plugins/chapete`) y entrada en el
  manifest de ese repo (`manifest.json` en la raíz, un único manifest para todos los tipos de extensión,
  como el de IRIA). Con README dentro del tarball. Al principio iba a ir a `@kwirthmagnify` y al manifest
  del core: se movió porque algunos plugins OSS pasan a publicarse desde el repo y el scope de jfvilas.
- **D2 · LLMs del core, sin configuración propia.** Se leen `STORAGE_KEY_PROVIDERS` y `STORAGE_KEY_LLMS`
  con `readStorageCommon`, como hace Censor. Chapete **no escribe** en ellos.
- **D3 · La llamada sale del back**, nunca del navegador: la API key no llega al cliente y el control de
  uso se aplica. Front y back hablan por el WebSocket del canal: la petición viaja como `COMMAND` y la
  respuesta vuelve como su `RESPONSE`.
- **D4 · Sin streaming: `generateText` de `common-ai`, tal cual** (decidido por el usuario el
  2026-10-06). Ya está envuelto en `runWithUsageGuard`, así que el control de uso se aplica sin tocar
  `common-ai` ni el core. El usuario ve *Thinking...* hasta que llega la respuesta entera.
- **D5 · Historial solo en memoria del front** (decidido por el usuario el 2026-10-06). Al cerrar la
  pestaña del canal se pierde la conversación. No hay lista de conversaciones ni persistencia.
- **D6 · Sin tools.** El modelo se llama sin `tools`, con un solo paso.

## Lo que hay que decir en voz alta

- ⚠️ **Una respuesta larga tarda y no se ve avanzar.** Sin streaming, el usuario solo ve *Thinking...*
  hasta el final. Se acepta para el MVP; si molesta, el streaming es un cambio aislado (`streamText`
  envuelto en `common-ai` y subir la dependencia del core), no un rediseño.
- ⚠️ **El tope por tokens frena la llamada siguiente**, no la que está en curso, porque `usage` llega con
  la respuesta. Es el comportamiento de cualquier `generateText` de Kwirth.
- ⚠️ **El historial entero viaja en cada turno.** Una conversación larga gasta más en cada mensaje y puede
  exceder la ventana de contexto del modelo. En el MVP no se recorta: el error del proveedor se enseña
  (RF7) y el usuario empieza una conversación nueva.
- ⚠️ El e2e **no puede llamar a un LLM real** (sería lento, dependería de la red y gastaría dinero). Hace
  falta un modelo falso para el harness y el e2e.

## Criterios de aceptación

- Con un LLM configurado, una pregunta muestra *Thinking...* y después la respuesta, con el markdown
  renderizado.
- Un segundo turno que se refiere al primero ("y en Python?") demuestra que el contexto se mantiene.
- Con el tope de uso alcanzado, el mensaje de error aparece en la conversación.
- Sin LLMs configurados, aparece el aviso de RF1.
- El tarball publicado contiene el README.

## Abierto

Nada. Todo lo abierto se cerró el 2026-10-06: historial en memoria (D5), system prompt para todo el canal
(RF8), parámetros y LLM en el setup de la instancia (RF1, RF9) y sin streaming (D4).
