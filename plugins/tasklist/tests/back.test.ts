import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { V1Pod } from '@kubernetes/client-node'
import { AccessKey, accessKeySerialize, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, IInstanceConfig } from '@kwirthmagnify/kwirth-common'
import { usageOf } from '../src/back/Usage'
import { IMetricsCluster, IMetricsValue } from '../src/back/MetricsProviderTypes'
import { editableObject, IdRegistry, isValidName, mapApplication, mapNode, mapProcess, mapUser, newTaskPod, ownerOf, PeakRegistry, replacementPod } from '../src/back/Mapper'
import { quantityOf, requestOf } from '../src/back/Quantity'
import { DEFAULT_TAIL_LINES, MAX_TAIL_LINES, TasklistChannel } from '../src/back/index'
import { EShutDownAction, ETasklistCommand, ETasklistError, isSystemUser, ITasklistMessage, ITasklistSnapshot } from '../src/common/TasklistTypes'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const pod = (over: { name?: string; namespace?: string; uid?: string; owner?: { kind: string; name: string }; hash?: string; node?: string; deleting?: boolean } = {}): V1Pod => ({
    metadata: {
        name: over.name ?? 'api-7d9f8b6c4-x2kq9', namespace: over.namespace ?? 'payroll', uid: over.uid ?? 'u-1',
        labels: over.hash === undefined ? { 'pod-template-hash': '7d9f8b6c4' } : (over.hash ? { 'pod-template-hash': over.hash } : {}),
        ...(over.owner === undefined
            ? { ownerReferences: [{ apiVersion: 'apps/v1', kind: 'ReplicaSet', name: 'api-7d9f8b6c4', uid: 'x', controller: true }] }
            : over.owner.kind ? { ownerReferences: [{ apiVersion: 'v1', kind: over.owner.kind, name: over.owner.name, uid: 'x', controller: true }] } : {}),
        ...(over.deleting ? { deletionTimestamp: new Date('2026-11-27T10:00:00Z') } : {})
    },
    spec: {
        nodeName: over.node ?? 'node-1',
        containers: [
            { name: 'api', image: 'payroll-api:2.1', resources: { requests: { cpu: '250m', memory: '128Mi' } } },
            { name: 'sidecar', image: 'envoy:1', resources: { requests: { cpu: '50m', memory: '64Mi' } } }
        ]
    },
    status: {
        phase: 'Running', startTime: new Date('2026-11-27T09:00:00Z'),
        containerStatuses: [
            { name: 'api', image: 'payroll-api:2.1', imageID: '', ready: true, restartCount: 2, state: { running: {} } },
            { name: 'sidecar', image: 'envoy:1', imageID: '', ready: false, restartCount: 0, state: { waiting: { reason: 'CrashLoopBackOff' } } }
        ]
    }
} as V1Pod)

const values = (v: Record<string, number>) => new Map<string, IMetricsValue>(Object.entries(v).map(([k, value]) => [k, { value, timestamp: 0 }]))

const reading = (container: Record<string, number>, node: { timestamp: number; rx: number; tx: number; cores?: number; memory?: number }, cpuUsage = 12.345): IMetricsCluster => ({
    metricsInterval: 10,
    cluster: { vcpus: 4, memory: 16e9, cpuUsage, memoryUsage: 30 },
    nodes: [{
        name: 'node-1', timestamp: node.timestamp, containerMetricValues: values(container),
        summary: { cpu: { usageNanoCores: (node.cores ?? 1) * 1e9 }, memory: { workingSetBytes: node.memory ?? 2e9 }, network: { rxBytes: node.rx, txBytes: node.tx } }
    }]
})

const C = 'container_cpu_usage_seconds_total'
const M = 'container_memory_working_set_bytes'

// ─── Quantity ─────────────────────────────────────────────────────────────────────────────────────

test('quantityOf reads decimal and binary suffixes; requestOf adds the containers or takes the largest init', () => {
    assert.equal(quantityOf('250m'), 0.25)
    assert.equal(quantityOf('2'), 2)
    assert.equal(quantityOf('128Mi'), 128 * 1024 * 1024)
    assert.equal(quantityOf('1e3'), 1000)
    assert.equal(quantityOf('nonsense'), 0)
    assert.equal(quantityOf(undefined), 0)
    const p = pod()
    assert.equal(requestOf(p, 'cpu'), 0.3)
    assert.equal(requestOf(p, 'memory'), 192 * 1024 * 1024)
    p.spec!.initContainers = [{ name: 'init', resources: { requests: { memory: '1Gi' } } }]
    assert.equal(requestOf(p, 'memory'), 1024 ** 3)
})

// ─── Usage ────────────────────────────────────────────────────────────────────────────────────────

