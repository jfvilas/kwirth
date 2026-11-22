import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESdsfPanel, SdsfSession } from '../src/common/SdsfSession'
import { ISdsfDataSource } from '../src/common/SdsfDataSource'
import { E3270Aid, E3270Color, E3270Highlight, E3270Key, E3270Lock } from '../src/common/terminal/Terminal3270Types'
import { displayCell } from '../src/common/terminal/Display3270'
import { COMMAND_COL, ROW_COMMAND, ROW_PF_KEYS, ROW_RULE, ROW_TITLE } from '../src/common/panels/SdsfLayout'
import { DATA_ROWS, ROW_FILTER, ROW_FIRST_DATA, ROW_HEADERS } from '../src/common/panels/DaPanel'
import { ESdsfCommand, ESdsfError, ESdsfMetricsState, ESdsfQos, ISdsfMessageResponse, ISdsfPod, ISdsfRequest } from '../src/common/SdsfTypes'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'

const NOW = Date.parse('2026-11-22T12:00:00Z')

const podOf = (name: string, over: Partial<ISdsfPod> = {}): ISdsfPod => ({
    name, namespace: 'shop', uid: name, jobId: 'STC00001', owner: 'default', controllerKind: 'ReplicaSet', controllerName: 'rs',
    qos: ESdsfQos.BURSTABLE, phase: 'Running', ready: true, deleting: false, reason: '', priorityClass: '', priority: 0, restarts: 0,
    node: 'node-1', created: '2026-11-22T11:00:00.000Z', containers: [{ name: 'main', init: false, image: 'x', ready: true, restarts: 0, state: 'running', reason: '' }],
    ...over
})

const response = (over: Partial<ISdsfMessageResponse>): ISdsfMessageResponse => ({
    action: EInstanceMessageAction.COMMAND, flow: EInstanceMessageFlow.RESPONSE, type: EInstanceMessageType.DATA, channel: 'sdsf', instance: 'i',
    msgtype: 'sdsfmessageresponse', id: '1', command: ESdsfCommand.LIST, ok: true, ...over
})

class FakeSource implements ISdsfDataSource {
    requests: ISdsfRequest[] = []
    pods: ISdsfPod[] = []
    metrics = ESdsfMetricsState.AVAILABLE
    clusterCpu: number | undefined = 12.4
    next?: Partial<ISdsfMessageResponse> | Error
    logs: Record<string, string[]> = {}                // 'pod/container' -> lines
    refuseCancel = new Set<string>()                   // pod names whose cancel the back refuses
    request = (request: ISdsfRequest): Promise<ISdsfMessageResponse> => {
        this.requests.push(request)
        const next = this.next
        this.next = undefined
        if (next instanceof Error) return Promise.reject(next)
        switch (request.command) {
            case ESdsfCommand.LOG:
                return Promise.resolve(response({ command: request.command, lines: this.logs[`${request.podName}/${request.containerName}`] ?? [], ...next }))
            case ESdsfCommand.DESCRIBE:
                return Promise.resolve(response({ command: request.command, lines: [`Name:             ${request.podName}`, `Namespace:        ${request.podNamespace}`], ...next }))
            case ESdsfCommand.CANCEL:
                if (this.refuseCancel.has(request.podName!)) return Promise.resolve(response({ command: request.command, ok: false, error: ESdsfError.NOT_AUTHORIZED, detail: 'needs sdsf$cancel' }))
                this.pods = this.pods.filter(p => p.name !== request.podName)
                return Promise.resolve(response({ command: request.command, ...next }))
            default:
                return Promise.resolve(response({ pods: this.pods, metrics: this.metrics, clusterCpu: this.clusterCpu, ...next }))
        }
    }
}

const settle = () => new Promise(resolve => setImmediate(resolve))
const type = (s: SdsfSession, text: string) => { for (const c of text) s.key({ key: E3270Key.CHAR, char: c }) }
const aid = async (s: SdsfSession, a: E3270Aid) => { s.key({ key: E3270Key.AID, aid: a }); await settle() }
const enter = (s: SdsfSession) => aid(s, E3270Aid.ENTER)
// Types a command on a clean command line and presses Enter.
const command = async (s: SdsfSession, text: string, a: E3270Aid = E3270Aid.ENTER) => {
    const screen = s.terminal.screen
    screen.cursor = screen.address(ROW_COMMAND, COMMAND_COL)
    s.key({ key: E3270Key.ERASE_EOF })
    type(s, text)
    await aid(s, a)
}
const row = (s: SdsfSession, r: number) => s.terminal.screen.rowText(r)
const dataRows = (s: SdsfSession) => Array.from({ length: DATA_ROWS }, (_, i) => row(s, ROW_FIRST_DATA + i)).filter(r => r.trim())
const jobnames = (s: SdsfSession) => dataRows(s).map(r => r.slice(5, 13).trim())

