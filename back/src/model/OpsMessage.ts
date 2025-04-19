import { InstanceMessage } from "@jfvilas/kwirth-common"

export enum OpsCommandEnum {
    DELETE = 'delete',
    RESTART = 'restart',
    GET = 'get',
    DESCRIBE = 'describe'
}

export interface OpsMessage extends InstanceMessage {
    id: string
    command: OpsCommandEnum
    namespace: string
    group: string
    pod:string
    container: string
}

export interface OpsMessageResponse extends InstanceMessage {
    id: string
    timestamp?: Date
    command: OpsCommandEnum
    namespace: string
    group: string
    pod:string
    container: string
}
