import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { IKnown, InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ITrivyMessage, ITrivyMessageResponse, IUnknown, ISignalMessage, SignalMessageLevelEnum, TrivyCommandEnum } from '@jfvilas/kwirth-common'
import { TrivyIcon, TrivySetup } from './TrivySetup'
import { TrivyTabContent } from './TrivyTabContent'
import { ITrivyData, TrivyData } from './TrivyData'
import { TrivyConfig, TrivyInstanceConfig } from './TrivyConfig'
import { ENotifyLevel } from '../../tools/Global'

export class TrivyChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = TrivySetup
    TabContent: FC<IContentProps> = TrivyTabContent
    channelId = 'trivy'
    
    requiresSetup() { return true }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresClusterUrl() { return false }
    requiresWebSocket() { return true }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'trivy$workload' }
    getChannelIcon(): JSX.Element { return TrivyIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        let trivyData:ITrivyData = channelObject.data
        let trivyMessageResponse:ITrivyMessageResponse = JSON.parse(wsEvent.data)

        switch (trivyMessageResponse.type) {
            case InstanceMessageTypeEnum.DATA:
                if (trivyMessageResponse.flow === InstanceMessageFlowEnum.RESPONSE && trivyMessageResponse.action === InstanceMessageActionEnum.COMMAND) {
                    if (trivyMessageResponse.data) {
                        action = IChannelMessageAction.REFRESH
                        trivyData.score = trivyMessageResponse.data.score
                    }
                }
                else if (trivyMessageResponse.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                    switch (trivyMessageResponse.msgsubtype) {
                        case 'score':
                            trivyData.score = trivyMessageResponse.data.score
                            break
                        case 'add':
                            if (trivyMessageResponse.data.known) trivyData.known.push(trivyMessageResponse.data.known as IKnown)
                            if (trivyMessageResponse.data.unknown) trivyData.unknown.push(trivyMessageResponse.data.unknown as IUnknown)
                            break
                        case 'update':
                        case 'delete':
                            let assetKnown:IKnown = trivyMessageResponse.data.known
                            trivyData.known = (trivyData.known as IKnown[]).filter(a => a.namespace !== assetKnown.namespace || a.name !== assetKnown.name || a.container !== assetKnown.container)
                            if (trivyMessageResponse.msgsubtype==='update' && trivyMessageResponse.data.known) trivyData.known.push(assetKnown)
                            break
                        default:
                            console.log('Invalid msgsubtype: ', trivyMessageResponse.msgsubtype)
                    }
                    trivyData.known = [...trivyData.known]
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
        channelObject.data = new TrivyData()
        channelObject.instanceConfig = new TrivyInstanceConfig()
        channelObject.config = new TrivyConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let trivyData:ITrivyData = channelObject.data
        trivyData.paused = false
        trivyData.started = true
        trivyData.known = []
        trivyData.unknown = []
        trivyData.score = 0
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let trivyData:ITrivyData = channelObject.data
        trivyData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let trivyData:ITrivyData = channelObject.data
        trivyData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let trivyData:ITrivyData = channelObject.data
        trivyData.paused = false
        trivyData.started = false
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
