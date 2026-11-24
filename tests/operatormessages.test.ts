import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E5250Aid, E5250Key } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkPanel, ROLL_LIMIT, WrkSession } from '../src/common/WrkSession'
import { IWrkDataSource } from '../src/common/WrkDataSource'
import { EWrkCommand, EWrkError, EWrkJobStatus, EWrkJobType, EWrkMetricsState, IWrkactjobMessageResponse, IWrkJob, IWrkMessage, IWrkRequest } from '../src/common/WrkactjobTypes'
import { firstLevelOf, messageLinesOf, messageRowsOf, NO_MESSAGES, pageOf, previousTopOf } from '../src/common/panels/OperatorMessagesPanel'
import { parseCl } from '../src/common/panels/ClCommand'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'

// ─── fixtures ─────────────────────────────────────────────────────────────────────────────────────

const job = (name: string): IWrkJob => ({
    name, namespace: 'payroll', uid: name, user: 'default', type: EWrkJobType.ASJ, status: EWrkJobStatus.RUN, program: 'nginx',
    controllerKind: 'ReplicaSet', controllerName: name, phase: 'Running', node: 'node-a', priorityClass: '', priority: 0,
    restarts: 0, created: '', message: '', containers: []
})

const msg = (reason: string, over: Partial<IWrkMessage> = {}): IWrkMessage => ({
    time: '2026-11-24T09:30:00.000Z', firstTime: '2026-11-24T09:00:00.000Z', type: 'Warning', reason, message: 'Back-off restarting failed container',
    count: 3, source: 'kubelet', namespace: 'payroll', kind: 'Pod', object: 'api-1', ...over
})

const MESSAGES = [
    msg('BackOff'),
    msg('NodeNotReady', { namespace: '', kind: 'Node', object: 'node-b', message: 'Node node-b status is now: NodeNotReady', source: 'node-controller' }),
    msg('FailedScheduling', { message: '0/2 nodes are available: 2 Insufficient memory. preemption: 0/2 nodes are available: 2 No preemption victims found for incoming pod.' })
]

const response = (over: Partial<IWrkactjobMessageResponse> = {}): IWrkactjobMessageResponse => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.RESPONSE, type: EInstanceMessageType.DATA, channel: 'wrkactjob',
    instance: 'i1', msgtype: 'wrkactjobmessageresponse', id: 'x', command: EWrkCommand.LIST, ok: true, ...over
})

const settle = () => new Promise(r => setTimeout(r, 0))

const start = async (messages: IWrkMessage[] = MESSAGES) => {
    const asked: IWrkRequest[] = []
    let refuse: string | undefined
    let current = messages
    const source: IWrkDataSource = {
        request: (r: IWrkRequest) => {
            asked.push(r)
            if (refuse) { const detail = refuse; refuse = undefined; return Promise.resolve(response({ ok: false, error: EWrkError.FAILED, detail })) }
            return Promise.resolve(r.command === EWrkCommand.MESSAGES
                ? response({ command: r.command, messages: current })
                : response({ jobs: [job('api-1')], metrics: EWrkMetricsState.AVAILABLE }))
        }
    }
    const s = new WrkSession('incluster', source, undefined, () => new Date(2026, 10, 24, 10, 0, 0).getTime())
    s.connected()
    await settle()
    const screen = s.terminal.screen
    const text = (row: number) => screen.rowText(row)
    const key = (k: E5250Key, extra: Partial<{ char: string; aid: E5250Aid }> = {}) => s.key({ key: k, ...extra })
    const type = (t: string) => { for (const c of t) key(E5250Key.CHAR, { char: c }) }
    const aid = async (a: E5250Aid) => { key(E5250Key.AID, { aid: a }); await settle() }
    const command = async (t: string) => { screen.cursor = screen.address(20, 6); key(E5250Key.ERASE_EOF); type(t); await aid(E5250Aid.ENTER) }
    return { s, screen, text, key, type, aid, command, asked, set: (m: IWrkMessage[]) => { current = m }, refuseOnce: (d: string) => { refuse = d } }
}

// ─── pure pieces ──────────────────────────────────────────────────────────────────────────────────

