export interface IWrkactjobData {
    messages: string[]
    paused: boolean
    started: boolean
}

export class WrkactjobData implements IWrkactjobData {
    messages: string[] = []
    paused = false
    started = false
}
