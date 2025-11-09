import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, IOpsMessageResponse, OpsCommandEnum, ISignalMessage } from '@jfvilas/kwirth-common'
import { OpsIcon, OpsSetup } from './OpsSetup'
import { OpsTabContent } from './OpsTabContent'
import { OpsData, IOpsData } from './OpsData'
import { OpsInstanceConfig, OpsConfig } from './OpsConfig'
import { OPSHELPMESSAGE, OPSWELCOMEMESSAGE } from '../../tools/Constants'
import { cleanANSI } from './OpsTools'
import { ENotifyLevel } from '../../tools/Global'

export class OpsChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = OpsSetup
    TabContent: FC<IContentProps> = OpsTabContent
    channelId = 'ops'
    
    requiresSetup() { return true }
    requiresSettings() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresClusterUrl() { return false }
    requiresWebSocket() { return true }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'ops$get' }
    getChannelIcon(): JSX.Element { return OpsIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        let opsData:IOpsData = channelObject.data

        let opsMessage:IOpsMessageResponse = JSON.parse(wsEvent.data)

        switch (opsMessage.type) {
            case InstanceMessageTypeEnum.DATA:
                if (opsMessage.flow === InstanceMessageFlowEnum.RESPONSE) {
                    switch (opsMessage.command) {
                        case OpsCommandEnum.SHELL:
                            // it's a response for a shell session start, so we add shell session to shells array
                            let newShell = {
                                namespace: opsMessage.namespace,
                                pod: opsMessage.pod,
                                container: opsMessage.container,
                                lines: [],
                                connected: true,
                                id: opsMessage.id,
                                pending: ''
                            }
                            let index = opsData.shells.findIndex(s => s.connected === false)
                            if (index>=0)
                                opsData.shells[index] = newShell
                            else
                                opsData.shells.push (newShell)
                            opsData.shell = opsData.shells[opsData.shells.length-1]
                            action = IChannelMessageAction.REFRESH
                            break
                        case OpsCommandEnum.EXECUTE:
                            opsData.messages.push(cleanANSI(opsMessage.data))
                            action = IChannelMessageAction.REFRESH
                            break
                        default:
                            if (typeof opsMessage.data !== 'string')
                                opsData.messages.push(JSON.stringify(opsMessage.data))
                            else
                                opsData.messages.push(opsMessage.data)
                                action = IChannelMessageAction.REFRESH
                                break
                        }
                }
                else {
                    let shell = opsData.shells.find (s => s.id === opsMessage.id)
                    if (shell) {
                        let data = (shell.pending + cleanANSI(opsMessage.data)).trim().replaceAll('\r','').split('\n')
                        shell.lines.push(...data)
                        shell.pending = ''
                    }
                    else {
                        opsData.messages.push(opsMessage.data)
                    }
                    action = IChannelMessageAction.REFRESH
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                if (opsMessage.flow === InstanceMessageFlowEnum.RESPONSE && opsMessage.action === InstanceMessageActionEnum.COMMAND) {
                    if (opsMessage.command === OpsCommandEnum.SHELL) {
                        opsData.shell = undefined
                        opsData.messages.push(`Shell session to ${opsMessage.namespace}/${opsMessage.pod}/${opsMessage.container} ended`)
                        if (opsMessage.data) opsData.messages.push(opsMessage.data)
                        let shell = opsData.shells.find (c => c.namespace === opsMessage.namespace && c.pod === opsMessage.pod && c.container === opsMessage.container)
                        if (shell) shell.connected = false
                    }
                    else {
                        opsData.messages.push(opsMessage.data)
                    }
                    action = IChannelMessageAction.REFRESH
                }
                else if (opsMessage.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                    let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                    if (signalMessage.text) {
                        opsData.messages.push(signalMessage.text)
                        action = IChannelMessageAction.REFRESH
                    }
                }
                else {
                    let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                    if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.START) {
                        channelObject.instanceId = signalMessage.instance
                        if (signalMessage.text) {
                            opsData.messages.push(signalMessage.text)
                            action = IChannelMessageAction.REFRESH
                        }
                    }
                    else {
                        console.log('wsEvent.data on ops')
                        console.log(wsEvent.data)                    
                    }
                }
                break
            default:
                console.log(`Invalid message type ${opsMessage.type}`)
                break
        }
        return action
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.config = new OpsConfig()
        channelObject.data = new OpsData()
        channelObject.instanceConfig = new OpsInstanceConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = false
        opsData.started = true
        opsData.messages = [...OPSWELCOMEMESSAGE, ...OPSHELPMESSAGE]
        opsData.shell = undefined
        opsData.shells = []
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = false
        opsData.started = false
        opsData.messages.push('=========================================================================')
        return false
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