test('usageOf: nothing without readings; memory and counters from one, CPU and network only from two', () => {
    assert.equal(usageOf([]).containers.size, 0)
    const one = usageOf([reading({ [`payroll/api-x/api/${C}`]: 100, [`payroll/api-x/api/${M}`]: 5e6 }, { timestamp: 1000, rx: 1000, tx: 500 })])
    assert.deepEqual(one.containers.get('payroll/api-x/api'), { memory: 5e6, cpuSeconds: 100 })
    assert.equal(one.cluster, undefined)
    assert.equal(one.nodes.get('node-1')?.rxBytesPerSecond, undefined)
    assert.equal(one.nodes.get('node-1')?.cpu, 1)

    const two = usageOf([
        reading({ [`payroll/api-x/api/${C}`]: 100, [`payroll/api-x/sidecar/${C}`]: 10 }, { timestamp: 1000, rx: 1000, tx: 500 }),
        reading({ [`payroll/api-x/api/${C}`]: 104, [`payroll/api-x/sidecar/${C}`]: 5, [`payroll/api-x/api/${M}`]: 1e6 }, { timestamp: 11000, rx: 11000, tx: 2500 })
    ])
    // 4 CPU seconds over 10 s of 4 vcpus = 10 %
    assert.equal(two.containers.get('payroll/api-x/api')?.cpu, 10)
    // a counter that went back (a restart) has no % this time
    assert.equal(two.containers.get('payroll/api-x/sidecar')?.cpu, undefined)
    assert.equal(two.nodes.get('node-1')?.rxBytesPerSecond, 1000)
    assert.equal(two.nodes.get('node-1')?.txBytesPerSecond, 200)
    assert.deepEqual(two.cluster, { cpu: 12.35, memory: 2e9, interval: 10 })
})

test('usageOf: a node counter of 0 is "not given", and a node without a summary has no figures', () => {
    const r1 = reading({}, { timestamp: 1000, rx: 0, tx: 0 })
    const r2 = reading({}, { timestamp: 2000, rx: 500, tx: 500 })
    assert.equal(usageOf([r1, r2]).nodes.get('node-1')?.rxBytesPerSecond, undefined)
    const bare = reading({}, { timestamp: 1000, rx: 1, tx: 1 })
    bare.nodes[0].summary = undefined
    assert.deepEqual(usageOf([bare]).nodes.get('node-1'), {})
})

// ─── Mapper ───────────────────────────────────────────────────────────────────────────────────────

test('IdRegistry: Windows-like PIDs, stable per key, new for a new key, and forgets what is gone', () => {
    const ids = new IdRegistry(4, 4)
    assert.equal(ids.idOf('a'), 4)
    assert.equal(ids.idOf('b'), 8)
    assert.equal(ids.idOf('a'), 4)
    ids.keepOnly(new Set(['b']))
    assert.equal(ids.idOf('a'), 12)
    assert.equal(ids.idOf('b'), 8)
})

test('PeakRegistry keeps the highest value and forgets with the pod', () => {
    const peaks = new PeakRegistry()
    assert.equal(peaks.peakOf('a', undefined), undefined)
    assert.equal(peaks.peakOf('a', 10), 10)
    assert.equal(peaks.peakOf('a', 5), 10)
    peaks.keepOnly(new Set())
    assert.equal(peaks.peakOf('a', 5), 5)
})

test('ownerOf: a ReplicaSet with the template hash is its Deployment; the rest as they are; none for a bare pod', () => {
    assert.deepEqual(ownerOf(pod()), { kind: 'Deployment', name: 'api' })
    assert.deepEqual(ownerOf(pod({ hash: 'other' })), { kind: 'ReplicaSet', name: 'api-7d9f8b6c4' })
    assert.deepEqual(ownerOf(pod({ owner: { kind: 'StatefulSet', name: 'db' }, hash: '' })), { kind: 'StatefulSet', name: 'db' })
    assert.equal(ownerOf(pod({ owner: { kind: '', name: '' } })), undefined)
})

test('mapProcess: a pod as a process, its containers as threads, with the usage of each', () => {
    const usage = usageOf([
        reading({ [`payroll/api-7d9f8b6c4-x2kq9/api/${C}`]: 10, [`payroll/api-7d9f8b6c4-x2kq9/sidecar/${C}`]: 1 }, { timestamp: 0, rx: 1, tx: 1 }),
        reading({
            [`payroll/api-7d9f8b6c4-x2kq9/api/${C}`]: 12, [`payroll/api-7d9f8b6c4-x2kq9/sidecar/${C}`]: 3,
            [`payroll/api-7d9f8b6c4-x2kq9/api/${M}`]: 3000, [`payroll/api-7d9f8b6c4-x2kq9/sidecar/${M}`]: 1000,
            'payroll/api-7d9f8b6c4-x2kq9/api/container_fs_reads_bytes_total': 70, 'payroll/api-7d9f8b6c4-x2kq9/api/container_fs_writes_bytes_total': 30
        }, { timestamp: 10000, rx: 1, tx: 1 })
    ])
    const p = mapProcess(pod(), usage, new IdRegistry(4, 4), new PeakRegistry())
    assert.equal(p.pid, 4)
    assert.equal(p.name, 'api-7d9f8b6c4-x2kq9')
    assert.equal(p.namespace, 'payroll')
    assert.equal(p.node, 'node-1')
    assert.equal(p.phase, 'Running')
    assert.equal(p.startTime, '2026-11-27T09:00:00.000Z')
    assert.deepEqual(p.owner, { kind: 'Deployment', name: 'api' })
    assert.equal(p.cpu, 10)          // (2 + 2) / (10 s * 4 vcpus)
    assert.equal(p.cpuTime, 15)
    assert.equal(p.memory, 4000)
    assert.equal(p.peakMemory, 4000)
    assert.equal(p.ioRead, 70)
    assert.equal(p.ioWrite, 30)
    assert.deepEqual(p.containers.map(c => [c.name, c.state, c.ready, c.restarts, c.cpu, c.memory]), [
        ['api', 'Running', true, 2, 5, 3000],
        ['sidecar', 'Waiting (CrashLoopBackOff)', false, 0, 5, 1000]
    ])
})

test('mapProcess: without metrics there are no figures, and a pod being deleted is Terminating', () => {
    const p = mapProcess(pod({ deleting: true }), usageOf([]), new IdRegistry(4, 4), new PeakRegistry())
    assert.equal(p.phase, 'Terminating')
    assert.equal(p.cpu, undefined)
    assert.equal(p.memory, undefined)
    assert.equal(p.peakMemory, undefined)
})

