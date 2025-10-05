import { InstanceMessage } from "@jfvilas/kwirth-common"

export interface IFilemanObject {
    lines: string[]
    paused:boolean
    started:boolean
    files: IFileData[]
}

export interface IFileData {
    name: string
    isDirectory: boolean
    path: string
    updatedAt?: string
    size?: number
}

export class FilemanObject implements IFilemanObject {
    lines: string[] = []
    paused = false
    started = false
    files = []
}

export enum FilemanCommandEnum {
    HOME = 'home',
    DIR = 'dir',
    RENAME = 'rename',
    DELETE = 'delete',
    MOVE = 'move',
    COPY = 'copy',
    UPLOAD = 'upload',
    DOWNLOAD = 'download'
}

export interface IFilemanMessage extends InstanceMessage {
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

export interface IFilemanMessageResponse extends InstanceMessage {
    msgtype: 'filemanmessageresponse'
    id: string
    command: FilemanCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}
