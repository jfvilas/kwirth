import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E5250Aid, E5250Key, GEOMETRY_5250_27X132 } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkPanel, ROLL_LIMIT, WrkSession } from '../src/common/WrkSession'
import { IWrkDataSource } from '../src/common/WrkDataSource'
import {
    EWrkCommand, EWrkError, EWrkJobStatus, EWrkJobType, EWrkMetricsState, EWrkSubsystemStatus, IWrkactjobMessageResponse, IWrkJob, IWrkRequest,
    IWrkSubsystem, IWrkSubsystemDescription
} from '../src/common/WrkactjobTypes'
import {
    descriptionListOf, displayPageSizeOf, ESubsystemDescription, ESubsystemsView, poolNumbersOf, storageOf, subsystemsPageSizeOf, subsystemsViewsFor
} from '../src/common/panels/SubsystemPanels'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const MIB = 1024 ** 2

const job = (name: string, namespace: string): IWrkJob => ({
    name, namespace, uid: name, user: 'default', type: EWrkJobType.ASJ, status: EWrkJobStatus.RUN, program: 'nginx',
    controllerKind: 'ReplicaSet', controllerName: name, phase: 'Running', node: 'node-a', priorityClass: '', priority: 0,
    restarts: 0, created: '', message: '', containers: []
})

const JOBS = [job('api-1', 'payroll'), job('coredns-1', 'kube-system')]

const subsystem = (name: string, over: Partial<IWrkSubsystem> = {}): IWrkSubsystem =>
    ({ name, status: EWrkSubsystemStatus.ACTIVE, storage: 0, pools: [], jobs: 0, ...over })

const SUBSYSTEMS: IWrkSubsystem[] = [
    subsystem('kube-system', { storage: 170 * MIB, pools: ['node-b', 'node-a'], jobs: 9 }),
    subsystem('payroll', { storage: 512 * MIB, pools: ['node-a'], jobs: 1 }),
    subsystem('wrkactjob-e2e-a-very-long-namespace', { status: EWrkSubsystemStatus.ENDING })
]
const POOL_NAMES = ['node-a', 'node-b']

const DESCRIPTION: IWrkSubsystemDescription = {
    name: 'payroll', status: EWrkSubsystemStatus.ACTIVE, created: '2026-01-02T03:04:05.000Z',
    labels: { team: 'hr', 'kubernetes.io/metadata.name': 'payroll' }, annotations: {}, pools: ['node-a'],
    quotas: [{ quota: 'compute', resource: 'requests.memory', hard: '4Gi', used: '512Mi' }],
    limits: [{ limitRange: 'defaults', type: 'Container', resource: 'memory', min: '', max: '1Gi', defaultLimit: '256Mi', defaultRequest: '128Mi' }]
}

const response = (over: Partial<IWrkactjobMessageResponse> = {}): IWrkactjobMessageResponse => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.RESPONSE, type: EInstanceMessageType.DATA, channel: 'wrkactjob',
    instance: 'i1', msgtype: 'wrkactjobmessageresponse', id: 'x', command: EWrkCommand.LIST, ok: true, ...over
})

const settle = () => new Promise(r => setTimeout(r, 0))

