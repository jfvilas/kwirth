import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E5250Aid, E5250Key, E5250Lock, displayCell5250, E3270Color } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkPanel, WrkSession } from '../src/common/WrkSession'
import { IWrkDataSource } from '../src/common/WrkDataSource'
import { EWrkCommand, EWrkError, EWrkJobStatus, EWrkJobType, EWrkMetricsState, IWrkactjobMessageResponse, IWrkJob, IWrkRequest } from '../src/common/WrkactjobTypes'
import { controlTarget, findFrom, jobLogLine, rulerFrom } from '../src/common/panels/BrowsePanel'
import { attributesOf, EJobAttributes, fileStatusOf, wrap } from '../src/common/panels/JobPanels'
import { jobNumberOf, leader, qualifiedName } from '../src/common/panels/JobIdentity'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const job = (name: string, namespace: string, over: Partial<IWrkJob> = {}): IWrkJob => ({
    name, namespace, uid: '0b8f1c2e-1111-2222-3333-00000000abcd', user: 'payroll-sa', type: EWrkJobType.ASJ, status: EWrkJobStatus.RUN,
    program: 'payroll-api', controllerKind: 'ReplicaSet', controllerName: 'api-7d9f8b6c4', phase: 'Running', node: 'node-1',
    priorityClass: 'high', priority: 1000, restarts: 2, created: '2026-11-01T10:00:00.000Z', message: '',
    containers: [
        { name: 'migrate', init: true, image: 'migrate:1', ready: true, restarts: 0, state: 'terminated', reason: 'Completed', message: '' },
        { name: 'api', init: false, image: 'payroll-api:2', ready: true, restarts: 2, state: 'running', reason: '', message: '' }
    ],
    ...over
})

const API = job('api-7d9f8b6c4-x2kq9', 'payroll', { cpuSeconds: 12.5, memory: 64 * 1048576 })
const NIGHTLY = job('nightly-2915', 'payroll', { type: EWrkJobType.BCH, status: EWrkJobStatus.MSGW, controllerKind: 'Job', controllerName: 'nightly',
    message: 'Container close: CrashLoopBackOff (exit code 137). out of memory while closing the books for the month of November' })
const TWIN_A = job('twin', 'a')
const TWIN_B = job('twin', 'b')
const JOBS = [API, NIGHTLY, TWIN_A, TWIN_B]

const LOG = Array.from({ length: 40 }, (_, i) => `line ${String(i + 1).padStart(2, '0')}${i === 29 ? ' ERROR disk full' : ''}${i === 3 ? ' ' + 'x'.repeat(100) + 'TAIL' : ''}`)

const respond = (r: IWrkRequest, over: Partial<IWrkactjobMessageResponse> = {}): IWrkactjobMessageResponse => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.RESPONSE, type: EInstanceMessageType.DATA, channel: 'wrkactjob',
    instance: 'i1', msgtype: 'wrkactjobmessageresponse', id: 'x', command: r.command, ok: true, ...over
})

const fakeSource = () => {
    const asked: IWrkRequest[] = []
    let refuse: EWrkCommand | undefined
    const source: IWrkDataSource = {
        request: (r: IWrkRequest) => {
            asked.push(r)
            if (r.command === refuse) return Promise.resolve(respond(r, { ok: false, error: EWrkError.NOT_AUTHORIZED, detail: `Ending a job requires the 'wrkactjob$end' scope` }))
            switch (r.command) {
                case EWrkCommand.LOG:
                    return Promise.resolve(respond(r, { lines: LOG }))
                case EWrkCommand.EVENTS:
                    return Promise.resolve(respond(r, { events: [
                        { time: '2026-11-23T10:00:01.000Z', type: 'Normal', reason: 'Pulled', message: 'Image pulled', count: 1, source: 'kubelet' },
                        { time: '2026-11-23T10:00:02.000Z', type: 'Warning', reason: 'BackOff', message: 'Back-off restarting', count: 4, source: 'kubelet' }
                    ] }))
                case EWrkCommand.END:
                    return Promise.resolve(respond(r))
                default:
                    return Promise.resolve(respond(r, { jobs: JOBS, metrics: EWrkMetricsState.AVAILABLE }))
            }
        }
    }
    return { source, asked, refuse: (c: EWrkCommand | undefined) => { refuse = c } }
}

const settle = () => new Promise(r => setTimeout(r, 0))

