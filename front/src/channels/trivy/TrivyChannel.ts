import { FC } from 'react'
import { EChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IChannelRequirements, IContentProps, ISetupProps } from '../IChannel'
import { EInstanceMessageAction, EInstanceMessageChannel, EInstanceMessageType, ISignalMessage, ETrivyCommand, EInstanceMessageFlow, ESignalMessageLevel, IInstanceMessage } from '@jfvilas/kwirth-common'
import { TrivyIcon, TrivySetup } from './TrivySetup'
import { TrivyTabContent } from './TrivyTabContent'
import { ITrivyData, ITrivyMessage, ITrivyMessageResponse, IAsset, TrivyData } from './TrivyData'
import { TrivyConfig, TrivyInstanceConfig } from './TrivyConfig'

export class TrivyChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = TrivySetup
    TabContent: FC<IContentProps> = TrivyTabContent
    channelId = 'trivy'
    
    requirements:IChannelRequirements = {
        accessString: true,
        clusterUrl: true,
        clusterInfo: false,
        exit: false,
        frontChannels: false,
        metrics: false,
        notifier: true,
        setup: true,
        settings: false,
        palette: false,
        userSettings: false,
        webSocket: true
    }

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
                            switch(trivyMessageResponse.data.resource) {
                                case 'vulnerabilityreports':
                                    let assetv:IAsset = {
                                        name: trivyMessageResponse.data.known.name,
                                        namespace: trivyMessageResponse.data.known.namespace,
                                        container: trivyMessageResponse.data.known.container,
                                        unknown: {
                                            statusCode: 0,
                                            statusMessage: ''
                                        },
                                        vulnerabilityreports: {
                                            score: trivyMessageResponse.data.known.score,
                                            report: trivyMessageResponse.data.known.report
                                        },
                                        configauditreports: {
                                            report: undefined
                                        }
                                    }
                                    let existingv = trivyData.assets.find(a => a.name===trivyMessageResponse.data.known.name && a.namespace===trivyMessageResponse.data.known.namespace && a.container===trivyMessageResponse.data.known.container)
                                    if (existingv) {
                                        console.log('exist')
                                        existingv.vulnerabilityreports = {
                                            score: trivyMessageResponse.data.known.score,
                                            report: trivyMessageResponse.data.known.report
                                        }
                                    }
                                    else {
                                        trivyData.assets.push(assetv)
                                    }
                                    break
                                case 'configauditreports':
                                    let assetc:IAsset = {
                                        name: trivyMessageResponse.data.known.name,
                                        namespace: trivyMessageResponse.data.known.namespace,
                                        container: trivyMessageResponse.data.known.container,
                                        unknown: {
                                            statusCode: 0,
                                            statusMessage: ''
                                        },
                                        vulnerabilityreports: {
                                            score: 0,
                                            report: undefined
                                        },
                                        configauditreports: {
                                            report: trivyMessageResponse.data.known.report
                                        }
                                    }
                                    let existingc = trivyData.assets.find(a => a.name===trivyMessageResponse.data.known.name && a.namespace===trivyMessageResponse.data.known.namespace && a.container===trivyMessageResponse.data.known.container)
                                    if (existingc) {
                                        existingc.configauditreports = {
                                            report: trivyMessageResponse.data.known.report
                                        }
                                    }
                                    else {
                                        trivyData.assets.push(assetc)
                                    }
                                    break
                            }
                            break
                        case 'update':
                        case 'delete':
                            switch(trivyMessageResponse.data.resource) {
                                case 'vulnerabilityreports':
                                    // let assetKnown:IAsset = trivyMessageResponse.data.known
                                    // if (assetKnown) {
                                    //     trivyData.assets = trivyData.assets.filter(a => a.namespace !== assetKnown.namespace || a.name !== assetKnown.name || a.container !== assetKnown.container)
                                    //     if (trivyMessageResponse.msgsubtype==='update' && trivyMessageResponse.data.known) trivyData.assets.push(assetKnown)
                                    // }
                                    break
                                case 'configauditreports':
                                    break
                            }
                            break
                        default:
                            console.log('Invalid msgsubtype: ', trivyMessageResponse.msgsubtype)
                    }
                    trivyData.assets = [...trivyData.assets]
                    action = EChannelRefreshAction.REFRESH
                }
                break
            case EInstanceMessageType.SIGNAL:
                let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                if (signalMessage.flow === EInstanceMessageFlow.RESPONSE) {
                    switch(signalMessage.action) {
                        case EInstanceMessageAction.START:
                            channelObject.instanceId = signalMessage.instance
                            if (!channelObject.data.ri) {
                                // just connected, we request endpoints id for uload/dload
                                let instanceConfig:IInstanceMessage = {
                                    action: EInstanceMessageAction.RI,
                                    channel: 'trivy',
                                    flow: EInstanceMessageFlow.REQUEST,
                                    type: EInstanceMessageType.SIGNAL,
                                    instance: channelObject.instanceId
                                }
                                channelObject.webSocket!.send(JSON.stringify( instanceConfig ))
                            }
                            break
                        case EInstanceMessageAction.RI:
                            trivyData.ri = signalMessage.data
                            break
                        default:
                            console.log('Received signal action:', signalMessage.action)
                            break
                    }
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
        trivyData.assets = []
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