const start = async (subsystems: IWrkSubsystem[] = SUBSYSTEMS, geometry = undefined as typeof GEOMETRY_5250_27X132 | undefined, description: IWrkSubsystemDescription = DESCRIPTION) => {
    const asked: IWrkRequest[] = []
    let refuse: string | undefined
    const source: IWrkDataSource = {
        request: (r: IWrkRequest) => {
            asked.push(r)
            if (refuse) { const detail = refuse; refuse = undefined; return Promise.resolve(response({ ok: false, error: EWrkError.NOT_AUTHORIZED, detail })) }
            switch (r.command) {
                case EWrkCommand.SUBSYSTEMS: return Promise.resolve(response({ command: r.command, subsystems, poolNames: POOL_NAMES }))
                case EWrkCommand.SUBSYSTEM_DESCRIPTION: return Promise.resolve(response({ command: r.command, description: { ...description, name: r.targetNamespace ?? '' }, poolNames: POOL_NAMES }))
                case EWrkCommand.SYSTEM: return Promise.resolve(response({ command: r.command, system: { restricted: false, jobs: 2, metrics: EWrkMetricsState.AVAILABLE, pools: [] } }))
                default: return Promise.resolve(response({ jobs: JOBS, metrics: EWrkMetricsState.AVAILABLE }))
            }
        }
    }
    const s = new WrkSession('incluster', source, geometry, () => new Date(2026, 10, 24, 10, 0, 0).getTime())
    s.connected()
    await settle()
    const screen = s.terminal.screen
    const text = (row: number) => screen.rowText(row)
    const key = (k: E5250Key, extra: Partial<{ char: string; aid: E5250Aid }> = {}) => s.key({ key: k, ...extra })
    const type = (t: string) => { for (const c of t) key(E5250Key.CHAR, { char: c }) }
    const aid = async (a: E5250Aid) => { key(E5250Key.AID, { aid: a }); await settle() }
    const at = (row: number, col: number) => { screen.cursor = screen.address(row, col) }
    const command = async (t: string) => { at(screen.rows - 4, 6); key(E5250Key.ERASE_EOF); type(t); await aid(E5250Aid.ENTER) }
    // an option in the Opt field of a list row (the first data row is 8)
    const option = (row: number, o: string) => { at(row, 2); type(o) }
    return { s, screen, text, key, type, aid, at, command, option, asked, refuseOnce: (d: string) => { refuse = d } }
}

// ─── pure pieces ──────────────────────────────────────────────────────────────────────────────────

test('pool numbers, storage and the views', () => {
    assert.deepEqual(poolNumbersOf(['node-b', 'node-a', 'ghost'], POOL_NAMES), [1, 2])
    assert.equal(storageOf(0), '.00')
    assert.equal(storageOf(512 * MIB), '512.00')
    assert.deepEqual(subsystemsViewsFor(80), [ESubsystemsView.POOLS, ESubsystemsView.STATUS])
    assert.deepEqual(subsystemsViewsFor(132), [ESubsystemsView.WIDE])
    assert.equal(subsystemsPageSizeOf(24), 10)
    assert.equal(displayPageSizeOf(24), 12)
})

test('the DSPSBSD entries: attributes, pools in WRKSYSSTS numbering, quotas, limits; nothing says so', () => {
    const attributes = descriptionListOf(DESCRIPTION, POOL_NAMES, ESubsystemDescription.ATTRIBUTES)
    assert.equal(attributes.title, 'Display Operational Attributes')
    assert.match(attributes.lines[0], /^Subsystem description .*: payroll$/)
    assert.match(attributes.lines[2], /Created .*: 01\/02\/26/)
    assert.match(attributes.lines[4], /^Labels \..*: kubernetes\.io\/metadata\.name=payroll$/)
    assert.match(attributes.lines[5], /^\s+team=hr$/)
    assert.match(attributes.lines[6], /^Annotations .*: \*NONE$/)
    assert.match(descriptionListOf({ ...DESCRIPTION, created: '' }, [], ESubsystemDescription.ATTRIBUTES).lines[2], /Created .*: $/)
    const pools = descriptionListOf({ ...DESCRIPTION, pools: ['node-b', 'ghost'] }, POOL_NAMES, ESubsystemDescription.POOLS)
    assert.deepEqual(pools.lines.map(l => l.trim().split(/\s+/)), [['1', '2', 'node-b'], ['2', 'ghost']])
    const quotas = descriptionListOf(DESCRIPTION, POOL_NAMES, ESubsystemDescription.QUOTAS)
    assert.match(quotas.headings, /Quota\s+Resource\s+Used\s+Limit/)
    assert.match(quotas.lines[0], /compute\s+requests\.memory\s+512Mi\s+4Gi/)
    const limits = descriptionListOf(DESCRIPTION, POOL_NAMES, ESubsystemDescription.LIMITS)
    assert.match(limits.lines[0], /defaults\s+Container\s+memory\s+1Gi\s+256Mi\s+128Mi/)
    assert.ok(limits.headings.length <= 77, 'the headings fit in 80 columns')
    assert.match(limits.headings, /Request$/)
})

// ─── WRKSBS ───────────────────────────────────────────────────────────────────────────────────────

