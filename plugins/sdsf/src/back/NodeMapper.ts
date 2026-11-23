import type { V1Node, V1Pod } from '@kubernetes/client-node'
import { ESdsfNodeStatus, ISdsfNode } from '../common/SdsfTypes'
import { INodeUsage } from './PodMetrics'

/*
    A V1Node as an initiator of the INIT panel. Pure, like the other mappers: the tests feed it nodes written
    by hand.
*/

// Decimal suffixes as powers of ten (applied as an exponent, so '3800m' is exactly 3.8), binary ones as factors.
const DECIMAL: Record<string, number> = { n: -9, u: -6, m: -3, '': 0, k: 3, K: 3, M: 6, G: 9, T: 12, P: 15, E: 18 }
const BINARY: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5, Ei: 1024 ** 6 }

// A Kubernetes quantity ('3800m', '16Gi', '1e9', '4') as a number; 0 when it cannot be read.
export const quantityOf = (quantity: string | undefined): number => {
    const m = /^([+-]?\d+(?:\.\d+)?)(?:[eE]([+-]?\d+))?([a-zA-Z]*)$/.exec((quantity ?? '').trim())
    if (!m) return 0
    const exponent = Number(m[2] ?? 0)
    const suffix = m[3]
    if (BINARY[suffix] !== undefined) return Number(`${m[1]}e${exponent}`) * BINARY[suffix]
    if (DECIMAL[suffix] === undefined) return 0
    return Number(`${m[1]}e${exponent + DECIMAL[suffix]}`)
}

const ROLE_LABEL = 'node-role.kubernetes.io/'

export const rolesOf = (node: V1Node): string[] =>
    Object.keys(node.metadata?.labels ?? {}).filter(l => l.startsWith(ROLE_LABEL)).map(l => l.slice(ROLE_LABEL.length)).filter(Boolean).sort()

const isReady = (node: V1Node): boolean => (node.status?.conditions ?? []).some(c => c.type === 'Ready' && c.status === 'True')

// The pods a drain would evict: everything but those of a DaemonSet and the static (mirror) ones.
export const isEvictable = (pod: V1Pod): boolean =>
    !(pod.metadata?.ownerReferences ?? []).some(r => r.kind === 'DaemonSet') &&
    !pod.metadata?.annotations?.['kubernetes.io/config.mirror']

export const isRunning = (pod: V1Pod): boolean => pod.status?.phase !== 'Succeeded' && pod.status?.phase !== 'Failed'

/*
    The status reads the WHOLE node (every pod on it, whatever the key): whether a node is drained is a fact
    about the node. What the key limits is the Pods count, which `reached` brings already filtered.
*/
export const nodeStatusOf = (node: V1Node, podsOnNode: V1Pod[]): ESdsfNodeStatus => {
    if (!isReady(node)) return ESdsfNodeStatus.INACTIVE
    if (!node.spec?.unschedulable) return ESdsfNodeStatus.ACTIVE
    return podsOnNode.some(p => isRunning(p) && isEvictable(p)) ? ESdsfNodeStatus.HALTED : ESdsfNodeStatus.DRAINED
}

const ID_WIDTH = 8

/*
    The initiator IDs: each name without the prefix and the suffix every node shares, cut to 8 — 'agent' and
    'server' for k3d-kwirth-agent-0 and k3d-kwirth-server-0, '1-23' for ip-10-0-1-23.ec2.internal. When the
    start of what is left is not unique, its end; then the end of the name. Eight characters cannot always tell
    every node apart: the full name is on the NodeName column (PF11).
*/
export const nodeIdsOf = (names: string[]): string[] => {
    const unique = (ids: string[]) => ids.every(Boolean) && new Set(ids).size === ids.length
    const last8 = names.map(n => n.slice(-ID_WIDTH))
    if (names.length < 2) return last8
    let prefix = 0
    while (names.every(n => n.length > prefix && n[prefix] === names[0][prefix])) prefix++
    let suffix = 0
    while (names.every(n => n.length - suffix > prefix && n[n.length - 1 - suffix] === names[0][names[0].length - 1 - suffix])) suffix++
    const rest = names.map(n => n.slice(prefix, n.length - suffix).replace(/^[-.]+|[-.]+$/g, ''))
    const candidates = [rest.map(r => r.slice(0, ID_WIDTH)), rest.map(r => r.slice(-ID_WIDTH)), last8]
    return candidates.find(unique) ?? rest.map((r, i) => (r || names[i]).slice(0, ID_WIDTH))
}

export const mapNode = (node: V1Node, id: string, podsOnNode: V1Pod[], reached: number, usage: INodeUsage | undefined, interval: number | undefined): ISdsfNode => {
    const cpus = quantityOf(node.status?.allocatable?.cpu)
    const cpu = usage?.cpuSeconds !== undefined && interval && cpus > 0
        ? Math.round(usage.cpuSeconds / (interval * cpus) * 100 * 100) / 100
        : undefined
    const created = node.metadata?.creationTimestamp
    return {
        name: node.metadata?.name ?? '',
        id,
        status: nodeStatusOf(node, podsOnNode),
        roles: rolesOf(node),
        pods: reached,
        cpus,
        memory: quantityOf(node.status?.allocatable?.memory),
        cpu,
        memoryUsed: usage?.memory,
        version: node.status?.nodeInfo?.kubeletVersion ?? '',
        internalIp: (node.status?.addresses ?? []).find(a => a.type === 'InternalIP')?.address ?? '',
        created: created ? new Date(created).toISOString() : ''
    }
}
