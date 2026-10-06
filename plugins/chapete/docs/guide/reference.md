# Chapete

The **Chapete** plugin is a plain chat with an LLM: a text box, the conversation and the answers. It uses the LLMs configured in Kwirth's AI settings and calls them from the back end with `common-ai`'s `generateText`, so the API keys never reach the browser and every turn is counted against Kwirth's AI usage limits. It has no tools and does not read the cluster.

**Instance config (`IChapeteInstanceConfig`):**

| Field | Type | Default | Description |
|---|---|---|---|
| `llmId` | `string` | `''` | Id of an LLM configured in Kwirth. Required: the setup does not let the channel start without it. |
| `temperature` | `number` | `0.7` | `0` to `2`. The setup proposes the chosen LLM's own temperature. |

Both are fixed for the session: the channel is not `modifiable`.

**Channel storage:**

| Key | Description |
|---|---|
| `chapete-system` | The channel's system prompt, one for every user and instance. Empty or absent = the default one. |

**Commands (`EChapeteCommand`)** — sent by the tab as core `COMMAND` messages, each with its `accessKey`:

| Command | Payload | Answer |
|---|---|---|
| `ask` | `{ id, messages: IChapeteMessage[] }` — the whole conversation, ending with the user's turn | `IChapeteAnswer`: `{ id, text }` or `{ id, error, usageLimit? }`, plus `elapsed` |
| `getsystem` | — | the current system prompt |
| `setsystem` | `system: string` | the stored system prompt |

The back end keeps no conversation state: each `ask` carries the full history, and the LLMs and providers are read from the core's storage on every turn, so a change in the AI settings applies from the next question on. A usage limit is reported with `usageLimit: true`, so it can be told apart from a failure of the model.

Chapete is cluster-scoped (set **View** to `cluster`); start it from the tab's **⚙️ → Start**.

See the [Chapete guide](guide.md).