const open = async (pods: ISdsfPod[] = [], metrics = ESdsfMetricsState.AVAILABLE) => {
    const source = new FakeSource()
    source.pods = pods
    source.metrics = metrics
    const s = new SdsfSession('k3d-dev-cluster', source, () => NOW)
    return { s, source }
}

const openDa = async (pods: ISdsfPod[], metrics = ESdsfMetricsState.AVAILABLE) => {
    const o = await open(pods, metrics)
    await command(o.s, 'da')
    return o
}

// ─── Primary menu ─────────────────────────────────────────────────────────────

test('the session opens on the primary option menu, cursor on the command line', async () => {
    const { s } = await open()
    const screen = s.terminal.screen
    assert.equal(s.panel, ESdsfPanel.MENU)
    assert.match(screen.rowText(0), /^  Display  Filter  View  Print  Options  Search  Help/)
    assert.equal(screen.rowText(ROW_RULE), ' ' + '-'.repeat(79))
    assert.match(screen.rowText(ROW_TITLE), /^ K3D-DEV- -+  SDSF PRIMARY OPTION MENU  -+$/)
    assert.match(screen.rowText(ROW_COMMAND), /^ COMMAND INPUT ===>\s+SCROLL ===> PAGE$/)
    assert.match(screen.rowText(5), /^ DA    Active pods\s+INIT  Initiators \(nodes\)/)
    assert.match(screen.rowText(ROW_PF_KEYS), /F1=HELP .* F6=BOOK/)
    assert.match(screen.rowText(ROW_PF_KEYS + 1), /F7=UP .* F12=RETRIEVE/)
    assert.equal(screen.cursor, screen.address(ROW_COMMAND, COMMAND_COL), 'cursor at column 21, as in the captures')
})

test('menu colours as in the captures', async () => {
    const { s } = await open()
    const screen = s.terminal.screen
    assert.equal(displayCell(screen, screen.address(0, 2)).color, E3270Color.WHITE)
    assert.equal(displayCell(screen, screen.address(0, 2)).highlight, E3270Highlight.UNDERSCORE)
    assert.equal(displayCell(screen, screen.address(ROW_RULE, 5)).color, E3270Color.BLUE)
    assert.equal(displayCell(screen, screen.address(ROW_COMMAND, 76)).color, E3270Color.RED, 'PAGE in red')
    assert.equal(displayCell(screen, screen.address(5, 1)).color, E3270Color.TURQUOISE)
    assert.equal(displayCell(screen, screen.address(5, 7)).color, E3270Color.BLUE)
})

test('menu: phase-2 options say NOT AVAILABLE, an unknown one INVALID COMMAND and stays to be fixed', async () => {
    const { s, source } = await open()
    await command(s, 'st')
    assert.match(row(s, ROW_TITLE), /NOT AVAILABLE$/)
    assert.equal(displayCell(s.terminal.screen, s.terminal.screen.address(ROW_TITLE, 79)).color, E3270Color.YELLOW)
    await command(s, 'zz')
    assert.match(row(s, ROW_TITLE), /INVALID COMMAND$/)
    assert.match(row(s, ROW_COMMAND), /===> zz /)
    assert.equal(s.terminal.lock, E3270Lock.NONE)
    assert.equal(source.requests.length, 0, 'the menu never asks the back')
})

test('menu: an untouched command field still counts, as in ISPF', async () => {
    const { s } = await open()
    await command(s, 'zz')
    s.terminal.screen.cursor = 0
    await enter(s)
    assert.match(row(s, ROW_TITLE), /INVALID COMMAND$/)
})

test('menu: the scroll amount typed by the operator is kept, upper-cased', async () => {
    const { s } = await open()
    const screen = s.terminal.screen
    screen.cursor = screen.address(ROW_COMMAND, 76)
    s.key({ key: E3270Key.ERASE_EOF })
    type(s, 'csr')
    await enter(s)
    assert.match(row(s, ROW_COMMAND), /SCROLL ===> CSR $/)
})

test('END and PF3 on the menu leave to TSO READY; SDSF and SDSF DA come back; anything else is NOT FOUND', async () => {
    const { s } = await open([podOf('a')])
    await command(s, 'end')
    assert.equal(s.panel, ESdsfPanel.READY)
    assert.equal(row(s, 0).trim(), 'READY')
    type(s, 'listcat')
    await enter(s)
    assert.equal(row(s, 1).trim(), 'listcat')
    assert.equal(row(s, 2).trim(), 'IKJ56500I COMMAND LISTCAT NOT FOUND')
    assert.equal(row(s, 3).trim(), 'READY')
    await enter(s)
    assert.equal(row(s, 4).trim(), 'READY', 'an empty Enter: another READY')
    type(s, 'sdsf')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.MENU)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.READY)
    type(s, 'sdsf da')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.deepEqual(jobnames(s), ['A'])
})

// ─── DA ───────────────────────────────────────────────────────────────────────

