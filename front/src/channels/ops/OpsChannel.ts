import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, IOpsMessageResponse, OpsCommandEnum, SignalMessage } from '@jfvilas/kwirth-common'
import { OpsIcon, OpsSetup } from './OpsSetup'
import { OpsTabContent } from './OpsTabContent'
import { OpsObject, IOpsObject } from './OpsObject'
import { OpsInstanceConfig, OpsUiConfig } from './OpsConfig'
import { OPSHELPMESSAGE, OPSWELCOMEMESSAGE } from '../../tools/Constants'
import { cleanANSI } from './OpsTools'

export class OpsChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = OpsSetup
    TabContent: FC<IContentProps> = OpsTabContent
    channelId = 'ops'
    
    requiresSetup() { return true }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresWebSocket() { return true }
    setNotifier(notifier: any): void { }

    getScope() { return 'ops$get' }
    getChannelIcon(): JSX.Element { return OpsIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        let opsObject:IOpsObject = channelObject.uiData

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
                            let index = opsObject.shells.findIndex(s => s.connected === false)
                            if (index>=0)
                                opsObject.shells[index] = newShell
                            else
                                opsObject.shells.push (newShell)
                            opsObject.shell = opsObject.shells[opsObject.shells.length-1]
                            action = IChannelMessageAction.REFRESH
                            break
                        case OpsCommandEnum.EXECUTE:
                            opsObject.messages.push(cleanANSI(opsMessage.data))
                            action = IChannelMessageAction.REFRESH
                            break
                        default:
                            if (typeof opsMessage.data !== 'string')
                                opsObject.messages.push(JSON.stringify(opsMessage.data))
                            else
                                opsObject.messages.push(opsMessage.data)
                                action = IChannelMessageAction.REFRESH
                                break
                        }
                }
                else {
                    let shell = opsObject.shells.find (s => s.id === opsMessage.id)
                    if (shell) {
                        let data = (shell.pending + cleanANSI(opsMessage.data)).trim().replaceAll('\r','').split('\n')
                        shell.lines.push(...data)
                        shell.pending = ''
                    }
                    else {
                        opsObject.messages.push(opsMessage.data)
                    }
                    action = IChannelMessageAction.REFRESH
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                if (opsMessage.flow === InstanceMessageFlowEnum.RESPONSE && opsMessage.action === InstanceMessageActionEnum.COMMAND) {
                    if (opsMessage.command === OpsCommandEnum.SHELL) {
                        opsObject.shell = undefined
                        opsObject.messages.push(`Shell session to ${opsMessage.namespace}/${opsMessage.pod}/${opsMessage.container} ended`)
                        if (opsMessage.data) opsObject.messages.push(opsMessage.data)
                        let shell = opsObject.shells.find (c => c.namespace === opsMessage.namespace && c.pod === opsMessage.pod && c.container === opsMessage.container)
                        if (shell) shell.connected = false
                    }
                    else {
                        opsObject.messages.push(opsMessage.data)
                    }
                    action = IChannelMessageAction.REFRESH
                }
                else if (opsMessage.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                    let signalMessage:SignalMessage = JSON.parse(wsEvent.data)
                    opsObject.messages.push(signalMessage.text)
                    action = IChannelMessageAction.REFRESH
                }
                else {
                    let signalMessage:SignalMessage = JSON.parse(wsEvent.data)
                    if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.START) {
                        channelObject.instanceId = signalMessage.instance
                        opsObject.messages.push(signalMessage.text)
                        action = IChannelMessageAction.REFRESH
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
        channelObject.uiConfig = new OpsUiConfig()
        channelObject.uiData = new OpsObject()
        channelObject.instanceConfig = new OpsInstanceConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let opsObject:IOpsObject = channelObject.uiData
        opsObject.paused = false
        opsObject.started = true
        opsObject.messages.push(...OPSWELCOMEMESSAGE, ...OPSHELPMESSAGE)
        opsObject.shell = undefined
        opsObject.shells = []
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let opsObject:IOpsObject = channelObject.uiData
        opsObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let opsObject:IOpsObject = channelObject.uiData
        opsObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let opsObject:IOpsObject = channelObject.uiData
        opsObject.paused = false
        opsObject.started = false
        opsObject.messages.push('=========================================================================')
        return false
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
