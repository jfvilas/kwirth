import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { V1Pod, CoreV1Event, V1Node } from '@kubernetes/client-node'
import { jobIdOf, mapPod } from '../src/back/PodMapper'
import { ageOf, describePod } from '../src/back/Describe'
import { usageOf } from '../src/back/PodMetrics'
import { IMetricsCluster, IMetricsValue } from '../src/back/MetricsProviderTypes'
import { SdsfChannel, ISdsfClusterInfo, DEFAULT_TAIL_LINES, MAX_TAIL_LINES } from '../src/back/index'
import { ESdsfCommand, ESdsfError, ESdsfMetricsState, ESdsfNodeAction, ESdsfNodeStatus, ESdsfObjectKind, ESdsfQos, ISdsfMessage, ISdsfNode } from '../src/common/SdsfTypes'
import { isEvictable, mapNode, nodeIdsOf, nodeStatusOf, quantityOf, rolesOf } from '../src/back/NodeMapper'
import { describeNode } from '../src/back/Describe'
import { AccessKey, accessKeySerialize, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, IInstanceConfig } from '@kwirthmagnify/kwirth-common'

// ─── PodMapper ────────────────────────────────────────────────────────────────

const pod = (over: Partial<V1Pod> = {}): V1Pod => ({
    metadata: {
        name: 'api-7d9f8b6c4-x2kq9', namespace: 'shop', uid: '0b8f1c2e-1111-2222-3333-00000000abcd',
        creationTimestamp: new Date('2026-11-01T10:00:00Z'),
        ownerReferences: [{ apiVersion: 'apps/v1', kind: 'ReplicaSet', name: 'api-7d9f8b6c4', uid: 'x', controller: true }]
    },
    spec: {
        serviceAccountName: 'api-sa', nodeName: 'node-1', priorityClassName: 'high', priority: 1000,
        initContainers: [{ name: 'migrate', image: 'migrate:1' }],
        containers: [{ name: 'api', image: 'api:2' }, { name: 'sidecar', image: 'proxy:1' }]
    },
    status: {
        phase: 'Running', qosClass: 'Burstable',
        initContainerStatuses: [{ name: 'migrate', image: 'migrate:1', imageID: '', ready: true, restartCount: 0, state: { terminated: { exitCode: 0, reason: 'Completed' } } }],
        containerStatuses: [
            { name: 'api', image: 'api:2', imageID: '', ready: true, restartCount: 3, state: { running: { startedAt: new Date() } } },
            { name: 'sidecar', image: 'proxy:1', imageID: '', ready: true, restartCount: 1, state: { running: {} } }
        ]
    },
    ...over
})

test('jobId: three letters by controller and five stable digits from the uid', () => {
    const uid = '0b8f1c2e-1111-2222-3333-00000000abcd'
    assert.equal(jobIdOf(uid, 'ReplicaSet'), 'STC' + String(0xabcd % 100000).padStart(5, '0'))
    assert.equal(jobIdOf(uid, 'Job'), 'JOB43981')
    assert.equal(jobIdOf(uid, ''), 'TSU43981')
    assert.equal(jobIdOf(uid, 'StatefulSet'), jobIdOf(uid, 'StatefulSet'), 'stable')
    assert.equal(jobIdOf('', 'Job'), 'JOB00000')
    assert.equal(jobIdOf('zzzz', ''), 'TSU00000', 'a non-hex uid does not produce NaN')
    assert.equal(jobIdOf(uid, 'X').length, 8)
})

test('mapPod takes every DA column out of the V1Pod', () => {
    const p = mapPod(pod())
    assert.equal(p.name, 'api-7d9f8b6c4-x2kq9')
    assert.equal(p.namespace, 'shop')
    assert.equal(p.owner, 'api-sa')
    assert.equal(p.controllerKind, 'ReplicaSet')
    assert.equal(p.controllerName, 'api-7d9f8b6c4')
    assert.equal(p.jobId.slice(0, 3), 'STC')
    assert.equal(p.qos, ESdsfQos.BURSTABLE)
    assert.equal(p.phase, 'Running')
    assert.equal(p.ready, true)
    assert.equal(p.deleting, false)
    assert.equal(p.reason, '', 'a completed init container is no reason')
    assert.equal(p.priorityClass, 'high')
    assert.equal(p.priority, 1000)
    assert.equal(p.restarts, 4, 'regular containers only')
    assert.equal(p.node, 'node-1')
    assert.equal(p.created, '2026-11-01T10:00:00.000Z')
    assert.deepEqual(p.containers.map(c => [c.name, c.init, c.state]), [['migrate', true, 'terminated'], ['api', false, 'running'], ['sidecar', false, 'running']])
})

test('mapPod: the reason an operator looks at first', () => {
    const waiting = pod()
    waiting.status!.containerStatuses![0].state = { waiting: { reason: 'CrashLoopBackOff' } }
    waiting.status!.containerStatuses![0].ready = false
    const w = mapPod(waiting)
    assert.equal(w.reason, 'CrashLoopBackOff')
    assert.equal(w.ready, false)

    const evicted = pod({ status: { phase: 'Failed', reason: 'Evicted' } })
    assert.equal(mapPod(evicted).reason, 'Evicted')

    const oom = pod()
    oom.status!.containerStatuses![1].state = { terminated: { exitCode: 137, reason: 'OOMKilled' } }
    assert.equal(mapPod(oom).reason, 'OOMKilled')
})

test('mapPod survives a bare, empty pod', () => {
    const p = mapPod({})
    assert.equal(p.name, '')
    assert.equal(p.jobId, 'TSU00000')
    assert.equal(p.qos, ESdsfQos.UNKNOWN)
    assert.equal(p.ready, false)
    assert.equal(p.created, '')
    assert.deepEqual(p.containers, [])
    const deleting = mapPod({ metadata: { deletionTimestamp: new Date() }, status: { qosClass: 'BestEffort' } })
    assert.equal(deleting.deleting, true)
    assert.equal(deleting.qos, ESdsfQos.BESTEFFORT)
    assert.equal(mapPod({ status: { qosClass: 'Guaranteed' } }).qos, ESdsfQos.GUARANTEED)
})

// ─── Describe ─────────────────────────────────────────────────────────────────

test('ageOf, in the units kubectl uses', () => {
    const now = Date.parse('2026-11-22T12:00:00Z')
    assert.equal(ageOf(undefined, now), '<unknown>')
    assert.equal(ageOf(new Date(now - 30_000), now), '30s')
    assert.equal(ageOf(new Date(now - 10 * 60_000), now), '10m')
    assert.equal(ageOf(new Date(now - 5 * 3600_000), now), '5h')
    assert.equal(ageOf(new Date(now - 3 * 86400_000), now), '3d')
    assert.equal(ageOf(new Date(now + 60_000), now), '0s', 'a clock skew never goes negative')
})

