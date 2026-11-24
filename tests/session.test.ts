import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E5250Aid, E5250Key, E5250Lock, GEOMETRY_5250_27X132, displayCell5250, E3270Color } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkPanel, NO_METRICS, ROLL_LIMIT, WrkSession } from '../src/common/WrkSession'
import { IWrkDataSource } from '../src/common/WrkDataSource'
import { EWrkCommand, EWrkError, EWrkJobStatus, EWrkJobType, EWrkMetricsState, IWrkactjobMessageResponse, IWrkJob, IWrkRequest } from '../src/common/WrkactjobTypes'
import { EWrkView, columnsOf, nameOf, percentOf, rowsFrom, viewsFor } from '../src/common/panels/ActiveJobsPanel'
import { genericMatches, parseCl } from '../src/common/panels/ClCommand'
import { dateTimeOf, elapsedOf } from '../src/common/panels/WrkLayout'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const job = (name: string, namespace: string, over: Partial<IWrkJob> = {}): IWrkJob => ({
    name, namespace, uid: name, user: 'default', type: EWrkJobType.ASJ, status: EWrkJobStatus.RUN, program: 'nginx',
    controllerKind: 'ReplicaSet', controllerName: name, phase: 'Running', node: 'node-1', priorityClass: '', priority: 0,
    restarts: 0, created: '', message: '', containers: [], ...over
})

const JOBS: IWrkJob[] = [
    job('coredns-7c6f', 'kube-system', { user: 'coredns', program: 'coredns', cpu: 0.1, cpuSeconds: 12.5 }),
    job('api-7d9f8b6c4-x2kq9', 'payroll', { user: 'payroll-sa', program: 'payroll-api', cpu: 1.2, restarts: 2 }),
    job('nightly-2915', 'payroll', { type: EWrkJobType.BCH, status: EWrkJobStatus.MSGW, program: 'nightly-close' }),
    job('kube-proxy-x', 'kube-system', { type: EWrkJobType.SYS, status: EWrkJobStatus.DEQW, cpu: 0 })
]

const response = (over: Partial<IWrkactjobMessageResponse> = {}): IWrkactjobMessageResponse => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.RESPONSE, type: EInstanceMessageType.DATA, channel: 'wrkactjob',
    instance: 'i1', msgtype: 'wrkactjobmessageresponse', id: 'x', command: EWrkCommand.LIST, ok: true, ...over
})

// A source that answers LIST with `jobs`, or with what `next` says once.
const fakeSource = (jobs: IWrkJob[] = JOBS) => {
    const asked: IWrkRequest[] = []
    let next: (() => Promise<IWrkactjobMessageResponse>) | undefined
    const source: IWrkDataSource = {
        request: (r: IWrkRequest) => {
            asked.push(r)
            if (next) { const n = next; next = undefined; return n() }
            return Promise.resolve(response({ jobs, metrics: EWrkMetricsState.AVAILABLE, clusterCpu: 12.3 }))
        }
    }
    return { source, asked, answerOnce: (f: () => Promise<IWrkactjobMessageResponse>) => { next = f } }
}

const settle = () => new Promise(r => setTimeout(r, 0))

const NOW = new Date(2026, 10, 23, 19, 42, 7).getTime()

const start = async (jobs: IWrkJob[] = JOBS, geometry = undefined as typeof GEOMETRY_5250_27X132 | undefined) => {
    let clock = NOW
    const fake = fakeSource(jobs)
    const s = new WrkSession('incluster', fake.source, geometry, () => clock)
    s.connected()
    await settle()
    const screen = s.terminal.screen
    const text = (row: number) => screen.rowText(row)
    const all = () => Array.from({ length: screen.rows }, (_, r) => text(r)).join('\n')
    const key = (k: E5250Key, extra: Partial<{ char: string; aid: E5250Aid }> = {}) => s.key({ key: k, ...extra })
    const type = (t: string) => { for (const c of t) key(E5250Key.CHAR, { char: c }) }
    const aid = async (a: E5250Aid) => { key(E5250Key.AID, { aid: a }); await settle() }
    const tick = (ms: number) => { clock += ms }
    return { s, screen, text, all, key, type, aid, tick, ...fake }
}

// ─── pure pieces ──────────────────────────────────────────────────────────────────────────────────

