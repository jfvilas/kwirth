import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { V1Pod, V1ContainerStatus } from '@kubernetes/client-node'
import { AccessKey, accessKeySerialize, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, IInstanceConfig } from '@kwirthmagnify/kwirth-common'
import { isActive, mapJob, programOf, statusOf, typeOf } from '../src/back/JobMapper'
import { mapEvent, sortEvents } from '../src/back/EventMapper'
import { usageOf } from '../src/back/PodMetrics'
import { IMetricsCluster, IMetricsValue } from '../src/back/MetricsProviderTypes'
import { WrkactjobChannel, IWrkClusterInfo, DEFAULT_DELAY, DEFAULT_TAIL_LINES, MAX_TAIL_LINES, MAX_MESSAGES } from '../src/back/index'
import { EWrkCommand, EWrkError, EWrkJobStatus, EWrkJobType, EWrkMetricsState, EWrkRunStatus, EWrkSubsystemStatus, IWrkactjobMessage, IWrkJob, IWrkMessage, IWrkSchedule, IWrkSubsystem, IWrkSubsystemDescription, IWrkSystem } from '../src/common/WrkactjobTypes'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const running = (name: string, image: string, over: Partial<V1ContainerStatus> = {}): V1ContainerStatus =>
    ({ name, image, imageID: '', ready: true, restartCount: 0, state: { running: {} }, ...over } as V1ContainerStatus)

const pod = (over: { name?: string; namespace?: string; owner?: string; phase?: string; statuses?: V1ContainerStatus[]; deleting?: boolean } = {}): V1Pod => ({
    metadata: {
        name: over.name ?? 'api-7d9f8b6c4-x2kq9', namespace: over.namespace ?? 'payroll', uid: 'u-1',
        creationTimestamp: new Date('2026-11-01T10:00:00Z'),
        ...(over.owner === '' ? {} : { ownerReferences: [{ apiVersion: 'apps/v1', kind: over.owner ?? 'ReplicaSet', name: 'api-7d9f8b6c4', uid: 'x', controller: true }] }),
        ...(over.deleting ? { deletionTimestamp: new Date('2026-11-23T10:00:00Z') } : {})
    },
    spec: {
        serviceAccountName: 'payroll-sa', nodeName: 'node-1', priorityClassName: 'high', priority: 1000,
        initContainers: [{ name: 'migrate', image: 'migrate:1' }],
        containers: [{ name: 'api', image: 'registry.example.com/team/payroll-api:2.1@sha256:abc' }, { name: 'sidecar', image: 'envoy:1' }]
    },
    status: {
        phase: over.phase ?? 'Running',
        initContainerStatuses: [{ name: 'migrate', image: 'migrate:1', imageID: '', ready: true, restartCount: 0, state: { terminated: { exitCode: 0, reason: 'Completed' } } }],
        containerStatuses: over.statuses ?? [running('api', 'payroll-api:2.1', { restartCount: 2 }), running('sidecar', 'envoy:1', { restartCount: 1 })]
    }
} as V1Pod)

const waiting = (name: string, reason: string, message = ''): V1ContainerStatus =>
    ({ name, image: 'x', imageID: '', ready: false, restartCount: 7, state: { waiting: { reason, message } },
       lastState: { terminated: { exitCode: 137, reason: 'OOMKilled', message: 'out of memory' } } } as V1ContainerStatus)

const reading = (values: Record<string, number>): IMetricsCluster => ({
    metricsInterval: 10,
    cluster: { vcpus: 4, memory: 1e9 },
    nodes: [{ name: 'node-1', timestamp: 0, podMetricValues: new Map(), containerMetricValues: new Map<string, IMetricsValue>(Object.entries(values).map(([k, v]) => [k, { value: v, timestamp: 0 }])) }],
    clusterMetricValues: new Map()
})

// ─── the mapper ───────────────────────────────────────────────────────────────────────────────────

test('typeOf, PRD D6: what kept the pod alive says the job type', () => {
    assert.equal(typeOf('ReplicaSet'), EWrkJobType.ASJ)
    assert.equal(typeOf('StatefulSet'), EWrkJobType.ASJ)
    assert.equal(typeOf('SomeOperatorKind'), EWrkJobType.ASJ)
    assert.equal(typeOf('Job'), EWrkJobType.BCH)
    assert.equal(typeOf('DaemonSet'), EWrkJobType.SYS)
    assert.equal(typeOf(''), EWrkJobType.BCI)
})

test('programOf: the image name alone, no registry, path, tag or digest', () => {
    assert.equal(programOf('registry.k8s.io/coredns/coredns:v1.11.1'), 'coredns')
    assert.equal(programOf('registry.example.com:5000/team/payroll-api:2.1@sha256:abc'), 'payroll-api')
    assert.equal(programOf('nginx'), 'nginx')
    assert.equal(programOf(''), '')
})

test('isActive: a finished pod, well or badly, is no active job', () => {
    assert.ok(isActive(pod()))
    assert.ok(isActive(pod({ phase: 'Pending' })))
    assert.ok(!isActive(pod({ phase: 'Succeeded' })))
    assert.ok(!isActive(pod({ phase: 'Failed' })))
})

