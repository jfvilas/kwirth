import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CoreV1Event, V1CronJob, V1Job, V1Namespace, V1Node, V1Pod } from '@kubernetes/client-node'
import { memoryRequestOf, quantityOf } from '../src/back/Quantity'
import { cpuOf, IPodJob, limitItemsOf, mapDescription, mapPool, mapPools, mapSubsystem, quotaItemsOf, storageOf, subsystemStatusOf } from '../src/back/SystemMapper'
import { mapMessage, sortMessages } from '../src/back/EventMapper'
import { MANUAL_ANNOTATION, mapRun, mapSchedule, runStatusOf, scheduleOf, submittedJobOf } from '../src/back/ScheduleMapper'
import { mapJob } from '../src/back/JobMapper'
import { EWrkJobStatus, EWrkRunStatus, EWrkSubsystemStatus } from '../src/common/WrkactjobTypes'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const GI = 1024 ** 3
const MI = 1024 ** 2

const pod = (name: string, node: string, memory: string[], init: string[] = [], over: Partial<V1Pod['status']> = {}): V1Pod => ({
    metadata: { name, namespace: 'payroll' },
    spec: {
        nodeName: node,
        containers: memory.map((m, i) => ({ name: `c${i}`, resources: m ? { requests: { memory: m } } : {} })),
        initContainers: init.map((m, i) => ({ name: `i${i}`, resources: { requests: { memory: m } } }))
    },
    status: { phase: 'Running', containerStatuses: [], ...over }
} as V1Pod)

const pair = (p: V1Pod, usage: { cpu?: number; memory?: number } = {}): IPodJob => ({ pod: p, job: mapJob(p, usage) })

const node = (name: string): V1Node => ({ metadata: { name }, status: { allocatable: { cpu: '3800m', memory: '16Gi', pods: '110' } } })

// ─── quantities ───────────────────────────────────────────────────────────────────────────────────

test('quantityOf: decimal and binary suffixes, exponents, and nonsense as 0', () => {
    assert.equal(quantityOf('3800m'), 3.8)
    assert.equal(quantityOf('16Gi'), 16 * GI)
    assert.equal(quantityOf('1e9'), 1e9)
    assert.equal(quantityOf('2k'), 2000)
    assert.equal(quantityOf('4'), 4)
    assert.equal(quantityOf('12Q'), 0)
    assert.equal(quantityOf('abc'), 0)
    assert.equal(quantityOf(undefined), 0)
})

test('memoryRequestOf: the containers together, or the largest init container if it asks for more', () => {
    assert.equal(memoryRequestOf(pod('a', 'n', ['100Mi', '50Mi'])), 150 * MI)
    assert.equal(memoryRequestOf(pod('a', 'n', ['100Mi'], ['300Mi', '20Mi'])), 300 * MI)
    assert.equal(memoryRequestOf(pod('a', 'n', [''])), 0, 'no request')
    assert.equal(memoryRequestOf({} as V1Pod), 0)
})

// ─── WRKSYSSTS ────────────────────────────────────────────────────────────────────────────────────

test('mapPool: a node with its pods — reserved, failing, restarts, and usage only when there is some', () => {
    const failing = pod('b', 'n1', ['1Gi'], [], { containerStatuses: [{ name: 'c0', image: '', imageID: '', ready: false, restartCount: 4, state: { waiting: { reason: 'CrashLoopBackOff' } } }] })
    const p = mapPool(node('n1'), [pair(pod('a', 'n1', ['512Mi']), { cpu: 1.25, memory: 100 }), pair(failing, { cpu: 0.5 })])
    assert.deepEqual(p, { name: 'n1', cpus: 3.8, memory: 16 * GI, reserved: 1.5 * GI, maxActive: 110, jobs: 2, failing: 1, restarts: 4, cpu: 1.75, memoryUsed: 100 })
    const idle = mapPool({ metadata: {} } as V1Node, [])
    assert.deepEqual([idle.name, idle.cpus, idle.cpu, idle.memoryUsed, idle.jobs], ['', 0, undefined, undefined, 0])
    assert.equal(mapJob(failing).status, EWrkJobStatus.MSGW)
})

