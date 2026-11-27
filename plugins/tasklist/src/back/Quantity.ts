import type { V1Pod } from '@kubernetes/client-node'

/*
    Kubernetes quantities. The same reading as SDSF and WRKACTJOB: a plugin cannot import another plugin, and
    nothing in Kwirth's common libraries parses quantities.
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

/*
    What a pod asks for of a resource ('cpu', 'memory'), as the scheduler counts it: its containers together, or
    its largest init container if that is more (init containers run one at a time, before the rest).
*/
export const requestOf = (pod: V1Pod, resource: string): number => {
    const request = (c: { resources?: { requests?: Record<string, string> } }) => quantityOf(c.resources?.requests?.[resource])
    const regular = (pod.spec?.containers ?? []).reduce((sum, c) => sum + request(c), 0)
    const init = Math.max(0, ...(pod.spec?.initContainers ?? []).map(request))
    return Math.max(regular, init)
}
