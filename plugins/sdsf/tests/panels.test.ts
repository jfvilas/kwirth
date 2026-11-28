import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sdsfPatternMatches } from '../src/common/panels/Wildcard'
import { EPrimaryCommand, parsePrimaryCommand } from '../src/common/panels/PrimaryCommand'
import { ageOf, dpOf, findColumn, posOf, procStepOf, statusOf, mainContainerOf, DA_COLUMNS, JOBNAME_COLUMN } from '../src/common/panels/DaColumns'
import { columnsFrom, offsetLeftOf } from '../src/common/panels/DaPanel'
import { daFilterMatches, daPositionOf, daTypeOf, DEFAULT_DA_FILTER, EDaPosition, EDaType, parseDaParameters } from '../src/common/panels/DaFilter'
import { ESdsfQos, ISdsfPod } from '../src/common/SdsfTypes'

const pod = (over: Partial<ISdsfPod> = {}): ISdsfPod => ({
    name: 'p', namespace: 'n', uid: 'u', jobId: 'STC00001', owner: 'o', controllerKind: '', controllerName: '', workload: 'p', step: '', qos: ESdsfQos.UNKNOWN,
    phase: 'Running', ready: true, deleting: false, reason: '', priorityClass: '', priority: 0, restarts: 0, node: '', created: '', containers: [],
    ...over
})

test('SDSF wildcards: * any string, % one character, no case, whole name', () => {
    assert.equal(sdsfPatternMatches('', 'x'), true)
    assert.equal(sdsfPatternMatches('*', 'x'), true)
    assert.equal(sdsfPatternMatches('API*', 'api-1'), true)
    assert.equal(sdsfPatternMatches('API*', 'web-api'), false)
    assert.equal(sdsfPatternMatches('*API*', 'web-api-2'), true)
    assert.equal(sdsfPatternMatches('API-%', 'api-1'), true)
    assert.equal(sdsfPatternMatches('API-%', 'api-12'), false)
    assert.equal(sdsfPatternMatches('API', 'api'), true)
    assert.equal(sdsfPatternMatches('API', 'api-1'), false)
    assert.equal(sdsfPatternMatches('a.b', 'axb'), false, 'regex characters are literal')
    assert.equal(sdsfPatternMatches('a(b', 'a(b'), true)
})

test('primary commands: verbs, abbreviations, arguments and quoted strings', () => {
    assert.deepEqual(parsePrimaryCommand('   '), { verb: EPrimaryCommand.NONE, args: [], text: '' })
    assert.equal(parsePrimaryCommand('da').verb, EPrimaryCommand.DA)
    assert.deepEqual(parsePrimaryCommand(' pre api* ').args, ['api*'])
    assert.equal(parsePrimaryCommand('pre x').verb, EPrimaryCommand.PREFIX)
    assert.equal(parsePrimaryCommand('own x').verb, EPrimaryCommand.OWNER)
    assert.equal(parsePrimaryCommand('bot').verb, EPrimaryCommand.BOTTOM)
    assert.equal(parsePrimaryCommand('retr').verb, EPrimaryCommand.RETRIEVE)
    assert.deepEqual(parsePrimaryCommand("f 'two words'").args, ['two words'])
    assert.deepEqual(parsePrimaryCommand('f "two words" next').args, ['two words', 'next'])
    assert.deepEqual(parsePrimaryCommand('sort sio d').args, ['sio', 'd'])
    assert.deepEqual(parsePrimaryCommand('&10'), { verb: EPrimaryCommand.AUTO, args: ['10'], text: '&10' })
    assert.deepEqual(parsePrimaryCommand('&').args, [])
    assert.equal(parsePrimaryCommand('&x').verb, EPrimaryCommand.INVALID)
    assert.deepEqual(parsePrimaryCommand('25'), { verb: EPrimaryCommand.AMOUNT, args: ['25'], text: '25' })
    assert.equal(parsePrimaryCommand('m').verb, EPrimaryCommand.AMOUNT)
    assert.equal(parsePrimaryCommand('max').verb, EPrimaryCommand.AMOUNT)
    assert.equal(parsePrimaryCommand('listcat').verb, EPrimaryCommand.INVALID)
})

