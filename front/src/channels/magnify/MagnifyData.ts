import { IInstanceMessage } from '@jfvilas/kwirth-common'
import { IFileObject } from '@jfvilas/react-file-manager'
import { IContentExternalObject } from './components/ContentExternal'
import { IContentEditObject } from './components/ContentEdit'
import { IContentDetailsObject } from './components/ContentDetails'
import { MagnifyUserPreferences } from './MagnifyUserPreferences'

export interface IMagnifyData {
    clusterInfo: any
    files: IFileObject[]
    paused: boolean
    started: boolean
    clusterEvents: any[]
    currentPath: string

    timers: number[]

    contentWindows : (IContentExternalObject|IContentEditObject|IContentDetailsObject)[]
    leftMenuAnchorParent: Element | undefined
    pendingWebSocketRequests : Map<string, (value: any) => void>

    metricsCluster: any[]
    metricsPodDetail: any[]

    refreshUsage?: () => void
    updateNamespaces?: (action:string, namespace:string) => void
    userPreferences: MagnifyUserPreferences
}

export class MagnifyData implements IMagnifyData {
    clusterInfo = undefined
    paused = false
    started = false
    files = []
    clusterEvents = []
    currentPath = '/'
    timers = []
    contentWindows = []
    leftMenuAnchorParent: undefined
    pendingWebSocketRequests = new Map<string, (value: any) => void>()
    metricsCluster = []
    metricsPodDetail = []
    updateNamespaces = undefined
    userPreferences = new MagnifyUserPreferences()
}

export enum EMagnifyCommand {
    NONE = 'none',
    CREATE = 'create',
    APPLY = 'apply',
    DELETE = 'delete',
    CLUSTERINFO = 'clusterinfo',
    LIST = 'list',
    SUBSCRIBE = 'subscribe',
    LISTCRD = 'listcrd',
    WATCH = 'watch',
    EVENTS = 'events',
    K8EVENT = 'k8event',
    CRONJOB = 'CronJob',
    INGRESSCLASS = 'IngressClass',
    POD = 'Pod',
    NODE = 'Node',
    CONTROLLER = 'Controller',
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
    command: EMagnifyCommand
    params?: string[]
}

export interface IMagnifyMessageResponse extends IInstanceMessage {
    msgtype: 'magnifymessageresponse'
    id: string
    command: EMagnifyCommand
    namespace: string
    group: string
    pod: string
    container: string
    event?: string
    data?: any
}
