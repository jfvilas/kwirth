import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel, IProviderSubscriber } from '@kwirthmagnify/kwirth-common-back'
import { Request, Response } from 'express'
import { EV16MapPayload, IV16MapInstanceConfig, IV16MapMessageResponse, V16_PROVIDER_ID } from '../common/V16MapTypes'
import { toPoint } from './V16Extract'

/** What the v16 provider hands its subscribers (see providers/v16/src/common/V16Types.ts). */
interface IV16Event {
    type: 'initial' | 'update'
    added: Record<string, unknown>[]
    updated: Record<string, unknown>[]
    removed: string[]
}

interface IProviderHandle {
    subscribe(subscriber: IProviderSubscriber, data: unknown): unknown
    unsubscribe(subscriber: IProviderSubscriber): unknown
}

interface IInstance {
    instanceId: string
    accessKey: AccessKey
    config: IV16MapInstanceConfig
    provider?: IProviderHandle
    /**
     * This instance's own subscriber. The provider keeps one subscription per subscriber object, so each
     * tab gets its own 'initial' snapshot and its own filter, instead of sharing the channel's.
     */
    subscriber?: IProviderSubscriber
}

interface ISocketEntry {
    ws: WebSocket
    lastRefresh: number
    instances: IInstance[]
}

export class V16MapChannel implements IChannel {
    readonly channelId = 'v16map'
    // declaring the provider is what makes the core instantiate it: v16 exposes no router of its own
    readonly requirements: IBackChannelRequirements = { storage: false, providers: [V16_PROVIDER_ID] }

    clusterInfo: any
    backChannelObject: IBackChannelObject
    private webSockets: ISocketEntry[] = []

    constructor(clusterInfo: unknown, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'v16map',
        routable: false,
        pauseable: false,
        modifiable: false,
        reconnectable: true,
        metrics: false,
        sources: [EClusterType.KUBERNETES],
        endpoints: [],
        websocket: false,
        cluster: false,         // standalone: the selector picks the 'none' view and names the tab after the channel
        resourced: false
    })

    getChannelScopeLevel = (scope: string): number => ['', 'none'].indexOf(scope)

    startChannel = async (): Promise<void> => {}
    // never invoked: each instance subscribes with its own proxy (see IInstance.subscriber)
    processProviderEvent = (_providerId: string, _obj: unknown): void => {}
    endpointRequest = async (_endpoint: string, _req: Request, _res: Response): Promise<void> => {}
    websocketRequest = async (_ws: WebSocket): Promise<void> => {}

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
            config: { v16Only: Boolean((instanceConfig.data as IV16MapInstanceConfig | undefined)?.v16Only) }
        }
        socket.instances.push(instance)
        this.subscribe(socket, instance)
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
            this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.INFO, instanceConfig.instance, 'V16 Map stopped')
        }
        else {
            this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceConfig.instance, 'V16 Map instance not found')
        }
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        if (!socket) return
        const instance = socket.instances.find(i => i.instanceId === instanceId)
        if (instance) this.unsubscribe(instance)
        socket.instances = socket.instances.filter(i => i.instanceId !== instanceId)
    }

    // nothing to command: the tab only listens
    processCommand = async (_webSocket: WebSocket, _instanceMessage: IInstanceMessage): Promise<boolean> => false

    containsAsset = (_ws: WebSocket, _ns: string, _pod: string, _ctr: string): boolean => false

    containsInstance = (instanceId: string): boolean =>
        this.webSockets.some(s => s.instances.some(i => i.instanceId === instanceId))

    getInstances = (): IChannelInstances => {
        const carrying = this.webSockets.filter(s => s.instances.length > 0)
        return { instances: carrying.reduce((n, s) => n + s.instances.length, 0), connections: carrying.length }
    }

    containsConnection = (webSocket: WebSocket): boolean =>
        Boolean(this.webSockets.find(s => s.ws === webSocket))

    // a connection that goes away takes its subscriptions with it, or the provider keeps feeding ghosts
    removeConnection = (webSocket: WebSocket): void => {
        for (const socket of this.webSockets.filter(s => s.ws === webSocket)) {
            for (const instance of socket.instances) this.unsubscribe(instance)
        }
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

    // ---- provider ---------------------------------------------------------------
    private subscribe = (socket: ISocketEntry, instance: IInstance): void => {
        const provider: IProviderHandle | undefined = this.clusterInfo.getProvider?.(V16_PROVIDER_ID, this)
        if (!provider) {
            this.sendSignal(socket.ws, EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instance.instanceId,
                `The '${V16_PROVIDER_ID}' provider is not installed: install it from the provider manager and restart Kwirth`)
            return
        }
        const subscriber: IProviderSubscriber = {
            processProviderEvent: (_providerId: string, obj: any) => this.deliver(socket, instance, obj as IV16Event)
        }
        instance.provider = provider
        instance.subscriber = subscriber
        Promise.resolve(provider.subscribe(subscriber, { v16Only: instance.config.v16Only })).catch(err => {
            this.sendSignal(socket.ws, EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instance.instanceId, `The '${V16_PROVIDER_ID}' provider failed while adding the subscriber: ${String(err)}`)
        })
    }

    private unsubscribe = (instance: IInstance): void => {
        if (instance.provider && instance.subscriber) {
            Promise.resolve(instance.provider.unsubscribe(instance.subscriber)).catch(err => {
                this.backChannelObject.logWarning?.(`V16 Map could not unsubscribe instance ${instance.instanceId}: ${String(err)}`)
            })
        }
        instance.provider = undefined
        instance.subscriber = undefined
    }

    private deliver = (socket: ISocketEntry, instance: IInstance, event: IV16Event): void => {
        const msg: IV16MapMessageResponse = {
            msgtype: 'v16mapmessageresponse',
            channel: this.channelId,
            action: EInstanceMessageAction.NONE,
            flow: EInstanceMessageFlow.UNSOLICITED,
            type: EInstanceMessageType.DATA,
            instance: instance.instanceId,
            payloadType: event.type === 'initial' ? EV16MapPayload.SNAPSHOT : EV16MapPayload.CHANGES,
            added: (event.added ?? []).map(toPoint),
            updated: (event.updated ?? []).map(toPoint),
            removed: event.removed ?? [],
            at: Date.now()
        }
        try {
            socket.ws.send(JSON.stringify(msg))
        }
        catch (err) {
            this.backChannelObject.logWarning?.(`V16 Map could not send to instance ${instance.instanceId}: ${String(err)}`)
        }
    }

    private sendSignal = (ws: WebSocket, action: EInstanceMessageAction, flow: EInstanceMessageFlow, level: ESignalMessageLevel, instanceId: string, text: string): void => {
        const msg: ISignalMessage = { action, flow, channel: 'v16map', instance: instanceId, type: EInstanceMessageType.SIGNAL, text, level }
        ws.send(JSON.stringify(msg))
    }

    private getInstance = (webSocket: WebSocket, instanceId: string): IInstance | undefined => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        return socket?.instances.find(i => i.instanceId === instanceId)
    }
}
