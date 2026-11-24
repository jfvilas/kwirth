import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E5250Aid, E5250Key, GEOMETRY_5250_27X132 } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkPanel, ROLL_LIMIT, WrkSession } from '../src/common/WrkSession'
import { IWrkDataSource } from '../src/common/WrkDataSource'
import {
    EWrkCommand, EWrkError, EWrkJobStatus, EWrkJobType, EWrkMetricsState, EWrkRunStatus, IWrkactjobMessageResponse, IWrkJob, IWrkRequest, IWrkSchedule
} from '../src/common/WrkactjobTypes'
import { nextSubmitOf, scheduleColumnsOf, scheduleDetailsOf, schedulePageSizeOf, scheduleViewsFor, EScheduleView } from '../src/common/panels/ScheduleEntriesPanel'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const job = (name: string, namespace: string, over: Partial<IWrkJob> = {}): IWrkJob => ({
    name, namespace, uid: name, user: 'default', type: EWrkJobType.BCH, status: EWrkJobStatus.RUN, program: 'backup',
    controllerKind: 'Job', controllerName: name, phase: 'Running', node: 'node-a', priorityClass: '', priority: 0,
    restarts: 0, created: '', message: '', containers: [], ...over
})

const JOBS = [job('backup-manual-1700000000-x7k2p', 'payroll'), job('backup-manual-1700000000x-a', 'payroll'), job('api-1', 'payroll', { type: EWrkJobType.ASJ })]

const schedule = (name: string, over: Partial<IWrkSchedule> = {}): IWrkSchedule => ({
    name, namespace: 'payroll', schedule: '0 2 * * *', timeZone: '', held: false, concurrencyPolicy: 'Forbid', program: 'backup', user: 'backup-sa',
    created: '2026-01-01T00:00:00.000Z', lastScheduled: '2026-11-24T02:00:00.000Z', lastSuccessful: '2026-11-24T02:05:00.000Z',
    runs: [
        { job: 'backup-manual-1700000000', started: '2026-11-24T09:00:00.000Z', completed: '', status: EWrkRunStatus.RUNNING, manual: true },
        { job: 'backup-29412360', started: '2026-11-24T02:00:00.000Z', completed: '2026-11-24T02:05:00.000Z', status: EWrkRunStatus.SUCCEEDED, manual: false }
    ],
    ...over
})

const SCHEDULES: IWrkSchedule[] = [
    schedule('backup'),
    schedule('reports', { schedule: '15 6 * * 1-5', held: true, runs: [] }),
    schedule('cleanup', { schedule: '*/10 * * * *', namespace: 'ops', timeZone: 'Europe/Madrid' }),
    schedule('monthly-close', { schedule: '0 0 15 * *', runs: [] })
]

const NOW = new Date('2026-11-24T10:00:00Z').getTime()

const response = (over: Partial<IWrkactjobMessageResponse> = {}): IWrkactjobMessageResponse => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.RESPONSE, type: EInstanceMessageType.DATA, channel: 'wrkactjob',
    instance: 'i1', msgtype: 'wrkactjobmessageresponse', id: 'x', command: EWrkCommand.LIST, ok: true, ...over
})

const settle = () => new Promise(r => setTimeout(r, 0))

