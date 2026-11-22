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

export const mapPod = (pod: V1Pod): ISdsfPod => {
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
