# Chapete — chat with an LLM from Kwirth

**Chapete** is a channel plugin for [Kwirth](https://kwirthmagnify.dev) that gives you a plain chat with a
large language model: a text box, the conversation and the answers, like ChatGPT or Claude, right inside
Kwirth.

It does **not** bring its own AI configuration. It uses the LLMs your Kwirth administrator already set up
in Kwirth's AI settings, so:

- the API keys stay in the Kwirth back end and never reach the browser;
- every question goes through Kwirth's AI usage limits, like any other AI call in Kwirth.

## Features

- Pick the LLM and the temperature when you start the channel.
- Multi-turn conversation: the model keeps the context of the whole chat.
- Answers rendered as Markdown (code blocks, tables, lists), with a button to copy them.
- A *Thinking...* indicator while the model works.
- **Enter** sends, **Shift+Enter** adds a new line.
- One **system prompt** for the whole channel, editable from the tab (⚙ button).
- Errors and usage limits are shown inside the conversation.

What it does **not** do, on purpose: it has no tools and does not read your cluster. For a chat that
knows your Kubernetes, look at Kwirth's other AI channels.

The conversation lives only in your browser tab: closing the tab, or stopping and starting the channel,
starts a new one.

## Requirements

- Kwirth with at least one **AI provider** and one **LLM** configured (Kwirth's AI settings).

## Installation

1. In Kwirth, add the **jfvilas marketplace** if it is not there yet:
   `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`
2. Open the **plugin manager** and install **Chapete** from that marketplace.
   You can also install it from its npm package, `@jfvilas/kwirth-plugin-chapete`.
3. Open a new tab, choose the **Chapete** channel and, in its setup, pick an LLM and a temperature.
4. Start the channel and type your question.

## Instance setup

| field | meaning |
|---|---|
| **LLM** | one of the LLMs configured in Kwirth. Fixed for the whole session of the channel |
| **Temperature** | 0 to 2. It starts at the LLM's own temperature; lower is more precise, higher is more creative |

## Links

- Kwirth: https://kwirthmagnify.dev — source at https://github.com/kwirthmagnify/kwirth
- Chapete source code: https://github.com/jfvilas/kwirth (folder `plugins/chapete`)