test('Pos codes', () => {
    assert.equal(posOf(pod()), 'IN')
    assert.equal(posOf(pod({ ready: false })), 'LO')
    assert.equal(posOf(pod({ phase: 'Pending' })), 'NS')
    assert.equal(posOf(pod({ phase: 'Succeeded' })), 'END')
    assert.equal(posOf(pod({ phase: 'Failed' })), 'ABN')
    assert.equal(posOf(pod({ phase: 'Unknown' })), '??')
    assert.equal(posOf(pod({ deleting: true })), 'TRM')
})

test('DP from the priority', () => {
    assert.equal(dpOf(2000001000), 'FF')
    assert.equal(dpOf(1000000000), 'FE')
    assert.equal(dpOf(1000), 'F8')
    assert.equal(dpOf(0), 'F0')
    assert.equal(dpOf(-5), 'C0')
})

test('main container, proc step (the container at work), status and age', () => {
    const p = pod({ containers: [
        { name: 'init', init: true, image: '', ready: false, restarts: 0, state: 'running', reason: '' },
        { name: 'done', init: true, image: '', ready: true, restarts: 0, state: 'terminated', reason: 'Completed' },
        { name: 'main', init: false, image: '', ready: false, restarts: 0, state: 'waiting', reason: '' }
    ] })
    assert.equal(mainContainerOf(p), 'main')
    assert.equal(procStepOf(p), 'init', 'an init container still at work')
    const started = { ...p, containers: p.containers.map(c => c.init ? { ...c, state: 'terminated' } : c) }
    assert.equal(procStepOf(started), 'main', 'the inits done: the main one')
    assert.equal(mainContainerOf(pod()), '')
    assert.equal(procStepOf(pod()), '')
    assert.equal(statusOf(pod({ reason: 'CrashLoopBackOff' })), 'CrashLoopBackOff')
    assert.equal(statusOf(pod({ deleting: true, reason: 'x' })), 'Terminating')
    assert.equal(statusOf(pod()), 'Running')
    const now = Date.parse('2026-11-22T12:00:00Z')
    assert.equal(ageOf('', now), '')
    assert.equal(ageOf('2026-11-22T11:59:30Z', now), '30s')
    assert.equal(ageOf('2026-11-22T11:30:00Z', now), '30m')
    assert.equal(ageOf('2026-11-22T07:00:00Z', now), '5h')
    assert.equal(ageOf('2026-11-19T12:00:00Z', now), '3d')
})

test('columns: findColumn ignores case; the pages of PF11 cover every column once', () => {
    const all = [JOBNAME_COLUMN, ...DA_COLUMNS]
    assert.equal(findColumn('sio', all)?.header, 'SIO')
    assert.equal(findColumn('JOBNAME', all)?.header, 'JOBNAME')
    assert.equal(findColumn('nope', all), undefined)
    const pages: string[][] = []
    let offset = 0
    for (;;) {
        const shown = columnsFrom(offset, 80, DA_COLUMNS)
        pages.push(shown.map(c => c.column.header))
        if (offset + shown.length >= DA_COLUMNS.length) break
        offset += shown.length
    }
    assert.deepEqual(pages.flat(), DA_COLUMNS.map(c => c.header))
    for (const page of pages) assert.ok(page.length > 0)
    // and PF10 from each page start goes back to exactly the previous one, page by page, as PF11 came
    const forward: number[] = []
    for (let o = 0; ; ) {
        forward.push(o)
        const n = columnsFrom(o, 80, DA_COLUMNS).length
        if (o + n >= DA_COLUMNS.length) break
        o += n
    }
    const backward: number[] = [forward[forward.length - 1]]
    while (backward[backward.length - 1] > 0) backward.push(offsetLeftOf(backward[backward.length - 1], 80, DA_COLUMNS))
    assert.deepEqual(backward.reverse(), forward)
    assert.equal(offsetLeftOf(0, 80, DA_COLUMNS), 0)
    // from the middle of a page (a page start of another width), to the start of the page it falls in
    assert.equal(offsetLeftOf(forward[1] + 1, 80, DA_COLUMNS), forward[1])
})

// ─── SYSLOG format (S6) ───────────────────────────────────────────────────────

import { eventColor, isFailure, syslogLine, timeOf, yydddOf } from '../src/common/panels/SyslogFormat'
import { E3270Color } from '@jfvilas/kwirth-dce-blockterm'
import { ISdsfEvent } from '../src/common/SdsfTypes'

