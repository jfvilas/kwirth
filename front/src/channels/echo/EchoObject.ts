export interface IEchoObject {
    lines: string[]
    paused:boolean
    started:boolean
}

export class EchoObject implements IEchoObject {
    lines: string[] = []
    paused = false
    started = false
}