test('mapNode: capacity, allocatable, Ready, cordoned, and the CPU as the node\'s own %', () => {
    const usage = usageOf([reading({}, { timestamp: 0, rx: 1, tx: 1, cores: 1, memory: 3e9 })])
    const n = mapNode({
        metadata: { name: 'node-1' }, spec: { unschedulable: true },
        status: { capacity: { cpu: '4', memory: '8Gi' }, allocatable: { cpu: '3800m', memory: '7Gi' }, conditions: [{ type: 'Ready', status: 'True' }] }
    }, usage)
    assert.deepEqual(n, {
        name: 'node-1', ready: true, unschedulable: true, cpuCapacity: 4, cpuAllocatable: 3.8,
        memoryCapacity: 8 * 1024 ** 3, memoryAllocatable: 7 * 1024 ** 3, cpu: 25, memory: 3e9,
        rxBytesPerSecond: undefined, txBytesPerSecond: undefined
    })
    assert.equal(mapNode({ metadata: { name: 'x' }, status: { conditions: [{ type: 'Ready', status: 'False' }] } }, usage).ready, false)
})

test('mapApplication, mapUser, newTaskPod, isValidName, isSystemUser', () => {
    assert.deepEqual(mapApplication('Deployment', { metadata: { name: 'api', namespace: 'payroll' }, spec: { replicas: 3, selector: {}, template: {} }, status: { readyReplicas: 2 } }),
        { kind: 'Deployment', namespace: 'payroll', name: 'api', replicas: 3, readyReplicas: 2 })
    assert.deepEqual(mapApplication('StatefulSet', { metadata: { name: 'x', namespace: 'y' } }), { kind: 'StatefulSet', namespace: 'y', name: 'x', replicas: 1, readyReplicas: 0 })
    // a DaemonSet's replicas are the nodes it should run on
    assert.deepEqual(mapApplication('DaemonSet', { metadata: { name: 'agent', namespace: 'y' }, status: { desiredNumberScheduled: 3, numberReady: 2, currentNumberScheduled: 3, numberMisscheduled: 0 } }),
        { kind: 'DaemonSet', namespace: 'y', name: 'agent', replicas: 3, readyReplicas: 2 })
    const replaced = replacementPod(pod({ owner: { kind: '', name: '' } }))
    assert.deepEqual(Object.keys(replaced.metadata ?? {}).sort(), ['annotations', 'labels', 'name', 'namespace'])
    assert.equal(replaced.spec?.containers.length, 2)
    assert.equal(replaced.status, undefined)
    const editable = editableObject('Pod', 'v1', { metadata: { name: 'p', resourceVersion: '7', managedFields: [{}] } as never })
    assert.deepEqual(editable, { apiVersion: 'v1', kind: 'Pod', metadata: { name: 'p', resourceVersion: '7' } })
    const ids = new IdRegistry(0, 1)
    const processes = [mapProcess(pod(), usageOf([]), new IdRegistry(4, 4), new PeakRegistry())]
    assert.deepEqual(mapUser({ metadata: { name: 'payroll' }, status: { phase: 'Active' } }, processes, ids), { id: 0, name: 'payroll', phase: 'Active', pods: 1 })
    assert.deepEqual(mapUser({ metadata: { name: 'gone', deletionTimestamp: new Date() } }, processes, ids), { id: 1, name: 'gone', phase: 'Terminating', pods: 0 })
    const task = newTaskPod('payroll', 'busybox-1', 'busybox:1.36')
    assert.equal(task.spec?.restartPolicy, 'Never')
    assert.equal(task.spec?.containers[0].image, 'busybox:1.36')
    assert.equal(task.metadata?.labels?.['app.kubernetes.io/created-by'], 'kwirth-tasklist')
    assert.ok(isValidName('busybox-1'))
    assert.ok(!isValidName('Busybox'))
    assert.ok(!isValidName('-a'))
    assert.ok(!isValidName(''))
    assert.ok(isSystemUser('kube-system'))
    assert.ok(!isSystemUser('payroll'))
})

// ─── the channel ──────────────────────────────────────────────────────────────────────────────────

interface ICall { method: string; params: unknown }