const start = async (schedules: IWrkSchedule[] = SCHEDULES, geometry = undefined as typeof GEOMETRY_5250_27X132 | undefined) => {
    const asked: IWrkRequest[] = []
    let refuse: string | undefined
    const source: IWrkDataSource = {
        request: (r: IWrkRequest) => {
            asked.push(r)
            if (refuse) { const detail = refuse; refuse = undefined; return Promise.resolve(response({ ok: false, error: EWrkError.NOT_AUTHORIZED, detail })) }
            switch (r.command) {
                case EWrkCommand.SCHEDULES: return Promise.resolve(response({ command: r.command, schedules }))
                case EWrkCommand.HOLD:
                case EWrkCommand.RELEASE: return Promise.resolve(response({ command: r.command }))
                case EWrkCommand.SUBMIT: return Promise.resolve(response({ command: r.command, submitted: `${r.targetName}-manual-1764000000` }))
                default: return Promise.resolve(response({ jobs: JOBS, metrics: EWrkMetricsState.AVAILABLE }))
            }
        }
    }
    const s = new WrkSession('incluster', source, geometry, () => NOW)
    s.connected()
    await settle()
    const screen = s.terminal.screen
    const text = (row: number) => screen.rowText(row)
    const key = (k: E5250Key, extra: Partial<{ char: string; aid: E5250Aid }> = {}) => s.key({ key: k, ...extra })
    const type = (t: string) => { for (const c of t) key(E5250Key.CHAR, { char: c }) }
    const aid = async (a: E5250Aid) => { key(E5250Key.AID, { aid: a }); await settle() }
    const at = (row: number, col: number) => { screen.cursor = screen.address(row, col) }
    const command = async (t: string) => { at(screen.rows - 4, 6); key(E5250Key.ERASE_EOF); type(t); await aid(E5250Aid.ENTER) }
    // an option in the Opt field of a list row (the first data row is 9)
    const option = (row: number, o: string) => { at(row, 2); type(o) }
    return { s, screen, text, key, type, aid, at, command, option, asked, refuseOnce: (d: string) => { refuse = d } }
}

// ─── pure pieces ──────────────────────────────────────────────────────────────────────────────────

test('columns, next submit and the views', () => {
    assert.deepEqual(scheduleColumnsOf(SCHEDULES[0]), { date: '*ALL', time: '02:00:00', frequency: '*WEEKLY' })
    assert.deepEqual(scheduleColumnsOf(SCHEDULES[2]), { date: '*/10 * * * *', time: '', frequency: '*CRON' })
    assert.equal(nextSubmitOf(SCHEDULES[0], NOW), new Date('2026-11-25T02:00:00Z').getTime())
    assert.equal(nextSubmitOf(schedule('bad', { schedule: 'nonsense' }), NOW), undefined)
    assert.deepEqual(scheduleViewsFor(80), [EScheduleView.SCHEDULE, EScheduleView.NAMES])
    assert.deepEqual(scheduleViewsFor(132), [EScheduleView.WIDE])
    assert.equal(schedulePageSizeOf(24), 9)
})