test('statusOf, PRD D7: END, MSGW, SCDW, then RUN or DEQW by its CPU', () => {
    const job = (p: V1Pod, cpu?: number) => mapJob(p, cpu === undefined ? {} : { cpu }).status
    assert.equal(job(pod({ deleting: true, statuses: [waiting('api', 'CrashLoopBackOff')] })), EWrkJobStatus.END, 'ending beats everything')
    assert.equal(job(pod({ statuses: [waiting('api', 'CrashLoopBackOff')] })), EWrkJobStatus.MSGW)
    assert.equal(job(pod({ phase: 'Pending', statuses: [waiting('api', 'ImagePullBackOff')] })), EWrkJobStatus.MSGW, 'a failing pull beats pending')
    assert.equal(job(pod({ statuses: [waiting('api', 'ErrImagePull')] })), EWrkJobStatus.MSGW)
    assert.equal(job(pod({ statuses: [waiting('api', 'CreateContainerConfigError')] })), EWrkJobStatus.MSGW)
    assert.equal(job(pod({ statuses: [{ name: 'api', image: 'x', imageID: '', ready: false, restartCount: 1, state: { terminated: { exitCode: 137, reason: 'OOMKilled' } } } as V1ContainerStatus] })), EWrkJobStatus.MSGW)
    assert.equal(job(pod({ statuses: [{ name: 'api', image: 'x', imageID: '', ready: false, restartCount: 1, state: { terminated: { exitCode: 1, reason: 'Error' } } } as V1ContainerStatus] })), EWrkJobStatus.MSGW)
    assert.equal(job(pod({ phase: 'Pending', statuses: [waiting('api', 'ContainerCreating')] })), EWrkJobStatus.SCDW, 'creating is not failing')
    assert.equal(job(pod({ phase: 'Pending', statuses: [] })), EWrkJobStatus.SCDW)
    assert.equal(job(pod(), 0.4), EWrkJobStatus.RUN)
    assert.equal(job(pod(), 0), EWrkJobStatus.DEQW)
    assert.equal(job(pod()), EWrkJobStatus.RUN, 'no CPU figure: a running job is RUN')
    // a container that was OOMKilled before but runs again is fine
    assert.equal(statusOf(pod(), mapJob(pod({ statuses: [running('api', 'x', { lastState: { terminated: { exitCode: 137, reason: 'OOMKilled' } } })] })).containers, 1), EWrkJobStatus.RUN)
})

test('mapJob: the job as WRKACTJOB shows it', () => {
    const j = mapJob(pod())
    assert.equal(j.name, 'api-7d9f8b6c4-x2kq9')
    assert.equal(j.namespace, 'payroll')
    assert.equal(j.user, 'payroll-sa')
    assert.equal(j.type, EWrkJobType.ASJ)
    assert.equal(j.program, 'payroll-api')
    assert.equal(j.controllerKind, 'ReplicaSet')
    assert.equal(j.controllerName, 'api-7d9f8b6c4')
    assert.equal(j.node, 'node-1')
    assert.equal(j.priorityClass, 'high')
    assert.equal(j.priority, 1000)
    assert.equal(j.restarts, 3, 'regular containers only')
    assert.equal(j.created, '2026-11-01T10:00:00.000Z')
    assert.equal(j.message, '')
    assert.deepEqual(j.containers.map(c => [c.name, c.init, c.state]), [['migrate', true, 'terminated'], ['api', false, 'running'], ['sidecar', false, 'running']])
    assert.equal(j.cpu, undefined)
    const withUsage = mapJob(pod(), { cpu: 1.5, cpuSeconds: 320, memory: 2048 })
    assert.deepEqual([withUsage.cpu, withUsage.cpuSeconds, withUsage.memory], [1.5, 320, 2048])
})

test('mapJob: a bare pod with nothing reported yet', () => {
    const bare = mapJob({ metadata: { name: 'debug', namespace: 'default' }, spec: { serviceAccount: 'old-sa', containers: [{ name: 'sh' }] }, status: {} } as V1Pod)
    assert.equal(bare.type, EWrkJobType.BCI)
    assert.equal(bare.user, 'old-sa')
    assert.equal(bare.program, '')
    assert.equal(bare.status, EWrkJobStatus.SCDW)
    assert.equal(bare.created, '')
    assert.equal(bare.containers[0].state, '')
    const nothing = mapJob({} as V1Pod)
    assert.equal(nothing.name, '')
    assert.equal(nothing.priority, 0)
})

test('mapJob: a job in MSGW says why — the failing container, its reason, exit code and message', () => {
    const j = mapJob(pod({ statuses: [waiting('api', 'CrashLoopBackOff', 'back-off 5m0s restarting failed container')] }))
    assert.equal(j.status, EWrkJobStatus.MSGW)
    assert.equal(j.message, 'Container api: CrashLoopBackOff (exit code 137). back-off 5m0s restarting failed container')
    const quiet = mapJob(pod({ statuses: [{ name: 'api', image: 'x', imageID: '', ready: false, restartCount: 0, state: { waiting: { reason: 'ImagePullBackOff' } } } as V1ContainerStatus] }))
    assert.equal(quiet.message, 'Container api: ImagePullBackOff')
    // with no message of its own, a waiting container takes the last termination's
    const borrowed = mapJob(pod({ statuses: [waiting('api', 'CrashLoopBackOff')] }))
    assert.equal(borrowed.message, 'Container api: CrashLoopBackOff (exit code 137). out of memory')
    const died = mapJob(pod({ statuses: [{ name: 'api', image: 'x', imageID: '', ready: false, restartCount: 1, state: { terminated: { exitCode: 1, reason: 'Error', message: 'panic:\n  nil map' } } } as V1ContainerStatus] }))
    assert.equal(died.message, 'Container api: Error (exit code 1). panic: nil map')
})