const start = async () => {
    const fake = fakeSource()
    const s = new WrkSession('incluster', fake.source, undefined, () => Date.UTC(2026, 10, 23))
    s.connected()
    await settle()
    const screen = s.terminal.screen
    const text = (row: number) => screen.rowText(row)
    const key = (k: E5250Key) => s.key({ key: k })
    const type = (t: string) => { for (const c of t) s.key({ key: E5250Key.CHAR, char: c }) }
    const aid = async (a: E5250Aid) => { s.key({ key: E5250Key.AID, aid: a }); await settle(); await settle() }
    const at = (row: number, col: number) => { screen.cursor = screen.address(row, col) }
    // the list row of a subsystem or a job, by the Subsystem/Job column (columns 6 to 18) alone
    const rowOf = (name: string) => Array.from({ length: screen.rows }, (_, r) => text(r)).findIndex((t, r) => r >= 8 && t.slice(6, 19).trim() === name.toUpperCase().slice(0, 10))
    const option = (name: string, opt: string) => { at(rowOf(name), 2); type(opt) }
    const command = (t: string) => { at(20, 6); key(E5250Key.ERASE_EOF); type(t) }
    return { s, screen, text, key, type, aid, at, rowOf, option, command, ...fake }
}

// ─── pure pieces ──────────────────────────────────────────────────────────────────────────────────

test('job identity: a six-digit number from the uid, number/user/name, and the dot leaders', () => {
    assert.equal(jobNumberOf('0b8f1c2e-1111-2222-3333-00000000abcd'), String(0xabcd).padStart(6, '0'))
    assert.equal(jobNumberOf(''), '000000')
    assert.equal(jobNumberOf('zz'), '000000')
    assert.equal(qualifiedName(API), '043981/PAYROLL-SA/API-7D9F8B')
    assert.equal(qualifiedName(job('x', 'y', { user: '' })), '043981/DEFAULT/X')
    assert.equal(leader('Job name', 20, false), 'Job name . . . .    ')
    assert.equal(leader('Subsystem', 20), 'Subsystem  . . .  : ')
    // the dots line up from one label to the next
    assert.equal(leader('Job name', 30).indexOf('.', 12), leader('Subsystem', 30).indexOf('.', 12))
    assert.ok(leader('A long label', 20).endsWith(' : '))
})

test('the attributes panels: status and definition, from the LIST alone', () => {
    const status = Object.fromEntries(attributesOf(API, EJobAttributes.STATUS))
    assert.equal(status['Current status'], 'RUN')
    assert.equal(status['Subsystem'], 'payroll')
    assert.equal(status['CPU used (seconds)'], '12.5')
    assert.equal(status['Memory (working set)'], '64 MB')
    assert.equal(status['Entered system'].slice(0, 8), '11/01/26')
    const bare = Object.fromEntries(attributesOf(job('b', 'c', { created: '' }), EJobAttributes.STATUS))
    assert.deepEqual([bare['CPU used (seconds)'], bare['Memory (working set)'], bare['Entered system']], ['', '', ''])
    const definition = attributesOf(API, EJobAttributes.DEFINITION)
    assert.deepEqual(Object.fromEntries(definition.slice(0, 6)), {
        'User (service account)': 'payroll-sa', 'Job type': 'ASJ', 'Started by': 'ReplicaSet api-7d9f8b6c4',
        'Priority class': 'high', 'Priority': '1000', 'Program': 'PGM-payroll-api'
    })
    assert.deepEqual(definition.slice(6), [['Containers', 'migrate (init): migrate:1'], ['', 'api: payroll-api:2']])
    const lonely = Object.fromEntries(attributesOf(job('b', 'c', { controllerKind: '', priorityClass: '', program: '' }), EJobAttributes.DEFINITION))
    assert.deepEqual([lonely['Started by'], lonely['Priority class'], lonely['Program']], ['Nobody: a bare pod', '*NONE', ''])
})

test('wrap: at blanks, and a word longer than the line cut', () => {
    assert.deepEqual(wrap('one two three', 7), ['one two', 'three'])
    assert.deepEqual(wrap('abcdefghij', 4), ['abcd', 'efgh', 'ij'])
    assert.deepEqual(wrap('', 5), [])
})

test('the spooled file status: OPN while the container writes, RDY when it is done', () => {
    assert.equal(fileStatusOf(API.containers[1]), 'OPN')
    assert.equal(fileStatusOf(API.containers[0]), 'RDY')
})