test('the details: the entry, its schedule in words and as cron, and its submissions', () => {
    const d = scheduleDetailsOf(SCHEDULES[0], NOW)
    assert.equal(d.title, 'Display Job Schedule Entry Details')
    assert.match(d.header, /Job:   BACKUP\s+Subsystem:   payroll/)
    const all = d.lines.join('\n')
    assert.match(all, /Schedule \(cron\) .*: 0 2 \* \* \*/)
    assert.match(all, /Time zone .*: \*SYS \(the controller's, UTC\)/)
    assert.match(all, /Frequency .*: \*WEEKLY/)
    assert.match(all, /Schedule days .*: \*ALL/)
    assert.match(all, /Schedule time .*: 02:00:00/)
    assert.match(all, /Next submit date .*: \d\d\/\d\d\/\d\d/)
    assert.match(all, /backup-manual-1700000000\s+.*ACTIVE\s+\(submitted\)/)
    assert.match(all, /backup-29412360\s+.*COMPLETED/)
    const cron = scheduleDetailsOf(schedule('x', { schedule: '*/10 * * * *', timeZone: 'Europe/Madrid', runs: [], lastScheduled: '', lastSuccessful: '', program: '', user: '' }), NOW).lines.join('\n')
    assert.match(cron, /Frequency .*: \*CRON/)
    assert.doesNotMatch(cron, /Schedule days/)
    assert.match(cron, /Time zone .*: Europe\/Madrid/)
    assert.match(cron, /Last submitted .*: \*NONE/)
    assert.match(cron, /User .*: DEFAULT/)
    assert.match(cron, /Submissions:\n  \*NONE/)
    assert.match(scheduleDetailsOf(schedule('never', { schedule: '0 0 30 2 *' }), NOW).lines.join('\n'), /Next submit date .*: \*NONE/)
})

// ─── the panel ────────────────────────────────────────────────────────────────────────────────────

test('WRKJOBSCDE: the entries in IBM i words, HLD standing out, the legend without 2 or 4', async () => {
    const { s, text, command, asked } = await start()
    await command('wrkjobscde')
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES)
    assert.equal(asked.at(-1)?.command, EWrkCommand.SCHEDULES)
    assert.match(text(0), /Work with Job Schedule Entries\s+INCLUSTER/)
    assert.equal(text(4).trim(), '3=Hold   5=Display details   6=Release')
    assert.equal(text(5).trim(), '8=Work with last submission   10=Submit immediately')
    assert.match(text(6), /-----Schedule------\s+Next/)
    assert.match(text(7), /^ Opt  Job         Status  Date      Time      Frequency   Submit/)
    assert.match(text(9), /^      BACKUP      SCD     \*ALL      02:00:00  \*WEEKLY     11\/2\d\/26/)
    assert.match(text(10), /REPORTS     HLD     \*SELECT   06:15:00  \*WEEKLY/)
    assert.match(text(11), /CLEANUP     SCD     \*\/10 \* \* \* \*\s+\*CRON\s+11\/24\/26/)
    assert.match(text(12), /MONTHLY-CL  SCD     15        00:00:00  \*MONTHLY    12\/1\d\/26/)
    assert.match(text(18), /Bottom/)
    assert.match(text(21), /F3=Exit   F5=Refresh   F11=Display names   F12=Cancel/)
})

test('F11: the subsystem, the full name and the cron; at 132 all at once and no F11', async () => {
    const { text, command, aid } = await start()
    await command('WRKJOBSCDE')
    await aid(E5250Aid.F11)
    assert.match(text(7), /Opt  Job\s+Subsystem\s+Name\s+Cron/)
    assert.match(text(12), /MONTHLY-CL\s+payroll\s+monthly-close\s+0 0 15 \* \*/)
    await aid(E5250Aid.F11)
    assert.match(text(7), /Status/)

    const wide = await start(SCHEDULES, GEOMETRY_5250_27X132)
    await wide.command('WRKJOBSCDE')
    assert.match(wide.text(7), /Frequency   Submit\s+Subsystem\s+Name\s+Cron/)
    assert.match(wide.text(9), /\*WEEKLY .*payroll\s+backup\s+0 2 \* \* \*/)
    assert.doesNotMatch(wide.text(24), /F11/)
    await wide.aid(E5250Aid.F11)
    assert.match(wide.text(26), /Function key not allowed\./)
})

test('3: the HLDJOBSCDE prompt; Enter holds it, the list says so, refreshed', async () => {
    const { s, text, command, aid, option, asked } = await start()
    await command('WRKJOBSCDE')
    option(9, '3')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.PROMPT)
    assert.match(text(0), /Hold Job Schedule Entry \(HLDJOBSCDE\)/)
    assert.match(text(4), /Job name .*BACKUP/)
    assert.match(text(5), /Subsystem .*payroll/)
    await aid(E5250Aid.ENTER)
    assert.deepEqual(asked.at(-2), { command: EWrkCommand.HOLD, targetNamespace: 'payroll', targetName: 'backup' })
    assert.equal(asked.at(-1)?.command, EWrkCommand.SCHEDULES)
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES)
    assert.match(text(23), /Job schedule entry BACKUP held\./)
})

test('6 releases and 10 submits, each through its prompt, in order; F12 on a prompt skips it', async () => {
    const { s, text, command, aid, option, asked } = await start()
    await command('WRKJOBSCDE')
    option(10, '6')
    option(12, '10')
    await aid(E5250Aid.ENTER)
    assert.match(text(0), /Release Job Schedule Entry \(RLSJOBSCDE\)/)
    await aid(E5250Aid.ENTER)
    assert.deepEqual(asked.at(-1), { command: EWrkCommand.RELEASE, targetNamespace: 'payroll', targetName: 'reports' })
    assert.match(text(0), /Submit Job \(SBMJOB\)/)
    assert.match(text(4), /MONTHLY-CLOSE/)
    await aid(E5250Aid.ENTER)
    assert.deepEqual(asked.at(-2), { command: EWrkCommand.SUBMIT, targetNamespace: 'payroll', targetName: 'monthly-close' })
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES)
    assert.match(text(23), /Job monthly-close-manual-1764000000 submitted\./)

    option(9, '10')
    await aid(E5250Aid.ENTER)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES, 'cancelled: nothing submitted')
    assert.notEqual(asked.at(-1)?.command, EWrkCommand.SUBMIT)
})

