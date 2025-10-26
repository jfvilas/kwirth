import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { FilemanInstanceConfig, FilemanConfig } from './FilemanConfig'
import { FilemanSetup, FilemanIcon } from './FilemanSetup'
import { IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageEventEnum } from "@jfvilas/kwirth-common"
import { FilemanCommandEnum, FilemanData, IFilemanMessageResponse, IFilemanData } from './FilemanData'
import { FilemanTabContent } from './FilemanTabContent'
import { v4 as uuid } from 'uuid'
import { ENotifyLevel } from '../../tools/Global'

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
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = FilemanSetup
    TabContent: FC<IContentProps> = FilemanTabContent
    channelId = 'fileman'
    
    requiresSetup() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresClusterUrl() { return true }
    requiresWebSocket() { return true }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'fileman$read'}
    getChannelIcon(): JSX.Element { return FilemanIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let msg:IFilemanMessage = JSON.parse(wsEvent.data)

        let filemanData:IFilemanData = channelObject.data
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
                                    if (!filemanData.files.some(f => f.path === '/'+ ns)) {
                                        filemanData.files.push ({ name: ns, isDirectory: true, path: '/'+ ns, class:'namespace' })
                                    }
                                    let podNames = Array.from (new Set (data.filter(a => a.split('/')[0]===ns).map(o => o.split('/')[1])))
                                    podNames.map(p => {
                                        if (!filemanData.files.some(f => f.path === '/'+ns+'/'+p)) {
                                            filemanData.files.push({ name: p, isDirectory: true, path: '/'+ns+'/'+p, class:'pod' })
                                        }
                                        let conts = Array.from (new Set (data.filter(a => a.split('/')[0]===ns && a.split('/')[1]===p).map(o => o.split('/')[2])))
                                        conts.map(c => {
                                            if (!filemanData.files.some(f => f.path === '/'+ns+'/'+p+'/'+c)) {
                                                filemanData.files.push ({ name: c, isDirectory: true, path: '/'+ns+'/'+p+'/'+c, class:'container' })
                                            }
                                        })
                                    })
                                })
                                filemanData.files=[...filemanData.files]
                                return IChannelMessageAction.REFRESH
                            case FilemanCommandEnum.DIR:
                                let content = JSON.parse(response.data)
                                if (content.status!=='Success') {
                                    this.notify(ENotifyLevel.ERROR, 'ERROR: '+ (content.text || content.message))
                                }
                                else {
                                    for (let o of content.metadata.object) {
                                        let name = o.name.split('/')[o.name.split('/').length-1]
                                        let e = { 
                                            name,
                                            isDirectory: (o.type===1),
                                            path: o.name,
                                            updatedAt: new Date(+o.time).toISOString(),
                                            size: +o.size,
                                            ...(o.type===0? {class:'file'}:{})
                                        }
                                        filemanData.files = filemanData.files.filter(f => f.path !== e.path)
                                        filemanData.files.push (e)
                                    }
                                }
                                return IChannelMessageAction.REFRESH
                            case FilemanCommandEnum.RENAME: {
                                let content = JSON.parse(response.data)
                                if (content.status!=='Success') {
                                    this.notify(ENotifyLevel.ERROR, 'ERROR: '+ (content.text || content.message))
                                }
                                return IChannelMessageAction.REFRESH
                            }
                            case FilemanCommandEnum.DELETE: {
                                let content = JSON.parse(response.data)
                                if (content.status==='Success') {
                                    let fname = content.metadata.object
                                    filemanData.files = filemanData.files.filter(f => f.path !== fname)
                                    filemanData.files = filemanData.files.filter(f => !f.path.startsWith(fname+'/'))
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'ERROR: '+ (content.text || content.message))
                                }
                                return IChannelMessageAction.REFRESH
                            }
                            case FilemanCommandEnum.MOVE:
                            case FilemanCommandEnum.COPY:
                            case FilemanCommandEnum.CREATE: {
                                let content = JSON.parse(response.data)
                                if (content.status==='Success') {
                                    filemanData.files = filemanData.files.filter(f => f.path !== content.metadata.object)
                                    let f = { 
                                        name: (content.metadata.object as string).split('/').slice(-1)[0],
                                        isDirectory: (content.metadata.type===1),
                                        path: content.metadata.object,
                                        updatedAt: new Date(+content.metadata.time).toISOString(), 
                                        size: +content.metadata.size,
                                        ...(content.metadata.type.type===0? {class:'file'}:{})
                                    }
                                    filemanData.files.push(f)
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'ERROR: '+ (content.text || content.message))
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
                    }
                    else if (signalMessage.action === InstanceMessageActionEnum.COMMAND) {
                        if (signalMessage.text) this.notify(ENotifyLevel.INFO, signalMessage.text)
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
                            id: uuid(),
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

                        if (signalMessage.text) this.notify(ENotifyLevel.INFO, signalMessage.text)
                    }
                    if (signalMessage.event === SignalMessageEventEnum.DELETE) {
                        filemanData.files = filemanData.files.filter(f => !f.path.startsWith('/'+signalMessage.namespace+'/'+signalMessage.pod+'/'))
                        filemanData.files = filemanData.files.filter(f => f.path!=='/'+signalMessage.namespace+'/'+signalMessage.pod)
                        if (signalMessage.text) this.notify(ENotifyLevel.INFO, signalMessage.text)
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
        let config = new FilemanConfig()
        config.notify = this.notify
        let data = new FilemanData()

        channelObject.config = config
        channelObject.data = data
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let filemanData:IFilemanData = channelObject.data
        filemanData.paused = false
        filemanData.started = true;
        filemanData.files=[]
        filemanData.currentPath='/'
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let filemanData:IFilemanData = channelObject.data
        filemanData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let filemanData:IFilemanData = channelObject.data
        filemanData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let filemanData:IFilemanData = channelObject.data
        filemanData.paused = false
        filemanData.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }
    
    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