test('the browse: ruler, control values, find and the job log line', () => {
    assert.equal(rulerFrom(0, 20), '*...+....1....+....2')
    assert.equal(rulerFrom(39, 12), '4....+....5.')
    assert.equal(rulerFrom(40, 6), '....+.')
    assert.equal(controlTarget('t', 10, 100, 16), 0)
    assert.equal(controlTarget('B', 10, 100, 16), 84)
    assert.equal(controlTarget('+5', 10, 100, 16), 15)
    assert.equal(controlTarget('-50', 10, 100, 16), 0)
    assert.equal(controlTarget('30', 0, 100, 16), 29)
    assert.equal(controlTarget('999', 0, 100, 16), 84)
    assert.equal(controlTarget('B', 0, 5, 16), 0, 'shorter than a page: the bottom is the top')
    assert.equal(controlTarget('X', 0, 100, 16), undefined)
    assert.equal(findFrom(['a', 'b ERR', 'c', 'd err'], 1, 'err'), 3)
    assert.equal(findFrom(['a', 'b ERR'], 1, 'err'), 1, 'wrapping round to itself')
    assert.equal(findFrom(['a'], 0, 'zz'), undefined)
    assert.equal(jobLogLine({ time: '2026-11-23T10:00:02.000Z', type: 'Warning', reason: 'BackOff', message: 'Back-off', count: 4, source: '' }), '10:00:02  Warning  BackOff: Back-off (x4)')
    assert.equal(jobLogLine({ time: '', type: '', reason: 'R', message: 'm', count: 1, source: '' }), '                   R: m', 'no time, no type: blanks in their place')
})

// ─── options on the list ──────────────────────────────────────────────────────────────────────────

test('option on a subsystem row, and 7 on a job not in MSGW, are refused on their field', async () => {
    const { s, at, type, aid, text, key, rowOf, screen } = await start()
    at(rowOf('PAYROLL'), 2)
    type('4')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Option 4 not valid for a subsystem\./)
    assert.equal(screen.cursor, screen.address(rowOf('PAYROLL'), 2))
    key(E5250Key.RESET)
    key(E5250Key.ERASE_INPUT)
    at(rowOf('API-7D9F8B'), 2)
    type('7')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /No messages to display for job API-7D9F8B\./)
    assert.equal(s.terminal.lock, E5250Lock.HOST_ERROR)
})

test('4: the ENDJOB prompt; Enter ends the job with its DELAY, and the list says so, refreshed', async () => {
    const { s, option, aid, text, asked, screen } = await start()
    option('API-7D9F8B', '4')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.PROMPT)
    assert.match(text(0), /End Job \(ENDJOB\)/)
    assert.match(text(2), /Type choices, press Enter\./)
    assert.match(text(4), /Job name \. \. \..*API-7D9F8B6C4-X2KQ9\s+Name/)
    assert.match(text(5), /Subsystem +\. .* : +payroll/)
    assert.match(text(6), /How to end .*\*CNTRLD\s+\*CNTRLD, \*IMMED/)
    assert.match(text(7), /Controlled end delay time .*30\s+Seconds/)
    assert.equal(screen.cursor, screen.address(4, 36), 'on the first field')
    await aid(E5250Aid.ENTER)
    assert.deepEqual(asked.find(r => r.command === EWrkCommand.END), { command: EWrkCommand.END, targetNamespace: 'payroll', targetName: 'api-7d9f8b6c4-x2kq9', delay: 30, immediate: false })
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    assert.match(text(23), /End of job 043981\/PAYROLL-SA\/API-7D9F8B requested\./)
    assert.equal(asked.filter(r => r.command === EWrkCommand.LIST).length, 2, 'the list asked for again')
})

test('4 with *IMMED; wrong values are reported on their own field', async () => {
    const { s, option, aid, text, key, type, at, asked, screen } = await start()
    option('API-7D9F8B', '4')
    await aid(E5250Aid.ENTER)
    at(6, 36); key(E5250Key.ERASE_EOF); type('*xyz')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Value \*XYZ for parameter OPTION not valid\./)
    assert.equal(screen.cursor, screen.address(6, 36))
    key(E5250Key.RESET)
    at(6, 36); key(E5250Key.ERASE_EOF); type('*immed')
    at(7, 36); key(E5250Key.ERASE_EOF); type('0')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Value 0 for parameter DELAY not valid: 1 to 999999\./)
    key(E5250Key.RESET)
    at(7, 36); key(E5250Key.ERASE_EOF); type('5')
    at(4, 36); key(E5250Key.ERASE_EOF); type('nope')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Job NOPE not found\./)
    key(E5250Key.RESET)
    at(4, 36); key(E5250Key.ERASE_EOF); type('api-7d9f8b6c4-x2kq9')
    await aid(E5250Aid.ENTER)
    assert.deepEqual(asked.filter(r => r.command === EWrkCommand.END).at(-1), { command: EWrkCommand.END, targetNamespace: 'payroll', targetName: 'api-7d9f8b6c4-x2kq9', delay: 5, immediate: true })
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
})