test('options that cannot run are refused on their field: 4, 2, 3 on HLD, 6 on SCD, 8 with no submission', async () => {
    const { text, command, aid, option, key, asked } = await start()
    await command('WRKJOBSCDE')
    const before = asked.length
    for (const [row, o, message] of [
        [9, '4', /Option 4 not valid\./],
        [9, '2', /Option 2 not valid\./],
        [10, '3', /Job schedule entry REPORTS already held\./],
        [9, '6', /Job schedule entry BACKUP not held\./],
        [10, '8', /No submission for job schedule entry REPORTS\./]
    ] as [number, string, RegExp][]) {
        option(row, o)
        await aid(E5250Aid.ENTER)
        assert.match(text(23), message)
        key(E5250Key.RESET)
        option(row, '  ')
    }
    assert.equal(asked.length, before, 'nothing asked')
})

test('the entry typed on the prompt must be the one chosen; the back saying no stays on the prompt', async () => {
    const { s, text, command, aid, option, key, at, type, refuseOnce } = await start()
    await command('WRKJOBSCDE')
    option(9, '3')
    await aid(E5250Aid.ENTER)
    at(4, 36)
    key(E5250Key.ERASE_EOF)
    type('other')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Job schedule entry OTHER not found\./)
    key(E5250Key.RESET)
    at(4, 36)
    key(E5250Key.ERASE_EOF)
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Job schedule entry \*N not found\./)
    key(E5250Key.RESET)
    at(4, 36)
    type('backup')
    refuseOnce("Not authorized: job schedule entries need the 'wrkactjob$schedule' scope")
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.PROMPT)
    assert.match(text(23), /need the 'wrkactjob\$schedule' scope\s*$/, 'whole on the message line')
    key(E5250Key.RESET)
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
})

test('5: the details; 8: WRKACTJOB with the pods of the last submission, F12 back', async () => {
    const { s, text, command, aid, option } = await start()
    await command('WRKJOBSCDE')
    option(9, '5')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.DISPLAY)
    assert.match(text(0), /Display Job Schedule Entry Details/)
    assert.match(text(2), /Job:   BACKUP/)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES)
    option(9, '8')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    const list = [8, 9, 10, 11].map(text).join('\n')
    assert.match(list, /BACKUP-MAN/)
    assert.equal((list.match(/BACKUP-MAN/g) ?? []).length, 1, "only '<job>-…': not a job whose name merely starts the same")
    assert.doesNotMatch(list, /API-1/)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES)
})

test('roll, F5, Enter, F4, the menu (5), typed on itself, an empty list, a key it does not have', async () => {
    const many = Array.from({ length: 12 }, (_, i) => schedule(`job-${String(i).padStart(2, '0')}`))
    const { s, text, command, aid, key, asked, at, type } = await start(many)
    await command('WRKJOBSCDE')
    assert.match(text(18), /More\.\.\./)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(9), /JOB-09/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    const before = asked.length
    await aid(E5250Aid.F5)
    await aid(E5250Aid.ENTER)
    await command('WRKJOBSCDE')
    assert.equal(asked.length, before + 3)
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES)
    await command('WRKJOBSCDE JOB(X)')
    assert.match(text(23), /Keyword JOB not valid/)
    key(E5250Key.RESET)
    await aid(E5250Aid.F1)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    at(20, 6)
    key(E5250Key.ERASE_EOF)
    type('WRKJOBSCDE')
    await aid(E5250Aid.F4)
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES)
    await aid(E5250Aid.F3)
    await aid(E5250Aid.F3)
    type('5')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SCHEDULE_ENTRIES, 'menu option 5')

    const none = await start([])
    await none.command('WRKJOBSCDE')
    assert.match(none.text(9), /\(No job schedule entries\)/)
})