test('parseCl: a verb and keyword parameters, upper case; anything else is not valid', () => {
    assert.deepEqual(parseCl(' wrkactjob sbs(payroll)   job(api*) '), { verb: 'WRKACTJOB', params: { SBS: 'PAYROLL', JOB: 'API*' } })
    assert.deepEqual(parseCl('SIGNOFF'), { verb: 'SIGNOFF', params: {} })
    assert.equal(parseCl('WRKACTJOB PAYROLL').error, 'Parameter PAYROLL not valid for command WRKACTJOB.')
    assert.deepEqual(parseCl(''), { verb: '', params: {} })
})

test('genericMatches: IBM i generic names, any case', () => {
    assert.ok(genericMatches('', 'x'))
    assert.ok(genericMatches('*ALL', 'x'))
    assert.ok(genericMatches('API*', 'api-7d9f'))
    assert.ok(!genericMatches('API*', 'web'))
    assert.ok(genericMatches('PAYROLL', 'payroll'))
    assert.ok(!genericMatches('PAY', 'payroll'))
})

test('rowsFrom: subsystems in order, each followed by its jobs; a filter keeps subsystems with jobs only', () => {
    const rows = rowsFrom(JOBS)
    assert.deepEqual(rows.map(nameOf), ['KUBE-SYSTE', '  COREDNS-7C', '  KUBE-PROXY', 'PAYROLL', '  API-7D9F8B', '  NIGHTLY-29'])
    assert.deepEqual(rowsFrom(JOBS, { subsystem: 'PAYROLL', job: '' }).map(nameOf), ['PAYROLL', '  API-7D9F8B', '  NIGHTLY-29'])
    assert.deepEqual(rowsFrom(JOBS, { subsystem: '', job: 'NIGHTLY*' }).map(nameOf), ['PAYROLL', '  NIGHTLY-29'])
    assert.deepEqual(rowsFrom(JOBS, { subsystem: 'NOPE', job: '' }), [])
})

test('the columns: a subsystem row sums its jobs; IBM i number formats', () => {
    assert.equal(percentOf(undefined), '')
    assert.equal(percentOf(0), '.0')
    assert.equal(percentOf(0.04), '.0')
    assert.equal(percentOf(12.34), '12.3')
    const [sbs] = rowsFrom(JOBS)
    const cell = (view: EWrkView, heading: string) => columnsOf(view, 80).find(c => c.heading === heading)!.value(sbs)
    assert.equal(cell(EWrkView.STATUS, 'Type'), 'SBS')
    assert.equal(cell(EWrkView.STATUS, 'CPU %'), '.1')
    assert.equal(cell(EWrkView.STATUS, 'Status'), 'DEQW')
    assert.equal(cell(EWrkView.STATUS, 'User'), '')
    assert.equal(cell(EWrkView.STATUS, 'Function'), '')
    assert.equal(cell(EWrkView.ELAPSED, 'CPU'), '12.5')
    assert.equal(cell(EWrkView.ELAPSED, 'AuxIO'), '0')
    assert.equal(cell(EWrkView.ELAPSED, 'Pool'), '')
    assert.equal(cell(EWrkView.ELAPSED, 'Pty'), '')
    assert.equal(rowsFrom([job('x', 'y')])[0] && columnsOf(EWrkView.ELAPSED, 80).find(c => c.heading === 'CPU')!.value(rowsFrom([job('x', 'y')])[0]), '')
    assert.deepEqual(viewsFor(80), [EWrkView.STATUS, EWrkView.ELAPSED, EWrkView.NAMES])
    assert.deepEqual(viewsFor(132), [EWrkView.STATUS, EWrkView.NAMES])
    assert.ok(columnsOf(EWrkView.STATUS, 132).some(c => c.heading === 'Pool'), 'at 132 the status view carries the elapsed data')
})

test('dates and spans as IBM i writes them', () => {
    assert.equal(dateTimeOf(NOW), '11/23/26  19:42:07')
    assert.equal(elapsedOf(3_725_000), '01:02:05')
    assert.equal(elapsedOf(-5), '00:00:00')
})

// ─── the session ──────────────────────────────────────────────────────────────────────────────────