test('events: mapped from any API version, oldest first', () => {
    const e = mapEvent({ metadata: {}, involvedObject: {}, type: 'Warning', reason: 'BackOff', message: 'Back-off\n restarting', count: 3, source: { component: 'kubelet' }, lastTimestamp: new Date('2026-11-23T10:00:00Z') })
    assert.deepEqual(e, { time: '2026-11-23T10:00:00.000Z', type: 'Warning', reason: 'BackOff', message: 'Back-off restarting', count: 3, source: 'kubelet' })
    const series = mapEvent({ metadata: { creationTimestamp: new Date('2026-11-23T09:00:00Z') }, involvedObject: {}, series: { count: 5 }, reportingComponent: 'scheduler' })
    assert.deepEqual([series.time, series.count, series.source, series.type], ['2026-11-23T09:00:00.000Z', 5, 'scheduler', ''])
    const bare = mapEvent({ metadata: {}, involvedObject: {} })
    assert.deepEqual([bare.time, bare.count, bare.message], ['', 1, ''])
    assert.deepEqual(sortEvents([e, series]).map(x => x.reason), ['', 'BackOff'])
})

test('usageOf: nothing, then memory and the CPU counter, then the CPU % over the cluster', () => {
    assert.equal(usageOf([]).jobs.size, 0)
    const KEY = 'payroll/api/api/container_cpu_usage_seconds_total'
    const one = usageOf([reading({ [KEY]: 300, 'payroll/api/api/container_memory_working_set_bytes': 100, 'payroll/api/side/container_memory_working_set_bytes': 50 })])
    assert.deepEqual(one.jobs.get('payroll/api'), { memory: 150, cpuSeconds: 300 })
    assert.equal(one.clusterCpu, undefined)
    const two = usageOf([reading({ [KEY]: 300 }), reading({ [KEY]: 304, 'bad/key/metric': 1 })])
    assert.equal(two.jobs.get('payroll/api')?.cpu, 10, '4 seconds of the 40 the cluster had')
    assert.equal(two.jobs.get('payroll/api')?.cpuSeconds, 304)
    assert.equal(two.clusterCpu, 10)
    const restarted = usageOf([reading({ [KEY]: 300 }), reading({ [KEY]: 2 })])
    assert.equal(restarted.jobs.get('payroll/api')?.cpu, undefined, 'a counter that went back gives no %')
    const noCpus = usageOf([reading({ [KEY]: 1 }), { ...reading({ [KEY]: 2 }), cluster: { vcpus: 0, memory: 0 } }])
    assert.equal(noCpus.clusterCpu, undefined)
})

