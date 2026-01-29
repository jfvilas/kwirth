import { FC } from 'react'
import { EChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { IKnown, EInstanceMessageAction, EInstanceMessageChannel, EInstanceMessageType, ITrivyMessage, ITrivyMessageResponse, IUnknown, ISignalMessage, ETrivyCommand, EInstanceMessageFlow, ESignalMessageLevel } from '@jfvilas/kwirth-common'
import { TrivyIcon, TrivySetup } from './TrivySetup'
import { TrivyTabContent } from './TrivyTabContent'
import { ITrivyData, TrivyData } from './TrivyData'
import { TrivyConfig, TrivyInstanceConfig } from './TrivyConfig'
import { ENotifyLevel } from '../../tools/Global'

export class TrivyChannel implements IChannel {
    private setupVisible = false
    private notify: (channel:IChannel, level:ENotifyLevel, message:string) => void = (cjannel:IChannel, level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = TrivySetup
    TabContent: FC<IContentProps> = TrivyTabContent
    channelId = 'trivy'
    
    requiresSetup() { return true }
    requiresSettings() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresFrontChannels() { return true }
    requiresClusterUrl() { return false }
    requiresWebSocket() { return true }
    requiresUserSettings() { return false }
    setNotifier(notifier: (channel:IChannel, level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'trivy$workload' }
    getChannelIcon(): JSX.Element { return TrivyIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = EChannelRefreshAction.NONE
        let trivyData:ITrivyData = channelObject.data
        let trivyMessageResponse:ITrivyMessageResponse = JSON.parse(wsEvent.data)

        switch (trivyMessageResponse.type) {
            case EInstanceMessageType.DATA:
                if (trivyMessageResponse.flow === EInstanceMessageFlow.RESPONSE && trivyMessageResponse.action === EInstanceMessageAction.COMMAND) {
                    if (trivyMessageResponse.data) {
                        action = EChannelRefreshAction.REFRESH
                        trivyData.score = trivyMessageResponse.data.score
                    }
                }
                else if (trivyMessageResponse.flow === EInstanceMessageFlow.UNSOLICITED) {
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
                    action = EChannelRefreshAction.REFRESH
                }
                break
            case EInstanceMessageType.SIGNAL:
                let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                if (signalMessage.flow === EInstanceMessageFlow.RESPONSE && signalMessage.action === EInstanceMessageAction.START) {
                    channelObject.instanceId = signalMessage.instance
                    //this.trivyRequestScore(channelObject)  Not needed, score gets updated when a vuln report is created
                }
                else {
                    if (signalMessage.level!== ESignalMessageLevel.INFO) console.log('SIGNAL RECEIVED',wsEvent.data)
                }
                break
            default:
                console.log(`Invalid message type ${trivyMessageResponse.type}`)
                break
        }


        return {
            action
        }
    }

    async initChannel(channelObject:IChannelObject): Promise<boolean> {
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
            command: ETrivyCommand.SCORE,
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.REQUEST,
            type: EInstanceMessageType.DATA,
            channel: EInstanceMessageChannel.TRIVY
        }
        channelObject.webSocket!.send(JSON.stringify(triviMessage))
    }

}    