test('4 without permission: the back\'s reason on the prompt, nothing ended, Reset and F12 back', async () => {
    const { s, option, aid, text, key, refuse } = await start()
    refuse(EWrkCommand.END)
    option('API-7D9F8B', '4')
    await aid(E5250Aid.ENTER)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.PROMPT)
    assert.match(text(23), /Ending a job requires the 'wrkactjob\$end' scope/)
    assert.equal(s.terminal.lock, E5250Lock.HOST_ERROR)
    key(E5250Key.RESET)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
})

test('several options run in order, each when the previous is left; F3 leaves them all', async () => {
    const { s, option, aid, text } = await start()
    option('API-7D9F8B', '5')
    option('NIGHTLY-29', '7')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.WORK_WITH_JOB)
    assert.match(text(2), /Job:   API-7D9F8B   User:   PAYROLL-SA   Number:   043981/)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.MESSAGES, 'the next option')
    assert.match(text(2), /Job \. \. :   NIGHTLY-29   Subsystem \. \. :   payroll/)
    assert.match(text(6), /Container close: CrashLoopBackOff \(exit code 137\)/)
    assert.equal(displayCell5250(s.terminal.screen, s.terminal.screen.address(6, 4)).color, E3270Color.WHITE)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS, 'the last one left: back to the list')

    option('API-7D9F8B', '5')
    option('NIGHTLY-29', '7')
    await aid(E5250Aid.ENTER)
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS, 'F3: nothing else runs')
})

test('5: Work with Job — status and definition attributes, then back; a wrong selection', async () => {
    const { s, option, aid, text, type, key } = await start()
    option('API-7D9F8B', '5')
    await aid(E5250Aid.ENTER)
    assert.match(text(0), /Work with Job/)
    assert.match(text(1), /System:   INCLUSTER/)
    assert.match(text(6), /1\. Display job status attributes/)
    assert.match(text(9), /10\. Display job log/)
    type('1')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.ATTRIBUTES)
    assert.match(text(0), /Display Job Status Attributes/)
    assert.match(text(5), /Current status +\. .* : +RUN/)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.WORK_WITH_JOB)
    type('2')
    await aid(E5250Aid.ENTER)
    assert.match(text(0), /Display Job Definition Attributes/)
    assert.match(text(10), /Containers +\. .* : +migrate \(init\): migrate:1/)
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    await aid(E5250Aid.F12)
    type('9')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Selection 9 not valid\./)
    key(E5250Key.RESET)
    key(E5250Key.ERASE_INPUT)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.WORK_WITH_JOB, 'nothing selected: it stays')
    await aid(E5250Aid.F1)
    assert.match(text(23), /Function key not allowed\./)
})

test('5 then 4 and 10: spooled files and the job log from WRKJOB', async () => {
    const { s, option, aid, text, type, asked } = await start()
    option('API-7D9F8B', '5')
    await aid(E5250Aid.ENTER)
    type('4')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SPOOLED_FILES)
    await aid(E5250Aid.F12)
    type('10')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.BROWSE)
    assert.deepEqual(asked.at(-1), { command: EWrkCommand.EVENTS, targetNamespace: 'payroll', targetName: 'api-7d9f8b6c4-x2kq9' })
    assert.match(text(0), /Display Job Log/)
    assert.match(text(1), /Job   \. \. \. \. \. :   api-7d9f8b6c4-x2kq9/)
    assert.match(text(6), /10:00:02  Warning  BackOff: Back-off restarting \(x4\)/)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.WORK_WITH_JOB)
})