test('it opens on WRKACTJOB with the keyboard waiting for Kwirth, and lists when the instance is there', async () => {
    const fake = fakeSource()
    const s = new WrkSession('incluster', fake.source, undefined, () => NOW)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    assert.equal(s.terminal.lock, E5250Lock.SYSTEM)
    assert.match(s.terminal.screen.rowText(0), /Work with Active Jobs/)
    assert.equal(fake.asked.length, 0)
    s.connected()
    await settle()
    assert.deepEqual(fake.asked, [{ command: EWrkCommand.LIST }])
    assert.equal(s.terminal.lock, E5250Lock.NONE)
})

test('WRKACTJOB: title, system, date, statistics, legend, headings, rows, Bottom, command line and keys', async () => {
    const { text, screen } = await start()
    assert.match(text(0), /^\s+Work with Active Jobs\s+INCLUSTER $/)
    assert.match(text(1), /11\/23\/26  19:42:07 $/)
    assert.match(text(2), /CPU %:\s+12\.3\s+Elapsed time:\s+00:00:00\s+Active jobs:\s+4/)
    assert.match(text(4), /Type options, press Enter\./)
    assert.match(text(5), /4=End   5=Work with   7=Display message   8=Work with spooled files/)
    assert.match(text(7), /Opt  Subsystem\/Job  User        Type  CPU %  Function         Status/)
    assert.match(text(8), /KUBE-SYSTE\s+SBS\s+\.1\s+DEQW/)
    // a job two to the right of its subsystem; User under its heading, at column 21
    assert.match(text(9), /^ {8}COREDNS-7C {3}COREDNS {5}ASJ\s+\.1  PGM-COREDNS\s+RUN/)
    assert.equal(text(9).indexOf('COREDNS '), text(7).indexOf('User'))
    assert.match(text(13), /NIGHTLY-29 .*BCH .*PGM-NIGHTLY-CLO\s+MSGW/)
    assert.match(text(18), /Bottom $/)
    assert.match(text(19), /Parameters or command/)
    assert.match(text(20), /^ ===>/)
    assert.match(text(21), /F3=Exit   F5=Refresh   F7=Find   F10=Restart statistics/)
    assert.match(text(22), /F11=Display elapsed data   F12=Cancel/)
    // an Opt field on every row, underlined; the cursor on the first
    assert.equal(screen.inputFields().length, 7)
    assert.equal(screen.cursor, screen.address(8, 2))
    assert.ok(displayCell5250(screen, screen.address(8, 2)).underscore)
    // MSGW stands out in white; the rest is green
    assert.equal(displayCell5250(screen, screen.address(13, text(13).indexOf('MSGW'))).color, E3270Color.WHITE)
    assert.equal(displayCell5250(screen, screen.address(12, text(12).indexOf('RUN'))).color, E3270Color.GREEN)
})

test('option 9 is not valid: the message on the error line, the keyboard locked, the cursor on it; Reset frees it', async () => {
    const { s, type, key, aid, text, screen } = await start()
    key(E5250Key.TAB)
    type('9')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Option 9 not valid\./)
    assert.equal(s.terminal.lock, E5250Lock.HOST_ERROR)
    assert.equal(screen.cursor, screen.address(9, 2))
    key(E5250Key.RESET)
    assert.equal(s.terminal.lock, E5250Lock.NONE)
    assert.equal(text(23).trim(), '')
    assert.equal(screen.fieldValue(screen.fieldAt(screen.address(9, 2))!), '9', 'the option stays typed')
})

test('WRKACTJOB SBS() JOB() on the command line filters; an unknown keyword or command says so', async () => {
    const { s, key, type, aid, text, asked, screen } = await start()
    const toCommand = () => { s.terminal.screen.cursor = screen.address(20, 6) }
    toCommand()
    type('wrkactjob sbs(payroll)')
    await aid(E5250Aid.ENTER)
    assert.match(text(8), /PAYROLL/)
    assert.doesNotMatch(text(9), /COREDNS/)
    assert.equal(asked.length, 2)
    toCommand()
    type('wrkactjob job(nightly*)')
    await aid(E5250Aid.ENTER)
    assert.match(text(9), /NIGHTLY-29/)
    assert.equal(text(10).trim(), '')
    toCommand()
    type('wrkactjob foo(x)')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Keyword FOO not valid for this command\./)
    key(E5250Key.RESET)
    key(E5250Key.ERASE_INPUT)
    toCommand()
    type('dspmsg')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Command DSPMSG not available yet\./, 'PRD-fase3: known, its panel comes in S10')
    key(E5250Key.RESET)
    key(E5250Key.ERASE_INPUT)
    toCommand()
    type('wrkfoo')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Command WRKFOO in library \*LIBL not found\./)
    assert.equal(screen.cursor, screen.address(20, 6), 'the cursor on the command line')
    key(E5250Key.RESET)
    key(E5250Key.ERASE_INPUT)
    toCommand()
    type('wrkactjob x')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Parameter X not valid for command WRKACTJOB\./)
})

