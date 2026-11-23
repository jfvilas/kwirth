import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceConfigScope } from '@kwirthmagnify/kwirth-common'
import { WrkactjobSetup, WrkactjobIcon } from './WrkactjobSetup'
import { WrkactjobTabContent } from './WrkactjobTabContent'
import { WrkactjobConfig, WrkactjobInstanceConfig } from './WrkactjobConfig'
import { IWrkactjobData, WrkactjobData } from './WrkactjobData'
import { IWrkactjobMessageResponse } from '../common/WrkactjobTypes'

export class WrkactjobChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = WrkactjobSetup
    TabContent: FC<IContentProps> = WrkactjobTabContent
    channelId = 'wrkactjob'

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
    getChannelIcon = (): JSX.Element => WrkactjobIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as IWrkactjobMessageResponse
        const data = channelObject.data as IWrkactjobData
        // the scaffold's placeholder: the 5250 session replaces it in S4
        if (msg.detail) data.messages.push(msg.detail)
        return { action: EChannelRefreshAction.REFRESH }
    }

    initChannel = async (channelObject: IChannelObject): Promise<boolean> => {
        channelObject.data = new WrkactjobData()
        channelObject.instanceConfig = new WrkactjobInstanceConfig()
        channelObject.config = new WrkactjobConfig()
        return false
    }

    startChannel = (channelObject: IChannelObject): boolean => {
        (channelObject.data as IWrkactjobData).messages = []
        return true
    }

    stopChannel = (_channelObject: IChannelObject): boolean => true
    pauseChannel = (_channelObject: IChannelObject): boolean => true
    continueChannel = (_channelObject: IChannelObject): boolean => true
    socketDisconnected = (_channelObject: IChannelObject): boolean => false
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