test('8: the spooled files; 5 displays one; a wrong option; nothing typed stays', async () => {
    const { s, option, aid, text, type, at, key, asked } = await start()
    option('API-7D9F8B', '8')
    await aid(E5250Aid.ENTER)
    assert.match(text(0), /Work with Job Spooled Files/)
    assert.match(text(7), /Opt  File        Nbr  Status  Restarts  Image/)
    assert.match(text(8), /MIGRATE\s+1\s+RDY\s+0\s+migrate:1/)
    assert.match(text(9), /API\s+2\s+OPN\s+2\s+payroll-api:2/)
    at(9, 2)
    type('3')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Option 3 not valid\./)
    key(E5250Key.RESET)
    key(E5250Key.ERASE_INPUT)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SPOOLED_FILES)
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    at(9, 2)
    type('5')
    await aid(E5250Aid.ENTER)
    assert.deepEqual(asked.at(-1), { command: EWrkCommand.LOG, targetNamespace: 'payroll', targetName: 'api-7d9f8b6c4-x2kq9', containerName: 'api' })
    assert.equal(s.panel, EWrkPanel.BROWSE)
    assert.match(text(0), /Display Spooled File/)
    assert.match(text(1), /File  \. \. \. \. \. :   api\s+Page\/Line   1\/1/)
    assert.match(text(2), /Columns     1 - 78/)
    assert.match(text(4), /^ \*\.\.\.\+\.\.\.\.1/)
    assert.match(text(5), /line 01/)
    assert.match(text(21), /More\.\.\. $/)
})

test('DSPSPLF: roll, control, find, F16 and F19/F20; F3 out of everything', async () => {
    const { s, option, aid, text, type, at, key } = await start()
    option('API-7D9F8B', '8')
    await aid(E5250Aid.ENTER)
    at(9, 2); type('5')
    await aid(E5250Aid.ENTER)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(5), /line 17/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(5), /line 33/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), /beyond first or last record/)
    at(2, 21); type('t')
    await aid(E5250Aid.ENTER)
    assert.match(text(5), /line 01/)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(23), /beyond first or last record/)
    at(2, 21); type('b')
    await aid(E5250Aid.ENTER)
    assert.match(text(5), /line 25/)
    assert.match(text(21), /Bottom $/)
    at(2, 21); type('+x')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Control value \+X not valid\./)
    key(E5250Key.RESET)
    key(E5250Key.ERASE_EOF)
    at(2, 21); type('1')
    await aid(E5250Aid.ENTER)
    at(3, 21); type('disk full')
    await aid(E5250Aid.ENTER)
    assert.match(text(5), /line 30 ERROR disk full/)
    assert.match(text(1), /Page\/Line   1\/30/)
    await aid(E5250Aid.F16)
    assert.match(text(5), /line 30/, 'found again, wrapping round to the same line')
    at(3, 21); key(E5250Key.ERASE_EOF); type('nothing like it')
    await aid(E5250Aid.F16)
    assert.match(text(23), /String nothing like it not found\./)
    at(3, 21); key(E5250Key.ERASE_EOF)
    await aid(E5250Aid.F16)
    assert.match(text(23), /Type the string to find, then press F16\./)
    key(E5250Key.RESET)
    at(2, 21); type('4')
    await aid(E5250Aid.ENTER)
    await aid(E5250Aid.F20)
    assert.match(text(2), /Columns     40 - 117/)
    assert.match(text(4), /^ 4\.\.\.\.\+\.\.\.\.5/)
    await aid(E5250Aid.F20)
    await aid(E5250Aid.F19)
    await aid(E5250Aid.F19)
    await aid(E5250Aid.F19)
    assert.match(text(2), /Columns     1 - 78/)
    await aid(E5250Aid.F1)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.BROWSE, 'Enter with nothing typed stays')
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
})

test('an empty spooled file, and a log the back refuses', async () => {
    const fake = fakeSource()
    const real = fake.source.request
    let empty = true
    fake.source.request = (r: IWrkRequest) => r.command === EWrkCommand.LOG
        ? Promise.resolve(empty ? respond(r, {}) : respond(r, { ok: false, error: EWrkError.NOT_FOUND }))
        : real(r)
    const s = new WrkSession('x', fake.source)
    s.connected()
    await settle()
    const screen = s.terminal.screen
    const row = Array.from({ length: 24 }, (_, r) => screen.rowText(r)).findIndex(t => t.includes('API-7D9F8B'))
    screen.cursor = screen.address(row, 2)
    s.key({ key: E5250Key.CHAR, char: '8' })
    s.key({ key: E5250Key.AID, aid: E5250Aid.ENTER })
    await settle()
    screen.cursor = screen.address(9, 2)
    s.key({ key: E5250Key.CHAR, char: '5' })
    s.key({ key: E5250Key.AID, aid: E5250Aid.ENTER })
    await settle(); await settle()
    assert.match(screen.rowText(5), /\(Nothing to display\)/)
    assert.match(screen.rowText(1), /Page\/Line   1\/0/)
    s.key({ key: E5250Key.AID, aid: E5250Aid.F12 })
    empty = false
    screen.cursor = screen.address(9, 2)
    s.key({ key: E5250Key.CHAR, char: '5' })
    s.key({ key: E5250Key.AID, aid: E5250Aid.ENTER })
    await settle(); await settle()
    assert.equal(s.panel, EWrkPanel.SPOOLED_FILES)
    assert.match(screen.rowText(23), /Job not found\./)
})

