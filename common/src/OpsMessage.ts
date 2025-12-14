import { IInstanceMessage } from "./InstanceMessage"

export enum OpsCommandEnum {
    DESCRIBE = 'describe',

    EXECUTE = 'execute',

    RESTART = 'restart',
    RESTARTPOD = 'restartpod',
    RESTARTNS = 'restartns'
}

export interface IOpsMessage extends IInstanceMessage {
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

export interface IOpsMessageResponse extends IInstanceMessage {
    msgtype: 'opsmessageresponse'
    id: string
    command: OpsCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}