test('an empty filter result says so', async () => {
    const { s, type, aid, text, screen } = await start()
    s.terminal.screen.cursor = screen.address(20, 6)
    type('wrkactjob sbs(nope)')
    await aid(E5250Aid.ENTER)
    assert.match(text(8), /\(No active jobs to display\)/)
    assert.equal(screen.cursor, screen.address(20, 6), 'no Opt fields: the cursor on the command line')
})

test('F11 rotates the views: elapsed data, then the full names, then the status again', async () => {
    const { aid, text } = await start()
    await aid(E5250Aid.F11)
    assert.match(text(7), /Type  Pool\s+Pty\s+CPU  AuxIO/)
    assert.match(text(9), /COREDNS-7C\s+ASJ\s+NODE-1\s+12\.5/)
    assert.match(text(22), /F11=Display names/)
    await aid(E5250Aid.F11)
    assert.match(text(7), /Namespace\s+Pod/)
    assert.match(text(12), /payroll\s+api-7d9f8b6c4-x2kq9/)
    await aid(E5250Aid.F11)
    assert.match(text(7), /User\s+Type\s+CPU %/)
})

test('27x132: more list rows, and the status view carries the elapsed data', async () => {
    const { text, screen } = await start(JOBS, GEOMETRY_5250_27X132)
    assert.equal(screen.cols, 132)
    assert.match(text(7), /Status\s+Pool\s+Pty\s+CPU\s+AuxIO/)
    assert.match(text(27 - 4), /^ ===>/)
    assert.match(text(27 - 6), /Bottom $/, '13 list rows: 8 to 20, Bottom on 21')
})

test('Roll Up and Roll Down page the list; past either end the message says so', async () => {
    const many = Array.from({ length: 25 }, (_, i) => job(`job-${String(i).padStart(2, '0')}`, 'batch'))
    const { aid, text } = await start(many)
    assert.match(text(8), /BATCH/)
    assert.match(text(18), /More\.\.\. $/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(8), /JOB-09/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(8), /JOB-19/)
    assert.match(text(18), /Bottom $/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), new RegExp(ROLL_LIMIT.replace(/\./g, '\\.')))
    await aid(E5250Aid.ROLL_DOWN)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(8), /BATCH/)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(23), /beyond first or last record/)
})

test('F7 finds the string typed on the command line, wrapping round; not found says so', async () => {
    const many = Array.from({ length: 25 }, (_, i) => job(`job-${String(i).padStart(2, '0')}`, 'batch'))
    const { s, key, type, aid, text, screen } = await start(many)
    s.terminal.screen.cursor = screen.address(20, 6)
    type('job-22')
    await aid(E5250Aid.F7)
    assert.match(text(8), /JOB-22/)
    key(E5250Key.ERASE_INPUT)
    s.terminal.screen.cursor = screen.address(20, 6)
    type('nothing')
    await aid(E5250Aid.F7)
    assert.match(text(23), /String NOTHING not found\./)
    key(E5250Key.RESET)
    key(E5250Key.ERASE_INPUT)
    await aid(E5250Aid.F7)
    assert.match(text(23), /Type the string to find/)
})

test('F5 refreshes; F10 restarts the statistics', async () => {
    const { aid, text, tick, asked } = await start()
    tick(65_000)
    await aid(E5250Aid.F5)
    assert.equal(asked.length, 2)
    assert.match(text(2), /Elapsed time:\s+00:01:05/)
    await aid(E5250Aid.F10)
    assert.equal(asked.length, 3)
    assert.match(text(2), /Elapsed time:\s+00:00:00/)
    await aid(E5250Aid.ENTER)
    assert.equal(asked.length, 4, 'Enter with nothing typed refreshes too')
})

