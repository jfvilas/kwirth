import { ILlm, ILlmProvider } from '@kwirthmagnify/kwirth-common-ai'
import { buildModel, generateText, LanguageModel, UsageLimitError } from '@kwirthmagnify/kwirth-common-ai/back'
import { EChapeteRole, IChapeteAnswer, IChapeteAskRequest, IChapeteInstanceConfig, IChapeteMessage } from '../common/ChapeteTypes'

/** What a turn needs from the outside world. Injected so the harness can run it without reaching a provider. */
export interface IChapeteChatDeps {
    buildModel: (llm: ILlm, providers: ILlmProvider[]) => LanguageModel | null
    generateText: (options: IChapeteGenerateOptions) => Promise<{ text: string }>
}

/** The only options this channel passes to the model: no tools, a single step. */
export interface IChapeteGenerateOptions {
    model: LanguageModel
    system: string
    messages: Array<{ role: 'user' | 'assistant', content: string }>
    temperature: number
}

/*
    The real ones. 'generateText' is common-ai's, which the build maps to the CORE's copy: it is the one
    wrapped by the usage guard, so every turn of this chat is counted and can be cut like any other AI call
    in Kwirth.
*/
export const defaultChatDeps: IChapeteChatDeps = {
    buildModel,
    generateText: (options) => generateText(options)
}

/** Everything a turn depends on, already read from the core's storage. */
export interface IChapeteTurn {
    config: IChapeteInstanceConfig
    llms: ILlm[]
    providers: ILlmProvider[]
    system: string
    request: IChapeteAskRequest
}

/**
 * Why a conversation cannot be sent as it is, or undefined when it can. The front end already builds it
 * right; this is for what arrives broken, because what crosses the websocket is not to be trusted.
 */
export const invalidConversation = (messages: IChapeteMessage[] | undefined): string | undefined => {
    if (!Array.isArray(messages) || messages.length === 0) return 'The conversation is empty'
    for (const message of messages) {
        if (!message || typeof message.content !== 'string') return 'A message of the conversation has no text'
        if (message.role !== EChapeteRole.USER && message.role !== EChapeteRole.ASSISTANT) return `Unknown role '${String(message?.role)}'`
    }
    if (messages[messages.length - 1].role !== EChapeteRole.USER) return 'The last message of the conversation must be the user\'s'
    return undefined
}

/** The plugin's enum is an exact mirror of the SDK's roles; this maps it without a cast. */
const toModelMessage = (message: IChapeteMessage): { role: 'user' | 'assistant', content: string } =>
    message.role === EChapeteRole.USER ? { role: 'user', content: message.content } : { role: 'assistant', content: message.content }

/**
 * One turn of the chat. It ALWAYS answers, whether it went well or not: a failure has to reach the
 * conversation with its reason, never be left as a 'Thinking...' that does not end.
 */
export const runTurn = async (turn: IChapeteTurn, deps: IChapeteChatDeps = defaultChatDeps): Promise<IChapeteAnswer> => {
    const started = Date.now()
    const id = turn.request?.id ?? ''
    const fail = (error: string, usageLimit = false): IChapeteAnswer => ({
        id,
        error,
        ...(usageLimit ? { usageLimit: true } : {}),
        elapsed: Date.now() - started
    })

    const invalid = invalidConversation(turn.request?.messages)
    if (invalid) return fail(invalid)

    if (!turn.config?.llmId) return fail('No LLM selected for this channel. Stop it and pick one in its setup')
    const llm = turn.llms.find(l => l.id === turn.config.llmId)
    if (!llm) return fail(`LLM '${turn.config.llmId}' is no longer configured in Kwirth. Stop the channel and pick another one in its setup`)

    const model = deps.buildModel(llm, turn.providers)
    if (!model) return fail(`LLM '${llm.id}' could not be built: check its provider '${llm.provider}' and its key in Kwirth's AI settings`)

    try {
        const result = await deps.generateText({
            model,
            system: turn.system,
            messages: turn.request.messages.map(toModelMessage),
            temperature: turn.config.temperature
        })
        return { id, text: result.text, elapsed: Date.now() - started }
    }
    catch (err) {
        if (err instanceof UsageLimitError) return fail(err.message, true)
        return fail(err instanceof Error ? err.message : String(err))
    }
}
