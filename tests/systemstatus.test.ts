import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E5250Aid, E5250Key, GEOMETRY_5250_27X132 } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkPanel, NO_METRICS, ROLL_LIMIT, WrkSession } from '../src/common/WrkSession'
import { IWrkDataSource } from '../src/common/WrkDataSource'
import { EWrkCommand, EWrkError, EWrkJobStatus, EWrkJobType, EWrkMetricsState, IWrkactjobMessageResponse, IWrkJob, IWrkPool, IWrkRequest, IWrkSystem } from '../src/common/WrkactjobTypes'
import {
    aspPercentOf, ESystemView, gigabytesOf, megabytesOf, NOT_AVAILABLE, poolPageSizeOf, RESTRICTED_MESSAGE, systemColumnsOf, systemViewsFor
} from '../src/common/panels/SystemStatusPanel'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const MIB = 1024 ** 2
const GIB = 1024 ** 3

const job = (name: string): IWrkJob => ({
    name, namespace: 'payroll', uid: name, user: 'default', type: EWrkJobType.ASJ, status: EWrkJobStatus.RUN, program: 'nginx',
    controllerKind: 'ReplicaSet', controllerName: name, phase: 'Running', node: 'node-1', priorityClass: '', priority: 0,
    restarts: 0, created: '', message: '', containers: []
})

const pool = (name: string, over: Partial<IWrkPool> = {}): IWrkPool => ({
    name, cpus: 4, memory: 8 * GIB, reserved: 512 * MIB, maxActive: 110, jobs: 12, failing: 1, restarts: 7, cpu: 3.25, memoryUsed: 2 * GIB, ...over
})

const SYSTEM: IWrkSystem = {
    restricted: false, jobs: 14, cpu: 12.3, metrics: EWrkMetricsState.AVAILABLE,
    pools: [pool('k3d-kwirth-server-0'), pool('k3d-kwirth-agent-0', { cpu: undefined, memoryUsed: undefined })],
    storage: { capacity: 15 * GIB, bound: 10 * GIB, volumes: 2 }
}

const response = (over: Partial<IWrkactjobMessageResponse> = {}): IWrkactjobMessageResponse => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.RESPONSE, type: EInstanceMessageType.DATA, channel: 'wrkactjob',
    instance: 'i1', msgtype: 'wrkactjobmessageresponse', id: 'x', command: EWrkCommand.LIST, ok: true, ...over
})

const settle = () => new Promise(r => setTimeout(r, 0))

const start = async (system: IWrkSystem = SYSTEM, geometry = undefined as typeof GEOMETRY_5250_27X132 | undefined) => {
    let clock = new Date(2026, 10, 24, 10, 0, 0).getTime()
    const asked: IWrkRequest[] = []
    let current = system
    let refuse: string | undefined
    const source: IWrkDataSource = {
        request: (r: IWrkRequest) => {
            asked.push(r)
            if (refuse) { const detail = refuse; refuse = undefined; return Promise.resolve(response({ ok: false, error: EWrkError.FAILED, detail })) }
            return Promise.resolve(r.command === EWrkCommand.SYSTEM
                ? response({ command: r.command, system: current })
                : response({ jobs: [job('api-1')], metrics: current.metrics, clusterCpu: 1 }))
        }
    }
    const s = new WrkSession('incluster', source, geometry, () => clock)
    s.connected()
    await settle()
    const screen = s.terminal.screen
    const text = (row: number) => screen.rowText(row)
    const key = (k: E5250Key, extra: Partial<{ char: string; aid: E5250Aid }> = {}) => s.key({ key: k, ...extra })
    const type = (t: string) => { for (const c of t) key(E5250Key.CHAR, { char: c }) }
    const aid = async (a: E5250Aid) => { key(E5250Key.AID, { aid: a }); await settle() }
    // the command line keeps what was typed after an error, as on IBM i: erased first
    const command = async (t: string, at = screen.address(screen.rows - 4, 6)) => { screen.cursor = at; key(E5250Key.ERASE_EOF); type(t); await aid(E5250Aid.ENTER) }
    return {
        s, screen, text, key, type, aid, command, asked,
        tick: (ms: number) => { clock += ms },
        set: (next: IWrkSystem) => { current = next },
        refuseOnce: (detail: string) => { refuse = detail }
    }
}

// ─── pure pieces ──────────────────────────────────────────────────────────────────────────────────

test('number formats: megabytes, the system ASP and its % used', () => {
    assert.equal(megabytesOf(8 * GIB), '8192.00')
    assert.equal(megabytesOf(undefined), '')
    assert.equal(gigabytesOf(15 * GIB), '15.00 G')
    assert.equal(aspPercentOf(10, 15), '66.6667')
    assert.equal(aspPercentOf(0, 0), '.0000')
})