test('WRKSBS: subsystems with their storage and pools numbered as WRKSYSSTS; legend without 4', async () => {
    const { s, text, command, asked } = await start()
    await command('wrksbs')
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS)
    assert.equal(asked.at(-1)?.command, EWrkCommand.SUBSYSTEMS)
    assert.match(text(0), /Work with Subsystems\s+INCLUSTER/)
    assert.match(text(4), /Type options, press Enter\./)
    assert.equal(text(5).trim(), '5=Display subsystem description   8=Work with subsystem jobs')
    assert.match(text(6), /Total\s+-+Subsystem Pools-+/)
    assert.match(text(7), /Opt  Subsystem\s+Storage \(M\)\s+1\s+2\s+3\s+4\s+5\s+6\s+7\s+8\s+9\s+10/)
    assert.match(text(8), /KUBE-SYSTE\s+170\.00\s+1\s+2\s*$/)
    assert.match(text(9), /PAYROLL\s+512\.00\s+1\s*$/)
    assert.match(text(10), /WRKACTJOB-\s+\.00\s*$/)
    assert.match(text(18), /Bottom/)
    assert.match(text(21), /F3=Exit   F5=Refresh   F11=Display status   F12=Cancel/)
    assert.match(text(22), /F14=Work with system status/)
})

test('F11: status, jobs and the full name; and back', async () => {
    const { text, command, aid } = await start()
    await command('WRKSBS')
    await aid(E5250Aid.F11)
    assert.match(text(7), /Opt  Subsystem\s+Status\s+Jobs\s+Namespace/)
    assert.match(text(8), /KUBE-SYSTE\s+ACTIVE\s+9\s+kube-system/)
    assert.match(text(10), /ENDING\s+0\s+wrkactjob-e2e-a-very-long-namespace/)
    assert.match(text(21), /F11=Display pools/)
    await aid(E5250Aid.F11)
    assert.match(text(7), /Storage \(M\)/)
})

test('8: WRKACTJOB of that subsystem; F12 back to WRKSBS, F3 to the menu', async () => {
    const { s, text, command, aid, option } = await start()
    await command('WRKSBS')
    option(9, '8')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    assert.match(text(8), /PAYROLL/)
    assert.doesNotMatch(text(8) + text(9) + text(10), /KUBE-SYSTE/, 'only that subsystem')
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS)
    option(9, '8')
    await aid(E5250Aid.ENTER)
    await aid(E5250Aid.F3)
    assert.equal(s.panel, EWrkPanel.MENU)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SIGNED_OFF, 'the panels were left: F12 on the menu signs off')
})

test('5 opens DSPSBSD; each entry displays, Enter continues, F12 back, a wrong selection says so', async () => {
    const { s, text, command, aid, option, type, key, asked } = await start()
    await command('WRKSBS')
    option(9, '5')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEM_DESCRIPTION)
    assert.deepEqual([asked.at(-1)?.command, asked.at(-1)?.targetNamespace], [EWrkCommand.SUBSYSTEM_DESCRIPTION, 'payroll'])
    assert.match(text(0), /Display Subsystem Description/)
    assert.match(text(2), /Subsystem description:   PAYROLL\s+Status:   ACTIVE/)
    assert.match(text(6), /1\. Operational attributes/)
    assert.match(text(7), /2\. Pool definitions/)
    assert.match(text(8), /3\. Resource quota entries/)
    assert.match(text(9), /4\. Limit range entries/)
    for (const [selection, title] of [['1', 'Display Operational Attributes'], ['2', 'Display Pool Definitions'], ['3', 'Display Resource Quota Entries'], ['4', 'Display Limit Range Entries']]) {
        type(selection)
        await aid(E5250Aid.ENTER)
        assert.equal(s.panel, EWrkPanel.DISPLAY)
        assert.match(text(0), new RegExp(title))
        assert.match(text(19), /Press Enter to continue\./)
        await aid(E5250Aid.ENTER)
        assert.equal(s.panel, EWrkPanel.SUBSYSTEM_DESCRIPTION)
    }
    type('9')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Selection 9 not valid\./)
    key(E5250Key.RESET)
    key(E5250Key.ERASE_EOF)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEM_DESCRIPTION, 'nothing typed: the menu again')
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS)
})

test('several options run in order, each when the previous one is left; an invalid one stops them all', async () => {
    const { s, text, command, aid, option, key, asked } = await start()
    await command('WRKSBS')
    option(8, '4')
    await aid(E5250Aid.ENTER)
    assert.match(text(23), /Option 4 not valid\./, 'D14: no End subsystem')
    key(E5250Key.RESET)
    option(8, '5 ')
    option(9, '8')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEM_DESCRIPTION)
    assert.equal(asked.at(-1)?.targetNamespace, 'kube-system')
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS, 'then 8 on payroll')
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS, 'and back, nothing left: the list again')
    assert.equal(asked.at(-1)?.command, EWrkCommand.SUBSYSTEMS)
})

