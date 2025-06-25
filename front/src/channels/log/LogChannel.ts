import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceConfigScopeEnum, InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage } from '@jfvilas/kwirth-common'
import { LogIcon, LogSetup } from './LogSetup'
import { LogTabContent } from './LogTabContent'
import { LogObject, ILogMessage, ILogLine } from './LogObject'
import { LogInstanceConfig, LogSortOrderEnum, LogUiConfig } from './LogConfig'

export class LogChannel implements IChannel {
    private setupVisible = false
    private paused = false
    SetupDialog: FC<ISetupProps> = LogSetup
    TabContent: FC<IContentProps> = LogTabContent
    channelId = 'log'
    
    requiresMetrics() { return false }
    requiresAccessString() { return false }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.VIEW }
    getChannelIcon(): JSX.Element { return LogIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        let logObject = channelObject.uiData as LogObject
        let logUiConfig = channelObject.uiConfig as LogUiConfig

        const getMsgEpoch = (lmsg:ILogLine) =>{
            return (new Date(lmsg.text.split(' ')[0])).getTime()
        }

        let logMessage = JSON.parse(wsEvent.data) as ILogMessage

        switch (logMessage.type) {
            case InstanceMessageTypeEnum.DATA:
                action = IChannelMessageAction.REFRESH

                let bname = logMessage.namespace+'/'+logMessage.pod+'/'+logMessage.container
                let text = logMessage.text
                if (logObject.buffers.get(bname)) {
                    text = logObject.buffers.get(bname) + text
                    logObject.buffers.set(bname,'')
                }
                if (!text.endsWith('\n')) {
                    let i = text.lastIndexOf('\n')
                    let next = text.substring(i)
                    logObject.buffers.set(bname, next)
                    text = text.substring(0,i)
                }

                for (let line of text.split('\n')) {
                    if (line.trim() === '') continue

                    let logLine:ILogLine = {
                        text: line,
                        namespace: logMessage.namespace,
                        pod: logMessage.pod,
                        container: logMessage.container,
                        type: logMessage.type
                    }
                    if (logUiConfig.startDiagnostics) {
                        if (logObject.messages.length < logUiConfig.maxMessages) {
                            let cnt = logObject.counters.get(bname)
                            if (!cnt) {
                                logObject.counters.set(bname,0)
                                cnt = 0
                            }
                            if (cnt < logUiConfig.maxPerPodMessages) {
                                switch (logUiConfig.sortOrder) {
                                    case LogSortOrderEnum.POD:
                                        let podIndex = logObject.messages.findLastIndex(m => m.container===logLine.container && m.pod===logLine.pod && m.namespace===logLine.namespace)
                                        logObject.messages.splice(podIndex+1,0,logLine)
                                        break
                                    case LogSortOrderEnum.TIME:
                                        let timeIndex = logObject.messages.findLastIndex(m => getMsgEpoch(m) < getMsgEpoch(logLine))
                                        logObject.messages.splice(timeIndex+1,0,logLine)
                                        break
                                    default:
                                        logObject.messages.push(logLine)
                                        break
                                }
                                logObject.counters.set(bname, ++cnt)
                            }
                            if ([...logObject.counters.values()].reduce((prev,acc) => prev+acc, 0) > logUiConfig.maxMessages) {
                                action = IChannelMessageAction.STOP
                            }
                        }
                        else {
                            action = IChannelMessageAction.STOP
                        }
                    }
                    else {
                        logObject.messages.push(logLine)
                        if (logObject.messages.length > logUiConfig.maxMessages) logObject.messages.splice(0, logObject.messages.length - logUiConfig.maxMessages)
                    }
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage = JSON.parse(wsEvent.data) as InstanceMessage
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                else if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    logObject.messages.push({
                        text: signalMessage.text,
                        namespace: '',
                        pod: '',
                        container: '',
                        type: InstanceMessageTypeEnum.DATA
                    })
                }
                else {
                    logObject.messages.push(logMessage)
                    action = IChannelMessageAction.REFRESH
                }
                break
            default:
                console.log(`Invalid message type`, logMessage)
                break
        }

        return action
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.instanceConfig = new LogInstanceConfig()
        channelObject.uiConfig = new LogUiConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        this.paused = false;
        channelObject.uiData = new LogObject()

        let logInstanceConfig:LogInstanceConfig = channelObject.instanceConfig
        let logConfig:LogInstanceConfig = new LogInstanceConfig()

        if (channelObject.uiConfig.startDiagnostics) {
            logConfig = {
                timestamp: true,
                previous: false,
                fromStart: true
            }
        }
        else {
            logConfig = {
                timestamp: logInstanceConfig.timestamp,
                previous: logInstanceConfig.previous,
                fromStart: logInstanceConfig.fromStart,
                ...(!logConfig.fromStart? {} : {startTime: logInstanceConfig.startTime})
            }
        }
        channelObject.instanceConfig = logConfig
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        this.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        this.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let logObject = channelObject.uiData as LogObject
        logObject.messages.push({
            text: '=========================================================================',
            type: InstanceMessageTypeEnum.DATA,
            namespace: '',
            pod: '',
            container: ''
        }) 
        this.paused = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        let logObject = channelObject.uiData as LogObject
        logObject.messages.push({
            type: InstanceMessageTypeEnum.DATA,
            text: '*** Lost connection ***',
            namespace: '',
            pod: '',
            container: ''
        })
        return true
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