test('DA lists the pods with the columns of a real DA, in the colours of the captures', async () => {
    const { s, source } = await openDa([
        podOf('api-7d9f8b6c4-x2kq9', { owner: 'api-sa', jobId: 'STC43981', qos: ESdsfQos.GUARANTEED, priority: 2000001000, memory: 256 * 1024 * 1024, restarts: 3 }),
        podOf('worker-0', { namespace: 'batch', phase: 'Pending', ready: false, qos: ESdsfQos.BESTEFFORT })
    ])
    const screen = s.terminal.screen
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.deepEqual(source.requests, [{ command: ESdsfCommand.LIST }])
    assert.equal(s.terminal.lock, E3270Lock.NONE)
    assert.match(row(s, ROW_TITLE), /^ SDSF DA K3D-DEV- \(ALL\)    PAG  0  CPU\/L\/Z  12\/ 12\/  0 +LINE 1-2 \(2\)$/)
    assert.match(row(s, ROW_FILTER), /^ PREFIX=\*  DEST=\(ALL\)  OWNER=\*  SORT=\*/)
    assert.equal(row(s, ROW_HEADERS).trimEnd(), ' NP  JOBNAME  StepName ProcStep JobID    Owner    C Pos DP  Real Paging     SIO')
    // natural order: namespace, then name
    assert.deepEqual(jobnames(s), ['WORKER-0', 'API-7D9F'])
    assert.equal(dataRows(s)[1].trimEnd(), '     API-7D9F MAIN              STC43981 API-SA   G IN  FF   256   0.00       3')
    assert.match(dataRows(s)[0], / E NS  F0     - /)
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS, 5)).color, E3270Color.TURQUOISE)
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS, 1)).color, E3270Color.BLUE)
    assert.equal(displayCell(screen, screen.address(ROW_FILTER, 1)).color, E3270Color.TURQUOISE)
    assert.equal(displayCell(screen, screen.address(ROW_FIRST_DATA, 5)).color, E3270Color.BLUE, 'JOBNAME')
    assert.equal(displayCell(screen, screen.address(ROW_FIRST_DATA, 52)).color, E3270Color.YELLOW, 'Pos NS')
    assert.equal(displayCell(screen, screen.address(ROW_FIRST_DATA + 1, 78)).color, E3270Color.YELLOW, 'restarts > 0')
    // NP is an input field on every row
    assert.equal(screen.isProtected(screen.address(ROW_FIRST_DATA, 1)), false)
    assert.equal(screen.cursor, screen.address(ROW_COMMAND, COMMAND_COL))
})

test('the keyboard stays in X SYSTEM until the list arrives', async () => {
    const { s, source } = await open([podOf('a')])
    let release: (r: ISdsfMessageResponse) => void = () => {}
    source.request = (req) => { source.requests.push(req); return new Promise(resolve => { release = resolve }) }
    s.terminal.screen.cursor = s.terminal.screen.address(ROW_COMMAND, COMMAND_COL)
    type(s, 'da')
    s.key({ key: E3270Key.AID, aid: E3270Aid.ENTER })
    await settle()
    assert.equal(s.terminal.lock, E3270Lock.SYSTEM)
    release(response({ pods: [podOf('a')], metrics: ESdsfMetricsState.AVAILABLE }))
    await settle()
    assert.equal(s.terminal.lock, E3270Lock.NONE)
    assert.deepEqual(jobnames(s), ['A'])
})

test('listeners hear every change, including the late answer; dispose silences them', async () => {
    const { s } = await open([podOf('a')])
    let heard = 0
    const off = s.subscribe(() => heard++)
    await command(s, 'da')
    assert.ok(heard >= 2, 'the keys, the AID and the answer')
    off()
    const before = heard
    await enter(s)
    assert.equal(heard, before)
    s.subscribe(() => heard++)
    s.dispose()
    s.key({ key: E3270Key.RIGHT })
    assert.equal(heard, before)
})

test('PREFIX, OWNER and DEST filter, with SDSF wildcards; * resets', async () => {
    const pods = [podOf('api-1', { owner: 'api-sa' }), podOf('api-2', { namespace: 'kube-system', owner: 'coredns' }), podOf('web-1', { owner: 'web' })]
    const { s } = await openDa(pods)
    await command(s, 'prefix api*')
    assert.deepEqual(jobnames(s), ['API-2', 'API-1'])
    assert.match(row(s, ROW_FILTER), /PREFIX=API\*/)
    await command(s, 'pre api-%')
    assert.equal(jobnames(s).length, 2)
    await command(s, 'pre api')
    assert.deepEqual(jobnames(s), [], 'without a wildcard it is the whole name')
    assert.match(row(s, ROW_TITLE), /LINE 0-0 \(0\)$/)
    await command(s, 'prefix *')
    await command(s, 'owner core*')
    assert.deepEqual(jobnames(s), ['API-2'])
    await command(s, 'own')
    await command(s, 'dest KUBE-SYSTEM')
    assert.deepEqual(jobnames(s), ['API-2'], 'namespaces compare without case')
    assert.match(row(s, ROW_TITLE), /SDSF DA K3D-DEV- KUBE-SYS/)
    await command(s, 'dest (all)')
    assert.equal(jobnames(s).length, 3)
})