const ev = (over: Partial<ISdsfEvent> = {}): ISdsfEvent => ({
    time: '2026-11-22T11:32:32.447Z', type: 'Normal', reason: 'Scheduled', message: 'assigned', namespace: 'shop',
    kind: 'Pod', name: 'api-1', uid: 'u', count: 3, source: 'scheduler', ...over
})

test('SYSLOG dates and times: yyddd and hh:mm:ss.th, UTC', () => {
    assert.equal(yydddOf('2026-01-01T00:00:00Z'), '26001')
    assert.equal(yydddOf('2026-11-22T23:59:59Z'), '26326')
    assert.equal(yydddOf('2024-12-31T12:00:00Z'), '24366', 'leap year')
    assert.equal(yydddOf('nonsense'), '     ')
    assert.equal(timeOf('2026-11-22T11:32:32.447Z'), '11:32:32.44')
    assert.equal(timeOf(''), '           ')
})

test('SYSLOG line: type, system, date, time, JobID, count and the event', () => {
    assert.equal(syslogLine(ev(), 'k3d-dev-cluster', 'STC00042'), 'N K3D-DEV- 26326 11:32:32.44 STC00042 00000003  Scheduled pod/shop/api-1: assigned')
    assert.equal(syslogLine(ev({ type: 'Warning', kind: 'Node', namespace: '', name: 'n1', count: 12 }), 'c', ''),
        'W C        26326 11:32:32.44          00000012  Scheduled node/n1: assigned')
})

test('SYSLOG colours: green Normal, yellow Warning, red a failing Warning', () => {
    assert.equal(eventColor(ev()), E3270Color.GREEN)
    assert.equal(eventColor(ev({ type: 'Warning', reason: 'ScalingReplicaSet' })), E3270Color.YELLOW)
    for (const reason of ['BackOff', 'Failed', 'FailedMount', 'Unhealthy', 'Evicted', 'OOMKilling', 'Killing']) {
        assert.equal(isFailure(ev({ type: 'Warning', reason })), true, reason)
    }
    assert.equal(isFailure(ev({ type: 'Normal', reason: 'Killing' })), false, 'a Normal is never a failure')
})

// ─── ST columns (S7) ──────────────────────────────────────────────────────────

import { durationOf, jobStatusOf, queueOf, ST_COLUMNS } from '../src/common/panels/JobColumns'
import { ESdsfJobState, ESdsfObjectKind, ISdsfJob } from '../src/common/SdsfTypes'

const job = (over: Partial<ISdsfJob> = {}): ISdsfJob => ({
    kind: ESdsfObjectKind.JOB, name: 'j', namespace: 'n', uid: 'u', jobId: 'JOB00001', owner: 'o', cronJob: '', workload: 'j', step: '', schedule: '',
    state: ESdsfJobState.RUNNING, parallelism: 1, completions: 3, active: 1, succeeded: 1, failed: 0,
    start: '2026-11-22T11:00:00.000Z', end: '', ...over
})

test('ST Queue and Status in JES terms', () => {
    assert.equal(queueOf(job()), 'EXECUTION')
    assert.equal(queueOf(job({ state: ESdsfJobState.COMPLETE })), 'PRINT')
    assert.equal(queueOf(job({ state: ESdsfJobState.FAILED })), 'PRINT')
    assert.equal(queueOf(job({ state: ESdsfJobState.SCHEDULED })), 'INPUT')
    assert.equal(queueOf(job({ state: ESdsfJobState.SUSPENDED })), 'HOLD')
    assert.equal(queueOf(job({ state: ESdsfJobState.WAITING })), 'INPUT', 'a Job not started waits on the input queue')
    assert.equal(jobStatusOf(job({ state: ESdsfJobState.WAITING })), 'WAITING')
    assert.equal(jobStatusOf(job()), 'ACTIVE 1/3')
    assert.equal(jobStatusOf(job({ completions: 0, succeeded: 0 })), 'ACTIVE 0/1', 'no completions set: one')
    assert.equal(jobStatusOf(job({ state: ESdsfJobState.COMPLETE, succeeded: 3 })), 'COMPLETE 3/3')
    assert.equal(jobStatusOf(job({ state: ESdsfJobState.FAILED, failed: 6 })), 'FAILED 6')
    assert.equal(jobStatusOf(job({ state: ESdsfJobState.SCHEDULED, active: 0 })), 'SCHEDULED')
    assert.equal(jobStatusOf(job({ state: ESdsfJobState.SCHEDULED, active: 2 })), 'SCHEDULED 2 ACT')
    assert.equal(jobStatusOf(job({ state: ESdsfJobState.SUSPENDED })), 'SUSPENDED')
})

