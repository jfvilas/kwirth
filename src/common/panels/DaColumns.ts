import { ISdsfPod, ESdsfQos } from '../SdsfTypes'
import { E3270Color } from '../terminal/Terminal3270Types'

/*
    The DA columns: how each pod field becomes an SDSF column. Presentation only — the back sends data.

    The order is the one of a real DA (D8): JOBNAME is fixed at the left, the rest scroll with PF10/PF11. Past
    SIO come the ones only Kubernetes has: CPU%, the namespace, the full pod name (JOBNAME has 8 characters,
    and pod names are long), the status, the node and the age.
*/
// One column of a table panel, for rows of type T (pods on the DA, Jobs on ST/O/H).
export interface IDaColumn<T = ISdsfPod> {
    header: string
    width: number
    right: boolean                     // numbers are right-aligned, as on the real panel
    text: (row: T, now: number) => string
    color: (row: T) => E3270Color
    sortKey: (row: T, now: number) => string | number
}

const IDENTITY = E3270Color.BLUE
const VALUE = E3270Color.GREEN

const upper8 = (s: string): string => s.toUpperCase().slice(0, 8)

// The step being run: the first regular container. The proc step: an init container still at work.
export const stepNameOf = (pod: ISdsfPod): string => pod.containers.find(c => !c.init)?.name ?? ''
export const procStepOf = (pod: ISdsfPod): string => pod.containers.find(c => c.init && c.state !== 'terminated')?.name ?? ''

const QOS_CLASS: Record<ESdsfQos, string> = {
    [ESdsfQos.GUARANTEED]: 'G',
    [ESdsfQos.BURSTABLE]: 'B',
    [ESdsfQos.BESTEFFORT]: 'E',
    [ESdsfQos.UNKNOWN]: ' '
}

// The job class letter: G, B or E (BestEffort, so it does not collide with Burstable).
export const qosLetterOf = (qos: ESdsfQos): string => QOS_CLASS[qos]

/*
    Pos, the address space's position, in SDSF's own codes: IN (in storage, working), LO (logically swapped:
    running but not ready), NS (not yet started: pending), END and ABN (ended well or abended), TRM (being
    terminated) and ?? when Kubernetes does not know.
*/
export const posOf = (pod: ISdsfPod): string => {
    if (pod.deleting) return 'TRM'
    switch (pod.phase) {
        case 'Running':
            return pod.ready ? 'IN' : 'LO'
        case 'Pending':
            return 'NS'
        case 'Succeeded':
            return 'END'
        case 'Failed':
            return 'ABN'
        default:
            return '??'
    }
}

const posColor = (pod: ISdsfPod): E3270Color => {
    switch (posOf(pod)) {
        case 'IN':
        case 'END':
            return E3270Color.GREEN
        case 'NS':
        case 'TRM':
            return E3270Color.YELLOW
        default:
            return E3270Color.RED
    }
}

// DP, the dispatching priority in hex: the system-critical classes on top, as the system address spaces.
export const dpOf = (priority: number): string => {
    if (priority >= 2000000000) return 'FF'
    if (priority >= 1000000000) return 'FE'
    if (priority > 0) return 'F8'
    if (priority === 0) return 'F0'
    return 'C0'
}

export const statusOf = (pod: ISdsfPod): string => pod.deleting ? 'Terminating' : pod.reason || pod.phase

export const ageOf = (created: string, now: number): string => {
    if (!created) return ''
    const seconds = Math.max(0, Math.floor((now - Date.parse(created)) / 1000))
    if (seconds < 120) return `${seconds}s`
    if (seconds < 7200) return `${Math.floor(seconds / 60)}m`
    if (seconds < 172800) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
}

const realOf = (pod: ISdsfPod): string => pod.memory === undefined ? '-' : String(Math.round(pod.memory / (1024 * 1024)))
const cpuOf = (pod: ISdsfPod): string => pod.cpu === undefined ? '-' : pod.cpu.toFixed(2)

export const JOBNAME_COLUMN: IDaColumn = {
    header: 'JOBNAME', width: 8, right: false,
    text: p => upper8(p.name), color: () => IDENTITY, sortKey: p => p.name
}

export const DA_COLUMNS: IDaColumn[] = [
    { header: 'StepName', width: 8, right: false, text: p => upper8(stepNameOf(p)), color: () => IDENTITY, sortKey: p => stepNameOf(p) },
    { header: 'ProcStep', width: 8, right: false, text: p => upper8(procStepOf(p)), color: () => IDENTITY, sortKey: p => procStepOf(p) },
    { header: 'JobID', width: 8, right: false, text: p => p.jobId, color: () => IDENTITY, sortKey: p => p.jobId },
    { header: 'Owner', width: 8, right: false, text: p => upper8(p.owner), color: () => IDENTITY, sortKey: p => p.owner },
    { header: 'C', width: 1, right: false, text: p => QOS_CLASS[p.qos], color: () => VALUE, sortKey: p => QOS_CLASS[p.qos] },
    { header: 'Pos', width: 3, right: false, text: posOf, color: posColor, sortKey: posOf },
    { header: 'DP', width: 2, right: false, text: p => dpOf(p.priority), color: () => VALUE, sortKey: p => p.priority },
    { header: 'Real', width: 5, right: true, text: realOf, color: () => VALUE, sortKey: p => p.memory ?? -1 },
    { header: 'Paging', width: 6, right: true, text: () => '0.00', color: () => VALUE, sortKey: () => 0 },
    { header: 'SIO', width: 7, right: true, text: p => String(p.restarts), color: p => p.restarts > 0 ? E3270Color.YELLOW : VALUE, sortKey: p => p.restarts },
    { header: 'CPU%', width: 6, right: true, text: cpuOf, color: () => VALUE, sortKey: p => p.cpu ?? -1 },
    { header: 'Status', width: 18, right: false, text: p => statusOf(p).slice(0, 18), color: p => p.reason || p.deleting ? E3270Color.RED : VALUE, sortKey: statusOf },
    { header: 'Node', width: 20, right: false, text: p => p.node.slice(0, 20), color: () => IDENTITY, sortKey: p => p.node },
    { header: 'Age', width: 5, right: true, text: (p, now) => ageOf(p.created, now), color: () => VALUE, sortKey: p => p.created ? -Date.parse(p.created) : 0 },
    // Namespace and PodName share the last page: 20 + 44 is exactly the room right of JOBNAME.
    { header: 'Namespace', width: 20, right: false, text: p => p.namespace.slice(0, 20), color: () => IDENTITY, sortKey: p => p.namespace },
    { header: 'PodName', width: 44, right: false, text: p => p.name.slice(0, 44), color: () => IDENTITY, sortKey: p => p.name }
]

// A column by its header, ignoring case: what SORT takes.
export const findColumn = <T>(name: string, columns: IDaColumn<T>[]): IDaColumn<T> | undefined => {
    const wanted = name.toUpperCase()
    return columns.find(c => c.header.toUpperCase() === wanted)
}

export const cell = <T>(column: IDaColumn<T>, row: T, now: number): string => {
    const text = column.text(row, now).slice(0, column.width)
    return column.right ? text.padStart(column.width) : text.padEnd(column.width)
}
