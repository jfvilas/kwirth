import { FC } from "react"
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from "../IChannel"
import { FilemanInstanceConfig, FilemanUiConfig, IFilemanUiConfig } from "./FilemanConfig"
import { FilemanSetup, FilemanIcon } from './FilemanSetup'
import { IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageEventEnum } from "@jfvilas/kwirth-common"
import { FilemanCommandEnum, FilemanObject, IFilemanMessageResponse, IFilemanObject } from "./FilemanObject"
import { FilemanTabContent } from "./FilemanTabContent"
import { v4 as uuidv4 } from 'uuid'

interface IFilemanMessage extends IInstanceMessage {
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
    requiresClusterUrl() { return true }
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
                                let data = response.data as string[]
                                let nss = Array.from (new Set (data.map(n => n.split('/')[0])))
                                nss.map(ns => {
                                    if (!filemanObject.files.some(f => f.path === '/'+ ns)) {
                                        filemanObject.files.push ({ name: ns, isDirectory: true, path: '/'+ ns })
                                    }
                                    let podNames = Array.from (new Set (data.filter(a => a.split('/')[0]===ns).map(o => o.split('/')[1])))
                                    podNames.map(p => {
                                        if (!filemanObject.files.some(f => f.path === '/'+ns+'/'+p)) {
                                            filemanObject.files.push({ name: p, isDirectory: true, path: '/'+ns+'/'+p })
                                        }
                                        let conts = Array.from (new Set (data.filter(a => a.split('/')[0]===ns && a.split('/')[1]===p).map(o => o.split('/')[2])))
                                        conts.map(c => {
                                            if (!filemanObject.files.some(f => f.path === '/'+ns+'/'+p+'/'+c)) {
                                                filemanObject.files.push ({ name: c, isDirectory: true, path: '/'+ns+'/'+p+'/'+c })
                                            }
                                        })
                                    })
                                })
                                filemanObject.files=[...filemanObject.files]
                                return IChannelMessageAction.REFRESH
                            case FilemanCommandEnum.DIR:
                                let content = JSON.parse(response.data)
                                if (content.status!=='Success') {
                                    this.nofify('ERROR: '+ (content.text || content.message), 'error')
                                }
                                else {
                                    for (let o of content.metadata.object) {
                                        let name = o.name.split('/')[o.name.split('/').length-1]
                                        let e = { name, isDirectory: (o.type===1), path: o.name, updatedAt: new Date(+o.time).toISOString(), size: +o.size  }
                                        filemanObject.files = filemanObject.files.filter(f => f.path !== e.path)
                                        filemanObject.files.push (e)
                                    }
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
                                if (content.status==='Success') {
                                    let fname = content.metadata.object
                                    filemanObject.files = filemanObject.files.filter(f => f.path !== fname)
                                    filemanObject.files = filemanObject.files.filter(f => !f.path.startsWith(fname+'/'))
                                }
                                else {
                                    this.nofify('ERROR: '+ (content.text || content.message), 'error')
                                }
                                return IChannelMessageAction.REFRESH
                            }
                            case FilemanCommandEnum.MOVE:
                            case FilemanCommandEnum.COPY:
                            case FilemanCommandEnum.CREATE: {
                                let content = JSON.parse(response.data)
                                if (content.status==='Success') {
                                    filemanObject.files = filemanObject.files.filter(f => f.path !== content.metadata.object)
                                    let f = { 
                                        name: (content.metadata.object as string).split('/').slice(-1)[0],
                                        isDirectory: (content.metadata.type===1),
                                        path: content.metadata.object,
                                        updatedAt: new Date(+content.metadata.time).toISOString(), 
                                        size: +content.metadata.size,
                                    }
                                    filemanObject.files.push(f)
                                    //filemanObject.files = [...filemanObject.files]
                                }
                                else {
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
                let signalMessage = JSON.parse(wsEvent.data) as ISignalMessage
                if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE) {
                    if (signalMessage.action === InstanceMessageActionEnum.START) {
                        channelObject.instanceId = signalMessage.instance

                        // +++ session is started, so we ask for conatiner list
                        // setTimeout( (iid:string) => {
                        //     let [namespace,pod,container] = ['','','']
                        //     let filemanMessage:IFilemanMessage = {
                        //         flow: InstanceMessageFlowEnum.REQUEST,
                        //         action: InstanceMessageActionEnum.COMMAND,
                        //         channel: 'fileman',
                        //         type: InstanceMessageTypeEnum.DATA,
                        //         accessKey: channelObject.accessString!,
                        //         instance: iid,
                        //         id: uuidv4(),
                        //         command: FilemanCommandEnum.HOME,
                        //         namespace: namespace,
                        //         group: '',
                        //         pod: pod,
                        //         container: container,
                        //         params: [],
                        //         msgtype: 'filemanmessage'
                        //     }
                        //     let payload = JSON.stringify( filemanMessage )
                        //     channelObject.webSocket!.send(payload)
                        // }, 1500, signalMessage.instance)
                    }
                    else if (signalMessage.action === InstanceMessageActionEnum.COMMAND) {
                        if (signalMessage.text) this.nofify(signalMessage.text,'error')
                    }
                }
                if (signalMessage.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                    if (signalMessage.event === SignalMessageEventEnum.ADD) {
                        let filemanMessage:IFilemanMessage = {
                            flow: InstanceMessageFlowEnum.REQUEST,
                            action: InstanceMessageActionEnum.COMMAND,
                            channel: 'fileman',
                            type: InstanceMessageTypeEnum.DATA,
                            accessKey: channelObject.accessString!,
                            instance: channelObject.instanceId,
                            id: uuidv4(),
                            command: FilemanCommandEnum.HOME,
                            namespace: signalMessage.namespace!,
                            group: '',
                            pod: signalMessage.pod!,
                            container: signalMessage.container!,
                            params: [],
                            msgtype: 'filemanmessage'
                        }
                        let payload = JSON.stringify( filemanMessage )
                        channelObject.webSocket!.send(payload)

                        if (signalMessage.text) this.nofify(signalMessage.text,'info')
                    }
                    if (signalMessage.event === SignalMessageEventEnum.DELETE) {
                        filemanObject.files = filemanObject.files.filter(f => !f.path.startsWith('/'+signalMessage.namespace+'/'+signalMessage.pod+'/'))
                        filemanObject.files = filemanObject.files.filter(f => f.path!=='/'+signalMessage.namespace+'/'+signalMessage.pod)
                        if (signalMessage.text) this.nofify(signalMessage.text,'info')
                    }
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
        console.log('started')
        console.log('started')
        console.log('started')
        let filemanObject:IFilemanObject = channelObject.uiData
        filemanObject.paused = false
        filemanObject.started = true;
        filemanObject.files=[]
        filemanObject.currentPath='/'
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let filemanObject:IFilemanObject = channelObject.uiData
        filemanObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let filemanObject:IFilemanObject = channelObject.uiData
        filemanObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let filemanObject:IFilemanObject = channelObject.uiData
        filemanObject.paused = false
        filemanObject.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }
    
    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
