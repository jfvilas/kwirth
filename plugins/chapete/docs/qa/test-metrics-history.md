# Chapete — histórico de métricas de test

> Registro **incremental** de la suite de tests, una fila por **CL9 / tag**. Se **añade** una fila arriba en
> cada cierre (punto 2 de la checklist CL9); **no se sobrescribe**: es un histórico.
>
> **Cómo se obtiene cada dato:**
> - **Harness** = nº de tests que reporta `npm test` (`node --test`).
> - **Cobertura** = `COVERAGE=1 npm test` (Node `--experimental-test-coverage`). ⚠️ Es sobre lo que el harness
>   **carga** (la llamada al modelo, el canal del back y los datos del front), **no** el 100% del código: los
>   componentes React (`.tsx`) los cubre el e2e (no medido numéricamente). El informe sale sobre el bundle
>   único de tests, sin mapear a `src/`.
> - **e2e** = nº de spec files (`e2e/tests/*.spec.ts`) y nº de casos `test()`.

| Fecha | Versión / tag | Harness | Cobertura (líneas / ramas / funcs) | e2e (specs / casos) | Notas |
|---|---|---|---|---|---|
| 2026-10-06 | `plugin/chapete@0.1.0` | **45** | **96.47% / 95.39% / 88.41%** | 1 / 10 | **S1: el plugin funcionando.** Chat con un LLM de los configurados en el core: LLM y temperatura en el setup de la instancia, respuesta completa con *Thinking...* mientras llega (sin streaming, decidido así), Markdown con botón de copiar, *New chat*, un system prompt para todo el canal y errores (también los topes de uso) dentro de la conversación. La llamada sale del back con el `generateText` de `common-ai`, que el build mapea a la copia del **core**: cuenta y se corta como cualquier otra llamada de IA de Kwirth, sin tocar ni `common-ai` ni el core. El e2e usa un **LLM falso** (un servidor compatible con OpenAI en localhost, dado de alta como provider `openai-compat`) y es **no destructivo**: suma su provider y su LLM a los del dev, los retira al acabar y **lo comprueba releyendo la API**, y devuelve el system prompt del canal a como estaba. El caso "sin LLMs" se simula interceptando la petición en el navegador, no vaciando la configuración. 🐛 Uno propio del e2e: un locator que cogía el `<strong>` y no el párrafo con el número. 📦 Antes del primer publish el plugin se mudó a `@jfvilas` y a github.com/jfvilas/kwirth; harness y e2e se repitieron desde allí (45 y 10/10). Una corrida coincidió con el reinicio del core por tocar `kwirth-dev.json` y dejó el LLM de prueba puesto; la siguiente lo retiró sola. |