test('describePod reads like kubectl describe, events included and sorted', () => {
    const p = pod()
    p.metadata!.labels = { app: 'api', tier: 'web' }
    p.spec!.containers[0].resources = { limits: { cpu: '500m' }, requests: { memory: '128Mi' } }
    p.spec!.containers[0].ports = [{ containerPort: 8080 }]
    p.spec!.tolerations = [{ key: 'node.kubernetes.io/not-ready', operator: 'Exists', effect: 'NoExecute', tolerationSeconds: 300 }, { key: 'a', operator: 'Equal', value: 'b' }]
    p.status!.conditions = [{ type: 'Ready', status: 'True' }]
    const now = Date.parse('2026-11-22T12:00:00Z')
    const events: CoreV1Event[] = [
        { metadata: {}, involvedObject: {}, type: 'Warning', reason: 'BackOff', message: 'Back-off  restarting', lastTimestamp: new Date(now - 60_000), source: { component: 'kubelet' } },
        { metadata: {}, involvedObject: {}, type: 'Normal', reason: 'Scheduled', message: 'assigned', lastTimestamp: new Date(now - 600_000), reportingComponent: 'default-scheduler' }
    ]
    const text = describePod(p, events, now).join('\n')
    assert.match(text, /^Name: +api-7d9f8b6c4-x2kq9$/m)
    assert.match(text, /^Labels: +app=api$/m)
    assert.match(text, /^ +tier=web$/m)
    assert.match(text, /^Annotations: +<none>$/m)
    assert.match(text, /^Controlled By: +ReplicaSet\/api-7d9f8b6c4$/m)
    assert.match(text, /^Init Containers:\n  migrate:/m)
    assert.match(text, /^ {4}Ports: +8080\/TCP$/m)
    assert.match(text, /^ {4}Limits: +cpu=500m$/m)
    assert.match(text, /^ {4}Restart Count: +3$/m)
    assert.match(text, /^ {6}Reason: +Completed$/m)
    assert.match(text, /^ {2}Ready +True$/m)
    assert.match(text, /^QoS Class: +Burstable$/m)
    assert.match(text, /^Tolerations: +node.kubernetes.io\/not-ready:NoExecute for 300s$/m)
    assert.match(text, /^ +a=b$/m)
    const scheduled = text.indexOf('Scheduled')
    const backoff = text.indexOf('BackOff')
    assert.ok(scheduled > 0 && scheduled < backoff, 'oldest event first')
    assert.match(text, /Warning +BackOff +60s +kubelet +Back-off restarting/)
    assert.match(text, /default-scheduler/)
})

test('describePod of a terminating pod with no events', () => {
    const p = pod()
    p.metadata!.deletionTimestamp = new Date()
    p.spec!.initContainers = []
    p.status!.containerStatuses![0].state = { waiting: { reason: 'ContainerCreating' } }
    const text = describePod(p, []).join('\n')
    assert.match(text, /^Status: +Terminating$/m)
    assert.match(text, /^Events: +<none>$/m)
    assert.doesNotMatch(text, /Init Containers/)
    assert.match(text, /Waiting/)
})

// ─── Metrics ──────────────────────────────────────────────────────────────────

const reading = (values: Record<string, number>, node = 'node-1'): IMetricsCluster => ({
    metricsInterval: 10,
    cluster: { vcpus: 4, memory: 1e9 },
    nodes: [{ name: node, timestamp: 0, podMetricValues: new Map(), containerMetricValues: new Map<string, IMetricsValue>(Object.entries(values).map(([k, v]) => [k, { value: v, timestamp: 0 }])) }],
    clusterMetricValues: new Map()
})

test('usageOf: no readings, nothing; one reading, memory only', () => {
    assert.equal(usageOf([]).pods.size, 0)
    const one = usageOf([reading({ 'shop/api/api/container_memory_working_set_bytes': 100, 'shop/api/side/container_memory_working_set_bytes': 50 })])
    assert.deepEqual(one.pods.get('shop/api'), { memory: 150 })
    assert.equal(one.clusterCpu, undefined)
})

test('usageOf: CPU is the delta over every CPU second of the cluster, summed per pod', () => {
    const before = reading({ 'shop/api/api/container_cpu_usage_seconds_total': 100, 'shop/api/side/container_cpu_usage_seconds_total': 10, 'kube/dns/dns/container_cpu_usage_seconds_total': 5 })
    const after = reading({
        'shop/api/api/container_cpu_usage_seconds_total': 104, 'shop/api/side/container_cpu_usage_seconds_total': 12,
        'kube/dns/dns/container_cpu_usage_seconds_total': 4,       // restarted: counter went back
        'new/pod/c/container_cpu_usage_seconds_total': 3,          // not in the previous reading
        'shop/api/api/container_memory_working_set_bytes': 7,
        'bad/key': 1                                               // malformed: ignored
    })
    const u = usageOf([before, after])
    // (4 + 2) / (10 s * 4 vcpus) = 15 %
    assert.deepEqual(u.pods.get('shop/api'), { memory: 7, cpu: 15 })
    assert.equal(u.pods.get('kube/dns'), undefined)
    assert.equal(u.pods.get('new/pod'), undefined)
    assert.equal(u.clusterCpu, 15)
})

test('usageOf: a reading without CPU seconds gives no CPU instead of dividing by zero', () => {
    const r = reading({ 'a/b/c/container_cpu_usage_seconds_total': 1 })
    r.cluster.vcpus = 0
    assert.equal(usageOf([r, r]).clusterCpu, undefined)
})

// ─── Channel ──────────────────────────────────────────────────────────────────

interface ICall { method: string; params: unknown }

// The nodes of the fake cluster: node-1 Ready (where pod() runs), node-2 not Ready and cordoned.
const nodeObject = (name: string, over: Partial<V1Node> = {}): V1Node => ({
    metadata: { name, creationTimestamp: new Date('2026-11-01T00:00:00Z'), labels: { 'node-role.kubernetes.io/control-plane': 'true', 'kubernetes.io/os': 'linux' } },
    spec: {},
    status: {
        conditions: [{ type: 'Ready', status: 'True' }],
        allocatable: { cpu: '4', memory: '8Gi' },
        capacity: { cpu: '4', memory: '8Gi', pods: '110' },
        nodeInfo: { kubeletVersion: 'v1.31.5+k3s1', osImage: 'K3s', kernelVersion: '6', containerRuntimeVersion: 'containerd', architecture: 'amd64', bootID: '', machineID: '', kubeProxyVersion: '', operatingSystem: 'linux', systemUUID: '' },
        addresses: [{ type: 'InternalIP', address: '172.18.0.2' }]
    },
    ...over
} as V1Node)

const daemonPod = (): V1Pod => pod({ metadata: { name: 'proxy-x', namespace: 'kube-system', uid: 'd1', ownerReferences: [{ apiVersion: 'apps/v1', kind: 'DaemonSet', name: 'proxy', uid: 'y', controller: true }] } })

