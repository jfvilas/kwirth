export interface ITrivyObject {
    paused:boolean
    started:boolean
    score: number
    known: any[]
    unknown: any
}

export class TrivyObject implements ITrivyObject{
    started = false
    paused = false
    score = 0
    known:any[] = []
    unknown:any[] = []
}
