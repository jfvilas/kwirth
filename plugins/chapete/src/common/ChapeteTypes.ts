import { IInstanceMessage } from '@kwirthmagnify/kwirth-common'

/** Who said it. The values are the SDK's own roles, so a message goes to the model as it is. */
export enum EChapeteRole {
    USER = 'user',
    ASSISTANT = 'assistant'
}

/** One turn of the conversation, exactly as the model receives it. */
export interface IChapeteMessage {
    role: EChapeteRole
    content: string
}

/**
 * What the instance setup decides. It is fixed for the whole session of the channel: changing the LLM or
 * the temperature means stopping and starting it again.
 */
export interface IChapeteInstanceConfig {
    /** id of an ILlm configured in the core */
    llmId: string
    temperature: number
}

/**
 * What the front end asks the back end for. A core COMMAND, with this 'command' inside.
 *
 * ⚠️ Every command must travel with its 'accessKey': the core discards them BEFORE they reach the
 * plugin when it is missing, and from here all that can be seen is a timeout with no clue at all.
 */
export enum EChapeteCommand {
    /** sends the whole conversation and gets the next answer */
    ASK = 'ask',
    /** returns the channel's system prompt */
    GETSYSTEM = 'getsystem',
    /** stores a new system prompt for the whole channel */
    SETSYSTEM = 'setsystem'
}

/** Nature of the message the back end sends the front end. */
export enum EChapetePayload {
    ANSWER = 'answer',
    SYSTEM = 'system'
}

export interface IChapeteAskRequest {
    /** local id of the question, to match the answer with the bubble that is waiting for it */
    id: string
    /** the WHOLE conversation: the back end keeps no state between turns */
    messages: IChapeteMessage[]
}

export interface IChapeteAnswer {
    /** the same id the request carried */
    id: string
    /** present when the model answered */
    text?: string
    /** present when it did not: the provider's error, a usage limit, or why it could not even be tried */
    error?: string
    /** the error is a usage limit reached, not a failure of the model */
    usageLimit?: boolean
    /** how long it took, in ms */
    elapsed: number
}

export interface IChapeteCommandMessage extends IInstanceMessage {
    msgtype: 'chapetemessage'
    /** the core drops a COMMAND without it before it reaches the plugin (see EChapeteCommand) */
    accessKey: string
    command: EChapeteCommand
    /** ASK only */
    ask?: IChapeteAskRequest
    /** SETSYSTEM only */
    system?: string
}

export interface IChapeteMessageResponse extends IInstanceMessage {
    msgtype: 'chapetemessageresponse'
    payloadType: EChapetePayload
    /** present when payloadType === ANSWER */
    answer?: IChapeteAnswer
    /** present when payloadType === SYSTEM */
    system?: string
}

/** What the model is told when nobody has written a system prompt for the channel yet. */
export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant. Answer in the same language the user writes in, and use Markdown when it makes the answer clearer.'