test('filters typed on the menu apply when DA opens', async () => {
    const { s } = await open([podOf('api-1'), podOf('web-1')])
    await command(s, 'prefix web*')
    assert.equal(s.panel, ESdsfPanel.MENU)
    await command(s, 'da')
    assert.deepEqual(jobnames(s), ['WEB-1'])
})

test('SORT by any column, ascending or descending; SORT alone goes back to the natural order', async () => {
    const pods = [podOf('b', { restarts: 1 }), podOf('a', { restarts: 5 }), podOf('c', { restarts: 0 })]
    const { s } = await openDa(pods)
    assert.deepEqual(jobnames(s), ['A', 'B', 'C'])
    await command(s, 'sort sio d')
    assert.deepEqual(jobnames(s), ['A', 'B', 'C'])
    await command(s, 'sort sio')
    assert.deepEqual(jobnames(s), ['C', 'B', 'A'])
    assert.match(row(s, ROW_FILTER), /SORT=SIO\/A/)
    await command(s, 'sort jobname d')
    assert.deepEqual(jobnames(s), ['C', 'B', 'A'])
    await command(s, 'sort')
    assert.deepEqual(jobnames(s), ['A', 'B', 'C'])
    await command(s, 'sort bogus')
    assert.match(row(s, ROW_TITLE), /INVALID COLUMN NAME$/)
    await command(s, 'sort sio x')
    assert.match(row(s, ROW_TITLE), /INVALID COLUMN NAME$/)
})

const many = (n: number) => Array.from({ length: n }, (_, i) => podOf(`p${String(i).padStart(3, '0')}`))

test('PF8/PF7 scroll by the SCROLL amount; a number or M on the command line overrides it', async () => {
    const { s } = await openDa(many(60))
    assert.match(row(s, ROW_TITLE), /LINE 1-24 \(60\)$/)
    await aid(s, E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 25-48 \(60\)$/)
    await aid(s, E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 49-60 \(60\)$/)
    await aid(s, E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 60-60 \(60\)$/, 'never past the last row')
    await command(s, 'm', E3270Aid.PF7)
    assert.match(row(s, ROW_TITLE), /LINE 1-24 \(60\)$/)
    await command(s, '5', E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 6-29 \(60\)$/)
    await command(s, 'm', E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 37-60 \(60\)$/)
    await command(s, 'top')
    assert.match(row(s, ROW_TITLE), /LINE 1-24/)
    await command(s, 'bottom')
    assert.match(row(s, ROW_TITLE), /LINE 37-60/)
    await command(s, 'up 10')
    assert.match(row(s, ROW_TITLE), /LINE 27-50/)
    await command(s, 'down half')
    assert.match(row(s, ROW_TITLE), /LINE 39-60/)
    await command(s, 'up max')
    assert.match(row(s, ROW_TITLE), /LINE 1-24/)
    await command(s, 'down data')
    assert.match(row(s, ROW_TITLE), /LINE 24-47/)
    await command(s, 'down soon')
    assert.match(row(s, ROW_TITLE), /INVALID SCROLL AMOUNT$/)
})

test('SCROLL CSR: the cursor row goes to the top going down, to the bottom going up', async () => {
    const { s } = await openDa(many(60))
    const screen = s.terminal.screen
    screen.cursor = screen.address(ROW_COMMAND, 76)
    s.key({ key: E3270Key.ERASE_EOF })
    type(s, 'csr')
    await enter(s)
    screen.cursor = screen.address(ROW_FIRST_DATA + 10, 20)
    await aid(s, E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 11-34/)
    screen.cursor = screen.address(ROW_FIRST_DATA + 20, 20)
    await aid(s, E3270Aid.PF7)
    assert.match(row(s, ROW_TITLE), /LINE 8-31/)
    screen.cursor = screen.address(ROW_COMMAND, 30)
    await aid(s, E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 32-55/, 'cursor off the data: a page')
})

test('PF11/PF10 scroll the columns sideways; NP and JOBNAME stay', async () => {
    const { s } = await openDa([podOf('api-1', { cpu: 3.5, node: 'node-7' })])
    await aid(s, E3270Aid.PF11)
    assert.match(row(s, ROW_HEADERS), /^ NP  JOBNAME    CPU% Status +Node +Age *$/)
    assert.match(dataRows(s)[0], /API-1 +3\.50 Running +node-7 +60m/)
    await aid(s, E3270Aid.PF11)
    assert.match(row(s, ROW_HEADERS), /^ NP  JOBNAME  Namespace +PodName/)
    assert.match(dataRows(s)[0], /API-1 +shop +api-1/)
    await aid(s, E3270Aid.PF11)
    assert.match(row(s, ROW_HEADERS), /JOBNAME  Namespace/, 'at the last page it stays')
    await command(s, 'left')
    assert.match(row(s, ROW_HEADERS), /JOBNAME +SIO +CPU% Status/, 'a whole screen of columns back')
    await aid(s, E3270Aid.PF10)
    assert.match(row(s, ROW_HEADERS), /JOBNAME  StepName/)
    await command(s, 'right')
    assert.match(row(s, ROW_HEADERS), /JOBNAME    CPU%/)
})