// ─── the channel ──────────────────────────────────────────────────────────────────────────────────

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
            listPodForAllNamespaces: () => call('list', undefined, { items: [
                pod(),
                pod({ name: 'secret-pod', namespace: 'vault' }),
                pod({ name: 'done', namespace: 'payroll', phase: 'Succeeded' })
            ] }),
            readNamespacedPodLog: (p: unknown) => call('log', p, 'line 1\nline 2\n'),
            deleteNamespacedPod: (p: unknown) => call('delete', p, pod()),
            listNamespacedEvent: (p: unknown) => call('events', p, { items: [
                { metadata: {}, involvedObject: {}, reason: 'Started', lastTimestamp: new Date('2026-11-23T10:00:02Z') },
                { metadata: {}, involvedObject: {}, reason: 'Pulled', lastTimestamp: new Date('2026-11-23T10:00:01Z') }
            ] }),
            listNode: () => call('nodes', undefined, { items: [
                { metadata: { name: 'node-2' }, status: { allocatable: { cpu: '2', memory: '4Gi', pods: '110' } } },
                { metadata: { name: 'node-1' }, status: { allocatable: { cpu: '4', memory: '8Gi', pods: '110' } } }
            ] }),
            listPersistentVolume: () => call('volumes', undefined, { items: [
                { spec: { capacity: { storage: '10Gi' } }, status: { phase: 'Bound' } },
                { spec: { capacity: { storage: '5Gi' } }, status: { phase: 'Available' } }
            ] }),
            listNamespace: () => call('namespaces', undefined, { items: [
                { metadata: { name: 'vault' } }, { metadata: { name: 'payroll' } }, { metadata: { name: 'empty' } }
            ] }),
            readNamespace: (p: { name: string }) => call('namespace', p, { metadata: { name: p.name, labels: { team: 'hr' } }, status: { phase: 'Active' } }),
            listNamespacedPod: (p: { namespace: string }) => call('nspods', p, { items: p.namespace === 'payroll' ? [pod()] : [] }),
            listNamespacedResourceQuota: (p: unknown) => call('quotas', p, { items: [{ metadata: { name: 'q' }, status: { hard: { pods: '10' }, used: { pods: '3' } } }] }),
            listNamespacedLimitRange: (p: unknown) => call('limits', p, { items: [] }),
            listEventForAllNamespaces: (p: unknown) => call('allevents', p, { items: [
                { metadata: { namespace: 'payroll' }, involvedObject: { kind: 'Pod', name: 'api-7d9f8b6c4-x2kq9', namespace: 'payroll' }, type: 'Warning', reason: 'BackOff', lastTimestamp: new Date('2026-11-23T10:00:01Z') },
                { metadata: { namespace: 'payroll' }, involvedObject: { kind: 'Deployment', name: 'api', namespace: 'payroll' }, type: 'Warning', reason: 'FailedCreate', lastTimestamp: new Date('2026-11-23T10:00:03Z') },
                { metadata: { namespace: 'vault' }, involvedObject: { kind: 'Pod', name: 'secret-pod', namespace: 'vault' }, type: 'Warning', reason: 'Unhealthy', lastTimestamp: new Date('2026-11-23T10:00:02Z') },
                { metadata: { namespace: 'default' }, involvedObject: { kind: 'Node', name: 'node-1' }, type: 'Warning', reason: 'NodeNotReady', lastTimestamp: new Date('2026-11-23T10:00:04Z') }
            ] })
        },
        batchApi: {
            listCronJobForAllNamespaces: () => call('cronjobs', undefined, { items: [
                { metadata: { name: 'rotate', namespace: 'vault' }, spec: { schedule: '0 * * * *', jobTemplate: { spec: { template: { spec: { containers: [{ name: 'r', image: 'rotate:1' }] } } } } } },
                { metadata: { name: 'backup', namespace: 'payroll', uid: 'cj-1' }, spec: { schedule: '0 2 * * *', suspend: true, jobTemplate: { spec: { template: { spec: { containers: [{ name: 'b', image: 'backup:1' }] } } } } } }
            ] }),
            listJobForAllNamespaces: () => call('jobs', undefined, { items: [
                { metadata: { name: 'backup-1', namespace: 'payroll', ownerReferences: [{ kind: 'CronJob', name: 'backup' }] }, status: { startTime: new Date('2026-11-23T02:00:00Z') } }
            ] }),
            readNamespacedCronJob: (p: { name: string; namespace: string }) => call('cronjob', p, p.name === 'empty'
                ? { metadata: { name: 'empty', namespace: p.namespace }, spec: { schedule: '* * * * *' } }
                : { metadata: { name: p.name, namespace: p.namespace, uid: 'cj-1' }, spec: { schedule: '0 2 * * *', jobTemplate: { spec: { template: { spec: { containers: [{ name: 'b', image: 'backup:1' }] } } } } } }),
            patchNamespacedCronJob: (p: unknown) => call('patch', p, {}),
            createNamespacedJob: (p: { body: { metadata: { name: string } } }) => call('create', p, { metadata: { name: p.body.metadata.name } })
        },
        getProvider: (id: string) => opts.metrics && id === 'metrics'
            ? { id, subscribe: (s: unknown) => { subscribed.push(s); return Promise.resolve() }, unsubscribe: (s: unknown) => { subscribed.splice(subscribed.indexOf(s), 1) } }
            : undefined
    } as unknown as IWrkClusterInfo
    return { clusterInfo, calls, subscribed }
}

class FakeSocket {
    sent: unknown[] = []
    send = (data: string) => { this.sent.push(JSON.parse(data)) }
}

const key = (resources: string): AccessKey => ({ id: 'k', type: 'bearer', resources } as AccessKey)

const instanceConfig = (k: AccessKey, instance = 'i1'): IInstanceConfig => ({
    channel: 'wrkactjob', objects: '', action: EInstanceMessageAction.START, flow: EInstanceMessageFlow.REQUEST, type: EInstanceMessageType.SIGNAL,
    instance, accessKey: accessKeySerialize(k), scope: 'wrkactjob$read', view: 'cluster', namespace: '', group: '', pod: '', container: ''
} as unknown as IInstanceConfig)

const message = (command: EWrkCommand, extra: Partial<IWrkactjobMessage> = {}): IWrkactjobMessage => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.REQUEST, type: EInstanceMessageType.DATA, channel: 'wrkactjob', instance: 'i1',
    msgtype: 'wrkactjobmessage', id: 'r1', accessKey: 'whatever the browser says', command,
    targetNamespace: 'payroll', targetName: 'api-7d9f8b6c4-x2kq9', containerName: 'api', ...extra
})

const open = async (resources: string, opts: { metrics?: boolean; fail?: { code?: number; body?: string; message?: string } } = {}) => {
    const fake = fakeCluster(opts)
    const logs: string[] = []
    const backChannelObject = { logInfo: (m: string) => logs.push(m), logWarning: (m: string) => logs.push(m), logError: (m: string) => logs.push(m) }
    const channel = new WrkactjobChannel(fake.clusterInfo, backChannelObject as never)
    const ws = new FakeSocket() as unknown as WebSocket
    const ok = await channel.addObject(ws, instanceConfig(key(resources)), '*all', '*all', '*all')
    const run = async (m: IWrkactjobMessage) => {
        await channel.processCommand(ws, m)
        return (ws as unknown as FakeSocket).sent.at(-1) as Record<string, unknown>
    }
    return { channel, ws: ws as unknown as FakeSocket, ok, run, logs, ...fake }
}

