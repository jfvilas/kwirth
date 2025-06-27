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
