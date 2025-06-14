import { InstanceMessage } from "@jfvilas/kwirth-common"

export interface ITrivyObject {
    started: boolean
    score: number
    known: any[]
    unknown: any
}

export class TrivyObject implements ITrivyObject{
    started = false
    score = 0
    known:any[] = []
    unknown:any[] = []
}

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
