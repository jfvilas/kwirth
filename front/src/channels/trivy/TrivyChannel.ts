import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { IKnown, InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ITrivyMessage, ITrivyMessageResponse, IUnknown, ISignalMessage, SignalMessageLevelEnum, TrivyCommandEnum } from '@jfvilas/kwirth-common'
import { TrivyIcon, TrivySetup } from './TrivySetup'
import { TrivyTabContent } from './TrivyTabContent'
import { ITrivyObject, TrivyObject } from './TrivyObject'
import { TrivyInstanceConfig, TrivyUiConfig } from './TrivyConfig'

export class TrivyChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = TrivySetup
    TabContent: FC<IContentProps> = TrivyTabContent
    channelId = 'trivy'
    
    requiresSetup() { return true }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresClusterUrl() { return false }
    requiresWebSocket() { return true }
    setNotifier(notifier: any): void { }

    getScope() { return 'trivy$workload' }
    getChannelIcon(): JSX.Element { return TrivyIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        let trivyObject:ITrivyObject = channelObject.uiData
        let trivyMessageResponse:ITrivyMessageResponse = JSON.parse(wsEvent.data)

        switch (trivyMessageResponse.type) {
            case InstanceMessageTypeEnum.DATA:
                if (trivyMessageResponse.flow === InstanceMessageFlowEnum.RESPONSE && trivyMessageResponse.action === InstanceMessageActionEnum.COMMAND) {
                    if (trivyMessageResponse.data) {
                        action = IChannelMessageAction.REFRESH
                        trivyObject.score = trivyMessageResponse.data.score
                    }
                }
                else if (trivyMessageResponse.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                    switch (trivyMessageResponse.msgsubtype) {
                        case 'score':
                            trivyObject.score = trivyMessageResponse.data.score
                            break
                        case 'add':
                            if (trivyMessageResponse.data.known) trivyObject.known.push(trivyMessageResponse.data.known as IKnown)
                            if (trivyMessageResponse.data.unknown) trivyObject.unknown.push(trivyMessageResponse.data.unknown as IUnknown)
                            break
                        case 'update':
                        case 'delete':
                            let assetKnown:IKnown = trivyMessageResponse.data.known
                            trivyObject.known = (trivyObject.known as IKnown[]).filter(a => a.namespace !== assetKnown.namespace || a.name !== assetKnown.name || a.container !== assetKnown.container)
                            if (trivyMessageResponse.msgsubtype==='update' && trivyMessageResponse.data.known) trivyObject.known.push(assetKnown)
                            break
                        default:
                            console.log('Invalid msgsubtype: ', trivyMessageResponse.msgsubtype)
                    }
                    trivyObject.known = [...trivyObject.known]
                    action = IChannelMessageAction.REFRESH
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = signalMessage.instance
                    //this.trivyRequestScore(channelObject)  Not needed, score gets updated when a vuln report is created
                }
                else {
                    if (signalMessage.level!== SignalMessageLevelEnum.INFO) console.log('SIGNAL RECEIVED',wsEvent.data)
                }
                break
            default:
                console.log(`Invalid message type ${trivyMessageResponse.type}`)
                break
        }


        return action
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.uiData = new TrivyObject()
        channelObject.instanceConfig = new TrivyInstanceConfig()
        channelObject.uiConfig = new TrivyUiConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let trivyObject:ITrivyObject = channelObject.uiData
        trivyObject.paused = false
        trivyObject.started = true
        trivyObject.known = []
        trivyObject.unknown = []
        trivyObject.score = 0
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let trivyObject:ITrivyObject = channelObject.uiData
        trivyObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let trivyObject:ITrivyObject = channelObject.uiData
        trivyObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let trivyObject:ITrivyObject = channelObject.uiData
        trivyObject.paused = false
        trivyObject.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return true
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }


    // *************************************************************************************
    // PRIVATE
    // *************************************************************************************

    trivyRequestScore = (channelObject:IChannelObject) => {
        let triviMessage: ITrivyMessage = {
            msgtype: 'trivymessage',
            id: '1',
            accessKey: channelObject.accessString!,
            instance: channelObject.instanceId,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            command: TrivyCommandEnum.SCORE,
            action: InstanceMessageActionEnum.COMMAND,
            flow: InstanceMessageFlowEnum.REQUEST,
            type: InstanceMessageTypeEnum.DATA,
            channel: InstanceMessageChannelEnum.TRIVY
        }
        channelObject.webSocket!.send(JSON.stringify(triviMessage))
    }

}    
