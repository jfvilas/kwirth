import type { V1Namespace, V1Node, V1PersistentVolume, V1Pod, V1LimitRange, V1ResourceQuota } from '@kubernetes/client-node'
import {
    EWrkJobStatus, EWrkSubsystemStatus, IWrkJob, IWrkLimitItem, IWrkPool, IWrkQuotaItem, IWrkStorage, IWrkSubsystem,
    IWrkSubsystemDescription
} from '../common/WrkactjobTypes'
import { memoryRequestOf, quantityOf } from './Quantity'

/*
    WRKSYSSTS and WRKSBS out of the API objects (PRD-fase3 §2.1, §2.2). Pure, like the job mapper: the tests feed
    them objects written by hand. The pods come in pairs with the job WRKACTJOB made of them, so a status or a
    usage is decided in one place only.
*/

export interface IPodJob {
    pod: V1Pod
    job: IWrkJob
}

const iso = (t: Date | string | undefined): string => t ? new Date(t).toISOString() : ''

const round2 = (n: number): number => Math.round(n * 100) / 100

// A pool per node (D13), with the active pods on it.
export const mapPool = (node: V1Node, onNode: IPodJob[]): IWrkPool => {
    const allocatable = node.status?.allocatable ?? {}
    const cpus = onNode.map(p => p.job.cpu).filter((c): c is number => c !== undefined)
    const memories = onNode.map(p => p.job.memory).filter((m): m is number => m !== undefined)
    return {
        name: node.metadata?.name ?? '',
        cpus: quantityOf(allocatable['cpu']),
        memory: quantityOf(allocatable['memory']),
        reserved: onNode.reduce((sum, p) => sum + memoryRequestOf(p.pod), 0),
        maxActive: quantityOf(allocatable['pods']),
        jobs: onNode.length,
        failing: onNode.filter(p => p.job.status === EWrkJobStatus.MSGW).length,
        restarts: onNode.reduce((sum, p) => sum + p.job.restarts, 0),
        cpu: cpus.length > 0 ? round2(cpus.reduce((a, b) => a + b, 0)) : undefined,
        memoryUsed: memories.length > 0 ? memories.reduce((a, b) => a + b, 0) : undefined
    }
}

export const mapPools = (nodes: V1Node[], active: IPodJob[]): IWrkPool[] =>
    nodes
        .map(n => mapPool(n, active.filter(p => p.job.node === (n.metadata?.name ?? ''))))
        .sort((a, b) => a.name.localeCompare(b.name))

// The system ASP: every PersistentVolume, and the bound ones as the used part.
export const storageOf = (volumes: V1PersistentVolume[]): IWrkStorage => {
    const size = (v: V1PersistentVolume) => quantityOf(v.spec?.capacity?.['storage'])
    return {
        capacity: volumes.reduce((sum, v) => sum + size(v), 0),
        bound: volumes.filter(v => v.status?.phase === 'Bound').reduce((sum, v) => sum + size(v), 0),
        volumes: volumes.length
    }
}

// A cluster CPU % out of the jobs': undefined when none of them has a figure yet.
export const cpuOf = (jobs: IWrkJob[]): number | undefined => {
    const cpus = jobs.map(j => j.cpu).filter((c): c is number => c !== undefined)
    return cpus.length > 0 ? round2(cpus.reduce((a, b) => a + b, 0)) : undefined
}

export const subsystemStatusOf = (ns: V1Namespace | undefined): EWrkSubsystemStatus =>
    ns?.status?.phase === 'Terminating' || ns?.metadata?.deletionTimestamp ? EWrkSubsystemStatus.ENDING : EWrkSubsystemStatus.ACTIVE

// A subsystem of WRKSBS with its active pods (the ones the key reaches).
export const mapSubsystem = (ns: V1Namespace, inside: IPodJob[]): IWrkSubsystem => ({
    name: ns.metadata?.name ?? '',
    status: subsystemStatusOf(ns),
    storage: inside.reduce((sum, p) => sum + memoryRequestOf(p.pod), 0),
    pools: nodesOf(inside),
    jobs: inside.length
})

// Each resource a quota limits, one row each, sorted. status.hard is what the API server enforces (spec.hard
// until the quota controller has seen it).
export const quotaItemsOf = (quotas: V1ResourceQuota[]): IWrkQuotaItem[] =>
    quotas.flatMap(q => {
        const hard = q.status?.hard ?? q.spec?.hard ?? {}
        const used = q.status?.used ?? {}
        return Object.keys(hard).sort().map(resource => ({
            quota: q.metadata?.name ?? '',
            resource,
            hard: hard[resource],
            used: used[resource] ?? '0'
        }))
    })

// Each resource a limit range limits, per type, one row each.
export const limitItemsOf = (ranges: V1LimitRange[]): IWrkLimitItem[] =>
    ranges.flatMap(r => (r.spec?.limits ?? []).flatMap(l => {
        const resources = [...new Set([
            ...Object.keys(l.min ?? {}), ...Object.keys(l.max ?? {}),
            ...Object.keys(l._default ?? {}), ...Object.keys(l.defaultRequest ?? {})
        ])].sort()
        return resources.map(resource => ({
            limitRange: r.metadata?.name ?? '',
            type: l.type,
            resource,
            min: l.min?.[resource] ?? '',
            max: l.max?.[resource] ?? '',
            defaultLimit: l._default?.[resource] ?? '',
            defaultRequest: l.defaultRequest?.[resource] ?? ''
        }))
    }))

// The nodes some pods run on, sorted, once each.
export const nodesOf = (inside: IPodJob[]): string[] => [...new Set(inside.map(p => p.job.node).filter(Boolean))].sort()

export const mapDescription = (ns: V1Namespace, inside: IPodJob[], quotas: V1ResourceQuota[], ranges: V1LimitRange[]): IWrkSubsystemDescription => ({
    name: ns.metadata?.name ?? '',
    status: subsystemStatusOf(ns),
    created: iso(ns.metadata?.creationTimestamp),
    labels: ns.metadata?.labels ?? {},
    annotations: ns.metadata?.annotations ?? {},
    pools: nodesOf(inside),
    quotas: quotaItemsOf(quotas),
    limits: limitItemsOf(ranges)
})