const fakeCluster = (opts: { metrics?: boolean; fail?: { code?: number; body?: string; message?: string }; refuseEvict?: string[] } = {}) => {
    const calls: ICall[] = []
    const subscribed: unknown[] = []
    const call = async <T>(method: string, params: unknown, result: T): Promise<T> => {
        calls.push({ method, params })
        if (opts.fail) throw Object.assign(new Error(opts.fail.message ?? 'boom'), opts.fail)
        return result
    }
    const clusterInfo = {
        coreApi: {
            listPodForAllNamespaces: (p?: { fieldSelector?: string }) => {
                const all = [pod(), pod({ metadata: { name: 'secret-pod', namespace: 'vault', uid: '1' } }), daemonPod()]
                const node = /^spec\.nodeName=(.*)$/.exec(p?.fieldSelector ?? '')?.[1]
                return call('list', p, { items: node ? all.filter(x => x.spec?.nodeName === node) : all })
            },
            listNode: () => call('listNode', undefined, { items: [
                nodeObject('node-1'),
                nodeObject('node-2', { spec: { unschedulable: true }, status: { conditions: [{ type: 'Ready', status: 'False' }], allocatable: { cpu: '2000m', memory: '4096Mi' } } })
            ] }),
            readNode: (p: unknown) => call('readNode', p, nodeObject('node-1', { spec: { unschedulable: true, taints: [{ key: 'node.kubernetes.io/unschedulable', effect: 'NoSchedule' }] } })),
            patchNode: (p: unknown) => call('patchNode', p, {}),
            createNamespacedPodEviction: (p: { name: string }) => {
                if (opts.refuseEvict?.includes(p.name)) {
                    calls.push({ method: 'evict', params: p })
                    return Promise.reject(Object.assign(new Error('Too Many Requests'), { code: 429, body: JSON.stringify({ message: 'Cannot evict pod as it would violate the pod\'s disruption budget.' }) }))
                }
                return call('evict', p, {})
            },
            listEventForAllNamespaces: (p: unknown) => call('allEvents', p, { items: [
                { metadata: { namespace: 'default' }, involvedObject: { kind: 'Node', name: 'node-1' }, type: 'Normal', reason: 'NodeNotSchedulable', message: 'Node node-1 status is now: NodeNotSchedulable', lastTimestamp: new Date('2026-11-22T11:00:00Z') }
            ] }),
            readNamespacedPod: (p: unknown) => call('read', p, pod()),
            readNamespacedPodLog: (p: unknown) => call('log', p, 'line 1\nline 2\n'),
            deleteNamespacedPod: (p: unknown) => call('delete', p, pod()),
            listNamespacedEvent: (p: unknown) => call('events', p, { items: [] })
        },
        batchApi: {
            listJobForAllNamespaces: () => call('listJobs', undefined, { items: [
                { metadata: { name: 'nightly', namespace: 'shop', uid: 'j1' }, spec: { template: {} }, status: { succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] } },
                { metadata: { name: 'secret-job', namespace: 'vault', uid: 'j2' }, spec: { template: {} }, status: {} }
            ] }),
            listCronJobForAllNamespaces: () => call('listCronJobs', undefined, { items: [
                { metadata: { name: 'report', namespace: 'shop', uid: 'c1' }, spec: { schedule: '0 * * * *', suspend: true, jobTemplate: { spec: { template: {} } } }, status: {} }
            ] }),
            readNamespacedJob: (p: unknown) => call('readJob', p, { metadata: { name: 'nightly', namespace: 'shop' }, spec: { template: {} }, status: {} }),
            readNamespacedCronJob: (p: unknown) => call('readCronJob', p, { metadata: { name: 'report', namespace: 'shop' }, spec: { schedule: '0 * * * *', jobTemplate: { spec: { template: {} } } }, status: {} }),
            deleteNamespacedJob: (p: unknown) => call('deleteJob', p, {}),
            deleteNamespacedCronJob: (p: unknown) => call('deleteCronJob', p, {})
        },
        getProvider: (id: string) => opts.metrics && id === 'metrics'
            ? { id, subscribe: (s: unknown) => { subscribed.push(s); return Promise.resolve() }, unsubscribe: (s: unknown) => { subscribed.splice(subscribed.indexOf(s), 1) } }
            : undefined
    } as unknown as ISdsfClusterInfo
    return { clusterInfo, calls, subscribed }
}

class FakeSocket {
    sent: unknown[] = []
    send = (data: string) => { this.sent.push(JSON.parse(data)) }
}

const key = (resources: string): AccessKey => ({ id: 'k', type: 'bearer', resources } as AccessKey)

const instanceConfig = (k: AccessKey, instance = 'i1'): IInstanceConfig => ({
    channel: 'sdsf', objects: '', action: EInstanceMessageAction.START, flow: EInstanceMessageFlow.REQUEST, type: EInstanceMessageType.SIGNAL,
    instance, accessKey: accessKeySerialize(k), scope: 'sdsf$read', view: 'cluster', namespace: '', group: '', pod: '', container: ''
} as unknown as IInstanceConfig)

const message = (command: ESdsfCommand, extra: Partial<ISdsfMessage> = {}): ISdsfMessage => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.REQUEST, type: EInstanceMessageType.DATA, channel: 'sdsf', instance: 'i1',
    msgtype: 'sdsfmessage', id: 'r1', accessKey: 'whatever the browser says', command,
    targetNamespace: 'shop', targetName: 'api-7d9f8b6c4-x2kq9', containerName: 'api', ...extra
})

const open = async (resources: string, opts: { metrics?: boolean; fail?: { code?: number; body?: string; message?: string }; refuseEvict?: string[] } = {}) => {
    const fake = fakeCluster(opts)
    const channel = new SdsfChannel(fake.clusterInfo, {} as never)
    const ws = new FakeSocket() as unknown as WebSocket
    const ok = await channel.addObject(ws, instanceConfig(key(resources)), '*all', '*all', '*all')
    const run = async (m: ISdsfMessage) => {
        await channel.processCommand(ws, m)
        return (ws as unknown as FakeSocket).sent.at(-1) as Record<string, unknown>
    }
    return { channel, ws: ws as unknown as FakeSocket, ok, run, ...fake }
}

const ALL_READ = 'sdsf$read:shop,vault:::'
const ALL_CANCEL = 'sdsf$cancel:^shop$:::'