test('a Display list rolls; DSPSBSD from the command line; commands typed on the menu of DSPSBSD', async () => {
    const { s, text, command, aid, type, key } = await start()
    await command('DSPSBSD')
    assert.match(text(23), /Value for parameter SBSD required\./)
    key(E5250Key.RESET)
    await command('DSPSBSD SBSD(PAYROLL)')
    assert.equal(s.panel, EWrkPanel.SUBSYSTEM_DESCRIPTION)
    type('wrksyssts')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS, 'a command on the selection line')
    await aid(E5250Aid.F12)
    type('1')
    await aid(E5250Aid.ENTER)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
})

test('a long Display list: More..., Roll Up shows the rest, Roll Down back', async () => {
    const labels = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`l${String(i).padStart(2, '0')}`, 'x']))
    const { text, command, aid, type } = await start(SUBSYSTEMS, undefined, { ...DESCRIPTION, labels })
    await command('DSPSBSD SBSD(PAYROLL)')
    type('1')
    await aid(E5250Aid.ENTER)
    assert.match(text(6), /Subsystem description/)
    assert.match(text(18), /More\.\.\./)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(6), /l08=x/)
    assert.match(text(18), /More\.\.\./, '25 lines are three pages of 12')
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(6), /Annotations .*\*NONE/)
    assert.match(text(18), /Bottom/)
    await aid(E5250Aid.ROLL_DOWN)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(6), /Subsystem description/)
})

test('WRKSBS: F14, roll, F4, refresh, a function key it does not have, commands, and an empty list', async () => {
    const many = Array.from({ length: 14 }, (_, i) => subsystem(`ns-${String(i).padStart(2, '0')}`))
    const { s, text, command, aid, key, at, type, asked } = await start(many)
    await command('WRKSBS')
    assert.match(text(18), /More\.\.\./)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(8), /NS-10/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    const before = asked.length
    await aid(E5250Aid.F5)
    await aid(E5250Aid.ENTER)
    assert.equal(asked.length, before + 2)
    await command('WRKSBS')
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS, 'on itself: refreshed')
    await command('WRKSBS JUNK(1)')
    assert.match(text(23), /Keyword JUNK not valid/)
    key(E5250Key.RESET)
    await aid(E5250Aid.F1)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    at(20, 6)
    key(E5250Key.ERASE_EOF)
    type('WRKSBS')
    await aid(E5250Aid.F4)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS)
    await aid(E5250Aid.F14)
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS)

    const none = await start([])
    await none.command('WRKSBS')
    assert.match(none.text(8), /\(No subsystems to display\)/)
})

test('27x132: pools, status and the full name at once; F11 is not there', async () => {
    const { text, command, aid } = await start(SUBSYSTEMS, GEOMETRY_5250_27X132)
    await command('WRKSBS')
    assert.match(text(7), /Storage \(M\)\s+1 .*10\s+Status\s+Jobs\s+Namespace/)
    assert.match(text(8), /KUBE-SYSTE\s+170\.00\s+1\s+2\s+ACTIVE\s+9\s+kube-system/)
    assert.doesNotMatch(text(24), /F11/)
    await aid(E5250Aid.F11)
    assert.match(text(26), /Function key not allowed\./)
})

test('the back says no: on WRKSBS, and on DSPSBSD (the panel stays)', async () => {
    const { s, text, command, aid, option, key, refuseOnce } = await start()
    refuseOnce('No way.')
    await command('WRKSBS')
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    assert.match(text(23), /No way\./)
    key(E5250Key.RESET)
    await command('WRKSBS')
    refuseOnce('Your key does not reach subsystem payroll')
    option(9, '5')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.SUBSYSTEMS)
    assert.match(text(23), /Your key does not reach subsystem payroll/)
})

test('WRKACTJOB typed on a panel puts it aside: F12 on WRKACTJOB comes back to it', async () => {
    const { s, command, aid } = await start()
    await command('WRKSYSSTS')
    await command('WRKACTJOB')
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    await aid(E5250Aid.F12)
    assert.equal(s.panel, EWrkPanel.SYSTEM_STATUS)
})