test('views: three at 80 columns, one wide view at 132; the pool name fills the rest', () => {
    assert.deepEqual(systemViewsFor(80), [ESystemView.FAULTS, ESystemView.ACTIVITY, ESystemView.NAMES])
    assert.deepEqual(systemViewsFor(132), [ESystemView.WIDE])
    const width = (view: ESystemView, cols: number) => systemColumnsOf(view, cols).reduce((n, c) => n + c.width + 2, 1)
    assert.ok(width(ESystemView.FAULTS, 80) <= 80)
    assert.ok(width(ESystemView.ACTIVITY, 80) <= 80)
    assert.equal(width(ESystemView.NAMES, 80), 80 + 1)
    assert.equal(width(ESystemView.WIDE, 132), 132 + 1)
    assert.equal(poolPageSizeOf(24), 9)
    assert.equal(poolPageSizeOf(27), 12)
})

// ─── the panel ────────────────────────────────────────────────────────────────────────────────────

test('WRKSYSSTS: the figures, the pools numbered by name, command line and keys', async () => {
    const { s, text, command, asked } = await start()
    await command('wrksyssts')
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS)
    assert.equal(asked.at(-1)?.command, EWrkCommand.SYSTEM)
    assert.match(text(0), /Work with System Status\s+INCLUSTER/)
    assert.match(text(1), /11\/24\/26  10:00:00/)
    assert.match(text(2), /% CPU used \. .* :\s+12\.3\s+Auxiliary storage:/)
    assert.match(text(3), /Elapsed time .* :\s+00:00:00\s+System ASP .* :\s+15\.00 G/)
    assert.match(text(4), /Jobs in system .* :\s+14\s+% system ASP used .* :\s+66\.6667/)
    assert.match(text(5), /Main storage size \(M\) .* :\s+16384\.00/)
    assert.match(text(7), /System\s+Pool\s+Reserved\s+Max\s+DB\s+Non-DB/)
    assert.match(text(8), /Pool\s+Size \(M\)\s+Size \(M\)\s+Active\s+Fault\s+Fault/)
    assert.match(text(9), /^\s+1\s+8192\.00\s+512\.00\s+110\s+1\s+7\s*$/)
    assert.match(text(10), /^\s+2\s+8192\.00/)
    assert.match(text(18), /Bottom/)
    assert.match(text(19), /Command/)
    assert.match(text(21), /F3=Exit   F4=Prompt   F5=Refresh   F10=Restart   F12=Cancel/)
    assert.match(text(22), /F11=Display activity/)
    assert.ok(text(2).length <= 80)
})

test('F11 rotates faults, activity and pool names; a pool without usage shows blank', async () => {
    const { text, command, aid } = await start()
    await command('WRKSYSSTS')
    await aid(E5250Aid.F11)
    assert.match(text(8), /Pool\s+Size \(M\)\s+Active\s+CPU %\s+Size \(M\)/)
    assert.match(text(9), /^\s+1\s+8192\.00\s+12\s+3\.3\s+2048\.00\s*$/)
    assert.match(text(10), /^\s+2\s+8192\.00\s+12\s*$/)
    assert.match(text(22), /F11=Display pool names/)
    await aid(E5250Aid.F11)
    assert.match(text(8), /Pool\s+Size \(M\)\s+Name/)
    assert.match(text(9), /1\s+8192\.00\s+k3d-kwirth-server-0/)
    await aid(E5250Aid.F11)
    assert.match(text(22), /F11=Display activity/)
})

test('F5 and Enter refresh; F10 and RESET(*YES) restart the elapsed time', async () => {
    const { text, command, aid, tick, asked, screen } = await start()
    await command('WRKSYSSTS')
    tick(65_000)
    await aid(E5250Aid.F5)
    assert.match(text(3), /00:01:05/)
    const before = asked.length
    await aid(E5250Aid.ENTER)
    assert.equal(asked.length, before + 1)
    await aid(E5250Aid.F10)
    assert.match(text(3), /00:00:00/)
    tick(5_000)
    await command('WRKSYSSTS RESET(*NO)', screen.address(20, 6))
    assert.match(text(3), /00:00:05/, 'on itself, it is refreshed')
    await command('WRKSYSSTS RESET(*YES)', screen.address(20, 6))
    assert.match(text(3), /00:00:00/)
})