test('channel data: a cluster channel, no setup of the front metrics list; scope ladder and catalogue', () => {
    const c = new SdsfChannel(fakeCluster().clusterInfo, {} as never)
    const d = c.getChannelData()
    assert.equal(d.cluster, true)
    assert.equal(d.resourced, false)
    assert.equal(d.metrics, false)
    assert.deepEqual(c.requirements.providers, ['metrics'])
    assert.ok(c.getChannelScopeLevel('sdsf$read') < c.getChannelScopeLevel('sdsf$cancel'))
    assert.ok(c.getChannelScopeLevel('sdsf$cancel') < c.getChannelScopeLevel('admin'))
    assert.equal(c.getChannelScopeLevel('bogus'), -1)
    assert.deepEqual(c.getScopeCatalog().map(s => s.scope), ['sdsf$read', 'sdsf$cancel'])
})

test('a key without sdsf$read cannot open SDSF, and nothing is registered', async () => {
    const { ok, ws, channel } = await open('other$x::::')
    assert.equal(ok, false)
    assert.equal((ws.sent[0] as { level: string }).level, 'error')
    assert.deepEqual(channel.getInstances(), { instances: 0, connections: 0 })
})

test('LIST returns the pods the key reaches, and says the metrics provider is unavailable when it is', async () => {
    const { ok, run, channel } = await open('sdsf$read:^shop$:::')
    assert.equal(ok, true)
    assert.deepEqual(channel.getInstances(), { instances: 1, connections: 1 })
    const r = await run(message(ESdsfCommand.LIST))
    assert.equal(r.ok, true)
    assert.equal(r.msgtype, 'sdsfmessageresponse')
    assert.equal(r.id, 'r1')
    assert.deepEqual((r.pods as { name: string }[]).map(p => p.name), ['api-7d9f8b6c4-x2kq9'], 'vault is out of reach')
    assert.equal(r.metrics, ESdsfMetricsState.UNAVAILABLE)
})

test('metrics: subscribed while an instance is open, warming until two readings, then figures on the pods', async () => {
    const { run, channel, subscribed, ws } = await open(ALL_READ, { metrics: true })
    assert.equal(subscribed.length, 1)
    assert.equal((await run(message(ESdsfCommand.LIST))).metrics, ESdsfMetricsState.WARMING)
    channel.processProviderEvent('metrics', reading({ 'shop/api-7d9f8b6c4-x2kq9/api/container_cpu_usage_seconds_total': 10 }))
    channel.processProviderEvent('events', {})
    channel.processProviderEvent('metrics', reading({ 'shop/api-7d9f8b6c4-x2kq9/api/container_cpu_usage_seconds_total': 14, 'shop/api-7d9f8b6c4-x2kq9/api/container_memory_working_set_bytes': 2048 }))
    const r = await run(message(ESdsfCommand.LIST))
    assert.equal(r.metrics, ESdsfMetricsState.AVAILABLE)
    const api = (r.pods as { name: string; cpu?: number; memory?: number }[]).find(p => p.name === 'api-7d9f8b6c4-x2kq9')!
    assert.equal(api.cpu, 10)
    assert.equal(api.memory, 2048)
    assert.equal(r.clusterCpu, 10)
    channel.stopInstance(ws as unknown as WebSocket, instanceConfig(key(ALL_READ)))
    assert.equal(subscribed.length, 0, 'the last instance gone, the subscription goes too')
})

test('cleanup and removeConnection drop the subscription', async () => {
    const a = await open(ALL_READ, { metrics: true })
    a.channel.cleanup()
    assert.equal(a.subscribed.length, 0)
    const b = await open(ALL_READ, { metrics: true })
    b.channel.removeConnection(b.ws as unknown as WebSocket)
    assert.equal(b.subscribed.length, 0)
    assert.equal(b.channel.containsConnection(b.ws as unknown as WebSocket), false)
})

test('LOG reads the tail once, bounded, without the trailing empty line', async () => {
    const { run, calls } = await open(ALL_READ)
    const r = await run(message(ESdsfCommand.LOG))
    assert.deepEqual(r.lines, ['line 1', 'line 2'])
    assert.deepEqual(calls.at(-1), { method: 'log', params: { name: 'api-7d9f8b6c4-x2kq9', namespace: 'shop', container: 'api', tailLines: DEFAULT_TAIL_LINES } })
    await run(message(ESdsfCommand.LOG, { tailLines: 10 ** 9 }))
    assert.equal((calls.at(-1)!.params as { tailLines: number }).tailLines, MAX_TAIL_LINES)
    await run(message(ESdsfCommand.LOG, { tailLines: -5 }))
    assert.equal((calls.at(-1)!.params as { tailLines: number }).tailLines, 1)
    const noContainer = await run(message(ESdsfCommand.LOG, { containerName: undefined }))
    assert.equal(noContainer.error, ESdsfError.BAD_REQUEST)
})

test('DESCRIBE returns text lines with the pod events', async () => {
    const { run, calls } = await open(ALL_READ)
    const r = await run(message(ESdsfCommand.DESCRIBE))
    assert.equal(r.ok, true)
    assert.match((r.lines as string[])[0], /^Name: +api-7d9f8b6c4-x2kq9$/)
    assert.deepEqual(calls.at(-1), { method: 'events', params: { namespace: 'shop', fieldSelector: 'involvedObject.name=api-7d9f8b6c4-x2kq9' } })
})

test('a pod outside the key is NOT_AUTHORIZED for every per-pod command, and nothing reaches the API', async () => {
    const { run, calls } = await open('sdsf$cancel:^shop$:::')
    for (const command of [ESdsfCommand.LOG, ESdsfCommand.DESCRIBE, ESdsfCommand.CANCEL]) {
        const r = await run(message(command, { targetNamespace: 'vault', targetName: 'secret-pod' }))
        assert.equal(r.ok, false)
        assert.equal(r.error, ESdsfError.NOT_AUTHORIZED)
    }
    assert.equal(calls.length, 0)
    const missing = await run(message(ESdsfCommand.DESCRIBE, { targetName: undefined }))
    assert.equal(missing.error, ESdsfError.BAD_REQUEST)
})

test('CANCEL needs sdsf$cancel; with it, it deletes (CA with grace period 0)', async () => {
    const reader = await open(ALL_READ)
    const denied = await reader.run(message(ESdsfCommand.CANCEL))
    assert.equal(denied.error, ESdsfError.NOT_AUTHORIZED)
    assert.equal(reader.calls.length, 0)

    const canceller = await open(ALL_CANCEL)
    const r = await canceller.run(message(ESdsfCommand.CANCEL))
    assert.equal(r.ok, true)
    assert.deepEqual(canceller.calls.at(-1), { method: 'delete', params: { name: 'api-7d9f8b6c4-x2kq9', namespace: 'shop' } })
    await canceller.run(message(ESdsfCommand.CANCEL, { force: true }))
    assert.deepEqual(canceller.calls.at(-1), { method: 'delete', params: { name: 'api-7d9f8b6c4-x2kq9', namespace: 'shop', gracePeriodSeconds: 0 } })
})

