import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceConfigScopeEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage } from '@jfvilas/kwirth-common'
import { OpsIcon, OpsSetup } from './OpsSetup'
import { OpsTabContent } from './OpsTabContent'
import { OpsObject, IOpsObject, OpsMessageResponse, OpsCommandEnum } from './OpsObject'
import { OpsInstanceConfig, OpsUiConfig } from './OpsConfig'
import { OPSHELPMESSAGE, OPSWELCOMEMESSAGE } from '../../tools/Constants'

export class OpsChannel implements IChannel {
    private setupVisible = false
    private paused = false
    SetupDialog: FC<ISetupProps> = OpsSetup
    TabContent: FC<IContentProps> = OpsTabContent
    channelId = 'ops'
    
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.GET}
    getChannelIcon(): JSX.Element { return OpsIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        let opsObject = channelObject.uiData as OpsObject



        let opsMessage = JSON.parse(wsEvent.data) as OpsMessageResponse

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
                        let data = (shell.pending + this.cleanANSI(opsMessage.data)).trim().replaceAll('\r','').split('\n')
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
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    opsObject.messages.push(signalMessage.text)
                    action = IChannelMessageAction.REFRESH
                }
                else {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
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
        this.paused = false
        opsObject.messages.push(...OPSWELCOMEMESSAGE, ...OPSHELPMESSAGE)
        opsObject.shell = undefined
        opsObject.shells = []
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
        let opsObject:IOpsObject = channelObject.uiData
        this.paused = false
        opsObject.messages.push('=========================================================================')
        return false
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

    // PRIVATE
    cleanANSI(text: string): string {
        const regexAnsi = /\x1b\[[0-9;]*[mKHVfJrcegH]|\x1b\[\d*n/g;
        return text.replace(regexAnsi, '') // replace all matches with empty strings
    }

}    