test('FIND puts the first matching row on top, RFIND (PF5) the next one, wrapping; NOT FOUND otherwise', async () => {
    const pods = [...many(30), podOf('zeta-1', { node: 'gpu-node' }), podOf('zeta-2', { node: 'gpu-node' })]
    const { s } = await openDa(pods)
    await command(s, 'f gpu-node')
    assert.deepEqual(jobnames(s)[0], 'ZETA-1', 'found in a column off screen (Node)')
    await aid(s, E3270Aid.PF5)
    assert.deepEqual(jobnames(s)[0], 'ZETA-2')
    await command(s, 'rfind')
    assert.deepEqual(jobnames(s)[0], 'ZETA-1')
    assert.match(row(s, ROW_TITLE), /BOTTOM OF DATA REACHED$/)
    await command(s, "find 'no such'")
    assert.match(row(s, ROW_TITLE), /NOT FOUND$/)
    await command(s, 'find')
    assert.match(row(s, ROW_TITLE), /ENTER A FIND STRING$/)
})

test('RFIND with no FIND before', async () => {
    const { s } = await openDa([podOf('a')])
    await aid(s, E3270Aid.PF5)
    assert.match(row(s, ROW_TITLE), /NO PREVIOUS FIND$/)
})

test('PF12 brings back the commands typed before, newest first', async () => {
    const { s } = await openDa([podOf('a')])
    await command(s, 'prefix a*')
    await command(s, 'sort sio')
    await aid(s, E3270Aid.PF12)
    assert.match(row(s, ROW_COMMAND), /===> sort sio /)
    await aid(s, E3270Aid.PF12)
    assert.match(row(s, ROW_COMMAND), /===> prefix a\* /)
    await aid(s, E3270Aid.PF12)
    assert.match(row(s, ROW_COMMAND), /===> da /)
})

test('PF3, PF4 and END go back to the menu; CLEAR repaints without asking', async () => {
    const { s, source } = await openDa([podOf('a')])
    const asked = source.requests.length
    await aid(s, E3270Aid.CLEAR)
    assert.equal(source.requests.length, asked)
    assert.deepEqual(jobnames(s), ['A'])
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.MENU)
    await command(s, 'da')
    await aid(s, E3270Aid.PF4)
    assert.equal(s.panel, ESdsfPanel.MENU)
    await command(s, 'da')
    await command(s, 'end')
    assert.equal(s.panel, ESdsfPanel.MENU)
})

test('without the metrics provider: - in Real and CPU%, and a yellow warning whose long text PF1 shows', async () => {
    const { s, source } = await openDa([podOf('a')], ESdsfMetricsState.UNAVAILABLE)
    source.clusterCpu = undefined
    await enter(s)
    // the 30-character message covers the right of the title, as an ISPF short message does
    assert.match(row(s, ROW_TITLE), /CPU\/L\/Z   -\/ +METRICS PROVIDER NOT AVAILABLE$/)
    assert.equal(displayCell(s.terminal.screen, s.terminal.screen.address(ROW_TITLE, 79)).color, E3270Color.YELLOW)
    assert.match(dataRows(s)[0], / IN  F0     - /)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /Real and CPU% need Kwirth's 'metrics' provider/)
    await enter(s)
    assert.match(row(s, ROW_FILTER), /PREFIX=/, 'the long message goes on the next interaction')
})

test('a refused LIST and an unanswered one become messages, and the keyboard unlocks', async () => {
    const { s, source } = await openDa([podOf('a')])
    source.next = { ok: false, error: ESdsfError.NOT_AUTHORIZED, detail: 'no way' }
    await enter(s)
    assert.match(row(s, ROW_TITLE), /NOT AUTHORIZED$/)
    assert.equal(displayCell(s.terminal.screen, s.terminal.screen.address(ROW_TITLE, 79)).color, E3270Color.RED)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /no way/)
    source.next = { ok: false }
    await enter(s)
    assert.match(row(s, ROW_TITLE), /REQUEST FAILED$/)
    source.next = new Error('Kwirth did not answer in 30 seconds.')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /NO RESPONSE FROM KWIRTH$/)
    assert.equal(s.terminal.lock, E3270Lock.NONE)
    assert.deepEqual(jobnames(s), ['A'], 'the last good list stays on screen')
})

// ─── Line commands (S4) ───────────────────────────────────────────────────────

// Types a line command in the NP of a DA row (0-based among the visible rows).
const np = (s: SdsfSession, index: number, text: string, rowBase = ROW_FIRST_DATA) => {
    const screen = s.terminal.screen
    screen.cursor = screen.address(rowBase + index, 1)
    s.key({ key: E3270Key.ERASE_EOF })
    type(s, text)
}