const fakeCluster = (opts: { fail?: { code?: number; body?: string; message?: string }; metrics?: boolean; slowDelete?: boolean } = {}) => {
    const calls: ICall[] = []
    const deleted = new Set<string>()
    const call = async <T>(method: string, params: unknown, result: T): Promise<T> => {
        calls.push({ method, params })
        if (opts.fail) throw Object.assign(new Error(opts.fail.message ?? 'boom'), opts.fail)
        return result
    }
    const subscribed: unknown[] = []
    const clusterInfo = {
        coreApi: {
            listPodForAllNamespaces: (p?: unknown) => call('listPods', p, { items: [
                pod(),
                pod({ name: 'vault-0', namespace: 'vault', uid: 'u-2', owner: { kind: 'StatefulSet', name: 'vault' }, hash: '' }),
                pod({ name: 'coredns-1', namespace: 'kube-system', uid: 'u-3', owner: { kind: 'Deployment', name: 'x' }, hash: '' }),
                pod({ name: 'agent-1', namespace: 'payroll', uid: 'u-4', owner: { kind: 'DaemonSet', name: 'agent' }, hash: '' })
            ] }),
            listNode: () => call('listNodes', undefined, { items: [
                { metadata: { name: 'node-2' }, status: { capacity: { cpu: '2', memory: '4Gi' }, allocatable: { cpu: '2', memory: '3Gi' } } },
                { metadata: { name: 'node-1' }, status: { capacity: { cpu: '4', memory: '8Gi' }, allocatable: { cpu: '4', memory: '7Gi' } } }
            ] }),
            listNamespace: () => call('listNamespaces', undefined, { items: [
                { metadata: { name: 'vault' } }, { metadata: { name: 'payroll' } }, { metadata: { name: 'kube-system' } }, { metadata: { name: 'empty' } }
            ] }),
            // a deleted pod reads as 404 until it is created again (what a Restart of a bare pod waits for)
            readNamespacedPod: (p: { name: string; namespace: string }) => deleted.has(p.name)
                ? Promise.reject(Object.assign(new Error('not found'), { code: 404 }))
                : call('readPod', p,
                    p.name === 'bare' ? pod({ name: 'bare', owner: { kind: '', name: '' } })
                        : p.name === 'op' ? pod({ name: 'op', owner: { kind: 'Rollout', name: 'r' }, hash: '' })
                            : p.name === 'vault-0' ? pod({ name: 'vault-0', namespace: 'vault', owner: { kind: 'StatefulSet', name: 'vault' }, hash: '' })
                                : { ...pod(), metadata: { ...pod().metadata, managedFields: [{ manager: 'kubectl' }], resourceVersion: '42' } }),
            deleteNamespacedPod: (p: { name: string }) => { if (opts.slowDelete !== true) deleted.add(p.name); return call('deletePod', p, {}) },
            createNamespacedPod: (p: { body: V1Pod }) => { deleted.delete(p.body.metadata?.name ?? ''); return call('createPod', p, {}) },
            readNamespacedPodLog: (p: unknown) => call('log', p, 'line 1\nline 2\n'),
            replaceNamespacedPod: (p: unknown) => call('replacePod', p, {}),
            deleteNamespace: (p: unknown) => call('deleteNamespace', p, {}),
            patchNode: (p: unknown) => call('patchNode', p, {}),
            createNamespacedPodEviction: (p: { name: string }) => p.name === 'coredns-1'
                ? Promise.reject(Object.assign(new Error('x'), { body: JSON.stringify({ message: 'Cannot evict pod as it would violate the pod\'s disruption budget.' }) }))
                : call('evict', p, {})
        },
        appsApi: {
            listDeploymentForAllNamespaces: () => call('listDeployments', undefined, { items: [
                { metadata: { name: 'api', namespace: 'payroll' }, spec: { replicas: 2 }, status: { readyReplicas: 1 } },
                { metadata: { name: 'web', namespace: 'vault' }, spec: { replicas: 1 }, status: { readyReplicas: 1 } }
            ] }),
            listStatefulSetForAllNamespaces: () => call('listStatefulSets', undefined, { items: [
                { metadata: { name: 'vault', namespace: 'vault' }, spec: { replicas: 1 }, status: { readyReplicas: 1 } }
            ] }),
            listDaemonSetForAllNamespaces: () => call('listDaemonSets', undefined, { items: [
                { metadata: { name: 'agent', namespace: 'payroll' }, status: { desiredNumberScheduled: 2, numberReady: 2 } }
            ] }),
            readNamespacedReplicaSet: (p: unknown) => call('readReplicaSet', p, { metadata: { ownerReferences: [{ kind: 'Deployment', name: 'api', controller: true }] } }),
            readNamespacedDeployment: (p: unknown) => call('readDeployment', p, { metadata: { name: 'api', namespace: 'payroll' }, spec: { replicas: 2 } }),
            readNamespacedStatefulSet: (p: unknown) => call('readStatefulSet', p, { metadata: { name: 'vault', namespace: 'vault' } }),
            readNamespacedDaemonSet: (p: unknown) => call('readDaemonSet', p, { metadata: { name: 'agent', namespace: 'payroll' } }),
            replaceNamespacedDeployment: (p: unknown) => call('replaceDeployment', p, {}),
            replaceNamespacedStatefulSet: (p: unknown) => call('replaceStatefulSet', p, {}),
            replaceNamespacedDaemonSet: (p: unknown) => call('replaceDaemonSet', p, {}),
            deleteNamespacedDeployment: (p: unknown) => call('deleteDeployment', p, {}),
            deleteNamespacedReplicaSet: (p: unknown) => call('deleteReplicaSet', p, {}),
            deleteNamespacedStatefulSet: (p: unknown) => call('deleteStatefulSet', p, {}),
            deleteNamespacedDaemonSet: (p: unknown) => call('deleteDaemonSet', p, {})
        },
        batchApi: {
            deleteNamespacedJob: (p: unknown) => call('deleteJob', p, {})
        },
        getProvider: (id: string) => opts.metrics === false ? undefined : ({
            id, subscribe: (s: unknown) => { subscribed.push(s); return Promise.resolve() }, unsubscribe: (s: unknown) => { subscribed.splice(subscribed.indexOf(s), 1) }
        })
    }
    return { clusterInfo, calls, subscribed }
}

class FakeSocket {
    sent: unknown[] = []
    send = (data: string) => { this.sent.push(JSON.parse(data)) }
}

const key = (resources: string): AccessKey => ({ id: 'k', type: 'bearer', resources } as AccessKey)

const instanceConfig = (k: AccessKey, instance = 'i1'): IInstanceConfig => ({
    channel: 'tasklist', objects: '', action: EInstanceMessageAction.START, flow: EInstanceMessageFlow.REQUEST, type: EInstanceMessageType.SIGNAL,
    instance, accessKey: accessKeySerialize(k), scope: 'tasklist$read', view: 'cluster', namespace: '', group: '', pod: '', container: ''
} as unknown as IInstanceConfig)

