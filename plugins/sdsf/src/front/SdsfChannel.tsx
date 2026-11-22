import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ENotifyLevel, ESignalMessageLevel, IInstanceMessage, IExtensionScope, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { SdsfSetup, SdsfIcon } from './SdsfSetup'
import { SdsfTabContent } from './SdsfTabContent'
import { SdsfConfig, SdsfInstanceConfig } from './SdsfConfig'
import { ISdsfData, SdsfData } from './SdsfData'
import { ESdsfScope, ISdsfMessageResponse, SDSF_SCOPES } from '../common/SdsfTypes'
import { SdsfBackSource } from './SdsfBackSource'
import { SdsfSession } from '../common/SdsfSession'

export class SdsfChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = SdsfSetup
    TabContent: FC<IContentProps> = SdsfTabContent
    channelId = 'sdsf'

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
        // nothing to set up: SDSF starts straight on the cluster picked in the cluster list
        setup: false,
        settings: false,
        palette: false,
        userSettings: false,
        webSocket: true,
    }

    // The scope the instance is opened with, as magnify does: the lowest that lets SDSF open.
    getScope = (): string => ESdsfScope.READ
    getScopeCatalog = (): IExtensionScope[] => SDSF_SCOPES
    getChannelIcon = (): JSX.Element => SdsfIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as IInstanceMessage
        if (msg.type === EInstanceMessageType.SIGNAL) {
            const signal = msg as ISignalMessage
            // A rejection from the core or the channel (no permission, for one): say it, do not swallow it.
            if (signal.level === ESignalMessageLevel.ERROR) {
                channelObject.notify?.(channelObject.channelId, ENotifyLevel.ERROR, signal.text || 'SDSF reported an error')
                return { action: EChannelRefreshAction.NONE }
            }
            if (signal.flow === EInstanceMessageFlow.RESPONSE && signal.action === EInstanceMessageAction.START && signal.instance) {
                channelObject.instanceId = signal.instance
                return { action: EChannelRefreshAction.REFRESH }
            }
            return { action: EChannelRefreshAction.NONE }
        }
        // An answer to the session: it repaints by itself through its listeners, nothing to refresh here.
        const response = msg as ISdsfMessageResponse
        if (response.msgtype === 'sdsfmessageresponse') (channelObject.data as ISdsfData).source?.resolve(response)
        return { action: EChannelRefreshAction.NONE }
    }

    initChannel = async (channelObject: IChannelObject): Promise<boolean> => {
        channelObject.data = new SdsfData()
        channelObject.instanceConfig = new SdsfInstanceConfig()
        channelObject.config = new SdsfConfig()
        return false
    }

    startChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as ISdsfData
        // Restarting keeps nothing from the previous session: a new logon, a new menu.
        this.endSession(data, 'The channel was restarted.')
        data.source = new SdsfBackSource(channelObject)
        data.session = new SdsfSession(channelObject.clusterName || 'KWIRTH', data.source)
        data.started = true
        return true
    }

    stopChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as ISdsfData
        this.endSession(data, 'The channel was stopped.')
        data.started = false
        return true
    }

    private endSession = (data: ISdsfData, reason: string): void => {
        data.source?.rejectAll(reason)
        data.session?.dispose()
        data.session = undefined
        data.source = undefined
    }

    pauseChannel = (_channelObject: IChannelObject): boolean => true
    continueChannel = (_channelObject: IChannelObject): boolean => true
    // Nobody will answer what was asked over a socket that is gone: the session gets its error now, not in 30 s.
    socketDisconnected = (channelObject: IChannelObject): boolean => {
        (channelObject.data as ISdsfData).source?.rejectAll('The connection to Kwirth was lost.')
        return false
    }
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