test('API failures come back as a code plus the API message: 404 is NOT_FOUND', async () => {
    const notFound = await open(ALL_READ, { fail: { code: 404, body: JSON.stringify({ message: 'pods "x" not found' }) } })
    const r = await notFound.run(message(ESdsfCommand.DESCRIBE))
    assert.equal(r.error, ESdsfError.NOT_FOUND)
    assert.equal(r.detail, 'pods "x" not found')
    const other = await open(ALL_READ, { fail: { code: 500, message: 'kaput' } })
    const o = await other.run(message(ESdsfCommand.LIST))
    assert.equal(o.error, ESdsfError.FAILED)
    assert.equal(o.detail, 'kaput')
    const raw = await open(ALL_READ, { fail: { body: 'plain text body' } })
    assert.equal((await raw.run(message(ESdsfCommand.LIST))).detail, 'plain text body')
})

test('unknown instances, foreign messages and unknown commands are refused', async () => {
    const { channel, ws, run } = await open(ALL_READ)
    assert.equal(await channel.processCommand(ws as unknown as WebSocket, { ...message(ESdsfCommand.LIST), instance: 'nope' }), false)
    assert.equal(await channel.processCommand(ws as unknown as WebSocket, { ...message(ESdsfCommand.LIST), msgtype: 'other' } as unknown as ISdsfMessage), false)
    const r = await run(message('bogus' as ESdsfCommand))
    assert.equal(r.error, ESdsfError.BAD_REQUEST)
    assert.equal(channel.containsInstance('i1'), true)
    assert.equal(channel.refreshConnection(ws as unknown as WebSocket), true)
    const other = new FakeSocket() as unknown as WebSocket
    assert.equal(channel.updateConnection(other, 'i1'), true)
    assert.equal(channel.updateConnection(other, 'zzz'), false)
})

// ─── Events (S6) ──────────────────────────────────────────────────────────────

import { mapEvent, sortEvents, MAX_EVENTS } from '../src/back/EventMapper'

test('mapEvent takes the time from whichever field the API filled, and tidies the message', () => {
    const base = { metadata: { namespace: 'shop', creationTimestamp: new Date('2026-11-22T10:00:00Z') }, involvedObject: { kind: 'Pod', name: 'api-1', uid: 'u1', namespace: 'shop' } }
    assert.equal(mapEvent({ ...base, lastTimestamp: new Date('2026-11-22T11:00:00Z') } as CoreV1Event).time, '2026-11-22T11:00:00.000Z')
    assert.equal(mapEvent({ ...base, eventTime: new Date('2026-11-22T12:00:00Z') } as unknown as CoreV1Event).time, '2026-11-22T12:00:00.000Z')
    assert.equal(mapEvent({ ...base, firstTimestamp: new Date('2026-11-22T09:00:00Z') } as CoreV1Event).time, '2026-11-22T09:00:00.000Z')
    assert.equal(mapEvent(base as CoreV1Event).time, '2026-11-22T10:00:00.000Z')
    assert.equal(mapEvent({ involvedObject: {}, metadata: {} } as CoreV1Event).time, '')
    const e = mapEvent({ ...base, type: 'Warning', reason: 'BackOff', message: 'Back-off\n  restarting', count: 7, source: { component: 'kubelet' } } as CoreV1Event)
    assert.deepEqual(e, { time: '2026-11-22T10:00:00.000Z', type: 'Warning', reason: 'BackOff', message: 'Back-off restarting', namespace: 'shop', kind: 'Pod', name: 'api-1', uid: 'u1', count: 7, source: 'kubelet' })
    assert.equal(mapEvent({ ...base, series: { count: 4 }, reportingComponent: 'ctrl' } as unknown as CoreV1Event).count, 4)
    assert.equal(mapEvent({ ...base, reportingComponent: 'ctrl' } as unknown as CoreV1Event).source, 'ctrl')
})

test('sortEvents: oldest first, only the newest MAX_EVENTS', () => {
    const many = Array.from({ length: MAX_EVENTS + 5 }, (_, i) => ({ ...mapEvent({ involvedObject: {}, metadata: {} } as CoreV1Event), time: new Date(Date.UTC(2026, 0, 1, 0, 0, MAX_EVENTS + 5 - i)).toISOString(), name: String(i) }))
    const sorted = sortEvents(many)
    assert.equal(sorted.length, MAX_EVENTS)
    assert.equal(sorted[sorted.length - 1].name, '0', 'the newest last')
    assert.ok(sorted[0].time < sorted[1].time)
})

test('EVENTS returns only what the key reaches: the pods it covers, the namespaces it covers', async () => {
    const fake = fakeCluster()
    const items = [
        { metadata: {}, involvedObject: { kind: 'Pod', name: 'api-1', namespace: 'shop' }, reason: 'A', lastTimestamp: new Date('2026-11-22T11:00:02Z') },
        { metadata: {}, involvedObject: { kind: 'Pod', name: 'other', namespace: 'shop' }, reason: 'B', lastTimestamp: new Date('2026-11-22T11:00:01Z') },
        { metadata: {}, involvedObject: { kind: 'Deployment', name: 'api', namespace: 'shop' }, reason: 'C', lastTimestamp: new Date('2026-11-22T11:00:00Z') },
        { metadata: {}, involvedObject: { kind: 'Pod', name: 'x', namespace: 'vault' }, reason: 'D', lastTimestamp: new Date('2026-11-22T11:00:03Z') },
        { metadata: {}, involvedObject: { kind: 'Node', name: 'n1' }, reason: 'E', lastTimestamp: new Date('2026-11-22T11:00:04Z') }
    ]
    ;(fake.clusterInfo.coreApi as unknown as { listEventForAllNamespaces: () => Promise<unknown> }).listEventForAllNamespaces = async () => ({ items })
    const channel = new SdsfChannel(fake.clusterInfo, {} as never)
    const ws = new FakeSocket() as unknown as WebSocket
    await channel.addObject(ws, instanceConfig(key('sdsf$read:^shop$:::')), '*all', '*all', '*all')
    await channel.processCommand(ws, message(ESdsfCommand.EVENTS, { targetNamespace: undefined, targetName: undefined, containerName: undefined }))
    const r = (ws as unknown as FakeSocket).sent.at(-1) as { ok: boolean; events: { reason: string }[] }
    assert.equal(r.ok, true)
    assert.deepEqual(r.events.map(e => e.reason), ['C', 'B', 'A'], 'shop only, oldest first; the node has no namespace')
    const narrow = new SdsfChannel(fake.clusterInfo, {} as never)
    const ws2 = new FakeSocket() as unknown as WebSocket
    await narrow.addObject(ws2, instanceConfig(key('sdsf$read:^shop$::^api-1$:')), '*all', '*all', '*all')
    await narrow.processCommand(ws2, message(ESdsfCommand.EVENTS))
    assert.deepEqual(((ws2 as unknown as FakeSocket).sent.at(-1) as { events: { reason: string }[] }).events.map(e => e.reason), ['A'], 'a key on one pod sees that pod only')
})