test('F3 and F12 go to the Main Menu; 1 comes back; F3 on the menu signs off; any key signs on again', async () => {
    const { s, type, aid, text, asked } = await start()
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.MENU)
    assert.match(text(0), /MAIN\s+IBM i Main Menu/)
    assert.match(text(1), /System:   INCLUSTER/)
    assert.match(text(5), /1\. Work with active jobs/)
    assert.match(text(6), /2\. Work with subsystems/)
    assert.match(text(7), /3\. Display operator messages/)
    assert.match(text(8), /4\. Work with system status/)
    assert.match(text(9), /5\. Work with job schedule entries/)
    assert.equal(text(10).trim(), '', 'a blank line above sign off, as on IBM i')
    assert.match(text(11), /90\. Sign off/)
    assert.match(text(19), /Selection or command/)
    type('1')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    assert.equal(asked.length, 2)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.MENU)
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
    s.key({ key: E5250Key.RESET })
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.MENU, 'nothing typed: the menu again')
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.SIGNED_OFF)
    assert.match(text(5), /Your job has ended\./)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.MENU)
    type('90')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SIGNED_OFF)
})

test('SIGNOFF on the WRKACTJOB command line; a function key WRKACTJOB does not have', async () => {
    const { s, type, aid, text, screen, key } = await start()
    await aid(E5250Aid.F1)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    s.terminal.screen.cursor = screen.address(20, 6)
    type('signoff')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SIGNED_OFF)
})

test('the back says no, or does not answer: the error on the error line, the list as it was', async () => {
    const { s, aid, text, answerOnce, key } = await start()
    answerOnce(() => Promise.resolve(response({ ok: false, error: EWrkError.NOT_AUTHORIZED, detail: 'Your key does not reach it' })))
    await aid(E5250Aid.F5)
    assert.match(text(23), /Your key does not reach it/)
    assert.match(text(9), /COREDNS/)
    key(E5250Key.RESET)
    answerOnce(() => Promise.resolve(response({ ok: false, error: EWrkError.FAILED })))
    await aid(E5250Aid.F5)
    assert.match(text(23), /Request failed\./)
    key(E5250Key.RESET)
    answerOnce(() => Promise.reject(new Error('The connection to Kwirth was lost.')))
    await aid(E5250Aid.F5)
    assert.match(text(23), /Kwirth did not respond: The connection to Kwirth was lost\./)
    assert.equal(s.terminal.lock, E5250Lock.HOST_ERROR)
    key(E5250Key.RESET)
    answerOnce(() => Promise.reject('plain'))
    await aid(E5250Aid.F5)
    assert.match(text(23), /Kwirth did not respond: plain/)
})

test('without the metrics provider the message says so once; no CPU figures', async () => {
    const fake = fakeSource()
    fake.answerOnce(() => Promise.resolve(response({ jobs: [job('a', 'b')], metrics: EWrkMetricsState.UNAVAILABLE })))
    const s = new WrkSession('x', fake.source, undefined, () => NOW)
    s.connected()
    await settle()
    assert.match(s.terminal.screen.rowText(23), new RegExp(NO_METRICS))
    assert.match(s.terminal.screen.rowText(2), /CPU %:\s+Elapsed/)
    fake.answerOnce(() => Promise.resolve(response({ jobs: [job('a', 'b')], metrics: EWrkMetricsState.UNAVAILABLE })))
    s.key({ key: E5250Key.AID, aid: E5250Aid.F5 })
    await settle()
    assert.equal(s.terminal.screen.rowText(23).trim(), '', 'said once')
})

test('listeners hear every repaint; a disposed session does nothing more', async () => {
    const { s, aid } = await start()
    let heard = 0
    const off = s.subscribe(() => heard++)
    await aid(E5250Aid.F11)
    assert.ok(heard > 0)
    off()
    const before = heard
    await aid(E5250Aid.F11)
    assert.equal(heard, before)
    s.dispose()
    s.key({ key: E5250Key.AID, aid: E5250Aid.F3 })
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    s.connected()
})
