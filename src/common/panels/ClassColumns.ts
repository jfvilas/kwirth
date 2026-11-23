import { ISdsfJobClass } from '../SdsfTypes'
import { E3270Color } from '../terminal/Terminal3270Types'
import { ageOf, IDaColumn } from './DaColumns'

/*
    The JC columns: a PriorityClass as a job class of SDSF's JOB CLASS DISPLAY. The class name is cut to 8, as
    a job class is short on z/OS; ClassName has it whole. PF11 brings the description.
*/

const IDENTITY = E3270Color.BLUE
const VALUE = E3270Color.GREEN

const PREEMPTION: Record<string, string> = {
    PreemptLowerPriority: 'LOWER',
    Never: 'NEVER'
}

export const preemptionOf = (c: ISdsfJobClass): string => PREEMPTION[c.preemption] ?? c.preemption.toUpperCase().slice(0, 7)

export const JC_CLASS_COLUMN: IDaColumn<ISdsfJobClass> = {
    header: 'JobClass', width: 8, right: false,
    text: c => c.name.toUpperCase().slice(0, 8), color: () => IDENTITY, sortKey: c => c.name
}

export const JC_COLUMNS: IDaColumn<ISdsfJobClass>[] = [
    { header: 'Prio', width: 11, right: true, text: c => String(c.value), color: () => VALUE, sortKey: c => c.value },
    { header: 'Default', width: 7, right: false, text: c => c.globalDefault ? 'YES' : 'NO', color: c => c.globalDefault ? E3270Color.WHITE : VALUE, sortKey: c => c.globalDefault ? 0 : 1 },
    { header: 'Preempt', width: 7, right: false, text: preemptionOf, color: c => c.preemption === 'Never' ? E3270Color.YELLOW : VALUE, sortKey: preemptionOf },
    { header: 'Pods', width: 5, right: true, text: c => String(c.pods), color: () => VALUE, sortKey: c => c.pods },
    { header: 'Age', width: 5, right: false, text: (c, now) => ageOf(c.created, now), color: () => VALUE, sortKey: c => c.created ? -Date.parse(c.created) : 0 },
    { header: 'ClassName', width: 26, right: false, text: c => c.name, color: () => IDENTITY, sortKey: c => c.name },
    { header: 'Description', width: 66, right: false, text: c => c.description.replace(/\s+/g, ' '), color: () => IDENTITY, sortKey: c => c.description }
]
