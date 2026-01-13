import { IInstanceMessage } from "@jfvilas/kwirth-common"
import { IFileObject } from "@jfvilas/react-file-manager"
import { IExternalContentObject } from "./components/ExternalContent"

export interface IMagnifyData {
    clusterInfo: any
    paused: boolean
    started: boolean
    files: IFileObject[]
    currentPath: string

    externalContent : IExternalContentObject[]
    leftMenuAnchorParent: Element | undefined
}

export class MagnifyData implements IMagnifyData {
    clusterInfo = undefined
    paused = false
    started = false
    files = []
    currentPath = '/'
    externalContent = []
    leftMenuAnchorParent: undefined
}

export enum MagnifyCommandEnum {
    CREATE = 'create',
    APPLY = 'apply',
    DELETE = 'delete',
    CLUSTERINFO = 'clusterinfo',
    LIST = 'list',
    LISTCRD = 'listcrd',
    WATCH = 'watch',
    EVENTS = 'events',
    K8EVENT = 'k8event',
    CRONJOB = 'CronJob',
    NODE = 'Node',
}

export interface IMagnifyMessage extends IInstanceMessage {
    msgtype: 'magnifymessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: MagnifyCommandEnum
    params?: string[]
}

export interface IMagnifyMessageResponse extends IInstanceMessage {
    msgtype: 'magnifymessageresponse'
    id: string
    command: MagnifyCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    event?: string
    data?: any
}
