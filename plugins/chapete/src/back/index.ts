import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel } from '@kwirthmagnify/kwirth-common-back'
import { ILlm, ILlmProvider, STORAGE_KEY_LLMS, STORAGE_KEY_PROVIDERS } from '@kwirthmagnify/kwirth-common-ai'
import { Request, Response } from 'express'
import { DEFAULT_SYSTEM_PROMPT, EChapeteCommand, EChapetePayload, IChapeteAnswer, IChapeteAskRequest, IChapeteCommandMessage, IChapeteInstanceConfig, IChapeteMessageResponse } from '../common/ChapeteTypes'
import { runTurn } from './ChapeteChat'

/** The channel's system prompt: ONE for every user and every instance (PRD, RF8). */
const STORAGE_KEY_SYSTEM = 'chapete-system'

interface IInstance {
    instanceId: string
    accessKey: AccessKey
    config: IChapeteInstanceConfig
}

interface ISocketEntry {
    ws: WebSocket
    lastRefresh: number
    instances: IInstance[]
}

// 'implements IChannel' is what makes the compiler hold this class to the contract: without it, a method
// the core requires (getInstances, for instance) can be missing and the build still passes.
export class ChapeteChannel implements IChannel {
    readonly channelId = 'chapete'
    // storage: the system prompt lives in the channel's, and the LLMs are read from the common one
    readonly requirements: IBackChannelRequirements = { storage: true, providers: [] }

    clusterInfo: unknown
    backChannelObject: IBackChannelObject
    private webSockets: ISocketEntry[] = []

