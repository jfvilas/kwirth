import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceConfigScope, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ESignalMessageLevel, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { FlightMapSetup, FlightMapIcon } from './FlightMapSetup'
import { FlightMapTabContent } from './FlightMapTabContent'
import { applyMessage, FlightMapData, FlightMapInstanceConfig, IFlightMapData } from './FlightMapData'
import { IFlightMapMessageResponse } from '../common/FlightMapTypes'

export class FlightMapChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = FlightMapSetup
    TabContent: FC<IContentProps> = FlightMapTabContent
    channelId = 'flightmap'

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
    getChannelIcon = (): JSX.Element => FlightMapIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as IFlightMapMessageResponse
        const data = channelObject.data as IFlightMapData

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
        channelObject.data = new FlightMapData()
        channelObject.instanceConfig = new FlightMapInstanceConfig()
        channelObject.config = {}
        return false
    }

    startChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IFlightMapData
        data.aircraft = []
        data.timestamp = ''
        data.error = ''
        data.signals = []
        data.started = true
        return true
    }

    stopChannel = (channelObject: IChannelObject): boolean => {
        (channelObject.data as IFlightMapData).started = false
        return true
    }

    pauseChannel = (_channelObject: IChannelObject): boolean => false
    continueChannel = (_channelObject: IChannelObject): boolean => false
    socketDisconnected = (_channelObject: IChannelObject): boolean => false
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