const READ_ALL = 'wrkactjob$read:payroll,vault:::'
const END_PAYROLL = 'wrkactjob$end:^payroll$:::'

test('channel data: a cluster channel; the scope ladder and catalogue', () => {
    const c = new WrkactjobChannel(fakeCluster().clusterInfo, {} as never)
    const d = c.getChannelData()
    assert.equal(d.id, 'wrkactjob')
    assert.equal(d.cluster, true)
    assert.equal(d.resourced, false)
    assert.equal(d.metrics, false)
    assert.deepEqual(c.requirements.providers, ['metrics'])
    assert.ok(c.getChannelScopeLevel('wrkactjob$read') < c.getChannelScopeLevel('wrkactjob$end'))
    assert.ok(c.getChannelScopeLevel('wrkactjob$end') < c.getChannelScopeLevel('admin'))
    assert.equal(c.getChannelScopeLevel('bogus'), -1)
    assert.ok(c.getChannelScopeLevel('wrkactjob$read') < c.getChannelScopeLevel('wrkactjob$schedule'), 'PRD-fase3 D18')
    assert.ok(c.getChannelScopeLevel('wrkactjob$schedule') < c.getChannelScopeLevel('wrkactjob$end'))
    assert.deepEqual(c.getScopeCatalog().map(s => s.scope), ['wrkactjob$read', 'wrkactjob$schedule', 'wrkactjob$end'])
})

test('a key without wrkactjob$read cannot open it, and nothing is registered', async () => {
    const { ok, ws, channel } = await open('other$x::::')
    assert.equal(ok, false)
    assert.equal((ws.sent[0] as { level: string }).level, 'error')
    assert.deepEqual(channel.getInstances(), { instances: 0, connections: 0 })
    assert.equal(channel.containsInstance('i1'), false)
})

test('LIST: the active jobs the key reaches, and the metrics unavailable without the provider', async () => {
    const { ok, run, channel } = await open('wrkactjob$read:^payroll$:::')
    assert.equal(ok, true)
    assert.deepEqual(channel.getInstances(), { instances: 1, connections: 1 })
    assert.equal(channel.containsInstance('i1'), true)
    const r = await run(message(EWrkCommand.LIST))
    assert.equal(r.ok, true)
    assert.equal(r.msgtype, 'wrkactjobmessageresponse')
    assert.equal(r.id, 'r1')
    assert.deepEqual((r.jobs as IWrkJob[]).map(j => j.name), ['api-7d9f8b6c4-x2kq9'], 'vault is out of reach, the finished pod is not active')
    assert.equal(r.metrics, EWrkMetricsState.UNAVAILABLE)
})

test('metrics: subscribed while an instance is open, warming, then CPU on the jobs and their status', async () => {
    const { run, channel, subscribed, ws } = await open(READ_ALL, { metrics: true })
    assert.equal(subscribed.length, 1)
    assert.equal((await run(message(EWrkCommand.LIST))).metrics, EWrkMetricsState.WARMING)
    const KEY = 'payroll/api-7d9f8b6c4-x2kq9/api/container_cpu_usage_seconds_total'
    channel.processProviderEvent('metrics', reading({ [KEY]: 10, 'vault/secret-pod/x/container_cpu_usage_seconds_total': 5 }))
    channel.processProviderEvent('events', {})
    channel.processProviderEvent('metrics', reading({ [KEY]: 14, 'vault/secret-pod/x/container_cpu_usage_seconds_total': 5 }))
    channel.processProviderEvent('metrics', reading({ [KEY]: 18, 'vault/secret-pod/x/container_cpu_usage_seconds_total': 5 }))
    const r = await run(message(EWrkCommand.LIST))
    assert.equal(r.metrics, EWrkMetricsState.AVAILABLE)
    const jobs = r.jobs as IWrkJob[]
    const api = jobs.find(j => j.name === 'api-7d9f8b6c4-x2kq9')!
    assert.equal(api.cpu, 10)
    assert.equal(api.cpuSeconds, 18)
    assert.equal(api.status, EWrkJobStatus.RUN)
    assert.equal(jobs.find(j => j.name === 'secret-pod')!.status, EWrkJobStatus.DEQW, 'no CPU in the interval: waiting for work')
    channel.stopInstance(ws as unknown as WebSocket, instanceConfig(key(READ_ALL)))
    assert.equal(subscribed.length, 0, 'the last instance gone, the subscription goes too')
    assert.equal((ws.sent.at(-1) as { text: string }).text, 'WRKACTJOB stopped')
})

test('cleanup and removeConnection drop the subscription; a second open does not subscribe twice', async () => {
    const a = await open(READ_ALL, { metrics: true })
    await a.channel.addObject(a.ws as unknown as WebSocket, instanceConfig(key(READ_ALL), 'i2'), '*all', '*all', '*all')
    assert.equal(a.subscribed.length, 1)
    a.channel.cleanup()
    assert.equal(a.subscribed.length, 0)
    const b = await open(READ_ALL, { metrics: true })
    b.channel.removeConnection(b.ws as unknown as WebSocket)
    assert.equal(b.subscribed.length, 0)
    assert.equal(b.channel.containsConnection(b.ws as unknown as WebSocket), false)
})