test('parseCl: DSPMSG and WRKMSG take the queue by position, before any keyword', () => {
    assert.deepEqual(parseCl('dspmsg qsysopr'), { verb: 'DSPMSG', params: { MSGQ: 'QSYSOPR' } })
    assert.deepEqual(parseCl('WRKMSG *SYSOPR'), { verb: 'WRKMSG', params: { MSGQ: '*SYSOPR' } })
    assert.deepEqual(parseCl('DSPMSG MSGQ(QSYSOPR)'), { verb: 'DSPMSG', params: { MSGQ: 'QSYSOPR' } })
    assert.equal(parseCl('DSPMSG QSYSOPR EXTRA').error, 'Parameter EXTRA not valid for command DSPMSG.')
    assert.equal(parseCl('DSPMSG START(*LAST) QSYSOPR').error, 'Parameter QSYSOPR not valid for command DSPMSG.')
})

test('a message: what it is about, its reason and text, wrapped with the rest indented', () => {
    assert.equal(firstLevelOf(MESSAGES[0]), 'Pod api-1 in subsystem payroll: BackOff - Back-off restarting failed container')
    assert.equal(firstLevelOf(MESSAGES[1]), 'Node node-b: NodeNotReady - Node node-b status is now: NodeNotReady')
    assert.equal(firstLevelOf(msg('Odd', { kind: '', message: '' })), 'Odd')
    const lines = messageLinesOf(MESSAGES[2], 80)
    assert.equal(lines.length, 3)
    assert.ok(lines.every(l => l.length <= 74))
    assert.match(lines[1], /^  \S/)
    // a word longer than a line is cut once, and only once
    const long = messageLinesOf(msg('BackOff', { object: 'a', message: 'in pod ' + 'x'.repeat(100) + ')' }), 80)
    assert.equal(long.length, 2, 'the long word starts filling the first line')
    assert.ok(long.every(l => l.length <= 74))
    assert.equal(long.map(l => l.trim()).join('').replace(/\s/g, '').includes('x'.repeat(100) + ')'), true)
    assert.ok(long.every(l => l.trim() !== ')'), 'no orphan')
})

test('pages hold whole messages; the page before is as many as fit', () => {
    const many = Array.from({ length: 20 }, (_, i) => msg(`R${i}`))
    assert.equal(messageRowsOf(24), 12)
    const first = pageOf(many, 0, 24, 80)
    assert.equal(first.length, 12)
    assert.deepEqual([first[0].row, first[11].row], [6, 17])
    const tall = [msg('A'), msg('B', { message: 'x '.repeat(400) }), msg('C')]
    assert.deepEqual(pageOf(tall, 0, 24, 80).map(m => m.index), [0], 'B does not fit after A: it starts the next page')
    assert.equal(pageOf(tall, 1, 24, 80)[0].lines.length, 12, 'and alone it is cut to the page')
    assert.equal(previousTopOf(many, 12, 24, 80), 0)
    assert.equal(previousTopOf(many, 15, 24, 80), 3)
    assert.equal(previousTopOf(tall, 2, 24, 80), 1)
})

// ─── the panel ────────────────────────────────────────────────────────────────────────────────────

test('DSPMSG QSYSOPR: the queue, newest first as the back sends them, the cursor on the first', async () => {
    const { s, screen, text, command, asked } = await start()
    await command('dspmsg qsysopr')
    assert.equal(s.panel, EWrkPanel.OPERATOR_MESSAGES)
    assert.equal(asked.at(-1)?.command, EWrkCommand.MESSAGES)
    assert.match(text(0), /Display Messages/)
    assert.match(text(1), /System:   INCLUSTER/)
    assert.match(text(2), /Queue .* : QSYSOPR\s+Program .* : \*DSPMSG/)
    assert.match(text(3), /Library .* : QSYS/)
    assert.match(text(6), /^\s+Pod api-1 in subsystem payroll: BackOff - Back-off restarting failed\s*$/)
    assert.match(text(7), /^\s{5}container\s*$/, "its second line, two further in than the first (column 3)")
    assert.match(text(8), /Node node-b: NodeNotReady/)
    assert.match(text(9), /FailedScheduling/)
    assert.match(text(18), /Bottom/)
    assert.match(text(21), /F1=Help   F3=Exit   F5=Refresh   F12=Cancel/)
    assert.equal(screen.cursor, screen.address(6, 3))
})

