import type { V1Pod, V1ContainerStatus } from '@kubernetes/client-node'
import { ESdsfQos, ISdsfContainer, ISdsfPod } from '../common/SdsfTypes'

/*
    V1Pod -> one DA row.

    Pure on purpose: it is the part of the back with most decisions in it, and the tests feed it pods
    written by hand instead of needing a cluster.
*/

/*
    The JES job id: three letters and five digits, eight characters like a real one.

    The letters say what started the "address space": a Job is a batch JOB, a bare pod (nobody owns it,
    somebody ran it by hand) is a TSU session, and anything a controller keeps alive is a started task.
    The digits come from the uid, so the id is the same on every refresh for the life of the pod — the
    operator reads it as an identity, and it must not move when the list is redrawn.
*/
export const jobIdOf = (uid: string, controllerKind: string): string => {
    const prefix = controllerKind === 'Job' ? 'JOB' : controllerKind === '' ? 'TSU' : 'STC'
    const hex = uid.replace(/-/g, '').slice(-8)
    const n = hex ? parseInt(hex, 16) % 100000 : 0
    return prefix + String(Number.isNaN(n) ? 0 : n).padStart(5, '0')
}

const qosOf = (value: string | undefined): ESdsfQos => {
    switch (value) {
        case ESdsfQos.GUARANTEED:
            return ESdsfQos.GUARANTEED
        case ESdsfQos.BURSTABLE:
            return ESdsfQos.BURSTABLE
        case ESdsfQos.BESTEFFORT:
            return ESdsfQos.BESTEFFORT
        default:
            return ESdsfQos.UNKNOWN
    }
}

const containerOf = (name: string, image: string, init: boolean, status: V1ContainerStatus | undefined): ISdsfContainer => {
    let state = ''
    let reason = ''
    if (status?.state?.running) {
        state = 'running'
    }
    else if (status?.state?.waiting) {
        state = 'waiting'
        reason = status.state.waiting.reason ?? ''
    }
    else if (status?.state?.terminated) {
        state = 'terminated'
        reason = status.state.terminated.reason ?? ''
    }
    return { name, image, init, state, reason, ready: Boolean(status?.ready), restarts: status?.restartCount ?? 0 }
}

/*
    The one reason worth a column: what an operator would look at first. A container stuck waiting
    (CrashLoopBackOff, ImagePullBackOff…) beats everything, then the pod-level reason Kubernetes sets
    when it gives up on the pod (Evicted), then a container that died for a reason other than finishing.
*/
const reasonOf = (pod: V1Pod, containers: ISdsfContainer[]): string => {
    const waiting = containers.find(c => c.state === 'waiting' && c.reason)
    if (waiting) return waiting.reason
    if (pod.status?.reason) return pod.status.reason
    const died = containers.find(c => !c.init && c.state === 'terminated' && c.reason && c.reason !== 'Completed')
    return died?.reason ?? ''
}

// What is left of a name once its parent's goes: 'x2kq9' of api-7d9f8b6c4-x2kq9, '0' of db-0. The whole name when it is not the parent's plus a suffix.
export const suffixOf = (name: string, parent: string): string =>
    parent && name.startsWith(parent + '-') && name.length > parent.length + 1 ? name.slice(parent.length + 1) : name

/*
    The workload at the top of a pod's owners, its JOBNAME. A ReplicaSet is named after its Deployment plus the
    pod-template-hash, which is a label of the pod too: taking it off gives the Deployment without reading the
    ReplicaSet. A Job's CronJob is in the Job, not in the pod: whoever maps knows the Jobs and says it.
*/
export const workloadOf = (pod: V1Pod, controllerKind: string, controllerName: string, cronJobOf: (namespace: string, job: string) => string): string => {
    switch (controllerKind) {
        case '':
            return pod.metadata?.name ?? ''
        case 'ReplicaSet': {
            const hash = pod.metadata?.labels?.['pod-template-hash']
            return hash && controllerName.endsWith('-' + hash) ? controllerName.slice(0, -hash.length - 1) : controllerName
        }
        case 'Job':
            return cronJobOf(pod.metadata?.namespace ?? '', controllerName) || controllerName
        default:
            return controllerName
    }
}

export const mapPod = (pod: V1Pod, cronJobOf: (namespace: string, job: string) => string = () => ''): ISdsfPod => {
    const statuses = pod.status?.containerStatuses ?? []
    const initStatuses = pod.status?.initContainerStatuses ?? []
    const regular = (pod.spec?.containers ?? []).map(c => containerOf(c.name, c.image ?? '', false, statuses.find(s => s.name === c.name)))
    const init = (pod.spec?.initContainers ?? []).map(c => containerOf(c.name, c.image ?? '', true, initStatuses.find(s => s.name === c.name)))
    const containers = [...init, ...regular]
    const controller = pod.metadata?.ownerReferences?.find(o => o.controller) ?? pod.metadata?.ownerReferences?.[0]
    const controllerKind = controller?.kind ?? ''
    const uid = pod.metadata?.uid ?? ''
    const created = pod.metadata?.creationTimestamp

    return {
        name: pod.metadata?.name ?? '',
        namespace: pod.metadata?.namespace ?? '',
        uid,
        jobId: jobIdOf(uid, controllerKind),
        owner: pod.spec?.serviceAccountName ?? pod.spec?.serviceAccount ?? '',
        controllerKind,
        controllerName: controller?.name ?? '',
        workload: workloadOf(pod, controllerKind, controller?.name ?? '', cronJobOf),
        step: controllerKind ? suffixOf(pod.metadata?.name ?? '', controller?.name ?? '') : '',
        qos: qosOf(pod.status?.qosClass),
        phase: pod.status?.phase ?? '',
        ready: regular.length > 0 && regular.every(c => c.ready),
        deleting: Boolean(pod.metadata?.deletionTimestamp),
        reason: reasonOf(pod, containers),
        priorityClass: pod.spec?.priorityClassName ?? '',
        priority: pod.spec?.priority ?? 0,
        restarts: regular.reduce((sum, c) => sum + c.restarts, 0),
        node: pod.spec?.nodeName ?? '',
        created: created ? new Date(created).toISOString() : '',
        containers
    }
}
