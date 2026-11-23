import { ESdsfJobState, ESdsfObjectKind, ISdsfJob } from '../SdsfTypes'
import { E3270Color } from '@jfvilas/kwirth-dce-blockterm'
import { ageOf, IDaColumn } from './DaColumns'

/*
    The ST, O and H columns: a Job or a CronJob as SDSF shows a batch job (reference capture 1523606598205:
    JOBNAME JobID Owner Prty Queue C … Status). The Queue says where it is in its life, as JES's does:

      EXECUTION   a Job running                 INPUT   a CronJob waiting for its next run, or a Job not started
      PRINT       a Job ended, well or not      HOLD    a CronJob suspended

    Page 1 is the JES view; PF11 brings the schedule, the CronJob and the duration, and then the namespace and
    the full name.
*/

const upper8 = (s: string): string => s.toUpperCase().slice(0, 8)

const QUEUE: Record<ESdsfJobState, string> = {
    [ESdsfJobState.WAITING]: 'INPUT',
    [ESdsfJobState.RUNNING]: 'EXECUTION',
    [ESdsfJobState.COMPLETE]: 'PRINT',
    [ESdsfJobState.FAILED]: 'PRINT',
    [ESdsfJobState.SCHEDULED]: 'INPUT',
    [ESdsfJobState.SUSPENDED]: 'HOLD'
}

const STATE_COLOR: Record<ESdsfJobState, E3270Color> = {
    [ESdsfJobState.WAITING]: E3270Color.TURQUOISE,
    [ESdsfJobState.RUNNING]: E3270Color.WHITE,
    [ESdsfJobState.COMPLETE]: E3270Color.GREEN,
    [ESdsfJobState.FAILED]: E3270Color.RED,
    [ESdsfJobState.SCHEDULED]: E3270Color.TURQUOISE,
    [ESdsfJobState.SUSPENDED]: E3270Color.PINK
}

export const queueOf = (job: ISdsfJob): string => QUEUE[job.state]

// 'ACTIVE 1/3', 'COMPLETE 3/3', 'FAILED 2', 'SCHEDULED', 'SUSPENDED'.
export const jobStatusOf = (job: ISdsfJob): string => {
    const target = job.completions || 1
    switch (job.state) {
        case ESdsfJobState.WAITING:
            return 'WAITING'
        case ESdsfJobState.RUNNING:
            return `ACTIVE ${job.succeeded}/${target}`
        case ESdsfJobState.COMPLETE:
            return `COMPLETE ${job.succeeded}/${target}`
        case ESdsfJobState.FAILED:
            return `FAILED ${job.failed}`
        case ESdsfJobState.SCHEDULED:
            return job.active ? `SCHEDULED ${job.active} ACT` : 'SCHEDULED'
        default:
            return 'SUSPENDED'
    }
}

// How long a Job ran (or has been running); nothing for a CronJob.
export const durationOf = (job: ISdsfJob, now: number): string => {
    if (job.kind !== ESdsfObjectKind.JOB || !job.start) return ''
    const end = job.end ? Date.parse(job.end) : now
    const seconds = Math.max(0, Math.floor((end - Date.parse(job.start)) / 1000))
    if (seconds < 120) return `${seconds}s`
    if (seconds < 7200) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h`
}

const IDENTITY = E3270Color.BLUE
const VALUE = E3270Color.GREEN

export const ST_JOBNAME_COLUMN: IDaColumn<ISdsfJob> = {
    header: 'JOBNAME', width: 8, right: false,
    text: j => upper8(j.name), color: () => IDENTITY, sortKey: j => j.name
}

export const ST_COLUMNS: IDaColumn<ISdsfJob>[] = [
    { header: 'JobID', width: 8, right: false, text: j => j.jobId, color: () => IDENTITY, sortKey: j => j.jobId },
    { header: 'Owner', width: 8, right: false, text: j => upper8(j.owner), color: () => IDENTITY, sortKey: j => j.owner },
    { header: 'Prty', width: 4, right: true, text: j => String(j.parallelism), color: () => VALUE, sortKey: j => j.parallelism },
    { header: 'Queue', width: 9, right: false, text: queueOf, color: j => STATE_COLOR[j.state], sortKey: queueOf },
    // the class: J for a Job, C for a CronJob
    { header: 'C', width: 1, right: false, text: j => j.kind === ESdsfObjectKind.JOB ? 'J' : 'C', color: () => VALUE, sortKey: j => j.kind },
    { header: 'Status', width: 16, right: false, text: jobStatusOf, color: j => STATE_COLOR[j.state], sortKey: jobStatusOf },
    { header: 'Age', width: 5, right: true, text: (j, now) => ageOf(j.start, now), color: () => VALUE, sortKey: j => j.start ? -Date.parse(j.start) : 0 },
    { header: 'Schedule', width: 16, right: false, text: j => j.schedule.slice(0, 16), color: () => VALUE, sortKey: j => j.schedule },
    { header: 'CronJob', width: 20, right: false, text: j => j.cronJob.slice(0, 20), color: () => IDENTITY, sortKey: j => j.cronJob },
    { header: 'Dur', width: 6, right: true, text: durationOf, color: () => VALUE, sortKey: (j, now) => durationOf(j, now) },
    { header: 'Namespace', width: 20, right: false, text: j => j.namespace.slice(0, 20), color: () => IDENTITY, sortKey: j => j.namespace },
    { header: 'JobName', width: 44, right: false, text: j => j.name.slice(0, 44), color: () => IDENTITY, sortKey: j => j.name }
]