test('mapPools: one per node, by name, each with the pods on it', () => {
    const pools = mapPools([node('worker-b'), node('worker-a')], [pair(pod('x', 'worker-a', [])), pair(pod('y', 'worker-a', [])), pair(pod('z', 'worker-b', []))])
    assert.deepEqual(pools.map(p => [p.name, p.jobs]), [['worker-a', 2], ['worker-b', 1]])
})

test('storageOf and cpuOf', () => {
    assert.deepEqual(storageOf([]), { capacity: 0, bound: 0, volumes: 0 })
    assert.deepEqual(storageOf([{ spec: { capacity: { storage: '1Gi' } }, status: { phase: 'Bound' } }, {}]), { capacity: GI, bound: GI, volumes: 2 })
    assert.equal(cpuOf([]), undefined)
    assert.equal(cpuOf([mapJob(pod('a', 'n', [])), mapJob(pod('b', 'n', []), { cpu: 0.333 }), mapJob(pod('c', 'n', []), { cpu: 0.333 })]), 0.67)
})

// ─── WRKSBS / DSPSBSD ─────────────────────────────────────────────────────────────────────────────

test('subsystemStatusOf: Terminating or being deleted is ENDING', () => {
    assert.equal(subsystemStatusOf({ status: { phase: 'Active' } }), EWrkSubsystemStatus.ACTIVE)
    assert.equal(subsystemStatusOf({ status: { phase: 'Terminating' } }), EWrkSubsystemStatus.ENDING)
    assert.equal(subsystemStatusOf({ metadata: { deletionTimestamp: new Date() } }), EWrkSubsystemStatus.ENDING)
    assert.equal(subsystemStatusOf(undefined), EWrkSubsystemStatus.ACTIVE)
})

test('mapSubsystem: its storage is what its pods ask for; its pools, the nodes they run on', () => {
    const s = mapSubsystem({ metadata: { name: 'payroll' } }, [pair(pod('a', 'n2', ['1Gi'])), pair(pod('b', 'n1', ['1Gi'])), pair(pod('c', 'n2', [])), pair(pod('d', '', []))])
    assert.deepEqual(s, { name: 'payroll', status: EWrkSubsystemStatus.ACTIVE, storage: 2 * GI, pools: ['n1', 'n2'], jobs: 4 })
    assert.equal(mapSubsystem({}, []).name, '')
})

test('quotaItemsOf: a row per resource, status.hard first, spec.hard until the controller has seen it', () => {
    assert.deepEqual(quotaItemsOf([
        { metadata: { name: 'q1' }, spec: { hard: { pods: '5' } }, status: { hard: { pods: '10', cpu: '4' }, used: { pods: '3' } } },
        { metadata: { name: 'q2' }, spec: { hard: { secrets: '20' } } },
        {}
    ]), [
        { quota: 'q1', resource: 'cpu', hard: '4', used: '0' },
        { quota: 'q1', resource: 'pods', hard: '10', used: '3' },
        { quota: 'q2', resource: 'secrets', hard: '20', used: '0' }
    ])
})

test('limitItemsOf: a row per type and resource, with what it sets', () => {
    assert.deepEqual(limitItemsOf([
        { metadata: { name: 'lr' }, spec: { limits: [
            { type: 'Container', max: { cpu: '2' }, _default: { memory: '512Mi' }, defaultRequest: { memory: '256Mi' } },
            { type: 'PersistentVolumeClaim', min: { storage: '1Gi' } }
        ] } },
        { spec: { limits: [] } },
        {} as never
    ]), [
        { limitRange: 'lr', type: 'Container', resource: 'cpu', min: '', max: '2', defaultLimit: '', defaultRequest: '' },
        { limitRange: 'lr', type: 'Container', resource: 'memory', min: '', max: '', defaultLimit: '512Mi', defaultRequest: '256Mi' },
        { limitRange: 'lr', type: 'PersistentVolumeClaim', resource: 'storage', min: '1Gi', max: '', defaultLimit: '', defaultRequest: '' }
    ])
})