const message = (command: ETasklistCommand, extra: Partial<ITasklistMessage> = {}): ITasklistMessage => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.REQUEST, type: EInstanceMessageType.DATA, channel: 'tasklist', instance: 'i1',
    msgtype: 'tasklistmessage', id: 'r1', accessKey: 'whatever the browser says', command,
    targetNamespace: 'payroll', targetName: 'api-7d9f8b6c4-x2kq9', ...extra
})

const open = async (resources: string, opts: { fail?: { code?: number; body?: string; message?: string }; metrics?: boolean; slowDelete?: boolean } = {}) => {
    const fake = fakeCluster(opts)
    const logs: string[] = []
    const channel = new TasklistChannel(fake.clusterInfo as never, { logInfo: (m: string) => logs.push(m), logWarning: (m: string) => logs.push(m), logError: (m: string) => logs.push(m) } as never)
    const ws = new FakeSocket() as unknown as WebSocket
    const ok = await channel.addObject(ws, instanceConfig(key(resources)), '*all', '*all', '*all')
    const run = async (m: ITasklistMessage) => {
        await channel.processCommand(ws, m)
        return (ws as unknown as FakeSocket).sent.at(-1) as Record<string, unknown>
    }
    return { channel, ws: ws as unknown as FakeSocket, ok, run, logs, ...fake }
}

const READ_PAYROLL = 'tasklist$read:^payroll$:::'
const END_PAYROLL = 'tasklist$end:^payroll$:::'
const ADMIN = 'admin::::'

test('channel data: a cluster channel, the metrics provider as a soft dependency, the scope ladder', () => {
    const c = new TasklistChannel(fakeCluster().clusterInfo as never, {} as never)
    const d = c.getChannelData()
    assert.equal(d.id, 'tasklist')
    assert.equal(d.cluster, true)
    assert.equal(d.resourced, false)
    assert.deepEqual(c.requirements.providers, ['metrics'])
    assert.ok(c.getChannelScopeLevel('tasklist$read') < c.getChannelScopeLevel('tasklist$end'))
    assert.ok(c.getChannelScopeLevel('tasklist$end') < c.getChannelScopeLevel('cluster'))
    assert.ok(c.getChannelScopeLevel('cluster') < c.getChannelScopeLevel('admin'))
    assert.deepEqual(c.getScopeCatalog().map(s => s.scope), ['tasklist$read', 'tasklist$end'])
})

test('the door: no tasklist$read, no instance, and the signal says why; with it, metrics are subscribed', async () => {
    const denied = await open('magnify$read::::')
    assert.equal(denied.ok, false)
    assert.match(String((denied.ws.sent[0] as { text: string }).text), /tasklist\$read/)
    assert.equal(denied.subscribed.length, 0)
    const allowed = await open(READ_PAYROLL)
    assert.equal(allowed.ok, true)
    assert.equal(allowed.subscribed.length, 1)
    allowed.channel.removeConnection(allowed.ws as unknown as WebSocket)
    assert.equal(allowed.subscribed.length, 0)
})

test('SNAPSHOT with a namespace key: its processes, users and applications only; no nodes below cluster', async () => {
    const { run } = await open(READ_PAYROLL)
    const r = await run(message(ETasklistCommand.SNAPSHOT))
    assert.equal(r.ok, true)
    assert.equal(r.canEnd, false)
    assert.equal(r.isAdmin, false)
    const s = r.snapshot as ITasklistSnapshot
    assert.deepEqual(s.processes.map(p => p.name), ['api-7d9f8b6c4-x2kq9', 'agent-1'])
    assert.deepEqual(s.processes.map(p => p.pid), [4, 8])
    assert.deepEqual(s.users.map(u => u.name), ['payroll'])
    // the applications of every kind the key reaches (PRD D17), sorted by name
    assert.deepEqual(s.applications.map(a => `${a.kind} ${a.name}`), ['DaemonSet agent', 'Deployment api'])
    assert.deepEqual(s.applications.find(a => a.kind === 'DaemonSet'), { kind: 'DaemonSet', namespace: 'payroll', name: 'agent', replicas: 2, readyReplicas: 2 })
    assert.deepEqual(s.nodes, [])
    assert.deepEqual(s.requests, { cpu: 0.6, memory: 2 * 192 * 1024 * 1024 })
    assert.equal(s.metrics, undefined)
})

test('SNAPSHOT with an admin key: every process, the nodes sorted; PIDs stay across snapshots', async () => {
    const { run } = await open(ADMIN)
    const r = await run(message(ETasklistCommand.SNAPSHOT))
    const s = r.snapshot as ITasklistSnapshot
    assert.equal(r.canEnd, true)
    assert.equal(r.isAdmin, true)
    assert.equal(s.processes.length, 4)
    assert.deepEqual(s.nodes.map(n => n.name), ['node-1', 'node-2'])
    assert.deepEqual(s.users.map(u => u.name), ['empty', 'kube-system', 'payroll', 'vault'])
    const again = (await run(message(ETasklistCommand.SNAPSHOT))).snapshot as ITasklistSnapshot
    assert.deepEqual(again.processes.map(p => p.pid), s.processes.map(p => p.pid))
})