// ─── Jobs and CronJobs (S7) ───────────────────────────────────────────────────

import type { V1Job, V1CronJob } from '@kubernetes/client-node'
import { jobStateOf, mapCronJob, mapJob } from '../src/back/JobMapper'
import { describeCronJob, describeJob } from '../src/back/Describe'
import { ESdsfJobState, ESdsfObjectKind } from '../src/common/SdsfTypes'

test('jobStateOf reads the conditions: Failed, Complete (or SuccessCriteriaMet), running until then', () => {
    const job = (conditions: { type: string; status: string }[]): V1Job => ({ status: { conditions } } as V1Job)
    assert.equal(jobStateOf(job([])), ESdsfJobState.RUNNING)
    assert.equal(jobStateOf({} as V1Job), ESdsfJobState.RUNNING)
    assert.equal(jobStateOf(job([{ type: 'Complete', status: 'True' }])), ESdsfJobState.COMPLETE)
    assert.equal(jobStateOf(job([{ type: 'SuccessCriteriaMet', status: 'True' }])), ESdsfJobState.COMPLETE)
    assert.equal(jobStateOf(job([{ type: 'Complete', status: 'False' }])), ESdsfJobState.RUNNING)
    assert.equal(jobStateOf(job([{ type: 'Failed', status: 'True' }, { type: 'Complete', status: 'True' }])), ESdsfJobState.FAILED)
})

test('mapJob and mapCronJob take every ST column out of the object', () => {
    const j = mapJob({
        metadata: { name: 'backup-28920', namespace: 'ops', uid: 'aaaa-0001', ownerReferences: [{ kind: 'CronJob', name: 'backup', apiVersion: 'batch/v1', uid: 'x' }] },
        spec: { parallelism: 2, completions: 4, template: { spec: { serviceAccountName: 'runner', containers: [] } } },
        status: { active: 1, succeeded: 2, failed: 1, startTime: new Date('2026-11-22T10:00:00Z') }
    } as V1Job)
    assert.deepEqual(j, {
        kind: ESdsfObjectKind.JOB, name: 'backup-28920', namespace: 'ops', uid: 'aaaa-0001', jobId: jobIdOf('aaaa-0001', 'Job'), owner: 'runner',
        cronJob: 'backup', schedule: '', state: ESdsfJobState.RUNNING, parallelism: 2, completions: 4, active: 1, succeeded: 2, failed: 1,
        start: '2026-11-22T10:00:00.000Z', end: ''
    })
    assert.equal(j.jobId.slice(0, 3), 'JOB')
    const bare = mapJob({} as V1Job)
    assert.equal(bare.owner, 'default')
    assert.equal(bare.parallelism, 1)
    assert.equal(bare.completions, 0)
    const c = mapCronJob({
        metadata: { name: 'backup', namespace: 'ops', uid: 'cccc' },
        spec: { schedule: '0 2 * * *', jobTemplate: { spec: { parallelism: 3, template: { spec: { serviceAccountName: 'runner', containers: [] } } } } },
        status: { active: [{ name: 'backup-1' }], lastScheduleTime: new Date('2026-11-22T02:00:00Z'), lastSuccessfulTime: new Date('2026-11-22T02:05:00Z') }
    } as V1CronJob)
    assert.equal(c.kind, ESdsfObjectKind.CRONJOB)
    assert.equal(c.state, ESdsfJobState.SCHEDULED)
    assert.equal(c.schedule, '0 2 * * *')
    assert.equal(c.active, 1)
    assert.equal(c.parallelism, 3)
    assert.equal(c.start, '2026-11-22T02:00:00.000Z')
    assert.equal(mapCronJob({ spec: { suspend: true } } as V1CronJob).state, ESdsfJobState.SUSPENDED)
    assert.equal(mapCronJob({} as V1CronJob).owner, 'default')
})

test('describeJob and describeCronJob read like kubectl describe', () => {
    const job = describeJob({
        metadata: { name: 'nightly', namespace: 'shop', ownerReferences: [{ kind: 'CronJob', name: 'n', apiVersion: 'v', uid: 'u', controller: true }] },
        spec: { backoffLimit: 6, completions: 1, template: { spec: { serviceAccountName: 'runner', restartPolicy: 'Never', containers: [{ name: 'work', image: 'busybox', command: ['sh', '-c'], args: ['echo hi'] }] } } },
        status: { succeeded: 1, conditions: [{ type: 'Complete', status: 'True', reason: 'CompletionsReached' }] }
    } as V1Job, []).join('\n')
    assert.match(job, /^Name: +nightly$/m)
    assert.match(job, /^Controlled By: +CronJob\/n$/m)
    assert.match(job, /^Pods Statuses: +0 Active \/ 1 Succeeded \/ 0 Failed$/m)
    assert.match(job, /^ {2}Complete +True +CompletionsReached$/m)
    assert.match(job, /^ {4}Command: +sh -c$/m)
    assert.match(job, /^ {2}Restart Policy: +Never$/m)
    assert.match(job, /^Events: +<none>$/m)
    const cron = describeCronJob({
        metadata: { name: 'report', namespace: 'shop' },
        spec: { schedule: '*/5 * * * *', suspend: true, concurrencyPolicy: 'Forbid', jobTemplate: { spec: { template: { spec: { containers: [] } } } } },
        status: { active: [{ name: 'report-1' }, { name: 'report-2' }] }
    } as V1CronJob, []).join('\n')
    assert.match(cron, /^Schedule: +\*\/5 \* \* \* \*$/m)
    assert.match(cron, /^Suspend: +True$/m)
    assert.match(cron, /^Active Jobs: +report-1, report-2$/m)
    assert.match(describeCronJob({} as V1CronJob, []).join('\n'), /^Suspend: +False$/m)
})

test('JOBS returns the Jobs and CronJobs of the namespaces the key reaches', async () => {
    const { run } = await open('sdsf$read:^shop$:::')
    const r = await run(message(ESdsfCommand.JOBS, { targetNamespace: undefined, targetName: undefined, containerName: undefined }))
    assert.equal(r.ok, true)
    const jobs = r.jobs as { name: string; kind: string; state: string }[]
    assert.deepEqual(jobs.map(j => [j.kind, j.name, j.state]), [['Job', 'nightly', 'complete'], ['CronJob', 'report', 'suspended']], 'vault is out of reach')
})