test('F1 on a message: Additional Message Information; Enter back; F1 elsewhere says where', async () => {
    const { s, screen, text, command, aid, key } = await start()
    await command('DSPMSG')
    screen.cursor = screen.address(9, 10)
    await aid(E5250Aid.F1)
    assert.equal(s.panel, EWrkPanel.MESSAGE_DETAILS)
    assert.match(text(0), /Additional Message Information/)
    assert.match(text(2), /Message ID .* : FailedScheduling/)
    assert.match(text(3), /Message type .* : Warning/)
    assert.match(text(5), /First sent .* : 11\/24\/26/)
    assert.match(text(6), /Occurrences .* : 3/)
    assert.match(text(7), /From object .* : Pod api-1/)
    assert.match(text(8), /Subsystem .* : payroll/)
    assert.match(text(9), /From program .* : kubelet/)
    assert.match(text(11), /Message \. \. \. \. :\s+0\/2 nodes are available/)
    assert.match(text(19), /Press Enter to continue\./)
    await aid(E5250Aid.F5)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.OPERATOR_MESSAGES)
    screen.cursor = screen.address(8, 3)
    await aid(E5250Aid.F1)
    assert.match(text(8), /Subsystem .* : \*NONE/, 'a node is in no subsystem')
    await aid(E5250Aid.F12)
    screen.cursor = screen.address(7, 40)
    await aid(E5250Aid.F1)
    assert.match(text(2), /Message ID .* : BackOff/, 'on the second line of a message, that message')
    await aid(E5250Aid.F12)
    screen.cursor = screen.address(2, 3)
    await aid(E5250Aid.F1)
    assert.match(text(23), /Position the cursor on a message, then press F1\./)
})

test('the menu (3), WRKMSG and every queue that means QSYSOPR; another queue is not found', async () => {
    const { s, text, command, aid, type, key } = await start()
    for (const c of ['WRKMSG', 'DSPMSG MSGQ(*SYSOPR)', 'DSPMSG *WRKUSR']) {
        await command(c)
        assert.equal(s.panel, EWrkPanel.OPERATOR_MESSAGES, c)
        await aid(E5250Aid.F3)
    }
    await command('DSPMSG QPRINT')
    assert.match(text(23), /Message queue QPRINT in \*LIBL not found\./)
    key(E5250Key.RESET)
    await command('DSPMSG SEV(40)')
    assert.match(text(23), /Keyword SEV not valid for this command\./)
    key(E5250Key.RESET)
    await aid(E5250Aid.F3)
    type('3')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.OPERATOR_MESSAGES)
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.MENU, 'nothing to reply: Enter leaves')
})

test('roll by whole messages; F5 refreshes; no messages says so; a key it does not have', async () => {
    const many = Array.from({ length: 20 }, (_, i) => msg(`R${String(i).padStart(2, '0')}`))
    const { text, command, aid, key, set, asked } = await start(many)
    await command('DSPMSG')
    assert.match(text(18), /More\.\.\./)
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(6), /R12/)
    assert.match(text(18), /Bottom/)
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.ROLL_DOWN)
    assert.match(text(6), /R00/)
    set([])
    const before = asked.length
    await aid(E5250Aid.F5)
    assert.equal(asked.length, before + 1)
    assert.match(text(23), new RegExp(NO_MESSAGES))
    await aid(E5250Aid.ROLL_UP)
    assert.match(text(23), new RegExp(ROLL_LIMIT))
    await aid(E5250Aid.F11)
    assert.match(text(23), /Function key not allowed\./)
    key(E5250Key.RESET)
    await command('DSPMSG')
})

test('F4 on DSPMSG runs it; the back says no', async () => {
    const { s, text, aid, type, key, refuseOnce, screen, asked } = await start()
    screen.cursor = screen.address(20, 6)
    type('DSPMSG')
    await aid(E5250Aid.F4)
    assert.equal(s.panel, EWrkPanel.OPERATOR_MESSAGES)
    await aid(E5250Aid.F12)
    refuseOnce('Events cannot be listed.')
    screen.cursor = screen.address(20, 6)
    key(E5250Key.ERASE_EOF)
    type('DSPMSG')
    await aid(E5250Aid.ENTER)
    assert.equal(s.panel, EWrkPanel.ACTIVE_JOBS)
    assert.match(text(23), /Events cannot be listed\./)
    assert.equal(asked.at(-1)?.command, EWrkCommand.MESSAGES)
})
