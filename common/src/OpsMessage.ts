import { InstanceMessage } from "./InstanceMessage"

export enum OpsCommandEnum {
    GET = 'get',
    DESCRIBE = 'describe',
    LIST = 'list',

    EXECUTE = 'execute',

    SHELL = 'shell',
    INPUT = 'input',

    RESTART = 'restart',
    RESTARTPOD = 'restartpod',
    RESTARTALL = 'restartall',
    RESTARTNAMESPACE = 'restartnamespace',

    DELETE = 'delete'
}

export interface OpsMessage extends InstanceMessage {
    msgtype: 'opsmessage'
    id: string
    accessKey: string
    instance: string
    command: OpsCommandEnum
    namespace: string
    group: string
    pod:string
    container: string
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