test('DESCRIBE and CANCEL on a Job and a CronJob go to the batch API; CANCEL takes the pods with it', async () => {
    const { run, calls } = await open('sdsf$cancel:^shop$:::')
    const job = { objectKind: ESdsfObjectKind.JOB, targetName: 'nightly', containerName: undefined }
    const cron = { objectKind: ESdsfObjectKind.CRONJOB, targetName: 'report', containerName: undefined }
    assert.match(((await run(message(ESdsfCommand.DESCRIBE, job))).lines as string[])[0], /^Name: +nightly$/)
    assert.equal(calls.filter(c => c.method === 'readJob').length, 1)
    assert.match(((await run(message(ESdsfCommand.DESCRIBE, cron))).lines as string[])[0], /^Name: +report$/)
    await run(message(ESdsfCommand.CANCEL, job))
    assert.deepEqual(calls.at(-1), { method: 'deleteJob', params: { name: 'nightly', namespace: 'shop', propagationPolicy: 'Background' } })
    await run(message(ESdsfCommand.CANCEL, { ...cron, force: true }))
    assert.deepEqual(calls.at(-1), { method: 'deleteCronJob', params: { name: 'report', namespace: 'shop', gracePeriodSeconds: 0, propagationPolicy: 'Background' } })
    assert.equal((await run(message(ESdsfCommand.LOG, { ...job, containerName: 'work' }))).error, ESdsfError.BAD_REQUEST, 'only a pod has a log')
})

test('a key limited to pods does not reach a Job; a key on another namespace neither', async () => {
    const podKey = await open('sdsf$cancel:^shop$::^api-1$:')
    const r = await podKey.run(message(ESdsfCommand.CANCEL, { objectKind: ESdsfObjectKind.JOB, targetName: 'nightly', containerName: undefined }))
    assert.equal(r.error, ESdsfError.NOT_AUTHORIZED)
    const other = await open('sdsf$cancel:^vault$:::')
    const o = await other.run(message(ESdsfCommand.DESCRIBE, { objectKind: ESdsfObjectKind.CRONJOB, targetName: 'report', containerName: undefined }))
    assert.equal(o.error, ESdsfError.NOT_AUTHORIZED)
    assert.equal(podKey.calls.length + other.calls.length, 0)
})

// ─── Nodes (INIT) ─────────────────────────────────────────────────────────────

test('quantities: cores, millicores, binary and decimal suffixes, exponents; nonsense is 0', () => {
    assert.equal(quantityOf('4'), 4)
    assert.equal(quantityOf('3800m'), 3.8)
    assert.equal(quantityOf('8Gi'), 8 * 1024 ** 3)
    assert.equal(quantityOf('4096Mi'), 4096 * 1024 ** 2)
    assert.equal(quantityOf('16323820Ki'), 16323820 * 1024)
    assert.equal(quantityOf('2G'), 2e9)
    assert.equal(quantityOf('1e9'), 1e9)
    assert.equal(quantityOf('1.5'), 1.5)
    assert.equal(quantityOf(undefined), 0)
    assert.equal(quantityOf('lots'), 0)
    assert.equal(quantityOf('5Xi'), 0)
})

test('node mapping: roles, the four statuses from Ready, cordon and what is left to evict; usage over its own CPUs', () => {
    const n = nodeObject('node-1')
    assert.deepEqual(rolesOf(n), ['control-plane'])
    assert.deepEqual(rolesOf(nodeObject('w', { metadata: { name: 'w' } })), [])
    assert.equal(isEvictable(daemonPod()), false)
    assert.equal(isEvictable(pod({ metadata: { name: 'static', annotations: { 'kubernetes.io/config.mirror': 'x' } } })), false)
    assert.equal(isEvictable(pod()), true)
    assert.equal(nodeStatusOf(n, [pod()]), ESdsfNodeStatus.ACTIVE)
    const cordoned = nodeObject('c', { spec: { unschedulable: true } })
    assert.equal(nodeStatusOf(cordoned, [pod(), daemonPod()]), ESdsfNodeStatus.HALTED)
    assert.equal(nodeStatusOf(cordoned, [daemonPod(), pod({ status: { phase: 'Succeeded' } })]), ESdsfNodeStatus.DRAINED, 'a DaemonSet pod and an ended one do not keep it HALTED')
    assert.equal(nodeStatusOf(nodeObject('x', { status: { conditions: [{ type: 'Ready', status: 'Unknown' }] } }), []), ESdsfNodeStatus.INACTIVE)
    assert.equal(nodeStatusOf(nodeObject('y', { status: {} }), []), ESdsfNodeStatus.INACTIVE)
    const mapped = mapNode(n, '1', [pod()], 1, { cpuSeconds: 8, memory: 512 }, 10)
    assert.deepEqual(mapped, {
        name: 'node-1', id: '1', status: ESdsfNodeStatus.ACTIVE, roles: ['control-plane'], pods: 1, cpus: 4, memory: 8 * 1024 ** 3,
        cpu: 20, memoryUsed: 512, version: 'v1.31.5+k3s1', internalIp: '172.18.0.2', created: '2026-11-01T00:00:00.000Z'
    })
    const bare = mapNode({} as V1Node, '', [], 0, undefined, undefined)
    assert.equal(bare.cpu, undefined)
    assert.equal(bare.name, '')
    assert.equal(bare.created, '')
})

test('initiator IDs: what is left of the names once what they share goes, unique, or the last 8', () => {
    assert.deepEqual(nodeIdsOf(['k3d-kwirth-agent-0', 'k3d-kwirth-server-0']), ['agent', 'server'])
    assert.deepEqual(nodeIdsOf(['ip-10-0-1-23.ec2.internal', 'ip-10-0-2-45.ec2.internal']), ['1-23', '2-45'])
    assert.deepEqual(nodeIdsOf(['aks-pool1-123-vmss000000', 'aks-pool1-123-vmss000001']), ['0', '1'])
    assert.deepEqual(nodeIdsOf(['gke-c-pool-a-1111', 'gke-c-pool-a-2222', 'gke-c-pool-b-3333']), ['a-1111', 'a-2222', 'b-3333'])
    assert.deepEqual(nodeIdsOf(['worker-alpha-0001x', 'worker-alpha-0002x', 'worker-bravo-0001x']), ['pha-0001', 'pha-0002', 'avo-0001'], 'the start repeats: the end')
    assert.deepEqual(nodeIdsOf(['aks-nodepool1-1-vmss000000', 'aks-nodepool1-1-vmss000001', 'aks-system-1-vmss000000']), ['nodepool', 'nodepool', 'system-1'], 'no 8 characters tell them apart: the start')
    assert.deepEqual(nodeIdsOf(['only-one-node']), ['one-node'])
    assert.deepEqual(nodeIdsOf([]), [])
    assert.deepEqual(nodeIdsOf(['node-1', 'node-1']), ['node-1', 'node-1'], 'nothing left: the last 8')
})