test('a provider that refuses the subscription is logged, and LIST still works', async () => {
    const fake = fakeCluster()
    const logs: string[] = []
    fake.clusterInfo.getProvider = () => ({ id: 'metrics', subscribe: () => Promise.reject(new Error('nope')), unsubscribe: () => { throw new Error('gone') } }) as never
    const channel = new WrkactjobChannel(fake.clusterInfo, { logError: (m: string) => logs.push(m) } as never)
    const ws = new FakeSocket() as unknown as WebSocket
    await channel.addObject(ws, instanceConfig(key(READ_ALL)), '*all', '*all', '*all')
    await new Promise(r => setTimeout(r, 0))
    assert.match(logs[0], /Cannot subscribe to the metrics provider: nope/)
    channel.removeInstance(ws, 'i1')
    assert.deepEqual(channel.getInstances(), { instances: 0, connections: 0 })
})

test('LOG: the container\'s log as lines, the tail clamped', async () => {
    const { run, calls } = await open(READ_ALL)
    const r = await run(message(EWrkCommand.LOG))
    assert.deepEqual(r.lines, ['line 1', 'line 2'])
    assert.deepEqual(calls.at(-1)?.params, { name: 'api-7d9f8b6c4-x2kq9', namespace: 'payroll', container: 'api', tailLines: DEFAULT_TAIL_LINES })
    await run(message(EWrkCommand.LOG, { tailLines: 1e9 }))
    assert.equal((calls.at(-1)?.params as { tailLines: number }).tailLines, MAX_TAIL_LINES)
    await run(message(EWrkCommand.LOG, { tailLines: -3 }))
    assert.equal((calls.at(-1)?.params as { tailLines: number }).tailLines, 1)
    const none = await run(message(EWrkCommand.LOG, { containerName: '' }))
    assert.equal(none.error, EWrkError.BAD_REQUEST)
})

test('EVENTS: the pod\'s own events, oldest first', async () => {
    const { run, calls } = await open(READ_ALL)
    const r = await run(message(EWrkCommand.EVENTS))
    assert.deepEqual((r.events as { reason: string }[]).map(e => e.reason), ['Pulled', 'Started'])
    assert.deepEqual(calls.at(-1)?.params, { namespace: 'payroll', fieldSelector: 'involvedObject.kind=Pod,involvedObject.name=api-7d9f8b6c4-x2kq9' })
})

test('a target the key does not reach, or no target, is refused before the API is called', async () => {
    const { run, calls } = await open('wrkactjob$read:^payroll$:::')
    const out = await run(message(EWrkCommand.LOG, { targetNamespace: 'vault', targetName: 'secret-pod' }))
    assert.equal(out.ok, false)
    assert.equal(out.error, EWrkError.NOT_AUTHORIZED)
    const none = await run(message(EWrkCommand.EVENTS, { targetName: '' }))
    assert.equal(none.error, EWrkError.BAD_REQUEST)
    assert.equal(calls.length, 0)
})

test('END: *CNTRLD gives the job its DELAY as grace period; *IMMED none', async () => {
    const { run, calls, logs } = await open(END_PAYROLL)
    const r = await run(message(EWrkCommand.END))
    assert.equal(r.ok, true)
    assert.deepEqual(calls.at(-1), { method: 'delete', params: { name: 'api-7d9f8b6c4-x2kq9', namespace: 'payroll', gracePeriodSeconds: DEFAULT_DELAY } })
    await run(message(EWrkCommand.END, { delay: 120 }))
    assert.equal((calls.at(-1)?.params as { gracePeriodSeconds: number }).gracePeriodSeconds, 120)
    await run(message(EWrkCommand.END, { immediate: true, delay: 120 }))
    assert.equal((calls.at(-1)?.params as { gracePeriodSeconds: number }).gracePeriodSeconds, 0)
    assert.match(logs.at(-1)!, /\*IMMED/)
    const bad = await run(message(EWrkCommand.END, { delay: -1 }))
    assert.equal(bad.error, EWrkError.BAD_REQUEST)
    const huge = await run(message(EWrkCommand.END, { delay: 1e7 }))
    assert.equal(huge.error, EWrkError.BAD_REQUEST)
    assert.equal(calls.length, 3)
})

test('END without wrkactjob$end is refused and nothing is deleted', async () => {
    const { run, calls, logs } = await open(READ_ALL)
    const r = await run(message(EWrkCommand.END))
    assert.equal(r.ok, false)
    assert.equal(r.error, EWrkError.NOT_AUTHORIZED)
    assert.match(r.detail as string, /wrkactjob\$end/)
    assert.equal(calls.length, 0)
    assert.match(logs.at(-1)!, /Denied end/)
})

test('API errors: 404 is NOT_FOUND with the API\'s message, anything else FAILED', async () => {
    const notFound = await open(READ_ALL, { fail: { code: 404, body: JSON.stringify({ message: 'pods "x" not found' }) } })
    const r = await notFound.run(message(EWrkCommand.LOG))
    assert.equal(r.error, EWrkError.NOT_FOUND)
    assert.equal(r.detail, 'pods "x" not found')
    const raw = await open(READ_ALL, { fail: { code: 500, body: 'not json' } })
    assert.equal((await raw.run(message(EWrkCommand.LIST))).detail, 'not json')
    const plain = await open(READ_ALL, { fail: { message: 'socket hang up' } })
    const p = await plain.run(message(EWrkCommand.EVENTS))
    assert.equal(p.error, EWrkError.FAILED)
    assert.equal(p.detail, 'socket hang up')
})

