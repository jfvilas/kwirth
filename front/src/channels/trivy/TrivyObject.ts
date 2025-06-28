import { IKnown, IUnknown } from "@jfvilas/kwirth-common"

export interface ITrivyObject {
    paused:boolean
    started:boolean
    score: number
    known: IKnown[]
    unknown: IUnknown[]
}

export class TrivyObject implements ITrivyObject{
    started = false
    paused = false
    score = 0
    known = []
    unknown = []
}