// ─── commands ─────────────────────────────────────────────────────────────────────────────────────

test('ENDJOB on the command line ends straight away; an ambiguous or missing name says so', async () => {
    const { s, command, aid, text, key, asked } = await start()
    command('endjob job(api-7d9f8b6c4-x2kq9) option(*immed)')
    await aid(E5250Aid.ENTER)
    assert.deepEqual(asked.filter(r => r.command === EWrkCommand.END).at(-1), { command: EWrkCommand.END, targetNamespace: 'payroll', targetName: 'api-7d9f8b6c4-x2kq9', delay: 30, immediate: true })
    assert.match(text(23), /End of job .*API-7D9F8B requested\./)
    command('endjob job(twin)')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /More than one job named TWIN: select it from the list\./)
    key(E5250Key.RESET)
    command('endjob')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Value for parameter JOB required\./)
    key(E5250Key.RESET)
    command('endjob job(x) foo(1)')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Keyword FOO not valid for this command\./)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
})

test('WRKJOB on the command line opens Work with Job; F4 prompts ENDJOB and WRKJOB with what was typed', async () => {
    const { s, command, aid, text, key, type, at, asked } = await start()
    command('wrkjob job(nightly-2915)')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.WORK_WITH_JOB)
    assert.match(text(2), /NIGHTLY-29/)
    await aid(E5250Aid.F3)
    command('wrkjob job(nope)')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Job NOPE not found\./)
    key(E5250Key.RESET)

    command('endjob job(api-7d9f8b6c4-x2kq9) delay(120)')
    await aid(E5250Aid.F4)
    assert.equal(s.panel, EWrkPanel.PROMPT)
    assert.match(text(4), /API-7D9F8B6C4-X2KQ9/)
    assert.match(text(5), /How to end .*\*CNTRLD/, 'no subsystem line: the prompt did not come from a row')
    assert.match(text(6), /Controlled end delay time .*120/)
    await aid(E5250Aid.ENTER)
    assert.equal(asked.filter(r => r.command === EWrkCommand.END).at(-1)?.delay, 120)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)

    command('wrkjob')
    await aid(E5250Aid.F4)
    assert.match(text(0), /Work with Job \(WRKJOB\)/)
    assert.equal(s.terminal.screen.cursor, s.terminal.screen.address(4, 36), 'on the empty Job name')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Value for parameter JOB required\./)
    key(E5250Key.RESET)
    at(4, 36); type('nightly-2915')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.WORK_WITH_JOB)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS, 'the prompt was replaced: F12 goes to the list')

    command('dspmsg')
    await aid(E5250Aid.F4)
    assert.match(text(23), /Command DSPMSG cannot be prompted here\./)
    key(E5250Key.RESET)
    command('')
    await aid(E5250Aid.F4)
    assert.match(text(23), /Type a command, then press F4 to prompt it\./)
    key(E5250Key.RESET)
    command('x y')
    await aid(E5250Aid.F4)
    assert.match(text(23), /Parameter Y not valid for command X\./)
    key(E5250Key.RESET)
    command('endjob job(api-7d9f8b6c4-x2kq9)')
    await aid(E5250Aid.F4)
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
})

test('from the menu: WRKJOB and F4 open over it, and leaving them comes back to the menu', async () => {
    const { s, aid, type, text, asked } = await start()
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.MENU)
    type('wrkjob job(nightly-2915)')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.WORK_WITH_JOB)
    const lists = asked.filter(r => r.command === EWrkCommand.LIST).length
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.MENU)
    assert.equal(asked.filter(r => r.command === EWrkCommand.LIST).length, lists, 'no list asked for on the menu')
    type('endjob')
    await aid(E5250Aid.F4)
    assert.equal(s.panel, EWrkPanel.PROMPT)
    assert.match(text(0), /End Job \(ENDJOB\)/)
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.MENU)
    type('signoff')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SIGNED_OFF)
})