const twoContainers = (name: string) => podOf(name, {
    jobId: 'STC00042',
    containers: [
        { name: 'migrate', init: true, image: 'migrate:1', ready: true, restarts: 0, state: 'terminated', reason: 'Completed' },
        { name: 'api', init: false, image: 'registry/api:2.1', ready: true, restarts: 2, state: 'running', reason: '' },
        { name: 'proxy', init: false, image: 'envoy:1', ready: false, restarts: 0, state: 'waiting', reason: 'CrashLoopBackOff' }
    ]
})

test('S opens the browse of the main container log, between the TOP and BOTTOM marks; PF3 comes back', async () => {
    const { s, source } = await openDa([twoContainers('api-1')])
    source.logs['api-1/api'] = ['first line', '\u001b[32mgreen\u001b[0m\ttabbed', 'bell\u0007']
    np(s, 0, 's')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.deepEqual(source.requests.at(-1), { command: ESdsfCommand.LOG, podNamespace: 'shop', podName: 'api-1', containerName: 'api' })
    assert.match(row(s, ROW_TITLE), /^ SDSF OUTPUT DISPLAY API-1    STC00042  DSID   101  LINE 0 +COLUMNS 01- 79$/)
    assert.match(row(s, 4), /^ \*+ TOP OF DATA \*+/)
    assert.equal(row(s, 5).trimEnd(), ' first line')
    assert.equal(row(s, 6).trimEnd(), ' green   tabbed', 'ANSI codes gone, tab to the next stop')
    assert.equal(row(s, 7).trimEnd(), ' bell.', 'control characters as dots')
    assert.match(row(s, 8), /BOTTOM OF DATA/)
    const screen = s.terminal.screen
    assert.equal(displayCell(screen, screen.address(5, 1)).color, E3270Color.GREEN)
    assert.equal(displayCell(screen, screen.address(4, 1)).color, E3270Color.WHITE)
    const asked = source.requests.length
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.equal(source.requests.length, asked + 1, 'back on the DA with a fresh list')
})