    constructor(clusterInfo: unknown, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'chapete',
        routable: false,
        pauseable: false,       // nothing flows on its own: it only answers when asked
        modifiable: false,      // the LLM and the temperature are fixed for the session
        reconnectable: true,
        metrics: false,
        sources: [EClusterType.KUBERNETES],
        endpoints: [],
        websocket: false,
        cluster: true,          // a chat does not hang from a pod
        resourced: false
    })

    getChannelScopeLevel = (scope: string): number => ['', 'none', 'cluster'].indexOf(scope)

    startChannel = async (): Promise<void> => {}
    processProviderEvent = (_providerId: string, _obj: unknown): void => {}
    endpointRequest = async (_endpoint: string, _req: Request, _res: Response): Promise<void> => {}
    websocketRequest = async (_ws: WebSocket): Promise<void> => {}

    // ---- registration: cluster channels arrive here through addObject('*all') ----
    addObject = async (webSocket: WebSocket, instanceConfig: IInstanceConfig, _ns: string, _pod: string, _ctr: string): Promise<boolean> => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (!socket) {
            const len = this.webSockets.push({ ws: webSocket, lastRefresh: Date.now(), instances: [] })
            socket = this.webSockets[len - 1]
        }
        if (socket.instances.find(i => i.instanceId === instanceConfig.instance)) return true

        const instance: IInstance = {
            instanceId: instanceConfig.instance,
            accessKey: accessKeyDeserialize(instanceConfig.accessKey),
            config: instanceConfig.data as IChapeteInstanceConfig
        }
        socket.instances.push(instance)
        // the system prompt goes out on start: the settings dialog of the tab shows it
        await this.sendSystem(socket, instance)
        return true
    }

    deleteObject = async (webSocket: WebSocket, instanceConfig: IInstanceConfig, _ns: string, _pod: string, _ctr: string): Promise<boolean> => {
        this.removeInstance(webSocket, instanceConfig.instance)
        return true
    }

    pauseContinueInstance = (_webSocket: WebSocket, _instanceConfig: IInstanceConfig, _action: EInstanceMessageAction): void => {}

    modifyInstance = (_ws: WebSocket, _cfg: IInstanceConfig): void => {}

    stopInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig): void => {
        if (this.getInstance(webSocket, instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.INFO, instanceConfig.instance, 'Chapete stopped')
        }
        else {
            this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceConfig.instance, 'Chapete instance not found')
        }
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) socket.instances = socket.instances.filter(i => i.instanceId !== instanceId)
    }

    processCommand = async (webSocket: WebSocket, instanceMessage: IInstanceMessage): Promise<boolean> => {
        if (instanceMessage.flow === EInstanceMessageFlow.IMMEDIATE) return false
        if (instanceMessage.action !== EInstanceMessageAction.COMMAND) return false

        const socket = this.webSockets.find(s => s.ws === webSocket)
        const instance = this.getInstance(webSocket, instanceMessage.instance)
        if (!socket || !instance) {
            this.sendSignal(webSocket, instanceMessage.action, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceMessage.instance, 'Chapete instance not found')
            return false
        }

        const msg = instanceMessage as IChapeteCommandMessage
        switch (msg.command) {
            case EChapeteCommand.ASK:
                await this.ask(socket, instance, msg.ask)
                return true
            case EChapeteCommand.GETSYSTEM:
                await this.sendSystem(socket, instance)
                return true
            case EChapeteCommand.SETSYSTEM:
                await this.setSystem(socket, instance, msg.system)
                return true
            default:
                this.sendSignal(webSocket, instanceMessage.action, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceMessage.instance, `Unknown command '${String(msg.command)}'`)
                return false
        }
    }

    containsAsset = (_ws: WebSocket, _ns: string, _pod: string, _ctr: string): boolean => false

    containsInstance = (instanceId: string): boolean =>
        this.webSockets.some(s => s.instances.some(i => i.instanceId === instanceId))

    // What this channel has running, for the Status channel's Plugins tab. A connection counts while it
    // carries an instance: one left with none is on its way out.
    getInstances = (): IChannelInstances => {
        const carrying = this.webSockets.filter(s => s.instances.length > 0)
        return { instances: carrying.reduce((n, s) => n + s.instances.length, 0), connections: carrying.length }
    }

    containsConnection = (webSocket: WebSocket): boolean =>
        Boolean(this.webSockets.find(s => s.ws === webSocket))

    removeConnection = (webSocket: WebSocket): void => {
        this.webSockets = this.webSockets.filter(s => s.ws !== webSocket)
    }

    refreshConnection = (webSocket: WebSocket): boolean => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) { socket.lastRefresh = Date.now(); return true }
        return false
    }

    updateConnection = (newWebSocket: WebSocket, instanceId: string): boolean => {
        for (const entry of this.webSockets) {
            if (entry.instances.some(i => i.instanceId === instanceId)) {
                entry.ws = newWebSocket
                return true
            }
        }
        return false
    }

    // ---- chat ------------------------------------------------------------------
    /*
        The LLMs and the providers are read on EVERY turn, not once on start: they are the core's, and an
        administrator who fixes a key in the AI settings expects the next question to use it.
    */
    private ask = async (socket: ISocketEntry, instance: IInstance, request: IChapeteAskRequest | undefined): Promise<void> => {
        if (!request) {
            this.sendSignal(socket.ws, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instance.instanceId, 'Ask command received with no payload')
            return
        }
        let answer: IChapeteAnswer
        try {
            const providers: ILlmProvider[] = (await this.backChannelObject.readStorageCommon!(STORAGE_KEY_PROVIDERS, true)) ?? []
            const llms: ILlm[] = (await this.backChannelObject.readStorageCommon!(STORAGE_KEY_LLMS, false)) ?? []
            const system = await this.readSystem()
            answer = await runTurn({ config: instance.config, llms, providers, system, request })
        }
        catch (err) {
            answer = { id: request.id, error: `Could not read Kwirth's AI configuration: ${err instanceof Error ? err.message : String(err)}`, elapsed: 0 }
        }
        if (answer.error) this.backChannelObject.logWarning?.(`Chapete could not answer with LLM '${instance.config?.llmId}': ${answer.error}`)
        this.send(socket, instance, { payloadType: EChapetePayload.ANSWER, answer }, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE)
    }

    private readSystem = async (): Promise<string> => {
        const stored: unknown = await this.backChannelObject.readStorage!(STORAGE_KEY_SYSTEM, false)
        return typeof stored === 'string' && stored.trim() !== '' ? stored : DEFAULT_SYSTEM_PROMPT
    }

    private sendSystem = async (socket: ISocketEntry, instance: IInstance): Promise<void> => {
        let system = DEFAULT_SYSTEM_PROMPT
        try {
            system = await this.readSystem()
        }
        catch (err) {
            this.backChannelObject.logWarning?.(`Chapete could not read its system prompt, using the default one: ${String(err)}`)
        }
        this.send(socket, instance, { payloadType: EChapetePayload.SYSTEM, system }, EInstanceMessageAction.NONE, EInstanceMessageFlow.UNSOLICITED)
    }

    /*
        An empty text is stored as such and means 'the default one': there is no separate reset, so clearing
        the field is how the default comes back.
    */
    private setSystem = async (socket: ISocketEntry, instance: IInstance, system: string | undefined): Promise<void> => {
        if (typeof system !== 'string') {
            this.sendSignal(socket.ws, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instance.instanceId, 'Set system command received with no text')
            return
        }
        try {
            await this.backChannelObject.writeStorage!(STORAGE_KEY_SYSTEM, false, system)
        }
        catch (err) {
            this.sendSignal(socket.ws, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instance.instanceId, `Could not store the system prompt: ${String(err)}`)
            return
        }
        await this.sendSystem(socket, instance)
    }

    private send = (socket: ISocketEntry, instance: IInstance, payload: Pick<IChapeteMessageResponse, 'payloadType' | 'answer' | 'system'>, action: EInstanceMessageAction, flow: EInstanceMessageFlow): void => {
        const msg: IChapeteMessageResponse = {
            msgtype: 'chapetemessageresponse',
            channel: this.channelId,
            action,
            flow,
            type: EInstanceMessageType.DATA,
            instance: instance.instanceId,
            ...payload
        }
        socket.ws.send(JSON.stringify(msg))
    }

    private sendSignal = (ws: WebSocket, action: EInstanceMessageAction, flow: EInstanceMessageFlow, level: ESignalMessageLevel, instanceId: string, text: string): void => {
        const msg: ISignalMessage = { action, flow, channel: 'chapete', instance: instanceId, type: EInstanceMessageType.SIGNAL, text, level }
        ws.send(JSON.stringify(msg))
    }

    private getInstance = (webSocket: WebSocket, instanceId: string): IInstance | undefined => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        return socket?.instances.find(i => i.instanceId === instanceId)
    }
}
