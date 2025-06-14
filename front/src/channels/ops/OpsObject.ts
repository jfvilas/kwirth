import { InstanceMessage } from "@jfvilas/kwirth-common"

export enum OpsCommandEnum {
    CLEAR = 'clear',
    GET = 'get',
    DESCRIBE = 'describe',
    LIST = 'list',

    EXECUTE = 'execute',

    SHELL = 'shell',
    INPUT = 'input',

    RESTART = 'restart',
    RESTARTPOD = 'restartpod',
    RESTARTALL = 'restartall',
    RESTARTNS = 'restartns',

    DELETE = 'delete'
}

export interface OpsMessage extends InstanceMessage {
    msgtype: 'opsmessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod:string
    container: string
    command: OpsCommandEnum
    params?: string[]
}

export interface OpsMessageResponse extends InstanceMessage {
    msgtype: 'opsmessageresponse'
    id: string
    command: OpsCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}

export interface IShell {
    namespace: string 
    pod: string 
    container: string 
    lines: string[]
    id: string
    connected: boolean
    pending: string
}

export interface IOpsObject {
    messages: string[]
    shells: IShell[]
    shell: IShell|undefined
}

export class OpsObject implements IOpsObject{
    messages:string[] = []
    shells:IShell[] = []
    shell:IShell|undefined = undefined
}