test('SNAPSHOT with metrics: the cluster figures for the whole cluster, the key\'s share below it', async () => {
    const admin = await open(ADMIN)
    const readings = [
        reading({ [`payroll/api-7d9f8b6c4-x2kq9/api/${C}`]: 10, [`vault/vault-0/api/${C}`]: 10 }, { timestamp: 0, rx: 1, tx: 1 }, 50),
        reading({ [`payroll/api-7d9f8b6c4-x2kq9/api/${C}`]: 14, [`vault/vault-0/api/${C}`]: 18, [`payroll/api-7d9f8b6c4-x2kq9/api/${M}`]: 100 }, { timestamp: 10000, rx: 1, tx: 1 }, 50)
    ]
    for (const r of readings) admin.channel.processProviderEvent('metrics', r)
    admin.channel.processProviderEvent('other', {})
    const all = (await admin.run(message(ETasklistCommand.SNAPSHOT))).snapshot as ITasklistSnapshot
    assert.deepEqual(all.metrics, { cpu: 50, memory: 2e9, interval: 10 })

    const mine = await open(READ_PAYROLL)
    for (const r of readings) mine.channel.processProviderEvent('metrics', r)
    const share = (await mine.run(message(ETasklistCommand.SNAPSHOT))).snapshot as ITasklistSnapshot
    assert.deepEqual(share.metrics, { cpu: 10, memory: 100, interval: 10 })
})

test('END_PROCESS: needs tasklist$end and a key that reaches the pod; deletes it', async () => {
    const reader = await open(READ_PAYROLL)
    const denied = await reader.run(message(ETasklistCommand.END_PROCESS))
    assert.equal(denied.error, ETasklistError.ACCESS_DENIED)
    assert.equal(denied.detail, 'Access is denied.')
    assert.ok(!reader.calls.some(c => c.method === 'deletePod'))

    const ender = await open(END_PAYROLL)
    assert.equal((await ender.run(message(ETasklistCommand.END_PROCESS, { targetNamespace: 'vault', targetName: 'vault-0' }))).error, ETasklistError.ACCESS_DENIED)
    const r = await ender.run(message(ETasklistCommand.END_PROCESS))
    assert.equal(r.ok, true)
    assert.deepEqual(ender.calls.find(c => c.method === 'deletePod')?.params, { name: 'api-7d9f8b6c4-x2kq9', namespace: 'payroll' })
    assert.equal((await ender.run(message(ETasklistCommand.END_PROCESS, { targetName: '' }))).error, ETasklistError.NOT_FOUND)
})

test('END_PROCESS_TREE: up from the ReplicaSet to the Deployment; a StatefulSet; a bare pod alone; an unknown controller leaves the pod alone', async () => {
    const admin = await open(ADMIN)
    let r = await admin.run(message(ETasklistCommand.END_PROCESS_TREE))
    assert.equal(r.ok, true)
    assert.equal(r.detail, 'Deployment api')
    assert.deepEqual(admin.calls.find(c => c.method === 'deleteDeployment')?.params, { name: 'api', namespace: 'payroll', propagationPolicy: 'Background' })

    r = await admin.run(message(ETasklistCommand.END_PROCESS_TREE, { targetNamespace: 'vault', targetName: 'vault-0' }))
    assert.equal(r.detail, 'StatefulSet vault')

    r = await admin.run(message(ETasklistCommand.END_PROCESS_TREE, { targetName: 'bare' }))
    assert.equal(r.detail, 'Pod bare')

    r = await admin.run(message(ETasklistCommand.END_PROCESS_TREE, { targetName: 'op' }))
    assert.match(String(r.detail), /Rollout r is not one/)
    assert.deepEqual(admin.calls.filter(c => c.method === 'deletePod').map(c => (c.params as { name: string }).name), ['bare', 'op'])
})

test('END_PROCESS_TREE: a key that reaches the pod but not its controller by name is denied', async () => {
    const narrow = await open('tasklist$end:^payroll$::api-7d9f8b6c4:')
    const r = await narrow.run(message(ETasklistCommand.END_PROCESS_TREE))
    assert.equal(r.error, ETasklistError.ACCESS_DENIED)
    assert.ok(!narrow.calls.some(c => c.method.startsWith('delete')))
})

test('END_TASK deletes the application by its kind; NEW_TASK validates and creates the pod', async () => {
    const ender = await open(END_PAYROLL)
    assert.equal((await ender.run(message(ETasklistCommand.END_TASK, { targetName: 'api', targetKind: 'Deployment' }))).ok, true)
    assert.deepEqual(ender.calls.find(c => c.method === 'deleteDeployment')?.params, { name: 'api', namespace: 'payroll' })
    assert.equal((await ender.run(message(ETasklistCommand.END_TASK, { targetName: 'agent', targetKind: 'DaemonSet' }))).ok, true)
    assert.deepEqual(ender.calls.find(c => c.method === 'deleteDaemonSet')?.params, { name: 'agent', namespace: 'payroll' })
    assert.equal((await ender.run(message(ETasklistCommand.END_TASK, { targetName: 'db', targetKind: 'StatefulSet' }))).ok, true)
    assert.match(String((await ender.run(message(ETasklistCommand.END_TASK, { targetName: 'x', targetKind: 'Job' }))).detail), /not an application/)

    assert.match(String((await ender.run(message(ETasklistCommand.NEW_TASK, { targetName: 'x', image: ' ' }))).detail), /image/)
    assert.match(String((await ender.run(message(ETasklistCommand.NEW_TASK, { targetName: 'Bad_Name', image: 'busybox' }))).detail), /not a valid name/)
    assert.match(String((await ender.run(message(ETasklistCommand.NEW_TASK, { targetName: 'ok', targetNamespace: '', image: 'busybox' }))).detail), /namespace/)
    assert.equal((await ender.run(message(ETasklistCommand.NEW_TASK, { targetName: 'ok', targetNamespace: 'vault', image: 'busybox' }))).error, ETasklistError.ACCESS_DENIED)
    const r = await ender.run(message(ETasklistCommand.NEW_TASK, { targetName: 'busybox-1', image: 'busybox:1.36' }))
    assert.equal(r.ok, true)
    const created = ender.calls.find(c => c.method === 'createPod')?.params as { namespace: string; body: V1Pod }
    assert.equal(created.namespace, 'payroll')
    assert.equal(created.body.metadata?.name, 'busybox-1')
})

