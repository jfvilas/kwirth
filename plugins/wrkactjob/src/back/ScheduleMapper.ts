import type { V1CronJob, V1Job } from '@kubernetes/client-node'
import { EWrkRunStatus, IWrkSchedule, IWrkScheduleRun } from '../common/WrkactjobTypes'
import { programOf } from './JobMapper'

/*
    WRKJOBSCDE out of the CronJobs and their Jobs (PRD-fase3 §2.4). Pure, like the other mappers.
*/

// What kubectl writes on a Job it creates from a CronJob ('kubectl create job --from=cronjob/…'), and SBMJOB too.
export const MANUAL_ANNOTATION = 'cronjob.kubernetes.io/instantiate'

const iso = (t: Date | string | undefined): string => t ? new Date(t).toISOString() : ''

// The CronJob that started a Job: its controller ownerReference.
export const scheduleOf = (job: V1Job): string =>
    (job.metadata?.ownerReferences ?? []).find(r => r.kind === 'CronJob')?.name ?? ''

export const runStatusOf = (job: V1Job): EWrkRunStatus => {
    const conditions = job.status?.conditions ?? []
    if (conditions.some(c => c.type === 'Failed' && c.status === 'True')) return EWrkRunStatus.FAILED
    if (conditions.some(c => c.type === 'Complete' && c.status === 'True')) return EWrkRunStatus.SUCCEEDED
    return EWrkRunStatus.RUNNING
}

export const mapRun = (job: V1Job): IWrkScheduleRun => ({
    job: job.metadata?.name ?? '',
    started: iso(job.status?.startTime ?? job.metadata?.creationTimestamp),
    completed: iso(job.status?.completionTime),
    status: runStatusOf(job),
    manual: job.metadata?.annotations?.[MANUAL_ANNOTATION] === 'manual'
})

// A CronJob with the Jobs it started (those of its namespace that it owns), newest first.
export const mapSchedule = (cronJob: V1CronJob, jobs: V1Job[]): IWrkSchedule => {
    const name = cronJob.metadata?.name ?? ''
    const namespace = cronJob.metadata?.namespace ?? ''
    const pod = cronJob.spec?.jobTemplate?.spec?.template?.spec
    return {
        name,
        namespace,
        schedule: cronJob.spec?.schedule ?? '',
        timeZone: cronJob.spec?.timeZone ?? '',
        held: cronJob.spec?.suspend === true,
        concurrencyPolicy: cronJob.spec?.concurrencyPolicy ?? 'Allow',
        program: programOf(pod?.containers?.[0]?.image ?? ''),
        user: pod?.serviceAccountName ?? '',
        created: iso(cronJob.metadata?.creationTimestamp),
        lastScheduled: iso(cronJob.status?.lastScheduleTime),
        lastSuccessful: iso(cronJob.status?.lastSuccessfulTime),
        runs: jobs
            .filter(j => (j.metadata?.namespace ?? '') === namespace && scheduleOf(j) === name)
            .map(mapRun)
            .sort((a, b) => b.started.localeCompare(a.started))
    }
}

// Kubernetes names are at most 63 characters for a Job (its pods add a suffix to it).
const MAX_JOB_NAME = 63

/*
    SBMJOB: the Job 'kubectl create job --from=cronjob/<name>' would create — the CronJob's job template, owned
    by the CronJob (so its history and WRKACTJOB see it as one of its runs) and marked as manual. The name is
    '<cronjob>-manual-<epoch seconds>', cut so it fits.
*/
export const submittedJobOf = (cronJob: V1CronJob, now: number): V1Job => {
    const name = cronJob.metadata?.name ?? ''
    const suffix = `-manual-${Math.floor(now / 1000)}`
    const template = cronJob.spec?.jobTemplate
    return {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
            name: name.slice(0, MAX_JOB_NAME - suffix.length) + suffix,
            namespace: cronJob.metadata?.namespace,
            labels: template?.metadata?.labels,
            annotations: { ...(template?.metadata?.annotations ?? {}), [MANUAL_ANNOTATION]: 'manual' },
            ownerReferences: [{
                apiVersion: 'batch/v1',
                kind: 'CronJob',
                name,
                uid: cronJob.metadata?.uid ?? '',
                controller: true,
                blockOwnerDeletion: true
            }]
        },
        spec: template?.spec
    }
}
