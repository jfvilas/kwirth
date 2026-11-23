import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ENotifyLevel, ESignalMessageLevel, IInstanceMessage, IExtensionScope, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { EDisplay } from '@jfvilas/kwirth-dce-blockterm'
import { WrkactjobSetup, WrkactjobIcon } from './WrkactjobSetup'
import { WrkactjobTabContent } from './WrkactjobTabContent'
import { WrkactjobConfig, WrkactjobInstanceConfig } from './WrkactjobConfig'
import { IWrkactjobData, WrkactjobData } from './WrkactjobData'
import { EWrkModel, EWrkScope, IWrkactjobInstanceConfig, IWrkactjobMessageResponse, WRK_MODEL_GEOMETRY, WRK_SCOPES } from '../common/WrkactjobTypes'
import { WrkBackSource } from './WrkBackSource'
import { WrkSession } from '../common/WrkSession'

export class WrkactjobChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = WrkactjobSetup
    TabContent: FC<IContentProps> = WrkactjobTabContent
    channelId = 'wrkactjob'

    requirements: IChannelRequirements = {
        accessString: true,
        clusterUrl: true,
        clusterInfo: false,
        exit: false,
        frontChannels: false,
        backChannels: false,
        metrics: false,
        notifier: true,
        notifications: false,
        // the terminal: model (24x80 or 27x132) and colour or green screen, asked when it starts
        setup: true,
        settings: false,
        palette: false,
        userSettings: false,
        webSocket: true,
    }

    // The scope the instance is opened with: the lowest that lets WRKACTJOB open.
    getScope = (): string => EWrkScope.READ
    getScopeCatalog = (): IExtensionScope[] => WRK_SCOPES
    getChannelIcon = (): JSX.Element => WrkactjobIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as IInstanceMessage
        const data = channelObject.data as IWrkactjobData
        if (msg.type === EInstanceMessageType.SIGNAL) {
            const signal = msg as ISignalMessage
            // A rejection from the core or the channel (no permission, for one): say it, do not swallow it.
            if (signal.level === ESignalMessageLevel.ERROR) {
                channelObject.notify?.(channelObject.channelId, ENotifyLevel.ERROR, signal.text || 'WRKACTJOB reported an error')
                return { action: EChannelRefreshAction.NONE }
            }
            if (signal.flow === EInstanceMessageFlow.RESPONSE && signal.action === EInstanceMessageAction.START && signal.instance) {
                channelObject.instanceId = signal.instance
                // the instance exists now: the session can ask for its first list
                data.session?.connected()
                return { action: EChannelRefreshAction.REFRESH }
            }
            return { action: EChannelRefreshAction.NONE }
        }
        // An answer to the session: it repaints by itself through its listeners, nothing to refresh here.
        const response = msg as IWrkactjobMessageResponse
        if (response.msgtype === 'wrkactjobmessageresponse') data.source?.resolve(response)
        return { action: EChannelRefreshAction.NONE }
    }

    initChannel = async (channelObject: IChannelObject): Promise<boolean> => {
        channelObject.data = new WrkactjobData()
        channelObject.instanceConfig = new WrkactjobInstanceConfig()
        channelObject.config = new WrkactjobConfig()
        return false
    }

    startChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IWrkactjobData
        // Restarting keeps nothing from the previous session.
        this.endSession(data, 'The channel was restarted.')
        const config = channelObject.instanceConfig as Partial<IWrkactjobInstanceConfig> | undefined
        const model = Object.values(EWrkModel).find(m => m === config?.model) ?? EWrkModel.MODEL_24X80
        data.display = Object.values(EDisplay).find(d => d === config?.display) ?? EDisplay.COLOR
        data.source = new WrkBackSource(channelObject)
        data.session = new WrkSession(channelObject.clusterName || 'KWIRTH', data.source, WRK_MODEL_GEOMETRY[model])
        data.started = true
        return true
    }

    stopChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IWrkactjobData
        this.endSession(data, 'The channel was stopped.')
        data.started = false
        return true
    }

    private endSession = (data: IWrkactjobData, reason: string): void => {
        data.source?.rejectAll(reason)
        data.session?.dispose()
        data.session = undefined
        data.source = undefined
    }

    pauseChannel = (_channelObject: IChannelObject): boolean => true
    continueChannel = (_channelObject: IChannelObject): boolean => true
    // Nobody will answer what was asked over a socket that is gone: the session gets its error now, not in 30 s.
    socketDisconnected = (channelObject: IChannelObject): boolean => {
        (channelObject.data as IWrkactjobData).source?.rejectAll('The connection to Kwirth was lost.')
        return false
    }
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