test('LOG: a container\'s last lines, for a key that reaches it; the tail is bounded', async () => {
    const reader = await open(READ_PAYROLL)
    const r = await reader.run(message(ETasklistCommand.LOG, { containerName: 'api' }))
    assert.deepEqual(r.lines, ['line 1', 'line 2'])
    assert.deepEqual(reader.calls.find(c => c.method === 'log')?.params, { name: 'api-7d9f8b6c4-x2kq9', namespace: 'payroll', container: 'api', tailLines: DEFAULT_TAIL_LINES })
    await reader.run(message(ETasklistCommand.LOG, { containerName: 'api', tailLines: 10 ** 9 }))
    assert.equal((reader.calls.filter(c => c.method === 'log')[1].params as { tailLines: number }).tailLines, MAX_TAIL_LINES)
    assert.equal((await reader.run(message(ETasklistCommand.LOG, { containerName: '' }))).error, ETasklistError.NOT_FOUND)
    assert.equal((await reader.run(message(ETasklistCommand.LOG, { targetNamespace: 'vault', targetName: 'vault-0', containerName: 'api' }))).error, ETasklistError.ACCESS_DENIED)
})

test('RESTART_PROCESS: a pod with a controller is deleted; a bare one is deleted, waited for and created again', async () => {
    const reader = await open(READ_PAYROLL)
    assert.equal((await reader.run(message(ETasklistCommand.RESTART_PROCESS))).error, ETasklistError.ACCESS_DENIED)
    const admin = await open(ADMIN)
    const owned = await admin.run(message(ETasklistCommand.RESTART_PROCESS))
    assert.equal(owned.detail, 'deleted, its ReplicaSet api-7d9f8b6c4 starts another')
    assert.ok(!admin.calls.some(c => c.method === 'createPod'))
    const bare = await admin.run(message(ETasklistCommand.RESTART_PROCESS, { targetName: 'bare' }))
    assert.equal(bare.detail, 'deleted and started again')
    const created = admin.calls.find(c => c.method === 'createPod')?.params as { namespace: string; body: V1Pod }
    assert.equal(created.body.metadata?.name, 'bare')
    assert.equal(created.body.metadata?.uid, undefined)
    assert.equal(created.body.status, undefined)
})

test('GET_YAML and APPLY_YAML: the object as YAML without managedFields; saved back only as the same object', async () => {
    const reader = await open(READ_PAYROLL)
    assert.equal((await reader.run(message(ETasklistCommand.GET_YAML, { targetKind: 'Pod' }))).error, ETasklistError.ACCESS_DENIED)
    const admin = await open(ADMIN)
    const got = await admin.run(message(ETasklistCommand.GET_YAML, { targetKind: 'Pod' }))
    const text = String(got.yaml)
    assert.match(text, /^apiVersion: v1\nkind: Pod\n/)
    assert.match(text, /resourceVersion: '42'/)
    assert.doesNotMatch(text, /managedFields/)
    const deployment = await admin.run(message(ETasklistCommand.GET_YAML, { targetKind: 'Deployment', targetName: 'api' }))
    assert.match(String(deployment.yaml), /^apiVersion: apps\/v1\nkind: Deployment\n/)
    assert.match(String((await admin.run(message(ETasklistCommand.GET_YAML, { targetKind: 'Secret', targetName: 'x' }))).detail), /cannot be edited/)

    const saved = await admin.run(message(ETasklistCommand.APPLY_YAML, { targetKind: 'Pod', yaml: text.replace('payroll-api:2.1', 'payroll-api:2.2') }))
    assert.equal(saved.ok, true)
    const replaced = admin.calls.find(c => c.method === 'replacePod')?.params as { name: string; body: V1Pod }
    assert.equal(replaced.name, 'api-7d9f8b6c4-x2kq9')
    assert.equal(replaced.body.spec?.containers[0].image, 'payroll-api:2.2')
    assert.equal(replaced.body.metadata?.resourceVersion, '42')
    // another object, another kind or YAML that cannot be read: refused, nothing replaced
    assert.match(String((await admin.run(message(ETasklistCommand.APPLY_YAML, { targetKind: 'Pod', yaml: text.replace('name: api-7d9f8b6c4-x2kq9', 'name: other') }))).detail), /must still be the Pod/)
    assert.match(String((await admin.run(message(ETasklistCommand.APPLY_YAML, { targetKind: 'Deployment', targetName: 'api', yaml: text }))).detail), /must still be the Deployment/)
    assert.match(String((await admin.run(message(ETasklistCommand.APPLY_YAML, { targetKind: 'Pod', yaml: 'a: [' }))).detail), /cannot be read/)
    assert.equal(admin.calls.filter(c => c.method === 'replacePod').length, 1)
    for (const kind of ['StatefulSet', 'DaemonSet', 'Deployment']) {
        assert.equal((await admin.run(message(ETasklistCommand.APPLY_YAML, { targetKind: kind, targetName: 'x', yaml: `kind: ${kind}\nmetadata:\n  name: x\n` }))).ok, true)
    }
    assert.deepEqual(admin.calls.filter(c => c.method.startsWith('replace')).map(c => c.method), ['replacePod', 'replaceStatefulSet', 'replaceDaemonSet', 'replaceDeployment'])
})