test('an unknown command, another plugin\'s message, an unknown instance', async () => {
    const { run, channel, ws } = await open(READ_ALL)
    const unknown = await run(message('bogus' as EWrkCommand))
    assert.equal(unknown.error, EWrkError.BAD_REQUEST)
    const before = ws.sent.length
    assert.equal(await channel.processCommand(ws as unknown as WebSocket, { ...message(EWrkCommand.LIST), msgtype: 'other' } as unknown as IWrkactjobMessage), false)
    assert.equal(ws.sent.length, before)
    assert.equal(await channel.processCommand(ws as unknown as WebSocket, { ...message(EWrkCommand.LIST), instance: 'nope' }), false)
    assert.equal((ws.sent.at(-1) as { text: string }).text, 'Instance not found')
})

test('connections: refresh and update keep the instance on its new socket', async () => {
    const { channel, ws } = await open(READ_ALL)
    assert.equal(channel.refreshConnection(ws as unknown as WebSocket), true)
    assert.equal(channel.refreshConnection(new FakeSocket() as unknown as WebSocket), false)
    const other = new FakeSocket() as unknown as WebSocket
    assert.equal(channel.updateConnection(other, 'i1'), true)
    assert.equal(channel.containsConnection(other), true)
    assert.equal(channel.updateConnection(other, 'nope'), false)
    assert.equal(channel.containsAsset(other, '', '', ''), false)
    assert.equal(await channel.deleteObject(other, {} as never, '', '', ''), true)
    channel.pauseContinueInstance(other, {} as never, EInstanceMessageAction.PAUSE)
    channel.modifyInstance(other, {} as never)
    await channel.startChannel()
    await channel.endpointRequest('', {} as never, {} as never)
    await channel.websocketRequest(other)
})

// ─── PRD-fase3: the system-wide commands and the job schedule entries ───────────────────────────────────

const CLUSTER_ALL = 'cluster::::'
const SCHEDULE_PAYROLL = 'wrkactjob$schedule:^payroll$:::'

test('SYSTEM at cluster level: pools are the nodes by name, the ASP the volumes, the CPU the cluster\'s', async () => {
    const { run, channel } = await open(CLUSTER_ALL, { metrics: true })
    channel.processProviderEvent('metrics', reading({ 'payroll/api-7d9f8b6c4-x2kq9/api/container_cpu_usage_seconds_total': 100 }))
    channel.processProviderEvent('metrics', reading({ 'payroll/api-7d9f8b6c4-x2kq9/api/container_cpu_usage_seconds_total': 104 }))
    const r = await run(message(EWrkCommand.SYSTEM))
    const system = r.system as IWrkSystem
    assert.equal(system.restricted, false)
    assert.equal(system.jobs, 2, 'payroll and vault, not the finished one')
    assert.equal(system.cpu, 10)
    assert.equal(system.metrics, EWrkMetricsState.AVAILABLE)
    assert.deepEqual(system.pools.map(p => [p.name, p.jobs, p.cpus]), [['node-1', 2, 4], ['node-2', 0, 2]])
    assert.deepEqual(system.storage, { capacity: 15 * 1024 ** 3, bound: 10 * 1024 ** 3, volumes: 2 })
})

test('SYSTEM below cluster level, D17: no nodes or volumes asked for, the CPU of what it reaches', async () => {
    const { run, calls } = await open('wrkactjob$read:^payroll$:::')
    const system = (await run(message(EWrkCommand.SYSTEM))).system as IWrkSystem
    assert.equal(system.restricted, true)
    assert.equal(system.jobs, 1)
    assert.equal(system.cpu, undefined)
    assert.equal(system.metrics, EWrkMetricsState.UNAVAILABLE)
    assert.deepEqual(system.pools, [])
    assert.equal(system.storage, undefined)
    assert.deepEqual(calls.map(c => c.method), ['list'])
})

test('SUBSYSTEMS: by name, or through a pod the key reaches; sorted', async () => {
    const byName = (await (await open('wrkactjob$read:^payroll$,^empty$:::')).run(message(EWrkCommand.SUBSYSTEMS))).subsystems as IWrkSubsystem[]
    assert.deepEqual(byName.map(s => [s.name, s.jobs, s.pools, s.status]), [['empty', 0, [], EWrkSubsystemStatus.ACTIVE], ['payroll', 1, ['node-1'], EWrkSubsystemStatus.ACTIVE]])
    const byPod = (await (await open('wrkactjob$read:::^secret:')).run(message(EWrkCommand.SUBSYSTEMS))).subsystems as IWrkSubsystem[]
    assert.deepEqual(byPod.map(s => s.name), ['vault'], 'a key on some pods sees only their subsystems')
})

