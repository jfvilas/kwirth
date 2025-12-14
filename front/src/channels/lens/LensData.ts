import { IInstanceMessage } from "@jfvilas/kwirth-common"
import { IFileObject } from "@jfvilas/react-file-manager"

export interface ILensData {
    paused: boolean
    started: boolean
    files: IFileObject[]
    currentPath: string
}

export class LensData implements ILensData {
    lines: string[] = []
    paused = false
    started = false
    files = []
    currentPath = '/'
}

export enum LensCommandEnum {
    CREATE = 'create',
    DELETE = 'delete',
    LIST = 'list',
    WATCH = 'watch',
    K8EVENT = 'k8event'
}

export interface ILensMessage extends IInstanceMessage {
    msgtype: 'lensmessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: LensCommandEnum
    params?: string[]
}

export interface ILensMessageResponse extends IInstanceMessage {
    msgtype: 'lensmessageresponse'
    id: string
    command: LensCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    event?: string
    data?: any
}
