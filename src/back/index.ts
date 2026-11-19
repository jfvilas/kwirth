import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel } from '@kwirthmagnify/kwirth-common-back'
import { Request, Response } from 'express'
import { IAbyssPatrolInstanceConfig } from '../common/AbyssPatrolTypes'

/*
    The game runs entirely in the browser. The back end only registers the instance: without it the core
    drops every command for this channel, and the front end could not pause or stop it.
*/
interface IInstance {
    instanceId: string
    accessKey: AccessKey
    config: IAbyssPatrolInstanceConfig
    paused: boolean
}

// 'implements IChannel' is what makes the compiler hold this class to the contract: without it, a method
// the core requires (getInstances, for instance) can be missing and the build still passes.
export class AbyssPatrolChannel implements IChannel {
    readonly channelId = 'depthcharge'
    readonly requirements: IBackChannelRequirements = { storage: false, providers: [] }

    clusterInfo: any
    backChannelObject: IBackChannelObject
    private webSockets: { ws: WebSocket; lastRefresh: number; instances: IInstance[] }[] = []

    constructor(clusterInfo: any, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'depthcharge',
        routable: false,
        pauseable: true,
        modifiable: false,
        reconnectable: false,
        metrics: false,
        sources: [EClusterType.KUBERNETES],
        endpoints: [],
        websocket: false,
        cluster: false,
        resourced: false
    })

    getChannelScopeLevel = (scope: string): number => ['', 'none'].indexOf(scope)

    startChannel = async (): Promise<void> => {}
    processProviderEvent = (_providerId: string, _obj: unknown): void => {}
    endpointRequest = async (_endpoint: string, _req: Request, _res: Response): Promise<void> => {}
    websocketRequest = async (_ws: WebSocket): Promise<void> => {}

    processCommand = async (webSocket: WebSocket, instanceMessage: IInstanceMessage): Promise<boolean> => {
        if (!this.getInstance(webSocket, instanceMessage.instance)) {
            this.sendSignal(webSocket, EInstanceMessageAction.NONE, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceMessage.instance, 'Instance not found')
            return false
        }
        return true
    }

    // Standalone channel: the core calls this once with the three selectors empty.
    addObject = async (webSocket: WebSocket, instanceConfig: IInstanceConfig): Promise<boolean> => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (!socket) {
            this.webSockets.push({ ws: webSocket, lastRefresh: Date.now(), instances: [] })
            socket = this.webSockets[this.webSockets.length - 1]
        }
        if (!socket.instances.some(i => i.instanceId === instanceConfig.instance)) {
            socket.instances.push({ instanceId: instanceConfig.instance, accessKey: accessKeyDeserialize(instanceConfig.accessKey), config: instanceConfig.data as IAbyssPatrolInstanceConfig, paused: false })
        }
        return true
    }

    deleteObject = async (_ws: WebSocket, _cfg: IInstanceConfig, _ns: string, _pod: string, _ctr: string): Promise<boolean> => true

    pauseContinueInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig, action: EInstanceMessageAction): void => {
        const instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) instance.paused = action === EInstanceMessageAction.PAUSE
    }

    modifyInstance = (_ws: WebSocket, _cfg: IInstanceConfig): void => {}

    stopInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig): void => {
        this.removeInstance(webSocket, instanceConfig.instance)
        this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.INFO, instanceConfig.instance, 'Depth Charge stopped')
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) socket.instances = socket.instances.filter(i => i.instanceId !== instanceId)
    }

    /*
        ── Configuration portability (IExtension) ──────────────────────────────────────────────────

        Kwirth knows how to export and import a whole installation's configuration (Settings -> Kwirth
        -> Export). Of this plugin, what the CORE stores already travels — its installation
        configuration — without you having to do anything.

        What the core CANNOT export is whatever YOU store: should this channel start persisting
        configuration of its own (`backChannelObject.writeStorage`, a database, an external service),
        uncomment these two methods and fill them in. They are optional: as long as you do not
        implement them, the plugin is declared as not yet exporting its own, which is the truth.

        THREE RULES, and all three get forgotten:

          1. WHAT TRAVELS. Configuration only: what somebody put together by hand and would hate to
             redo. NOT the data you accumulate, nor THIS installation's preferences. When in doubt:
             would you want this the same in another cluster? If the answer is "it depends on the
             cluster", it does not travel.
          2. SECRETS. With `includeCredentials` false, the secret fields are returned EMPTY, they are
             not omitted: the destination has to be able to say which ones to fill in. And on
             importing, an empty secret must NOT delete the one that was already here.
          3. IDEMPOTENCE. Importing what you exported yourself cannot change anything. And what
             arrives may come from another cluster or be edited by hand: validate it.

        import { IExtensionExportOptions, IExtensionImportResult } from '@kwirthmagnify/kwirth-common'

        exportConfig = async (options: IExtensionExportOptions): Promise<unknown> => {
            const config = await this.backChannelObject.readStorage!('depthcharge-config', false) ?? {}
            void options
            return { config }
        }

        importConfig = async (data: unknown): Promise<IExtensionImportResult> => {
            const incoming = (data as { config?: unknown })?.config
            if (!incoming || typeof incoming !== 'object') {
                return { applied: 0, skipped: 0, warnings: ['no configuration found in the imported data'] }
            }
            await this.backChannelObject.writeStorage!('depthcharge-config', false, incoming)
            return { applied: 1, skipped: 0, warnings: [] }
        }
    */

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

    private sendSignal = (ws: WebSocket, action: EInstanceMessageAction, flow: EInstanceMessageFlow, level: ESignalMessageLevel, instanceId: string, text: string): void => {
        const msg: ISignalMessage = { action, flow, channel: 'depthcharge', instance: instanceId, type: EInstanceMessageType.SIGNAL, text, level }
        ws.send(JSON.stringify(msg))
    }

    private getInstance = (webSocket: WebSocket, instanceId: string): IInstance | undefined => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        return socket?.instances.find(i => i.instanceId === instanceId)
    }
}