test('mapDescription: the namespace, its labels and annotations, quotas and limits', () => {
    const ns: V1Namespace = { metadata: { name: 'payroll', creationTimestamp: new Date('2026-01-01T00:00:00Z'), labels: { a: 'b' }, annotations: { c: 'd' } } }
    const d = mapDescription(ns, [pair(pod('a', 'n2', [])), pair(pod('b', 'n1', [])), pair(pod('c', 'n2', []))], [], [])
    assert.deepEqual(d, { name: 'payroll', status: EWrkSubsystemStatus.ACTIVE, created: '2026-01-01T00:00:00.000Z', labels: { a: 'b' }, annotations: { c: 'd' }, pools: ['n1', 'n2'], quotas: [], limits: [] })
    assert.deepEqual(mapDescription({}, [], [], []), { name: '', status: EWrkSubsystemStatus.ACTIVE, created: '', labels: {}, annotations: {}, pools: [], quotas: [], limits: [] })
})

// ─── DSPMSG QSYSOPR ───────────────────────────────────────────────────────────────────────────────

test('mapMessage: the event and what it is about; newest first', () => {
    const e: CoreV1Event = {
        metadata: { namespace: 'payroll' }, involvedObject: { kind: 'Pod', name: 'api-1', namespace: 'payroll' },
        type: 'Warning', reason: 'BackOff', message: 'Back-off', count: 7,
        firstTimestamp: new Date('2026-11-23T09:00:00Z'), lastTimestamp: new Date('2026-11-23T10:00:00Z')
    }
    const m = mapMessage(e)
    assert.deepEqual([m.namespace, m.kind, m.object, m.firstTime, m.time, m.count], ['payroll', 'Pod', 'api-1', '2026-11-23T09:00:00.000Z', '2026-11-23T10:00:00.000Z', 7])
    const node = mapMessage({ metadata: {}, involvedObject: { kind: 'Node', name: 'n1' } })
    assert.deepEqual([node.namespace, node.firstTime], ['', ''])
    const fromMeta = mapMessage({ metadata: { namespace: 'x' }, involvedObject: {} })
    assert.deepEqual([fromMeta.namespace, fromMeta.kind, fromMeta.object], ['x', '', ''])
    assert.deepEqual(sortMessages([m, { ...m, time: '2026-11-24T00:00:00.000Z', reason: 'later' }]).map(x => x.reason), ['later', 'BackOff'])
})

// ─── WRKJOBSCDE ───────────────────────────────────────────────────────────────────────────────────

const cronJob = (over: Partial<V1CronJob['spec']> = {}): V1CronJob => ({
    metadata: { name: 'backup', namespace: 'payroll', uid: 'cj-1', creationTimestamp: new Date('2026-01-01T00:00:00Z') },
    spec: {
        schedule: '0 2 * * *',
        jobTemplate: { metadata: { labels: { app: 'backup' } }, spec: { template: { spec: { serviceAccountName: 'backup-sa', containers: [{ name: 'b', image: 'reg.io/ops/backup:3' }] } } } },
        ...over
    },
    status: { lastScheduleTime: new Date('2026-11-23T02:00:00Z'), lastSuccessfulTime: new Date('2026-11-22T02:05:00Z') }
})

const job = (name: string, owner: string, started: string, conditions: { type: string; status: string }[] = [], manual = false, namespace = 'payroll'): V1Job => ({
    metadata: { name, namespace, ownerReferences: owner ? [{ apiVersion: 'batch/v1', kind: 'CronJob', name: owner, uid: 'x' }] : [], ...(manual ? { annotations: { [MANUAL_ANNOTATION]: 'manual' } } : {}) },
    status: { startTime: new Date(started), conditions: conditions as never }
})

