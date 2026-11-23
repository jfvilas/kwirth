import type { V1ResourceQuota } from '@kubernetes/client-node'
import { ISdsfQuotaItem } from '../common/SdsfTypes'
import { quantityOf } from './NodeMapper'

/*
    A ResourceQuota as rows of the RES panel, one per resource it limits: on z/OS, RES shows the WLM resources
    and their state; on Kubernetes, what a namespace may use and how close it is. The hard limits the API
    server enforces are status.hard (spec.hard until the quota controller has seen it).
*/
export const percentOf = (used: string, hard: string): number => {
    const u = quantityOf(used)
    const h = quantityOf(hard)
    if (h <= 0) return u > 0 ? 100 : 0
    return Math.round(u / h * 1000) / 10
}

export const mapQuota = (rq: V1ResourceQuota): ISdsfQuotaItem[] => {
    const hard = rq.status?.hard ?? rq.spec?.hard ?? {}
    const used = rq.status?.used ?? {}
    const created = rq.metadata?.creationTimestamp
    return Object.keys(hard).sort().map(resource => ({
        namespace: rq.metadata?.namespace ?? '',
        name: rq.metadata?.name ?? '',
        resource,
        used: used[resource] ?? '0',
        hard: hard[resource],
        percent: percentOf(used[resource] ?? '0', hard[resource]),
        created: created ? new Date(created).toISOString() : ''
    }))
}