test('a key below cluster level, D17: *N for what it cannot see, no pools, and the message every time', async () => {
    const { text, command, aid, key } = await start({ restricted: true, jobs: 1, cpu: undefined, metrics: EWrkMetricsState.WARMING, pools: [] })
    await command('WRKSYSSTS')
    assert.match(text(2), /% CPU used .* :\s+\*N/)
    assert.match(text(3), /System ASP .* :\s+\*N/)
    assert.match(text(4), /Jobs in system .* :\s+1\s/)
    assert.match(text(5), /Main storage size \(M\) .* :\s+\*N/)
    assert.match(text(9), /\(No pools to display\)/)
    assert.match(text(23), new RegExp(RESTRICTED_MESSAGE.replace(/\./g, '\\.')))
    key(E5250Key.RESET)
    await aid(E5250Aid.F5)
    assert.match(text(23), /Not authorized to some system values\./)
    assert.equal(NOT_AVAILABLE, '*N')
})

test('without the metrics provider: told once per session, by whichever panel asks first', async () => {
    const { text, command, aid, s } = await start({ ...SYSTEM, cpu: undefined, metrics: EWrkMetricsState.UNAVAILABLE })
    assert.match(text(23), /Metrics provider not installed/, 'the list told it')
    await command('WRKSYSSTS')
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS)
    assert.doesNotMatch(text(23), /Metrics provider/, 'not again')
    assert.match(text(2), /% CPU used .* :\s+\*N/)

    // a session where the list had its CPU and WRKSYSSTS is the first to hear the provider is gone
    const later = await start()
    later.set({ ...SYSTEM, metrics: EWrkMetricsState.UNAVAILABLE })
    await later.command('WRKSYSSTS')
    assert.match(later.text(23), new RegExp(NO_METRICS))
})

test('roll pages the pools; past either end the message says so', async () => {
    const pools = Array.from({ length: 12 }, (_, i) => pool(`node-${String(i).padStart(2, '0')}`))
    const { text, command, aid } = await start({ ...SYSTEM, pools })
    await command('WRKSYSSTS')
    assert.match(text(18), /More\.\.\./)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(9), /^\s+10\s/)
    assert.match(text(18), /Bottom/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
})

test('F3 and F12 go back to where it was called from: WRKACTJOB or the menu', async () => {
    const { s, command, aid, type, text } = await start()
    await command('WRKSYSSTS')
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.MENU)
    type('4')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS)
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.MENU)
    assert.match(text(0), /IBM i Main Menu/)
})

test('its command line: WRKACTJOB leaves it, F4 on WRKSYSSTS runs it, other commands, F11 at 132', async () => {
    const { s, command, aid, type, text, key, screen } = await start()
    await command('WRKSYSSTS')
    await command('WRKSYSSTS JUNK(1)', screen.address(20, 6))
    assert.match(text(23), /Keyword JUNK not valid for this command\./)
    key(E5250Key.RESET)
    await command('WRKSYSSTS RESET(MAYBE)', screen.address(20, 6))
    assert.match(text(23), /Value MAYBE for parameter RESET not valid\./)
    key(E5250Key.RESET)
    await command('WRKSBS', screen.address(20, 6))
    assert.match(text(23), /Command WRKSBS not available yet\./)
    key(E5250Key.RESET)
    screen.cursor = screen.address(20, 6)
    key(E5250Key.ERASE_EOF)
    await aid(E5250Aid.F1)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    screen.cursor = screen.address(20, 6)
    type('WRKSYSSTS')
    await aid(E5250Aid.F4)
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS, 'F4 on a command without a prompt runs it')
    await command('ENDJOB JOB(api-1) OPTION(*IMMED)', screen.address(20, 6))
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS)
    assert.match(text(23), /End of job .* requested\./, 'ended from WRKSYSSTS, it stays there')
    await command('WRKACTJOB', screen.address(20, 6))
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.MENU, 'WRKACTJOB left every panel: F3 is its own')

    const wide = await start(SYSTEM, GEOMETRY_5250_27X132)
    await wide.command('WRKSYSSTS')
    assert.match(wide.text(8), /Size \(M\)\s+Size \(M\)\s+Active\s+Fault\s+Fault\s+Active\s+CPU %\s+Size \(M\)\s+Name/)
    assert.match(wide.text(9), /k3d-kwirth-server-0/)
    assert.doesNotMatch(wide.text(25), /F11/)
    await wide.aid(E5250Aid.F11)
    assert.match(wide.text(26), /Function key not allowed\./)
})

test('the back says no: the error on the panel it was called from', async () => {
    const { s, command, refuseOnce, text, aid, key } = await start()
    refuseOnce('Request failed hard.')
    await command('WRKSYSSTS')
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    assert.match(text(23), /Request failed hard\./)
    key(E5250Key.RESET)
    await command('WRKSYSSTS')
    refuseOnce('Gone.')
    await aid(E5250Aid.F5)
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS)
    assert.match(text(23), /Gone\./)
})
