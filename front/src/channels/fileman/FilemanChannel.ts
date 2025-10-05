import { FC } from "react"
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from "../IChannel"
import { FilemanInstanceConfig, FilemanUiConfig, IFilemanUiConfig } from "./FilemanConfig"
import { FilemanSetup, FilemanIcon } from './FilemanSetup'
import { InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from "@jfvilas/kwirth-common"
import { FilemanCommandEnum, FilemanObject, IFilemanMessageResponse, IFilemanObject } from "./FilemanObject"
import { FilemanTabContent } from "./FilemanTabContent"
import { v4 as uuidv4 } from 'uuid'

interface IFilemanMessage extends InstanceMessage {
    msgtype: 'filemanmessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: FilemanCommandEnum
    params?: string[]
}

export class FilemanChannel implements IChannel {
    private setupVisible = false
    private nofify: (msg:string, level:string) => void = () => {}
    SetupDialog: FC<ISetupProps> = FilemanSetup
    TabContent: FC<IContentProps> = FilemanTabContent
    channelId = 'fileman'
    
    requiresSetup() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresWebSocket() { return true }
    setNotifier(notifier: any): void { this.nofify = notifier }

    getScope() { return 'fileman$read'}
    getChannelIcon(): JSX.Element { return FilemanIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let msg:IFilemanMessage = JSON.parse(wsEvent.data)

        let filemanObject:IFilemanObject = channelObject.uiData
        let filemanUiConfig:IFilemanUiConfig = channelObject.uiConfig
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA: {
                let response = JSON.parse(wsEvent.data) as IFilemanMessageResponse
                switch(response.action) {
                    case InstanceMessageActionEnum.COMMAND: {
                        switch(response.command) {
                            case FilemanCommandEnum.HOME:
                                let all = response.data as string[]
                                filemanObject.files = []
                                let nss = Array.from (new Set (all.map(n => n.split('/')[0])))
                                nss.map(ns => {
                                    let e = { name: ns, isDirectory: true, path: '/'+ ns }
                                    filemanObject.files = filemanObject.files.filter(f => f.path !== e.path)
                                    filemanObject.files.push (e)
                                    let podNames = Array.from (new Set (all.filter(a => a.split('/')[0]===ns).map(o => o.split('/')[1])))
                                    podNames.map(p => {
                                        let e = { name: p, isDirectory: true, path: '/'+ns+'/'+p }
                                        filemanObject.files = filemanObject.files.filter(f => f.path !== e.path)
                                        filemanObject.files.push (e)
                                        let conts = Array.from (new Set (all.filter(a => a.split('/')[0]===ns && a.split('/')[1]===p).map(o => o.split('/')[2])))
                                        conts.map(c => filemanObject.files.push ({ name: c, isDirectory: true, path: '/'+ns+'/'+p+'/'+c }))
                                    })
                                })
                                return IChannelMessageAction.REFRESH
                            case FilemanCommandEnum.DIR:
                                let content = JSON.parse(response.data)
                                for (let o of content) {
                                    let name = o.name.split('/')[o.name.split('/').length-1]
                                    let e = { name, isDirectory: (o.type===1), path: o.name, updatedAt: new Date(+o.time).toISOString(), size: +o.size  }
                                    filemanObject.files = filemanObject.files.filter(f => f.path !== e.path)
                                    filemanObject.files.push (e)
                                }
                                return IChannelMessageAction.REFRESH
                            case FilemanCommandEnum.RENAME: {
                                let content = JSON.parse(response.data)
                                if (content.status!=='Success') {
                                    this.nofify('ERROR: '+ (content.text || content.message), 'error')
                                }
                                return IChannelMessageAction.REFRESH
                            }
                            case FilemanCommandEnum.DELETE: {
                                let content = JSON.parse(response.data)
                                if (content.status!=='Success') {
                                    this.nofify('ERROR: '+ (content.text || content.message), 'error')
                                }
                                return IChannelMessageAction.REFRESH
                            }
                        }
                    }
                }
                return IChannelMessageAction.NONE
            }
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage:InstanceMessage = JSON.parse(wsEvent.data)
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance

                    // session is started, so we ask for conatiner list
                    // +++ review
                    setTimeout( () => {
                        let [namespace,pod,container] = ['','','']
                        let filemanMessage:IFilemanMessage = {
                            flow: InstanceMessageFlowEnum.REQUEST,
                            action: InstanceMessageActionEnum.COMMAND,
                            channel: 'fileman',
                            type: InstanceMessageTypeEnum.DATA,
                            accessKey: channelObject.accessString!,
                            instance: channelObject.instanceId,
                            id: uuidv4(),
                            command: FilemanCommandEnum.HOME,
                            namespace: namespace,
                            group: '',
                            pod: pod,
                            container: container,
                            params: [],
                            msgtype: 'filemanmessage'
                        }
                        let payload = JSON.stringify( filemanMessage )
                        channelObject.webSocket!.send(payload)
                    }, 1000)

                }
                return IChannelMessageAction.REFRESH
            default:
                console.log(`Invalid message type ${msg.type}`)
                return IChannelMessageAction.NONE
        }
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.instanceConfig = new FilemanInstanceConfig()
        channelObject.uiConfig = new FilemanUiConfig()
        channelObject.uiData = new FilemanObject()
        channelObject.uiConfig = this.nofify
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let filemanObject:IFilemanObject = channelObject.uiData
        filemanObject.lines = [ 'Start']
        filemanObject.paused = false
        filemanObject.started = true
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let echoObject:IFilemanObject = channelObject.uiData
        echoObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let echoObject:IFilemanObject = channelObject.uiData
        echoObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let echoObject:IFilemanObject = channelObject.uiData
        echoObject.lines.push('==========================================================================')
        echoObject.paused = false
        echoObject.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }
    
    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
