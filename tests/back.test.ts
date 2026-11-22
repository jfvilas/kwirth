import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { V1Pod, CoreV1Event } from '@kubernetes/client-node'
import { jobIdOf, mapPod } from '../src/back/PodMapper'
import { ageOf, describePod } from '../src/back/Describe'
import { usageOf } from '../src/back/PodMetrics'
import { IMetricsCluster, IMetricsValue } from '../src/back/MetricsProviderTypes'
import { SdsfChannel, ISdsfClusterInfo, DEFAULT_TAIL_LINES, MAX_TAIL_LINES } from '../src/back/index'
import { ESdsfCommand, ESdsfError, ESdsfMetricsState, ESdsfQos, ISdsfMessage } from '../src/common/SdsfTypes'
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

const fakeCluster = (opts: { metrics?: boolean; fail?: { code?: number; body?: string; message?: string } } = {}) => {
    const calls: ICall[] = []
    const subscribed: unknown[] = []
    const call = async <T>(method: string, params: unknown, result: T): Promise<T> => {
        calls.push({ method, params })
        if (opts.fail) throw Object.assign(new Error(opts.fail.message ?? 'boom'), opts.fail)
        return result
    }
    const clusterInfo = {
        coreApi: {
            listPodForAllNamespaces: () => call('list', undefined, { items: [pod(), pod({ metadata: { name: 'secret-pod', namespace: 'vault', uid: '1' } })] }),
            readNamespacedPod: (p: unknown) => call('read', p, pod()),
            readNamespacedPodLog: (p: unknown) => call('log', p, 'line 1\nline 2\n'),
            deleteNamespacedPod: (p: unknown) => call('delete', p, pod()),
            listNamespacedEvent: (p: unknown) => call('events', p, { items: [] })
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
    msgtype: 'sdsfmessage', id: 'r1', command, namespace: 'shop', pod: 'api-7d9f8b6c4-x2kq9', container: 'api', ...extra
})

const open = async (resources: string, opts: { metrics?: boolean; fail?: { code?: number; body?: string; message?: string } } = {}) => {
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
    const noContainer = await run(message(ESdsfCommand.LOG, { container: '' }))
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
        const r = await run(message(command, { namespace: 'vault', pod: 'secret-pod' }))
        assert.equal(r.ok, false)
        assert.equal(r.error, ESdsfError.NOT_AUTHORIZED)
    }
    assert.equal(calls.length, 0)
    const missing = await run(message(ESdsfCommand.DESCRIBE, { pod: '' }))
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
    const r = await run(message('bogus' as ESdsfCommand, { namespace: 'shop' }))
    assert.equal(r.error, ESdsfError.BAD_REQUEST)
    assert.equal(channel.containsInstance('i1'), true)
    assert.equal(channel.refreshConnection(ws as unknown as WebSocket), true)
    const other = new FakeSocket() as unknown as WebSocket
    assert.equal(channel.updateConnection(other, 'i1'), true)
    assert.equal(channel.updateConnection(other, 'zzz'), false)
})
