import type { V1PriorityClass } from '@kubernetes/client-node'
import { ISdsfJobClass } from '../common/SdsfTypes'

/*
    A PriorityClass as a job class of the JC panel. On z/OS a job class says how a job is scheduled; on
    Kubernetes the priority class does: the value its pods get, and whether they may preempt lower ones.
    `pods` are the ones the key reaches: the back counts them, a class does not know its pods.
*/
export const mapJobClass = (pc: V1PriorityClass, pods: number): ISdsfJobClass => {
    const created = pc.metadata?.creationTimestamp
    return {
        name: pc.metadata?.name ?? '',
        value: pc.value,
        globalDefault: pc.globalDefault === true,
        preemption: pc.preemptionPolicy ?? 'PreemptLowerPriority',
        pods,
        description: pc.description ?? '',
        created: created ? new Date(created).toISOString() : ''
    }
}
