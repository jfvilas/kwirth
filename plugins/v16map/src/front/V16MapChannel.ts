import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceConfigScope, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ESignalMessageLevel, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { V16MapSetup, V16MapIcon } from './V16MapSetup'
import { V16MapTabContent } from './V16MapTabContent'
import { applyMessage, IV16MapData, V16MapData, V16MapInstanceConfig } from './V16MapData'
import { IV16MapMessageResponse } from '../common/V16MapTypes'

export class V16MapChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = V16MapSetup
    TabContent: FC<IContentProps> = V16MapTabContent
    channelId = 'v16map'

    requirements: IChannelRequirements = {
        accessString: false,
        clusterUrl: false,
        clusterInfo: false,
        exit: false,
        frontChannels: false,
        backChannels: false,
        metrics: false,
        notifier: false,
        notifications: false,
        setup: true,
        settings: false,
        palette: false,
        userSettings: false,
        webSocket: false,
    }

    getScope = () => EInstanceConfigScope.NONE
    getChannelIcon = (): JSX.Element => V16MapIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as IV16MapMessageResponse
        const data = channelObject.data as IV16MapData

        switch (msg.type) {
            case EInstanceMessageType.DATA:
                applyMessage(data, msg)
                return { action: EChannelRefreshAction.REFRESH }
            case EInstanceMessageType.SIGNAL: {
                const signal: ISignalMessage = JSON.parse(wsEvent.data)
                if (signal.flow === EInstanceMessageFlow.RESPONSE && signal.action === EInstanceMessageAction.START) channelObject.instanceId = signal.instance
                if (signal.text && signal.level !== undefined && signal.level !== ESignalMessageLevel.INFO) data.signals.push(signal.text)
                return { action: EChannelRefreshAction.REFRESH }
            }
            default:
                return { action: EChannelRefreshAction.NONE }
        }
    }

    initChannel = async (channelObject: IChannelObject): Promise<boolean> => {
        channelObject.data = new V16MapData()
        channelObject.instanceConfig = new V16MapInstanceConfig()
        channelObject.config = {}
        return false
    }

    startChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IV16MapData
        data.points = {}
        data.signals = []
        data.lastUpdate = 0
        data.started = true
        return true
    }

    stopChannel = (channelObject: IChannelObject): boolean => {
        (channelObject.data as IV16MapData).started = false
        return true
    }

    pauseChannel = (_channelObject: IChannelObject): boolean => false
    continueChannel = (_channelObject: IChannelObject): boolean => false
    socketDisconnected = (_channelObject: IChannelObject): boolean => false
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