test('runStatusOf and scheduleOf', () => {
    assert.equal(runStatusOf(job('a', 'backup', '2026-11-23T00:00:00Z', [{ type: 'Failed', status: 'True' }])), EWrkRunStatus.FAILED)
    assert.equal(runStatusOf(job('a', 'backup', '2026-11-23T00:00:00Z', [{ type: 'Complete', status: 'True' }])), EWrkRunStatus.SUCCEEDED)
    assert.equal(runStatusOf(job('a', 'backup', '2026-11-23T00:00:00Z', [{ type: 'Complete', status: 'False' }])), EWrkRunStatus.RUNNING)
    assert.equal(runStatusOf({}), EWrkRunStatus.RUNNING)
    assert.equal(scheduleOf(job('a', 'backup', '2026-11-23T00:00:00Z')), 'backup')
    assert.equal(scheduleOf({}), '')
})

test('mapRun: when, how it ended, and whether it was submitted by hand', () => {
    const r = mapRun({ ...job('backup-manual-1', 'backup', '2026-11-23T10:00:00Z', [{ type: 'Complete', status: 'True' }], true), status: { startTime: new Date('2026-11-23T10:00:00Z'), completionTime: new Date('2026-11-23T10:01:00Z'), conditions: [{ type: 'Complete', status: 'True' }] } as never })
    assert.deepEqual(r, { job: 'backup-manual-1', started: '2026-11-23T10:00:00.000Z', completed: '2026-11-23T10:01:00.000Z', status: EWrkRunStatus.SUCCEEDED, manual: true })
    const fresh = mapRun({ metadata: { creationTimestamp: new Date('2026-11-23T11:00:00Z') } })
    assert.deepEqual([fresh.job, fresh.started, fresh.completed, fresh.manual], ['', '2026-11-23T11:00:00.000Z', '', false])
    assert.equal(mapRun({}).started, '')
})

test('mapSchedule: the entry and its own runs, newest first', () => {
    const s = mapSchedule(cronJob({ suspend: true, timeZone: 'Europe/Madrid', concurrencyPolicy: 'Forbid' }), [
        job('backup-1', 'backup', '2026-11-22T02:00:00Z'),
        job('backup-2', 'backup', '2026-11-23T02:00:00Z'),
        job('other-1', 'other', '2026-11-23T03:00:00Z'),
        job('backup-x', 'backup', '2026-11-23T04:00:00Z', [], false, 'vault')
    ])
    assert.deepEqual({ ...s, runs: s.runs.map(r => r.job) }, {
        name: 'backup', namespace: 'payroll', schedule: '0 2 * * *', timeZone: 'Europe/Madrid', held: true, concurrencyPolicy: 'Forbid',
        program: 'backup', user: 'backup-sa', created: '2026-01-01T00:00:00.000Z',
        lastScheduled: '2026-11-23T02:00:00.000Z', lastSuccessful: '2026-11-22T02:05:00.000Z', runs: ['backup-2', 'backup-1']
    })
    const bare = mapSchedule({}, [])
    assert.deepEqual([bare.name, bare.schedule, bare.timeZone, bare.held, bare.concurrencyPolicy, bare.program, bare.user, bare.lastScheduled], ['', '', '', false, 'Allow', '', '', ''])
})

test('submittedJobOf: what kubectl create job --from=cronjob makes — owned, marked manual, a name that fits', () => {
    const j = submittedJobOf(cronJob(), 1_700_000_000_123)
    assert.equal(j.metadata?.name, 'backup-manual-1700000000')
    assert.equal(j.metadata?.namespace, 'payroll')
    assert.deepEqual(j.metadata?.labels, { app: 'backup' })
    assert.deepEqual(j.metadata?.annotations, { [MANUAL_ANNOTATION]: 'manual' })
    assert.deepEqual(j.metadata?.ownerReferences?.[0], { apiVersion: 'batch/v1', kind: 'CronJob', name: 'backup', uid: 'cj-1', controller: true, blockOwnerDeletion: true })
    assert.equal(j.spec?.template.spec?.containers[0].image, 'reg.io/ops/backup:3')
    const long = submittedJobOf({ metadata: { name: 'x'.repeat(80) } }, 1_700_000_000_000)
    assert.equal(long.metadata?.name?.length, 63)
    assert.match(long.metadata?.name ?? '', /^x+-manual-1700000000$/)
    assert.equal(long.metadata?.ownerReferences?.[0].uid, '')
})
