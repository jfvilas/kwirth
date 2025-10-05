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
    RESTARTNS = 'restartns'
}

export interface IOpsMessage extends InstanceMessage {
    msgtype: 'opsmessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: OpsCommandEnum
    params?: string[]
}

export interface IOpsMessageResponse extends InstanceMessage {
    msgtype: 'opsmessageresponse'
    id: string
    command: OpsCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}
