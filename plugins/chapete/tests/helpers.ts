// Common mocks for chapete's unit tests (the sender-debug pattern).
// No infrastructure is brought up and no provider is reached: the storage is a pair of maps, the model
// is a fake, and the WebSocket traffic is captured with MockWs.
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, IInstanceMessage } from '@kwirthmagnify/kwirth-common'
import { ILlm, ILlmProvider, STORAGE_KEY_LLMS, STORAGE_KEY_PROVIDERS } from '@kwirthmagnify/kwirth-common-ai'
import { LanguageModel } from '@kwirthmagnify/kwirth-common-ai/back'
import { EChapeteCommand, EChapetePayload, IChapeteAnswer, IChapeteAskRequest, IChapeteInstanceConfig, IChapeteMessageResponse } from '../src/common/ChapeteTypes'
import { IChapeteChatDeps, IChapeteGenerateOptions } from '../src/back/ChapeteChat'

// Fake WebSocket: it keeps every send() and offers typed views of the traffic.
export class MockWs {
    readyState = 1
    sent: string[] = []
    send(s: string): void { this.sent.push(s) }
    close(): void {}
    parsed(): Array<Record<string, unknown>> { return this.sent.map(s => JSON.parse(s) as Record<string, unknown>) }
    clear(): void { this.sent = [] }

    private data(): IChapeteMessageResponse[] {
        return this.parsed().filter(m => m.type === EInstanceMessageType.DATA) as unknown as IChapeteMessageResponse[]
    }

    answers(): IChapeteAnswer[] {
        return this.data().filter(m => m.payloadType === EChapetePayload.ANSWER).map(m => m.answer as IChapeteAnswer)
    }

    /** every system prompt the back end reported, in order */
    systems(): string[] {
        return this.data().filter(m => m.payloadType === EChapetePayload.SYSTEM).map(m => m.system as string)
    }

    signals(): Array<Record<string, unknown>> {
        return this.parsed().filter(m => m.type === EInstanceMessageType.SIGNAL)
    }
}

export const provider = (over: Partial<ILlmProvider> = {}): ILlmProvider => ({
    name: 'fake-provider',
    type: 'openai-compat',
    key: 'sk-fake',
    models: [],
    endpoint: 'http://127.0.0.1:1/v1',
    ...over
})

export const llm = (over: Partial<ILlm> = {}): ILlm => ({
    id: 'fake-llm',
    provider: 'fake-provider',
    model: 'fake-model',
    temperature: 0.3,
    useProviderKey: true,
    key: '',
    ...over
})

/**
 * The channel's back object: logs, plus the two storages — the channel's own and the common one the core
 * keeps the AI configuration in. Writes land in 'channel', so a test can look at what was stored.
 */
export const makeBackObj = (common: Record<string, unknown> = {}, channel: Record<string, unknown> = {}) => {
    const warnings: string[] = []
    const obj = {
        logInfo: () => {},
        logWarning: (text: unknown) => { warnings.push(String(text)) },
        logError: () => {},
        readStorage: async (id: string, _secret: boolean) => channel[id],
        writeStorage: async (id: string, _secret: boolean, value: unknown) => { channel[id] = value },
        readStorageCommon: async (id: string, _secret: boolean) => common[id],
        writeStorageCommon: async (id: string, _secret: boolean, value: unknown) => { common[id] = value }
    }
    return { obj, warnings, channelStore: channel, commonStore: common }
}

/** a common storage with one provider and one LLM, the way the core's AI settings leave it */
export const aiStorage = (llms: ILlm[] = [llm()], providers: ILlmProvider[] = [provider()]): Record<string, unknown> => ({
    [STORAGE_KEY_PROVIDERS]: providers,
    [STORAGE_KEY_LLMS]: llms
})

export const instanceConfigFor = (instance: string, data: IChapeteInstanceConfig = { llmId: 'fake-llm', temperature: 0.9 }) => ({
    instance,
    accessKey: 'tester|permanent|cluster::::',
    data
})

export const command = (instance: string, cmd: EChapeteCommand, extra: { ask?: IChapeteAskRequest, system?: string } = {}): IInstanceMessage => ({
    action: EInstanceMessageAction.COMMAND,
    flow: EInstanceMessageFlow.REQUEST,
    type: EInstanceMessageType.DATA,
    channel: 'chapete',
    instance,
    accessKey: 'tester|permanent|cluster::::',
    msgtype: 'chapetemessage',
    command: cmd,
    ...extra
} as unknown as IInstanceMessage)

/** A model nobody will call: the fake generateText never touches it. */
export const FAKE_MODEL = { fake: true } as unknown as LanguageModel

/** Deps that record what reached the model and answer with whatever the test asks for. */
export const fakeDeps = (answer: (options: IChapeteGenerateOptions) => Promise<{ text: string }> = async () => ({ text: 'ok' })) => {
    const calls: IChapeteGenerateOptions[] = []
    const deps: IChapeteChatDeps = {
        buildModel: () => FAKE_MODEL,
        generateText: async (options) => {
            calls.push(options)
            return answer(options)
        }
    }
    return { deps, calls }
}