test('LOG_OFF and SHUT_DOWN are for admin alone', async () => {
    const ender = await open(END_PAYROLL)
    assert.equal((await ender.run(message(ETasklistCommand.LOG_OFF, { targetName: 'payroll' }))).error, ETasklistError.ACCESS_DENIED)
    assert.equal((await ender.run(message(ETasklistCommand.SHUT_DOWN, { targetName: 'node-1', shutDown: EShutDownAction.STAND_BY }))).error, ETasklistError.ACCESS_DENIED)
    assert.ok(!ender.calls.some(c => c.method === 'deleteNamespace' || c.method === 'patchNode'))

    const admin = await open(ADMIN)
    assert.equal((await admin.run(message(ETasklistCommand.LOG_OFF, { targetName: 'empty' }))).ok, true)
    assert.deepEqual(admin.calls.find(c => c.method === 'deleteNamespace')?.params, { name: 'empty' })
    assert.equal((await admin.run(message(ETasklistCommand.LOG_OFF, { targetName: '' }))).error, ETasklistError.NOT_FOUND)
})

test('SHUT_DOWN: Stand By cordons and Restart uncordons with a JSON patch add; Turn Off drains all but DaemonSets and reports refusals', async () => {
    const admin = await open(ADMIN)
    assert.equal((await admin.run(message(ETasklistCommand.SHUT_DOWN, { targetName: 'node-1', shutDown: EShutDownAction.STAND_BY }))).detail, 'cordoned')
    assert.equal((await admin.run(message(ETasklistCommand.SHUT_DOWN, { targetName: 'node-1', shutDown: EShutDownAction.RESTART }))).detail, 'uncordoned')
    const patches = admin.calls.filter(c => c.method === 'patchNode').map(c => c.params)
    assert.deepEqual(patches, [
        { name: 'node-1', body: [{ op: 'add', path: '/spec/unschedulable', value: true }] },
        { name: 'node-1', body: [{ op: 'add', path: '/spec/unschedulable', value: false }] }
    ])
    const r = await admin.run(message(ETasklistCommand.SHUT_DOWN, { targetName: 'node-1', shutDown: EShutDownAction.TURN_OFF }))
    assert.equal(r.ok, true)
    // four pods on the node: the DaemonSet's is skipped, two are evicted, and a disruption budget refuses the third
    assert.deepEqual(admin.calls.filter(c => c.method === 'evict').map(c => (c.params as { name: string }).name), ['api-7d9f8b6c4-x2kq9', 'vault-0'])
    assert.equal(r.detail, 'cordoned, 2 pod(s) evicted, 1 refused (kube-system/coredns-1: Cannot evict pod as it would violate the pod\'s disruption budget.)')
    assert.deepEqual(admin.calls.find(c => c.method === 'listPods' && c.params)?.params, { fieldSelector: 'spec.nodeName=node-1' })
    assert.equal((await admin.run(message(ETasklistCommand.SHUT_DOWN, { targetName: 'node-1', shutDown: 'nonsense' as EShutDownAction }))).ok, false)
})

test('errors: a 404 is NOT_FOUND, a 403 ACCESS_DENIED, anything else FAILED with the API\'s message', async () => {
    const missing = await open(ADMIN, { fail: { code: 404, body: JSON.stringify({ message: 'pods "x" not found' }) } })
    const r = await missing.run(message(ETasklistCommand.END_PROCESS))
    assert.equal(r.error, ETasklistError.NOT_FOUND)
    assert.equal(r.detail, 'pods "x" not found')
    assert.equal((await (await open(ADMIN, { fail: { code: 403 } })).run(message(ETasklistCommand.END_PROCESS))).error, ETasklistError.ACCESS_DENIED)
    const broken = await open(ADMIN, { fail: { body: 'plain text' } })
    assert.equal((await broken.run(message(ETasklistCommand.SNAPSHOT))).detail, 'plain text')
    assert.equal((await broken.run(message('nonsense' as ETasklistCommand))).error, ETasklistError.FAILED)
})

test('an unknown instance gets an error signal; another message type is ignored; instances are counted', async () => {
    const { channel, ws, run } = await open(READ_PAYROLL)
    await channel.processCommand(ws as unknown as WebSocket, message(ETasklistCommand.SNAPSHOT, { instance: 'nope' }))
    assert.equal((ws.sent.at(-1) as { level: string }).level, 'error')
    assert.equal(await channel.processCommand(ws as unknown as WebSocket, { ...message(ETasklistCommand.SNAPSHOT), msgtype: 'other' } as never), false)
    assert.ok(channel.containsInstance('i1'))
    assert.deepEqual(channel.getInstances(), { instances: 1, connections: 1 })
    channel.stopInstance(ws as unknown as WebSocket, instanceConfig(key(READ_PAYROLL)))
    assert.deepEqual(channel.getInstances(), { instances: 0, connections: 0 })
    assert.ok((await run(message(ETasklistCommand.SNAPSHOT))) !== undefined)
})

test('without the metrics provider the window still works', async () => {
    const { run, subscribed } = await open(ADMIN, { metrics: false })
    assert.equal(subscribed.length, 0)
    const r = await run(message(ETasklistCommand.SNAPSHOT))
    assert.equal(r.ok, true)
    assert.equal((r.snapshot as ITasklistSnapshot).metrics, undefined)
})
