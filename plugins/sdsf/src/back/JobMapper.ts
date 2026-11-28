import type { V1Job, V1CronJob } from '@kubernetes/client-node'
import { ESdsfJobState, ESdsfObjectKind, ISdsfJob } from '../common/SdsfTypes'
import { jobIdOf, suffixOf } from './PodMapper'

/*
    Job / CronJob -> one row of the ST, O and H panels. Pure, like the pod mapper: the tests feed it objects
    written by hand.
*/

const isoOf = (date: Date | string | undefined): string => date ? new Date(date).toISOString() : ''

// A Job's state from its conditions: Complete or Failed when the controller says so, running until then.
export const jobStateOf = (job: V1Job): ESdsfJobState => {
    const conditions = job.status?.conditions ?? []
    const isTrue = (type: string) => conditions.some(c => c.type === type && c.status === 'True')
    if (isTrue('Failed')) return ESdsfJobState.FAILED
    if (isTrue('Complete') || isTrue('SuccessCriteriaMet')) return ESdsfJobState.COMPLETE
    // not started yet: waiting on the input queue, as a job JES has read and no initiator has taken
    if (!job.status?.startTime) return ESdsfJobState.WAITING
    return ESdsfJobState.RUNNING
}

export const mapJob = (job: V1Job): ISdsfJob => {
    const uid = job.metadata?.uid ?? ''
    const cron = job.metadata?.ownerReferences?.find(o => o.kind === 'CronJob')
    return {
        kind: ESdsfObjectKind.JOB,
        name: job.metadata?.name ?? '',
        namespace: job.metadata?.namespace ?? '',
        uid,
        jobId: jobIdOf(uid, 'Job'),
        owner: job.spec?.template?.spec?.serviceAccountName ?? 'default',
        cronJob: cron?.name ?? '',
        workload: cron?.name || (job.metadata?.name ?? ''),
        step: cron?.name ? suffixOf(job.metadata?.name ?? '', cron.name) : '',
        schedule: '',
        state: jobStateOf(job),
        parallelism: job.spec?.parallelism ?? 1,
        completions: job.spec?.completions ?? 0,
        active: job.status?.active ?? 0,
        succeeded: job.status?.succeeded ?? 0,
        failed: job.status?.failed ?? 0,
        start: isoOf(job.status?.startTime ?? job.metadata?.creationTimestamp),
        end: isoOf(job.status?.completionTime)
    }
}

export const mapCronJob = (cron: V1CronJob): ISdsfJob => {
    const uid = cron.metadata?.uid ?? ''
    return {
        kind: ESdsfObjectKind.CRONJOB,
        name: cron.metadata?.name ?? '',
        namespace: cron.metadata?.namespace ?? '',
        uid,
        jobId: jobIdOf(uid, 'Job'),
        owner: cron.spec?.jobTemplate?.spec?.template?.spec?.serviceAccountName ?? 'default',
        cronJob: '',
        workload: cron.metadata?.name ?? '',
        step: '',
        schedule: cron.spec?.schedule ?? '',
        state: cron.spec?.suspend ? ESdsfJobState.SUSPENDED : ESdsfJobState.SCHEDULED,
        parallelism: cron.spec?.jobTemplate?.spec?.parallelism ?? 1,
        completions: cron.spec?.jobTemplate?.spec?.completions ?? 0,
        active: cron.status?.active?.length ?? 0,
        succeeded: 0,
        failed: 0,
        start: isoOf(cron.status?.lastScheduleTime),
        end: isoOf(cron.status?.lastSuccessfulTime)
    }
}
