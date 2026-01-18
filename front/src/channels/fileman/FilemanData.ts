import { IInstanceMessage } from "@jfvilas/kwirth-common"
import { IFileObject } from "@jfvilas/react-file-manager"

export interface IFilemanData {
    paused: boolean
    started: boolean
    files: IFileObject[]
    currentPath: string
}

export class FilemanData implements IFilemanData {
    lines: string[] = []
    paused = false
    started = false
    files = []
    currentPath = '/'
}

export enum EFilemanCommand {
    HOME = 'home',
    DIR = 'dir',
    CREATE = 'create',
    RENAME = 'rename',
    DELETE = 'delete',
    MOVE = 'move',
    COPY = 'copy',
    UPLOAD = 'upload',
    DOWNLOAD = 'download'
}

export interface IFilemanMessage extends IInstanceMessage {
    msgtype: 'filemanmessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: EFilemanCommand
    params?: string[]
}

export interface IFilemanMessageResponse extends IInstanceMessage {
    msgtype: 'filemanmessageresponse'
    id: string
    command: EFilemanCommand
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}