test('SUBSYSTEM_DESCRIPTION: labels and quotas of a subsystem the key reaches, by name or by a pod', async () => {
    const { run } = await open(READ_ALL)
    const d = (await run(message(EWrkCommand.SUBSYSTEM_DESCRIPTION, { targetName: '' }))).description as IWrkSubsystemDescription
    assert.equal(d.name, 'payroll')
    assert.deepEqual(d.labels, { team: 'hr' })
    assert.deepEqual(d.quotas, [{ quota: 'q', resource: 'pods', hard: '10', used: '3' }])
    const byPod = await (await open('wrkactjob$read:::^api-:')).run(message(EWrkCommand.SUBSYSTEM_DESCRIPTION, { targetName: '' }))
    assert.equal(byPod.ok, true)
    const out = await (await open('wrkactjob$read:::^api-:')).run(message(EWrkCommand.SUBSYSTEM_DESCRIPTION, { targetNamespace: 'vault' }))
    assert.equal(out.error, EWrkError.NOT_AUTHORIZED)
    const none = await run(message(EWrkCommand.SUBSYSTEM_DESCRIPTION, { targetNamespace: '' }))
    assert.equal(none.error, EWrkError.BAD_REQUEST)
})

test('MESSAGES: the Warning events the key reaches, newest first; a node\'s only at cluster level', async () => {
    const { run, calls } = await open('wrkactjob$read:^payroll$:::')
    const m = (await run(message(EWrkCommand.MESSAGES))).messages as IWrkMessage[]
    assert.deepEqual(m.map(x => x.reason), ['FailedCreate', 'BackOff'])
    assert.deepEqual(calls.at(-1)?.params, { fieldSelector: 'type=Warning' })
    const all = (await (await open(CLUSTER_ALL)).run(message(EWrkCommand.MESSAGES))).messages as IWrkMessage[]
    assert.deepEqual(all.map(x => x.reason), ['NodeNotReady', 'FailedCreate', 'Unhealthy', 'BackOff'])
    const pods = (await (await open('wrkactjob$read:::^api-:')).run(message(EWrkCommand.MESSAGES))).messages as IWrkMessage[]
    assert.deepEqual(pods.map(x => x.reason), ['BackOff'], 'a key on pods: its pods\' events only')
    assert.equal(MAX_MESSAGES, 1000)
})

test('SCHEDULES: the CronJobs the key reaches, with their runs', async () => {
    const s = (await (await open(READ_ALL)).run(message(EWrkCommand.SCHEDULES))).schedules as IWrkSchedule[]
    assert.deepEqual(s.map(x => [x.namespace, x.name, x.held]), [['payroll', 'backup', true], ['vault', 'rotate', false]])
    assert.deepEqual(s[0].runs.map(r => [r.job, r.status]), [['backup-1', EWrkRunStatus.RUNNING]])
    const one = (await (await open('wrkactjob$read:^payroll$:::')).run(message(EWrkCommand.SCHEDULES))).schedules as IWrkSchedule[]
    assert.deepEqual(one.map(x => x.name), ['backup'])
})

test('HOLD and RELEASE patch spec.suspend; SUBMIT creates the Job from the template', async () => {
    const { run, calls, logs } = await open(SCHEDULE_PAYROLL)
    const target = { targetName: 'backup', containerName: '' }
    assert.equal((await run(message(EWrkCommand.HOLD, target))).ok, true)
    assert.deepEqual(calls.at(-1), { method: 'patch', params: { name: 'backup', namespace: 'payroll', body: [{ op: 'add', path: '/spec/suspend', value: true }] } })
    await run(message(EWrkCommand.RELEASE, target))
    assert.equal((calls.at(-1)?.params as { body: { value: boolean }[] }).body[0].value, false)
    assert.match(logs.at(-1)!, /released/)
    const r = await run(message(EWrkCommand.SUBMIT, target))
    assert.equal(r.ok, true)
    assert.match(r.submitted as string, /^backup-manual-\d+$/)
    assert.equal(calls.at(-1)?.method, 'create')
    const empty = await run(message(EWrkCommand.SUBMIT, { targetName: 'empty', containerName: '' }))
    assert.equal(empty.error, EWrkError.FAILED)
})

test('HOLD, RELEASE and SUBMIT need wrkactjob$schedule (end includes it) and a CronJob the key reaches', async () => {
    const reader = await open(READ_ALL)
    const denied = await reader.run(message(EWrkCommand.HOLD, { targetName: 'backup', containerName: '' }))
    assert.equal(denied.error, EWrkError.NOT_AUTHORIZED)
    assert.match(denied.detail as string, /wrkactjob\$schedule/)
    assert.match(reader.logs.at(-1)!, /Denied hold/)
    assert.equal(reader.calls.length, 0)
    const ender = await open(END_PAYROLL)
    assert.equal((await ender.run(message(EWrkCommand.SUBMIT, { targetName: 'backup', containerName: '' }))).ok, true)
    const outside = await open(SCHEDULE_PAYROLL)
    const far = await outside.run(message(EWrkCommand.RELEASE, { targetNamespace: 'vault', targetName: 'rotate', containerName: '' }))
    assert.equal(far.error, EWrkError.NOT_AUTHORIZED)
    const none = await outside.run(message(EWrkCommand.SUBMIT, { targetName: '' }))
    assert.equal(none.error, EWrkError.BAD_REQUEST)
    assert.match(none.detail as string, /job schedule entry/)
    assert.equal(outside.calls.length, 0)
})
