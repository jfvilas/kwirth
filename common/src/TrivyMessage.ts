import { InstanceMessage } from "./InstanceMessage"

export enum TrivyCommandEnum {
    SCORE = 'score',
    RESCAN = 'rescan'
}

export interface TrivyMessage extends InstanceMessage {
    msgtype: 'trivymessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod:string
    container: string
    command: TrivyCommandEnum
    params?: string[]
}

export interface TrivyMessageResponse extends InstanceMessage {
    msgtype: 'trivymessageresponse'
    id: string
    namespace: string
    group: string
    pod: string
    container: string
    msgsubtype?: string
    data?: any
}