test('usageOf: per node, the memory of its containers and the CPU seconds of the interval', () => {
    const before = reading({ 'shop/api/api/container_cpu_usage_seconds_total': 10, 'kube/dns/dns/container_cpu_usage_seconds_total': 5 })
    const after = reading({ 'shop/api/api/container_cpu_usage_seconds_total': 16, 'kube/dns/dns/container_cpu_usage_seconds_total': 7, 'shop/api/api/container_memory_working_set_bytes': 300 })
    const u = usageOf([before, after])
    assert.deepEqual(u.nodes.get('node-1'), { memory: 300, cpuSeconds: 8 })
    assert.equal(u.interval, 10)
    const restarted = usageOf([after, before])
    assert.equal(restarted.nodes.get('node-1')?.cpuSeconds, undefined, 'a counter that went back gives no figure')
    assert.equal(usageOf([before]).nodes.get('node-1')?.cpuSeconds, undefined)
    const gone = reading({ 'shop/api/api/container_cpu_usage_seconds_total': 13, 'new/pod/c/container_cpu_usage_seconds_total': 100 })
    assert.equal(usageOf([before, gone]).nodes.get('node-1')?.cpuSeconds, 3, 'a container that went or came is left out, not the node')
    assert.equal(usageOf([before, reading({}, 'node-9')]).nodes.get('node-9')?.cpuSeconds, undefined, 'a node not in the previous reading: memory, no CPU')
})

test('NODES: every node, its status, and the Pods count only what the key reaches', async () => {
    const shop = await open('sdsf$read:^shop$:::')
    const r = await shop.run(message(ESdsfCommand.NODES))
    assert.equal(r.ok, true)
    const nodes = r.nodes as ISdsfNode[]
    assert.deepEqual(nodes.map(n => [n.name, n.status, n.pods]), [['node-1', ESdsfNodeStatus.ACTIVE, 1], ['node-2', ESdsfNodeStatus.INACTIVE, 0]])
    assert.equal(nodes[1].cpus, 2)
    const all = await open('admin::::')
    assert.equal(((await all.run(message(ESdsfCommand.NODES))).nodes as ISdsfNode[])[0].pods, 3, 'vault and the DaemonSet pod too: this key reaches everything')
})

test('DESCRIBE a node: no namespace needed; its pods and events filtered by the key', async () => {
    const shop = await open('sdsf$read:^shop$:::')
    const r = await shop.run(message(ESdsfCommand.DESCRIBE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1', containerName: '' }))
    assert.equal(r.ok, true)
    const text = (r.lines as string[]).join('\n')
    assert.match(text, /^Name: +node-1/)
    assert.match(text, /Unschedulable: +true/)
    assert.match(text, /Taints: +node\.kubernetes\.io\/unschedulable:NoSchedule/)
    assert.match(text, /Non-terminated Pods: +\(1 in total\)/)
    assert.match(text, /shop +api-7d9f8b6c4-x2kq9/)
    assert.doesNotMatch(text, /proxy-x/, 'kube-system is out of the key')
    assert.match(text, /Events: +<none>/, 'the node events live in default, out of the key')
    assert.deepEqual(shop.calls.find(c => c.method === 'allEvents')?.params, { fieldSelector: 'involvedObject.kind=Node,involvedObject.name=node-1' })
    const admin = await open('admin::::')
    const a = await admin.run(message(ESdsfCommand.DESCRIBE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1', containerName: '' }))
    assert.match((a.lines as string[]).join('\n'), /NodeNotSchedulable/)
    const none = await shop.run(message(ESdsfCommand.DESCRIBE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: '' }))
    assert.equal(none.error, ESdsfError.BAD_REQUEST)
})

test('a node description without events still describes, and a node with no taints says <none>', () => {
    const text = describeNode(nodeObject('n'), [], [], Date.parse('2026-11-22T12:00:00Z')).join('\n')
    assert.match(text, /Taints: +<none>/)
    assert.match(text, /Non-terminated Pods: +\(0 in total\)/)
    assert.match(text, /Kubelet Version: +v1\.31\.5\+k3s1/)
    assert.match(text, /  cpu: +4/)
})

test('NODE actions are for admin only, refused before the API is touched', async () => {
    for (const resources of ['sdsf$cancel::::', 'cluster::::']) {
        const { run, calls } = await open(resources)
        const r = await run(message(ESdsfCommand.NODE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1', nodeAction: ESdsfNodeAction.HALT }))
        assert.equal(r.ok, false)
        assert.equal(r.error, ESdsfError.NOT_AUTHORIZED)
        assert.match(String(r.detail), /'admin'/)
        assert.equal(calls.filter(c => c.method === 'patchNode').length, 0)
    }
})

test('NODE: halt and start are a JSON patch with add on spec.unschedulable', async () => {
    const { run, calls } = await open('admin::::')
    assert.equal((await run(message(ESdsfCommand.NODE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1', nodeAction: ESdsfNodeAction.HALT }))).ok, true)
    assert.equal((await run(message(ESdsfCommand.NODE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1', nodeAction: ESdsfNodeAction.START }))).ok, true)
    assert.deepEqual(calls.filter(c => c.method === 'patchNode').map(c => c.params), [
        { name: 'node-1', body: [{ op: 'add', path: '/spec/unschedulable', value: true }] },
        { name: 'node-1', body: [{ op: 'add', path: '/spec/unschedulable', value: false }] }
    ])
    const bad = await run(message(ESdsfCommand.NODE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1' }))
    assert.equal(bad.error, ESdsfError.BAD_REQUEST)
})

test('NODE drain: cordon, then one eviction per pod on it but the DaemonSet ones; a refused one is reported', async () => {
    const { run, calls } = await open('admin::::')
    const r = await run(message(ESdsfCommand.NODE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1', nodeAction: ESdsfNodeAction.DRAIN }))
    assert.equal(r.ok, true)
    assert.equal(r.evicted, 2)
    assert.deepEqual(calls.find(c => c.method === 'patchNode')?.params, { name: 'node-1', body: [{ op: 'add', path: '/spec/unschedulable', value: true }] })
    assert.deepEqual(calls.filter(c => c.method === 'evict').map(c => c.params), [
        { name: 'api-7d9f8b6c4-x2kq9', namespace: 'shop', body: { apiVersion: 'policy/v1', kind: 'Eviction', metadata: { name: 'api-7d9f8b6c4-x2kq9', namespace: 'shop' } } },
        { name: 'secret-pod', namespace: 'vault', body: { apiVersion: 'policy/v1', kind: 'Eviction', metadata: { name: 'secret-pod', namespace: 'vault' } } }
    ], 'every namespace (a drain is admin), never the DaemonSet pod')
    const pdb = await open('admin::::', { refuseEvict: ['api-7d9f8b6c4-x2kq9'] })
    const refused = await pdb.run(message(ESdsfCommand.NODE, { objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-1', nodeAction: ESdsfNodeAction.DRAIN }))
    assert.equal(refused.ok, false)
    assert.equal(refused.error, ESdsfError.FAILED)
    assert.equal(refused.evicted, 1)
    assert.match(String(refused.detail), /Halted; 1 of 2 pod\(s\) evicted\. Refused: shop\/api-7d9f8b6c4-x2kq9: Cannot evict pod as it would violate the pod's disruption budget\./)
})
