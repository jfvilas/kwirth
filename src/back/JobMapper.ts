import type { V1Pod, V1ContainerStatus } from '@kubernetes/client-node'
import { EWrkJobStatus, EWrkJobType, IWrkContainer, IWrkJob } from '../common/WrkactjobTypes'
import { IJobUsage } from './PodMetrics'

/*
    V1Pod -> one job of WRKACTJOB.

    Pure on purpose: it is the part of the back with most decisions in it, and the tests feed it pods written
    by hand instead of needing a cluster.
*/

// WRKACTJOB lists ACTIVE jobs: a pod that finished, well or badly, is not one any more.
export const isActive = (pod: V1Pod): boolean => {
    const phase = pod.status?.phase ?? ''
    return phase !== 'Succeeded' && phase !== 'Failed'
}

// PRD D6: what kept the pod alive says what kind of job it is.
export const typeOf = (controllerKind: string): EWrkJobType => {
    switch (controllerKind) {
        case '':
            return EWrkJobType.BCI
        case 'Job':
            return EWrkJobType.BCH
        case 'DaemonSet':
            return EWrkJobType.SYS
        default:
            // ReplicaSet (a Deployment's), StatefulSet, and whatever an operator keeps alive
            return EWrkJobType.ASJ
    }
}

/*
    The program a job runs, as the Function column shows it after 'PGM-': the image's own name, without the
    registry, the repository path, the tag or the digest. 'registry.k8s.io/coredns/coredns:v1.11.1' -> 'coredns'.
*/
export const programOf = (image: string): string => {
    const noDigest = image.split('@')[0]
    const last = noDigest.split('/').pop() ?? ''
    return last.split(':')[0]
}

// A container waiting for one of these, or just died like this, needs the operator: the job is in MSGW.
const FAILING_WAITING = new Set([
    'CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'InvalidImageName',
    'CreateContainerConfigError', 'CreateContainerError', 'RunContainerError'
])
const FAILING_TERMINATED = new Set(['Error', 'OOMKilled', 'ContainerCannotRun'])

const containerOf = (name: string, image: string, init: boolean, status: V1ContainerStatus | undefined): IWrkContainer => {
    const container: IWrkContainer = { name, image, init, ready: Boolean(status?.ready), restarts: status?.restartCount ?? 0, state: '', reason: '', message: '' }
    const last = status?.lastState?.terminated
    if (status?.state?.running) {
        container.state = 'running'
    }
    else if (status?.state?.waiting) {
        container.state = 'waiting'
        container.reason = status.state.waiting.reason ?? ''
        container.message = status.state.waiting.message ?? ''
    }
    else if (status?.state?.terminated) {
        container.state = 'terminated'
        container.reason = status.state.terminated.reason ?? ''
        container.message = status.state.terminated.message ?? ''
        container.exitCode = status.state.terminated.exitCode
    }
    // A container waiting to restart says little itself: the last termination says why it died.
    if (last && container.state !== 'terminated') {
        if (!container.message) container.message = last.message ?? ''
        container.exitCode = last.exitCode
    }
    return container
}

const isFailing = (c: IWrkContainer): boolean =>
    (c.state === 'waiting' && FAILING_WAITING.has(c.reason)) || (c.state === 'terminated' && FAILING_TERMINATED.has(c.reason))

// What 7=Display message shows: the first failing container, its reason, and what Kubernetes or the
// container itself said about it.
const messageOf = (failing: IWrkContainer | undefined): string => {
    if (!failing) return ''
    const exit = failing.exitCode !== undefined ? ` (exit code ${failing.exitCode})` : ''
    const said = failing.message.replace(/\s+/g, ' ').trim()
    return `Container ${failing.name}: ${failing.reason}${exit}${said ? '. ' + said : ''}`
}

/*
    PRD D7, in this order: a pod being deleted is ending (END); one with a failing container waits for the
    operator (MSGW); one not running yet is waiting to be scheduled (SCDW); a running one is RUN when it used
    CPU in the last interval and DEQW when it did not. With no CPU figure (no metrics provider, or only one
    reading yet) a running job is RUN: it is the honest default, it IS running.
*/
export const statusOf = (pod: V1Pod, containers: IWrkContainer[], cpu: number | undefined): EWrkJobStatus => {
    if (pod.metadata?.deletionTimestamp) return EWrkJobStatus.END
    if (containers.some(isFailing)) return EWrkJobStatus.MSGW
    if ((pod.status?.phase ?? '') !== 'Running') return EWrkJobStatus.SCDW
    if (cpu === undefined) return EWrkJobStatus.RUN
    return cpu > 0 ? EWrkJobStatus.RUN : EWrkJobStatus.DEQW
}

export const mapJob = (pod: V1Pod, usage: IJobUsage = {}): IWrkJob => {
    const statuses = pod.status?.containerStatuses ?? []
    const initStatuses = pod.status?.initContainerStatuses ?? []
    const regular = (pod.spec?.containers ?? []).map(c => containerOf(c.name, c.image ?? '', false, statuses.find(s => s.name === c.name)))
    const init = (pod.spec?.initContainers ?? []).map(c => containerOf(c.name, c.image ?? '', true, initStatuses.find(s => s.name === c.name)))
    const containers = [...init, ...regular]
    const controller = pod.metadata?.ownerReferences?.find(o => o.controller) ?? pod.metadata?.ownerReferences?.[0]
    const controllerKind = controller?.kind ?? ''
    const created = pod.metadata?.creationTimestamp
    const status = statusOf(pod, containers, usage.cpu)

    return {
        name: pod.metadata?.name ?? '',
        namespace: pod.metadata?.namespace ?? '',
        uid: pod.metadata?.uid ?? '',
        user: pod.spec?.serviceAccountName ?? pod.spec?.serviceAccount ?? '',
        type: typeOf(controllerKind),
        status,
        program: programOf(regular[0]?.image ?? ''),
        controllerKind,
        controllerName: controller?.name ?? '',
        phase: pod.status?.phase ?? '',
        node: pod.spec?.nodeName ?? '',
        priorityClass: pod.spec?.priorityClassName ?? '',
        priority: pod.spec?.priority ?? 0,
        restarts: regular.reduce((sum, c) => sum + c.restarts, 0),
        created: created ? new Date(created).toISOString() : '',
        message: status === EWrkJobStatus.MSGW ? messageOf(containers.find(isFailing)) : '',
        containers,
        ...(usage.cpu !== undefined ? { cpu: usage.cpu } : {}),
        ...(usage.cpuSeconds !== undefined ? { cpuSeconds: usage.cpuSeconds } : {}),
        ...(usage.memory !== undefined ? { memory: usage.memory } : {})
    }
}
