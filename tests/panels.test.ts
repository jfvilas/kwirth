import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sdsfPatternMatches } from '../src/common/panels/Wildcard'
import { EPrimaryCommand, parsePrimaryCommand } from '../src/common/panels/PrimaryCommand'
import { ageOf, dpOf, findColumn, posOf, procStepOf, statusOf, stepNameOf, DA_COLUMNS } from '../src/common/panels/DaColumns'
import { columnsFrom, offsetLeftOf } from '../src/common/panels/DaPanel'
import { ESdsfQos, ISdsfPod } from '../src/common/SdsfTypes'

const pod = (over: Partial<ISdsfPod> = {}): ISdsfPod => ({
    name: 'p', namespace: 'n', uid: 'u', jobId: 'STC00001', owner: 'o', controllerKind: '', controllerName: '', qos: ESdsfQos.UNKNOWN,
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

test('step, proc step, status and age', () => {
    const p = pod({ containers: [
        { name: 'init', init: true, image: '', ready: false, restarts: 0, state: 'running', reason: '' },
        { name: 'done', init: true, image: '', ready: true, restarts: 0, state: 'terminated', reason: 'Completed' },
        { name: 'main', init: false, image: '', ready: false, restarts: 0, state: 'waiting', reason: '' }
    ] })
    assert.equal(stepNameOf(p), 'main')
    assert.equal(procStepOf(p), 'init')
    assert.equal(stepNameOf(pod()), '')
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
    assert.equal(findColumn('sio')?.header, 'SIO')
    assert.equal(findColumn('JOBNAME')?.header, 'JOBNAME')
    assert.equal(findColumn('nope'), undefined)
    const pages: string[][] = []
    let offset = 0
    for (;;) {
        const shown = columnsFrom(offset, 80)
        pages.push(shown.map(c => c.column.header))
        if (offset + shown.length >= DA_COLUMNS.length) break
        offset += shown.length
    }
    assert.deepEqual(pages.flat(), DA_COLUMNS.map(c => c.header))
    for (const page of pages) assert.ok(page.length > 0)
    // and PF10 from each page start goes back to the previous one
    let back = offset
    const starts: number[] = []
    while (back > 0) { back = offsetLeftOf(back, 80); starts.push(back) }
    assert.equal(starts[starts.length - 1], 0)
    assert.equal(offsetLeftOf(0, 80), 0)
})
