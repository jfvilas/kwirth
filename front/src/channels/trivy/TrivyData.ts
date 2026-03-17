import { IInstanceMessage } from "@jfvilas/kwirth-common"

export interface ITrivyData {
    paused:boolean
    started:boolean
    score: number
    assets: IAsset[]
    ri:string|undefined
}

export class TrivyData implements ITrivyData{
    started = false
    paused = false
    score = 0
    assets = []
    ri = undefined
}

export enum ETrivyCommand {
    SCORE = 'score',
    RESCAN = 'rescan'
}

export interface ITrivyMessage extends IInstanceMessage {
    msgtype: 'trivymessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: ETrivyCommand
    params?: string[]
}

export interface ITrivyMessageResponse extends IInstanceMessage {
    msgtype: 'trivymessageresponse'
    id: string
    namespace: string
    group: string
    pod: string
    container: string
    msgsubtype?: string
    data?: any
}

export interface IAsset {
    name: string
    namespace: string
    container: string
    unknown: {
        statusCode: number
        statusMessage: string
    }
    vulnerabilityreports: {
        score: number
        report: any
    }
    configauditreports: {
        report: any
    }
    sbomreports: {
        report: any
    }
    exposedsecretreports: {
        report: any
    }
}
