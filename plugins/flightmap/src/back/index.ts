import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel, IProviderSubscriber } from '@kwirthmagnify/kwirth-common-back'
import { Request, Response } from 'express'
import { EFlightMapPayload, FLIGHT_STATUS_PROVIDER_ID, IAircraft, IFlightMapInstanceConfig, IFlightMapMessageResponse } from '../common/FlightMapTypes'

/** What the flight-status provider hands its subscribers. */
interface IFlightStatusEvent {
    type: 'positions' | 'error'
    timestamp: string
    aircraft?: IAircraft[]
    message?: string
}

interface IProviderHandle {
    subscribe(subscriber: IProviderSubscriber, data: unknown): unknown
    unsubscribe(subscriber: IProviderSubscriber): unknown
}

interface IInstance {
    instanceId: string
    accessKey: AccessKey
    config: IFlightMapInstanceConfig
    provider?: IProviderHandle
    /**
     * This instance's own subscriber. The provider keeps one subscription per subscriber object, so each
     * tab polls its own box at its own interval, instead of sharing the channel's.
     */
    subscriber?: IProviderSubscriber
}

interface ISocketEntry {
    ws: WebSocket
    lastRefresh: number
    instances: IInstance[]
}

export class FlightMapChannel implements IChannel {
    readonly channelId = 'flightmap'
    // declaring the provider is what makes the core instantiate it: flight-status exposes no router of its own
    readonly requirements: IBackChannelRequirements = { storage: false, providers: [FLIGHT_STATUS_PROVIDER_ID] }

    clusterInfo: any
    backChannelObject: IBackChannelObject
    private webSockets: ISocketEntry[] = []

    constructor(clusterInfo: unknown, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'flightmap',
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
            config: instanceConfig.data as IFlightMapInstanceConfig
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
            this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.INFO, instanceConfig.instance, 'Flight Map stopped')
        }
        else {
            this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceConfig.instance, 'Flight Map instance not found')
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
        const provider: IProviderHandle | undefined = this.clusterInfo.getProvider?.(FLIGHT_STATUS_PROVIDER_ID, this)
        if (!provider) {
            this.sendSignal(socket.ws, EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instance.instanceId,
                `The '${FLIGHT_STATUS_PROVIDER_ID}' provider is not installed: install it from the provider manager and restart Kwirth`)
            return
        }
        const subscriber: IProviderSubscriber = {
            processProviderEvent: (_providerId: string, obj: any) => this.deliver(socket, instance, obj as IFlightStatusEvent)
        }
        instance.provider = provider
        instance.subscriber = subscriber
        Promise.resolve(provider.subscribe(subscriber, instance.config)).catch(err => {
            this.sendSignal(socket.ws, EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instance.instanceId, `The '${FLIGHT_STATUS_PROVIDER_ID}' provider failed while adding the subscriber: ${String(err)}`)
        })
    }

    private unsubscribe = (instance: IInstance): void => {
        if (instance.provider && instance.subscriber) {
            Promise.resolve(instance.provider.unsubscribe(instance.subscriber)).catch(err => {
                this.backChannelObject.logWarning?.(`Flight Map could not unsubscribe instance ${instance.instanceId}: ${String(err)}`)
            })
        }
        instance.provider = undefined
        instance.subscriber = undefined
    }

    private deliver = (socket: ISocketEntry, instance: IInstance, event: IFlightStatusEvent): void => {
        const msg: IFlightMapMessageResponse = {
            msgtype: 'flightmapmessageresponse',
            channel: this.channelId,
            action: EInstanceMessageAction.NONE,
            flow: EInstanceMessageFlow.UNSOLICITED,
            type: EInstanceMessageType.DATA,
            instance: instance.instanceId,
            payloadType: event.type === 'error' ? EFlightMapPayload.ERROR : EFlightMapPayload.POSITIONS,
            timestamp: event.timestamp,
            aircraft: event.aircraft,
            error: event.message
        }
        try {
            socket.ws.send(JSON.stringify(msg))
        }
        catch (err) {
            this.backChannelObject.logWarning?.(`Flight Map could not send to instance ${instance.instanceId}: ${String(err)}`)
        }
    }

    private sendSignal = (ws: WebSocket, action: EInstanceMessageAction, flow: EInstanceMessageFlow, level: ESignalMessageLevel, instanceId: string, text: string): void => {
        const msg: ISignalMessage = { action, flow, channel: 'flightmap', instance: instanceId, type: EInstanceMessageType.SIGNAL, text, level }
        ws.send(JSON.stringify(msg))
    }

    private getInstance = (webSocket: WebSocket, instanceId: string): IInstance | undefined => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        return socket?.instances.find(i => i.instanceId === instanceId)
    }
}