test('ST duration: running till now, ended till the end, nothing for a CronJob', () => {
    const now = Date.parse('2026-11-22T11:00:45Z')
    assert.equal(durationOf(job(), now), '45s')
    assert.equal(durationOf(job({ end: '2026-11-22T11:30:00.000Z' }), now), '30m')
    assert.equal(durationOf(job({ end: '2026-11-22T14:00:00.000Z' }), now), '3h')
    assert.equal(durationOf(job({ start: '' }), now), '')
    assert.equal(durationOf(job({ kind: ESdsfObjectKind.CRONJOB }), now), '')
    assert.deepEqual(ST_COLUMNS.map(c => c.header), ['StepName', 'JobID', 'Owner', 'Prty', 'Queue', 'C', 'Status', 'Age', 'Schedule', 'CronJob', 'Dur', 'Namespace', 'JobName'])
})

test('DA types and positions of a pod', () => {
    assert.equal(daTypeOf(pod({ controllerKind: 'Job' })), EDaType.JOB)
    assert.equal(daTypeOf(pod({ controllerKind: 'ReplicaSet' })), EDaType.STC)
    assert.equal(daTypeOf(pod({ controllerKind: 'StatefulSet' })), EDaType.STC)
    assert.equal(daTypeOf(pod({ controllerKind: 'DaemonSet' })), EDaType.INIT)
    assert.equal(daTypeOf(pod({ controllerKind: '' })), EDaType.TSU)
    assert.equal(daPositionOf(pod()), EDaPosition.IN)
    assert.equal(daPositionOf(pod({ ready: false })), EDaPosition.TRANS)
    assert.equal(daPositionOf(pod({ deleting: true })), EDaPosition.TRANS)
    assert.equal(daPositionOf(pod({ phase: 'Pending', ready: false, node: '' })), EDaPosition.OUT)
    assert.equal(daPositionOf(pod({ phase: 'Pending', ready: false, node: 'node-1' })), EDaPosition.READY)
    assert.equal(daPositionOf(pod({ phase: 'Unknown' })), EDaPosition.TRANS)
    assert.equal(daPositionOf(pod({ phase: 'Succeeded' })), undefined)
    assert.equal(daPositionOf(pod({ phase: 'Failed' })), undefined)
})

