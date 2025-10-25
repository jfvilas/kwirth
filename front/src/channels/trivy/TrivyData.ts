import { IKnown, IUnknown } from "@jfvilas/kwirth-common"

export interface ITrivyData {
    paused:boolean
    started:boolean
    score: number
    known: IKnown[]
    unknown: IUnknown[]
}

export class TrivyData implements ITrivyData{
    started = false
    paused = false
    score = 0
    known = []
    unknown = []
}
