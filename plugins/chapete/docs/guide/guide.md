# 🗨️ Chapete (plugin)

> **Type:** Plugin (channel)<br>
> **Package:** `@jfvilas/kwirth-plugin-chapete`<br>
> **Marketplace:** `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`<br>
> **Icon:** 🗨️

## Overview

**Chapete** is a plain chat with a large language model, inside Kwirth: a text box, the conversation and the answers, the way you would use ChatGPT or Claude.

It brings no AI configuration of its own. It uses the **LLMs already configured in Kwirth's AI settings**, so whoever manages those keys keeps managing them in one place, and every question goes through the same **AI usage limits** as any other AI call in Kwirth.

## Why it exists

Kwirth talks to LLMs in many places, but always *for something*: analysing events, classifying logs, answering about the cluster. Sometimes all you need is to **ask**: draft a manifest, understand an error message, get a command right. Without a place for that, people open another browser tab with another chat, another account and another key, outside the limits Kwirth applies to its own AI usage.

## How it works

- **The question is answered by the Kwirth back end**, never by your browser. The API key of the LLM stays in the back end, and the call is counted against the usage limits of that key, exactly like the rest of Kwirth's AI calls.
- **The whole conversation is sent on every turn.** That is what lets the model remember what was said before ("and in Python?"). The conversation lives **only in your browser tab**: closing the tab, pressing *New chat*, or stopping and starting the channel starts a new one.
- **The answer arrives complete.** While the model works, a *Thinking...* bubble is shown, and it is replaced by the answer when it arrives.
- **The system prompt belongs to the channel**: one for everybody, and it applies from the next question on.
- **Chapete has no tools** and does not read your cluster: the model only knows what you write in the chat.

## Getting started

1. Make sure Kwirth has at least one **AI provider** and one **LLM** configured.
2. Choose **Cluster**, set **View** to `cluster`, pick the **chapete** channel and click **ADD**.
3. Open the tab's **⚙️ → Start**. The setup asks for the **LLM** and the **Temperature** (see below).
4. Type your question and press **Enter**.

If Kwirth has no LLM configured, the setup says so instead of showing an empty list, and **OK** stays disabled until there is one.

## The setup

| Field | Meaning |
|---|---|
| `LLM` | One of the LLMs configured in Kwirth, shown as `id (provider/model)`. If there is only one, it is already selected |
| `Temperature` | From `0` to `2`. It starts at the temperature that LLM has in Kwirth's AI settings; lower is more precise, higher is more creative |

Both are **fixed while the channel runs**, and the tab header shows them. To use another model or another temperature, stop the channel and start it again: the conversation starts over too, so a chat begun with one model is not continued by another.

## Chatting

| Action | How |
|---|---|
| Send a question | **Enter**, or the **SEND** button |
| New line inside the question | **Shift+Enter** |
| Copy an answer | The copy icon under the answer. It copies the answer as Markdown |
| Start over | The **+** icon in the header (*New chat*) |
| Change the system prompt | The ⚙️ icon in the chat header (not the tab's) |

Answers are rendered as **Markdown**: headings, lists, tables, links (they open in a new tab) and code blocks.

While an answer is pending, the message box and **SEND** are disabled.

## The system prompt

The system prompt is what the model is told before every conversation. Chapete starts with a default one that asks the model to answer in the same language you write in and to use Markdown when it helps.

Open it with the ⚙️ icon of the chat header, edit it and press **SAVE**. **CANCEL** closes without changes. Leaving it empty brings back the default one.

> ⚠️ The system prompt is **shared by everybody using Chapete**: saving it changes the next answer of every open chat.

## When something goes wrong

Errors are shown **inside the conversation**, in red, with their reason. They are never sent back to the model in the next turns.

| What you see | What it means |
|---|---|
| The provider's own message (`401 …`, `invalid model …`) | The LLM provider rejected the call: check the key, the model or the endpoint in Kwirth's AI settings |
| `Usage limit reached. …` | A usage limit configured in Kwirth's AI settings was reached. The message says which one and how much was used |
| `LLM '<id>' is no longer configured in Kwirth` | The LLM chosen in the setup was removed. Stop the channel and pick another one |
| `LLM '<id>' could not be built` | The LLM has no key, or its provider is missing. Fix it in Kwirth's AI settings |
| `No answer: the channel was stopped before the model replied.` | You stopped the channel while a question was pending |

## Related

- [Chapete reference](reference.md) — instance configuration and commands.
- [Kwirth documentation](https://kwirthmagnify.dev) — where the AI providers, the LLMs and their usage limits are configured.
