import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceConfigScope, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ESignalMessageLevel, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { ChapeteSetup, ChapeteIcon } from './ChapeteSetup'
import { ChapeteTabContent } from './ChapeteTabContent'
import { ChapeteConfig, ChapeteInstanceConfig } from './ChapeteConfig'
import { IChapeteData, ChapeteData, abandonPending, completeAnswer } from './ChapeteData'
import { EChapetePayload, IChapeteMessageResponse } from '../common/ChapeteTypes'

export class ChapeteChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = ChapeteSetup
    TabContent: FC<IContentProps> = ChapeteTabContent
    channelId = 'chapete'

    requirements: IChannelRequirements = {
        accessString: true,     // every COMMAND travels with its accessKey, and the setup reads the LLMs with it
        clusterUrl: true,       // the setup asks the core for its LLMs
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
        webSocket: true,        // the tab sends its questions through the instance's websocket
    }

    getScope = () => EInstanceConfigScope.NONE
    getChannelIcon = (): JSX.Element => ChapeteIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as IChapeteMessageResponse
        const data = channelObject.data as IChapeteData

        switch (msg.type) {
            case EInstanceMessageType.DATA:
                switch (msg.payloadType) {
                    case EChapetePayload.SYSTEM:
                        data.system = msg.system ?? ''
                        break
                    case EChapetePayload.ANSWER:
                        if (msg.answer) completeAnswer(data.entries, msg.answer)
                        break
                }
                return { action: EChannelRefreshAction.REFRESH }
            case EInstanceMessageType.SIGNAL: {
                const signal: ISignalMessage = JSON.parse(wsEvent.data)
                if (signal.flow === EInstanceMessageFlow.RESPONSE && signal.action === EInstanceMessageAction.START) channelObject.instanceId = signal.instance
                // the core's answer to the start carries no 'level'; this channel's own signals always do
                if (signal.text && signal.level !== undefined && signal.level !== ESignalMessageLevel.INFO) data.signals.push(signal.text)
                return { action: EChannelRefreshAction.REFRESH }
            }
            default:
                return { action: EChannelRefreshAction.NONE }
        }
    }

    initChannel = async (channelObject: IChannelObject): Promise<boolean> => {
        channelObject.data = new ChapeteData()
        channelObject.instanceConfig = new ChapeteInstanceConfig()
        channelObject.config = new ChapeteConfig()
        return false
    }

    /*
        A start is a new session: the LLM or the temperature may have changed in the setup, so the
        conversation starts over too, instead of continuing a chat begun with another model.
    */
    startChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IChapeteData
        data.entries = []
        data.signals = []
        data.started = true
        return true
    }

    stopChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IChapeteData
        abandonPending(data.entries)
        data.started = false
        return true
    }

    pauseChannel = (_channelObject: IChannelObject): boolean => false
    continueChannel = (_channelObject: IChannelObject): boolean => false
    socketDisconnected = (_channelObject: IChannelObject): boolean => false
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