test('DA parameters: the DADFLT, include, only, no, all; four at most, one O, ALL alone, last one wins', () => {
    assert.deepEqual(parseDaParameters([]), DEFAULT_DA_FILTER)
    assert.deepEqual(DEFAULT_DA_FILTER.types, [EDaType.STC, EDaType.TSU, EDaType.JOB])
    assert.deepEqual(DEFAULT_DA_FILTER.positions, [EDaPosition.IN, EDaPosition.OUT, EDaPosition.TRANS, EDaPosition.READY])
    assert.equal(DEFAULT_DA_FILTER.ended, false)

    assert.deepEqual(parseDaParameters(['init'])?.types, [EDaType.STC, EDaType.TSU, EDaType.JOB, EDaType.INIT])
    assert.deepEqual(parseDaParameters(['NOREADY', 'READY'])?.positions, [EDaPosition.IN, EDaPosition.OUT, EDaPosition.TRANS, EDaPosition.READY])
    assert.deepEqual(parseDaParameters(['JOB'])?.types, DEFAULT_DA_FILTER.types, 'including one already there changes nothing')
    assert.deepEqual(parseDaParameters(['ojob'])?.types, [EDaType.JOB])
    assert.deepEqual(parseDaParameters(['OSTC'])?.types, [EDaType.STC])
    assert.deepEqual(parseDaParameters(['OTSU'])?.types, [EDaType.TSU])
    assert.deepEqual(parseDaParameters(['OINIT'])?.types, [EDaType.INIT])
    assert.deepEqual(parseDaParameters(['OIN'])?.positions, [EDaPosition.IN])
    assert.deepEqual(parseDaParameters(['OOUT'])?.positions, [EDaPosition.OUT])
    assert.deepEqual(parseDaParameters(['OTRANS'])?.positions, [EDaPosition.TRANS])
    assert.deepEqual(parseDaParameters(['OREADY'])?.positions, [EDaPosition.READY])
    const oinNotsu = parseDaParameters(['OIN', 'NOTSU'])
    assert.deepEqual(oinNotsu?.positions, [EDaPosition.IN])
    assert.deepEqual(oinNotsu?.types, [EDaType.STC, EDaType.JOB])
    assert.deepEqual(parseDaParameters(['NOSTC', 'NOJOB'])?.types, [EDaType.TSU])
    assert.deepEqual(parseDaParameters(['NOIN'])?.positions, [EDaPosition.OUT, EDaPosition.TRANS, EDaPosition.READY])
    assert.deepEqual(parseDaParameters(['NOOUT', 'NOTRANS', 'NOREADY'])?.positions, [EDaPosition.IN])
    assert.deepEqual(parseDaParameters(['NOINIT']), DEFAULT_DA_FILTER)
    assert.deepEqual(parseDaParameters(['JOB', 'NOJOB'])?.types, [EDaType.STC, EDaType.TSU], 'the last one wins')
    assert.deepEqual(parseDaParameters(['NOJOB', 'JOB'])?.types, [EDaType.STC, EDaType.TSU, EDaType.JOB], 'the last one wins')

    assert.deepEqual(parseDaParameters(['ALL']), { types: Object.values(EDaType), positions: Object.values(EDaPosition), ended: true })
    assert.deepEqual(parseDaParameters(['allt']), { ...DEFAULT_DA_FILTER, types: Object.values(EDaType) })
    assert.deepEqual(parseDaParameters(['ALLP']), { ...DEFAULT_DA_FILTER, positions: Object.values(EDaPosition), ended: true })

    assert.equal(parseDaParameters(['ALL', 'JOB']), undefined, 'ALL goes alone')
    assert.equal(parseDaParameters(['NOTSU', 'ALLP']), undefined, 'ALLP goes alone')
    assert.equal(parseDaParameters(['OJOB', 'OIN']), undefined, 'one O at most')
    assert.equal(parseDaParameters(['JOB', 'STC', 'TSU', 'INIT', 'IN']), undefined, 'four at most')
    assert.notEqual(parseDaParameters(['JOB', 'STC', 'TSU', 'INIT']), undefined)
    assert.equal(parseDaParameters(['XYZ']), undefined)
    assert.equal(parseDaParameters(['NOXYZ']), undefined)
    assert.equal(parseDaParameters(['OXYZ']), undefined)
    assert.deepEqual(parseDaParameters(['OUT'])?.positions, DEFAULT_DA_FILTER.positions, 'OUT is a position, not O+UT')
})

test('DA filter on a pod: type and position, the ended ones only with ALL or ALLP', () => {
    const all = parseDaParameters(['ALL'])!
    const ended = pod({ phase: 'Succeeded', controllerKind: 'Job' })
    assert.equal(daFilterMatches(DEFAULT_DA_FILTER, pod({ controllerKind: 'ReplicaSet' })), true)
    assert.equal(daFilterMatches(DEFAULT_DA_FILTER, pod({ controllerKind: 'DaemonSet' })), false)
    assert.equal(daFilterMatches(DEFAULT_DA_FILTER, pod({ phase: 'Pending', node: 'n1' })), true, 'a pod starting on its node stays')
    assert.equal(daFilterMatches(parseDaParameters(['NOREADY'])!, pod({ phase: 'Pending', node: 'n1' })), false)
    assert.equal(daFilterMatches(DEFAULT_DA_FILTER, ended), false)
    assert.equal(daFilterMatches(all, ended), true)
    assert.equal(daFilterMatches(all, pod({ controllerKind: 'DaemonSet' })), true)
    assert.equal(daFilterMatches(parseDaParameters(['ALLP'])!, ended), true)
    assert.equal(daFilterMatches(parseDaParameters(['OIN'])!, ended), false)
})