test('browse: PF8/PF7, M+PF8, PF11/PF10, TOP/BOTTOM, FIND and RFIND with the cursor on the text', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${String(i + 1).padStart(3, '0')} ${'x'.repeat(i === 50 ? 120 : 10)}${i === 70 ? ' needle here' : ''}`)
    const { s, source } = await openDa([twoContainers('api-1')])
    source.logs['api-1/api'] = lines
    np(s, 0, 's')
    await enter(s)
    await aid(s, E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 26 /)
    assert.equal(row(s, 4).slice(1, 9), 'line 026')
    await aid(s, E3270Aid.PF7)
    assert.match(row(s, ROW_TITLE), /LINE 0 /)
    await command(s, 'm', E3270Aid.PF8)
    assert.match(row(s, ROW_TITLE), /LINE 76 /)
    assert.match(row(s, 29), /BOTTOM OF DATA/)
    await command(s, 'top')
    assert.match(row(s, ROW_TITLE), /LINE 0 /)
    await aid(s, E3270Aid.PF11)
    // the widest line has 129 columns: a page right stops where it ends
    assert.match(row(s, ROW_TITLE), /COLUMNS 51- 129$/)
    assert.match(row(s, 4), /TOP OF DATA/, 'the marks do not scroll sideways')
    await aid(s, E3270Aid.PF11)
    assert.match(row(s, ROW_TITLE), /COLUMNS 51- 129$/, 'never past the widest line')
    await aid(s, E3270Aid.PF10)
    assert.match(row(s, ROW_TITLE), /COLUMNS 01- 79$/)
    await command(s, 'f needle')
    assert.match(row(s, ROW_TITLE), /LINE 71 .*CHARS 'needle' FOUND/)
    const screen = s.terminal.screen
    assert.equal(screen.rowOf(screen.cursor), 4)
    assert.equal(row(s, 4).slice(screen.colOf(screen.cursor), screen.colOf(screen.cursor) + 6), 'needle')
    await aid(s, E3270Aid.PF5)
    assert.match(row(s, ROW_TITLE), /BOTTOM OF DATA REACHED$/, 'the only one: RFIND wraps to it')
    await command(s, 'f nothing-like-it')
    assert.match(row(s, ROW_TITLE), /NOT FOUND$/)
    await command(s, 'bottom')
    assert.match(row(s, ROW_TITLE), /LINE 76 /)
    await command(s, 'up 6')
    assert.match(row(s, ROW_TITLE), /LINE 70 /)
    await command(s, 'right 5')
    assert.match(row(s, ROW_TITLE), /COLUMNS 06- 84$/)
    await command(s, 'left max')
    assert.match(row(s, ROW_TITLE), /COLUMNS 01- 79$/)
    await command(s, 'down never')
    assert.match(row(s, ROW_TITLE), /INVALID SCROLL AMOUNT$/)
    await command(s, 'sort sio')
    assert.match(row(s, ROW_TITLE), /INVALID COMMAND$/)
    await command(s, 'end')
    assert.equal(s.panel, ESdsfPanel.DA)
})

test('a log that cannot be read stays on the DA with the reason', async () => {
    const { s, source } = await openDa([twoContainers('api-1')])
    source.next = { ok: false, error: ESdsfError.FAILED, detail: 'container "api" is waiting to start' }
    np(s, 0, 's')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.match(row(s, ROW_TITLE), /REQUEST FAILED$/)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /waiting to start/)
    const empty = podOf('empty', { containers: [] })
    source.pods = [empty]
    await enter(s)
    np(s, 0, 's')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /NO OUTPUT$/)
})

test('? shows the containers as the job data sets; S on one browses its log and PF3 goes back to them', async () => {
    const { s, source } = await openDa([twoContainers('api-1')])
    source.logs['api-1/proxy'] = ['proxy says hi']
    np(s, 0, '?')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.CONTAINERS)
    assert.match(row(s, ROW_TITLE), /^ SDSF JOB DATA SET DISPLAY - JOB API-1     \(STC00042\) +LINE 1-3 \(3\)$/)
    assert.equal(row(s, 4).trimEnd(), ' NP  DDNAME   StepName ProcStep DSID Owner    C State      Rst Image')
    assert.equal(row(s, 5).trimEnd(), '     MIGRATE  INIT     MIGRATE     2 DEFAULT  B Completed    0 migrate:1')
    assert.equal(row(s, 6).trimEnd(), '     API      API                101 DEFAULT  B running      2 registry/api:2.1')
    assert.match(row(s, 7), /PROXY +API +102 DEFAULT +B CrashLoopB +0 envoy:1/)
    const screen = s.terminal.screen
    assert.equal(displayCell(screen, screen.address(7, 48)).color, E3270Color.RED)
    assert.equal(displayCell(screen, screen.address(6, 61)).color, E3270Color.YELLOW, 'restarts')
    np(s, 2, 's', 5)
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.match(row(s, ROW_TITLE), /DSID   102/)
    assert.equal(row(s, 5).trimEnd(), ' proxy says hi')
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.CONTAINERS)
    np(s, 0, 'd', 5)
    await enter(s)
    assert.match(row(s, ROW_TITLE), /INVALID LINE COMMAND$/)
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.CONTAINERS, 'Enter alone refreshes the containers')
    await command(s, 'zz')
    assert.match(row(s, ROW_TITLE), /INVALID COMMAND$/)
    source.pods = []
    // the invalid command stays on the line, as in ISPF: clear it to refresh
    await command(s, '')
    assert.match(row(s, ROW_TITLE), /POD NO LONGER EXISTS$/)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.DA)
})

test('D browses the pod described', async () => {
    const { s, source } = await openDa([twoContainers('api-1')])
    np(s, 0, 'd')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.deepEqual(source.requests.at(-1), { command: ESdsfCommand.DESCRIBE, podNamespace: 'shop', podName: 'api-1' })
    assert.match(row(s, ROW_TITLE), /^ SDSF DESCRIBE API-1    STC00042  LINE 0/)
    assert.equal(row(s, 5).trimEnd(), ' Name:             api-1')
})

test('an unknown line command stops them all', async () => {
    const { s, source } = await openDa([podOf('a'), podOf('b')])
    np(s, 0, 's')
    np(s, 1, 'x')
    const asked = source.requests.length
    await enter(s)
    assert.match(row(s, ROW_TITLE), /INVALID LINE COMMAND$/)
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.deepEqual(source.requests.slice(asked), [{ command: ESdsfCommand.LIST }])
})

test('C asks for confirmation in a window; 1 cancels and says COMMAND ISSUED; the pod is gone from the list', async () => {
    const { s, source } = await openDa([podOf('api-1', { jobId: 'STC00007' }), podOf('web-1')])
    np(s, 0, 'c')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.DA)
    const text = Array.from({ length: 32 }, (_, r) => row(s, r)).join('\n')
    assert.match(text, /Confirm Action/)
    assert.match(text, /Pending action: +\| *\n *\| +Cancel \(delete\), with the pod's grace period: +\|/)
    assert.match(text, /C   STC00007  shop\/api-1/)
    assert.match(text, /1\. Process the action/)
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).length, 0, 'nothing deleted before confirming')
    const screen = s.terminal.screen
    // the DA under the window cannot be typed on: the only input is the selection
    assert.equal(screen.fieldAddresses().filter(a => !screen.cells[a].attribute!.protected).length, 1)
    type(s, '1')
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.CANCEL), [{ command: ESdsfCommand.CANCEL, podNamespace: 'shop', podName: 'api-1', force: false }])
    assert.match(row(s, ROW_TITLE), /COMMAND ISSUED$/)
    assert.deepEqual(jobnames(s), ['WEB-1'])
    assert.doesNotMatch(Array.from({ length: 32 }, (_, r) => row(s, r)).join('\n'), /Confirm Action/)
})

test('CA confirms a cancel with no grace period; several cancels go in one window', async () => {
    const { s, source } = await openDa([podOf('a'), podOf('b'), podOf('c')])
    np(s, 0, 'ca')
    np(s, 2, 'c')
    await enter(s)
    const text = Array.from({ length: 32 }, (_, r) => row(s, r)).join('\n')
    assert.match(text, /Cancel \(delete\); CA with no grace period:/)
    assert.match(text, /CA  STC00001  shop\/a/)
    assert.match(text, /C   STC00001  shop\/c/)
    type(s, '1')
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).map(r => [r.podName, r.force]), [['a', true], ['c', false]])
    assert.deepEqual(jobnames(s), ['B'])
})

test('confirm window: 2 or PF3 leave the pods alone; anything else asks again', async () => {
    const { s, source } = await openDa([podOf('a')])
    np(s, 0, 'c')
    await enter(s)
    await enter(s)
    assert.match(row(s, ROW_TITLE), /ENTER 1 OR 2$/)
    type(s, '2')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /ACTION CANCELLED$/)
    np(s, 0, 'c')
    await enter(s)
    await aid(s, E3270Aid.PF3)
    assert.match(row(s, ROW_TITLE), /ACTION CANCELLED$/)
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).length, 0)
    assert.deepEqual(jobnames(s), ['A'])
})

test('a refused cancel says NOT AUTHORIZED, with every failure in the long message', async () => {
    const { s, source } = await openDa([podOf('a'), podOf('b')])
    source.refuseCancel.add('a')
    np(s, 0, 'c')
    np(s, 1, 'c')
    await enter(s)
    type(s, '1')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /NOT AUTHORIZED$/)
    assert.deepEqual(jobnames(s), ['A'], 'b went, a stayed')
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /shop\/a: needs sdsf\$cancel/)
})

test('cancel with no answer from Kwirth', async () => {
    const { s, source } = await openDa([podOf('a')])
    np(s, 0, 'c')
    await enter(s)
    type(s, '1')
    source.next = new Error('lost')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /REQUEST FAILED$/)
})

test('cancels first, then S, ? and D one after the other, each when PF3 comes back from the previous', async () => {
    const { s, source } = await openDa([twoContainers('a'), twoContainers('b'), podOf('c')])
    source.logs['a/api'] = ['log of a']
    np(s, 0, 's')
    np(s, 1, '?')
    np(s, 2, 'c')
    await enter(s)
    assert.match(Array.from({ length: 32 }, (_, r) => row(s, r)).join('\n'), /Confirm Action/)
    type(s, '1')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.equal(row(s, 5).trimEnd(), ' log of a')
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.CONTAINERS)
    assert.match(row(s, ROW_TITLE), /JOB B /)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.deepEqual(jobnames(s), ['A', 'B'])
})

test('PF3 on the DA drops whatever line commands were still waiting', async () => {
    const { s } = await openDa([podOf('a'), podOf('b')])
    np(s, 0, 'd')
    np(s, 1, 'd')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.BROWSE, 'the second D')
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.DA)
})

test('phase-2 panels from DA, and an unknown command, keep the command to fix it', async () => {
    const { s } = await openDa([podOf('a')])
    await command(s, 'log')
    assert.match(row(s, ROW_TITLE), /NOT AVAILABLE$/)
    await command(s, 'xyz')
    assert.match(row(s, ROW_TITLE), /INVALID COMMAND$/)
    assert.match(row(s, ROW_COMMAND), /===> xyz /)
})

test('&nn refreshes on its own while nobody types; & stops it, PA1 too; leaving DA stops it', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { s, source } = await openDa([podOf('a')])
    await command(s, '&5')
    assert.match(row(s, ROW_FILTER), /SORT=\*  &5 *$/)
    const asked = source.requests.length
    t.mock.timers.tick(5000)
    await settle()
    assert.equal(source.requests.length, asked + 1)
    // half-typed input: the tick waits
    s.terminal.screen.cursor = s.terminal.screen.address(ROW_COMMAND, COMMAND_COL)
    type(s, 'x')
    t.mock.timers.tick(5000)
    await settle()
    assert.equal(source.requests.length, asked + 1)
    await command(s, '&')
    assert.doesNotMatch(row(s, ROW_FILTER), /&/)
    const stopped = source.requests.length
    t.mock.timers.tick(20000)
    await settle()
    assert.equal(source.requests.length, stopped)
    await command(s, '&2')
    await aid(s, E3270Aid.PA1)
    assert.match(row(s, ROW_TITLE), /AUTO UPDATE STOPPED$/)
    await command(s, '&2')
    await aid(s, E3270Aid.PF3)
    const away = source.requests.length
    t.mock.timers.tick(10000)
    await settle()
    assert.equal(source.requests.length, away)
    await command(s, 'da')
    await command(s, '&1000')
    assert.match(row(s, ROW_TITLE), /INVALID INTERVAL$/)
    await command(s, '&x')
    assert.match(row(s, ROW_TITLE), /INVALID COMMAND$/)
    s.dispose()
})
