import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceConfigScopeEnum, InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { TrivyIcon, TrivySetup } from './TrivySetup'
import { TrivyTabContent } from './TrivyTabContent'
import { TrivyMessage as ITrivyMessage, TrivyMessageResponse as ITrivyMessageResponse, ITrivyObject, TrivyCommandEnum, TrivyObject } from './TrivyObject'
import { TrivyInstanceConfig, TrivyUiConfig } from './TrivyConfig'

export class TrivyChannel implements IChannel {
    private setupVisible = false
    private paused = false
    SetupDialog: FC<ISetupProps> = TrivySetup
    TabContent: FC<IContentProps> = TrivyTabContent
    
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresWebSocket() { return true }
    getScope() { return InstanceConfigScopeEnum.WORKLOAD}
    getChannelId(): string { return 'alert' }
    getChannelIcon(): JSX.Element { return TrivyIcon }
    getChannelUiConfig(): any { return new TrivyUiConfig() }
    getChannelInstanceConfig(): any { return new TrivyInstanceConfig() }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
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
                    console.log()
                    let asset = trivyMessageResponse.data
                    switch (trivyMessageResponse.msgsubtype) {
                        case 'score':
                            console.log('newscore',trivyMessageResponse.data.score)
                            trivyObject.score = trivyMessageResponse.data.score
                            break
                        case 'add':
                            trivyObject.known.push(asset)
                            break
                        case 'update':
                        case 'delete':
                            console.log(trivyObject.known)
                            console.log(asset)
                            trivyObject.known = (trivyObject.known as any[]).filter(a => a.namespace !== asset.namespace || a.name !== asset.name || a.container !== asset.container)
                            if (trivyMessageResponse.msgsubtype==='update') trivyObject.known.push(asset)
                            break
                        default:
                            console.log('Invalid msgsubtype: ', trivyMessageResponse.msgsubtype)
                    }
                    trivyObject.known = [...trivyObject.known]
                    action = IChannelMessageAction.REFRESH
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = signalMessage.instance
                    this.trivyRequestScore(channelObject)
                }
                else {
                    if (signalMessage.level!== SignalMessageLevelEnum.INFO) {
                        console.log('SIGNAL RECEIVED')
                        console.log(wsEvent.data)
                    }
                }
                break
            default:
                console.log(`Invalid message type ${trivyMessageResponse.type}`)
                break
        }


        return action
    }

    initChannel(channelObject:IChannelObject): boolean {
        console.log('initChannel')
        channelObject.uiData = new TrivyObject()
        channelObject.instanceConfig = new TrivyInstanceConfig()
        channelObject.uiConfig = new TrivyUiConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        console.log('startChannel')
        channelObject.uiData = new TrivyObject()
        channelObject.uiData.started=true
        this.paused = false
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        console.log('pauseChannel')
        this.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        console.log('contChannel')
        this.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        console.log('stopChannel')
        this.paused = false
        channelObject.uiData.started=false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return true
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }


    // PRIVATE
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
