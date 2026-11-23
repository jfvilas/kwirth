import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESdsfPanel, SdsfSession } from '../src/common/SdsfSession'
import { ISdsfDataSource } from '../src/common/SdsfDataSource'
import { E3270Aid, E3270Color, E3270Highlight, E3270Key, E3270Lock } from '../src/common/terminal/Terminal3270Types'
import { displayCell } from '../src/common/terminal/Display3270'
import { COMMAND_COL, ROW_COMMAND, ROW_RULE, ROW_TITLE, rowPfKeys } from '../src/common/panels/SdsfLayout'
import { dataRows as dataRowsOf, ROW_FILTER, ROW_FIRST_DATA, ROW_HEADERS } from '../src/common/panels/DaPanel'
import { I3270Geometry, MODEL3_GEOMETRY } from '../src/common/terminal/Terminal3270Types'
import { ESdsfCommand, ESdsfError, ESdsfJobState, ESdsfMetricsState, ESdsfNodeAction, ESdsfNodeStatus, ESdsfObjectKind, ESdsfQos, ISdsfEvent, ISdsfJob, ISdsfMessageResponse, ISdsfNode, ISdsfPod, ISdsfRequest } from '../src/common/SdsfTypes'
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
    events: ISdsfEvent[] = []
    jobs: ISdsfJob[] = []
    failEvents?: Partial<ISdsfMessageResponse> | Error   // only for the EVENTS read (LOG asks LIST and EVENTS together)
    refuseCancel = new Set<string>()                   // pod names whose cancel the back refuses
    nodes: ISdsfNode[] = []
    refuseNode = new Set<string>()                     // node names whose actions the back refuses (not admin)
    evicted = 0                                        // what a drain answers
    request = (request: ISdsfRequest): Promise<ISdsfMessageResponse> => {
        this.requests.push(request)
        const next = this.next
        this.next = undefined
        if (next instanceof Error) return Promise.reject(next)
        switch (request.command) {
            case ESdsfCommand.LOG:
                return Promise.resolve(response({ command: request.command, lines: this.logs[`${request.targetName}/${request.containerName}`] ?? [], ...next }))
            case ESdsfCommand.DESCRIBE:
                return Promise.resolve(response({ command: request.command, lines: [`Name:             ${request.targetName}`, `Namespace:        ${request.targetNamespace}`], ...next }))
            case ESdsfCommand.EVENTS: {
                const fail = this.failEvents
                this.failEvents = undefined
                if (fail instanceof Error) return Promise.reject(fail)
                return Promise.resolve(response({ command: request.command, events: this.events, ...next, ...fail }))
            }
            case ESdsfCommand.JOBS:
                return Promise.resolve(response({ command: request.command, jobs: this.jobs, ...next }))
            case ESdsfCommand.NODES:
                return Promise.resolve(response({ command: request.command, nodes: this.nodes, ...next }))
            case ESdsfCommand.NODE: {
                if (this.refuseNode.has(request.targetName!)) return Promise.resolve(response({ command: request.command, ok: false, error: ESdsfError.NOT_AUTHORIZED, detail: "needs 'admin'" }))
                const status = request.nodeAction === ESdsfNodeAction.START ? ESdsfNodeStatus.ACTIVE
                    : request.nodeAction === ESdsfNodeAction.HALT ? ESdsfNodeStatus.HALTED : ESdsfNodeStatus.DRAINED
                this.nodes = this.nodes.map(n => n.name === request.targetName ? { ...n, status } : n)
                return Promise.resolve(response({ command: request.command, ...(request.nodeAction === ESdsfNodeAction.DRAIN ? { evicted: this.evicted } : {}), ...next }))
            }
            case ESdsfCommand.CANCEL:
                if (this.refuseCancel.has(request.targetName!)) return Promise.resolve(response({ command: request.command, ok: false, error: ESdsfError.NOT_AUTHORIZED, detail: 'needs sdsf$cancel' }))
                if (request.objectKind === ESdsfObjectKind.POD) this.pods = this.pods.filter(p => p.name !== request.targetName)
                else this.jobs = this.jobs.filter(j => j.name !== request.targetName)
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
const dataRows = (s: SdsfSession) => Array.from({ length: dataRowsOf(s.terminal.screen) }, (_, i) => row(s, ROW_FIRST_DATA + i)).filter(r => r.trim())
const jobnames = (s: SdsfSession) => dataRows(s).map(r => r.slice(5, 13).trim())

const open = async (pods: ISdsfPod[] = [], metrics = ESdsfMetricsState.AVAILABLE, geometry: I3270Geometry = MODEL3_GEOMETRY) => {
    const source = new FakeSource()
    source.pods = pods
    source.metrics = metrics
    const s = new SdsfSession('k3d-dev-cluster', source, geometry, () => NOW)
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
    assert.match(screen.rowText(rowPfKeys(screen)), /F1=HELP .* F6=BOOK/)
    assert.match(screen.rowText(rowPfKeys(screen) + 1), /F7=UP .* F12=RETRIEVE/)
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

test('menu: an unknown option says INVALID COMMAND and stays to be fixed', async () => {
    const { s, source } = await open()
    await command(s, 'zz')
    assert.equal(displayCell(s.terminal.screen, s.terminal.screen.address(ROW_TITLE, 79)).color, E3270Color.RED)
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
    assert.deepEqual(source.requests.at(-1), { command: ESdsfCommand.LOG, objectKind: ESdsfObjectKind.POD, targetNamespace: 'shop', targetName: 'api-1', containerName: 'api' })
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
    assert.deepEqual(source.requests.at(-1), { command: ESdsfCommand.DESCRIBE, objectKind: ESdsfObjectKind.POD, targetNamespace: 'shop', targetName: 'api-1' })
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

test('C asks first in the Confirm Action window of SDSF: one action, its line and its JOBNAME; Enter takes the 1 already there', async () => {
    const { s, source } = await openDa([podOf('api-1', { jobId: 'STC00007' }), podOf('web-1')])
    np(s, 0, 'c')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.DA)
    const text = screenText(s)
    assert.match(text, /Confirm Action/)
    assert.match(text, /1 {2}1\. {2}Process action character/)
    assert.match(text, /2\. {2}Discard action character/)
    assert.match(text, /3\. {2}Process action character and/)
    assert.match(text, /set confirmation off/)
    assert.match(text, /Line number: 1 +API-1/)
    assert.match(text, /F1=Help +F2=Split +F3=Cancel/)
    assert.match(text, /F9=Swap +F12=Cancel/)
    assert.doesNotMatch(text, /delete/i, 'it does not say what the action does, as on SDSF')
    assert.match(row(s, ROW_FIRST_DATA), /^ C {3}API-1/, 'the C stays on its NP')
    const screen = s.terminal.screen
    // the frame: yellow lines from the headers row, 13 columns short of the right edge
    assert.equal(row(s, ROW_HEADERS).slice(25, 67), '┌' + '─'.repeat(40) + '┐')
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS, 25)).color, E3270Color.YELLOW)
    assert.equal(row(s, ROW_HEADERS + 13).slice(25, 67), '└' + '─'.repeat(40) + '┘')
    const field = screen.address(ROW_HEADERS + 4, 28)
    assert.equal(screen.cursor, field)
    assert.equal(displayCell(screen, field).color, E3270Color.TURQUOISE)
    assert.equal(displayCell(screen, field).highlight, E3270Highlight.UNDERSCORE)
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS + 2, 40)).color, E3270Color.TURQUOISE, 'the title')
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS + 4, 34)).color, E3270Color.WHITE, 'the options')
    for (let r = ROW_HEADERS; r <= ROW_HEADERS + 13; r++) {
        assert.equal(displayCell(screen, screen.address(r, 66)).color, E3270Color.YELLOW, `the right border, row ${r}`)
        assert.equal(displayCell(screen, screen.address(r, 25)).color, E3270Color.YELLOW, `the left border, row ${r}`)
    }
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS + 9, 28)).color, E3270Color.GREEN, 'Line number:')
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS + 9, 49)).color, E3270Color.TURQUOISE, 'the JOBNAME')
    assert.equal(displayCell(screen, screen.address(ROW_HEADERS + 11, 30)).color, E3270Color.BLUE, 'the keys')
    assert.equal(displayCell(screen, screen.address(ROW_FIRST_DATA + 1, 5)).color, E3270Color.BLUE, 'the DA beside it keeps its colours')
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).length, 0, 'nothing deleted before confirming')
    // the DA under the window cannot be typed on: the only input is the selection
    assert.equal(screen.fieldAddresses().filter(a => !screen.cells[a].attribute!.protected).length, 1)
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.CANCEL), [{ command: ESdsfCommand.CANCEL, objectKind: ESdsfObjectKind.POD, targetNamespace: 'shop', targetName: 'api-1', force: false }])
    assert.match(row(s, ROW_TITLE), /COMMAND ISSUED$/)
    assert.deepEqual(jobnames(s), ['WEB-1'])
    assert.doesNotMatch(screenText(s), /Confirm Action/)
})

test('several actions: one window each, in order, with its line number; CA goes with no grace period', async () => {
    const { s, source } = await openDa([podOf('a'), podOf('b'), podOf('c')])
    np(s, 0, 'ca')
    np(s, 2, 'c')
    await enter(s)
    assert.match(screenText(s), /Line number: 1 +A\b/)
    assert.match(row(s, ROW_FIRST_DATA), /^ CA  A/)
    assert.match(row(s, ROW_FIRST_DATA + 2), /^ C {3}C/, 'both letters on their NP while the first is asked')
    await enter(s)
    assert.match(screenText(s), /Line number: 3 +C\b/)
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).length, 1, 'the first is processed before the second is asked')
    type(s, '1')
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).map(r => [r.targetName, r.force]), [['a', true], ['c', false]])
    assert.deepEqual(jobnames(s), ['B'])
    assert.match(row(s, ROW_TITLE), /COMMAND ISSUED$/)
})

test('confirm window: 2, PF3 or PF12 discard; PF1 says what the action does; anything else asks again', async () => {
    const { s, source } = await openDa([podOf('a')])
    np(s, 0, 'c')
    await enter(s)
    type(s, '9')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /INVALID SELECTION$/)
    assert.match(screenText(s), /Confirm Action/, 'the window stays')
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_TITLE), /C ACTION$/)
    assert.match(row(s, ROW_FILTER), /C cancels \(deletes\) it, with its grace period/)
    assert.match(screenText(s), /Confirm Action/)
    type(s, '2')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /ACTION CANCELLED$/)
    for (const key of [E3270Aid.PF3, E3270Aid.PF12]) {
        np(s, 0, 'c')
        await enter(s)
        await aid(s, key)
        assert.match(row(s, ROW_TITLE), /ACTION CANCELLED$/)
        assert.equal(s.panel, ESdsfPanel.DA)
    }
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).length, 0)
    assert.deepEqual(jobnames(s), ['A'])
})

test('confirm window: 2 discards that one only; 3 processes it and the rest go without asking, until SET CONFIRM ON', async () => {
    const { s, source } = await openDa([podOf('a'), podOf('b'), podOf('c'), podOf('d')])
    np(s, 0, 'c')
    np(s, 1, 'c')
    np(s, 2, 'c')
    await enter(s)
    type(s, '2')
    await enter(s)
    assert.match(screenText(s), /Line number: 2 +B\b/)
    type(s, '3')
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).map(r => r.targetName), ['b', 'c'], 'c without a window of its own')
    assert.doesNotMatch(screenText(s), /Confirm Action/)
    assert.match(row(s, ROW_TITLE), /COMMAND ISSUED$/)
    assert.deepEqual(jobnames(s), ['A', 'D'])
    np(s, 0, 'c')
    await enter(s)
    assert.doesNotMatch(screenText(s), /Confirm Action/, 'confirmation off: straight away')
    assert.deepEqual(jobnames(s), ['D'])
    await command(s, 'set confirm on')
    assert.match(row(s, ROW_TITLE), /CONFIRM ON$/)
    np(s, 0, 'c')
    await enter(s)
    assert.match(screenText(s), /Confirm Action/)
    await aid(s, E3270Aid.PF3)
    await command(s, 'SET CONFIRM OFF')
    assert.match(row(s, ROW_TITLE), /CONFIRM OFF$/)
    await command(s, 'set confirm maybe')
    assert.match(row(s, ROW_TITLE), /INVALID PARAMETER$/)
    await command(s, 'set colour on')
    assert.match(row(s, ROW_TITLE), /INVALID PARAMETER$/)
})

test('a refused cancel says NOT AUTHORIZED, with every failure in the long message', async () => {
    const { s, source } = await openDa([podOf('a'), podOf('b')])
    source.refuseCancel.add('a')
    np(s, 0, 'c')
    np(s, 1, 'c')
    await enter(s)
    await enter(s)
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

test('an unknown command on the DA keeps the command to fix it', async () => {
    const { s } = await openDa([podOf('a')])
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

// ─── LOG (S6) ─────────────────────────────────────────────────────────────────

const eventOf = (i: number, over: Partial<ISdsfEvent> = {}): ISdsfEvent => ({
    time: new Date(Date.parse('2026-11-22T11:00:00Z') + i * 1000).toISOString(),
    type: 'Normal', reason: 'Pulled', message: `event ${i}`, namespace: 'shop', kind: 'Pod', name: 'api-1', uid: 'u-api',
    count: 1, source: 'kubelet', ...over
})

test('LOG from the menu shows the events as the SYSLOG, at the bottom, coloured by severity; PF3 back to the menu', async () => {
    const { s, source } = await open([podOf('api-1', { uid: 'u-api', jobId: 'STC00042' })])
    source.events = [
        ...Array.from({ length: 40 }, (_, i) => eventOf(i)),
        eventOf(40, { type: 'Warning', reason: 'BackOff', message: 'Back-off restarting failed container' }),
        eventOf(41, { type: 'Warning', reason: 'ScalingReplicaSet', kind: 'Deployment', name: 'api', uid: 'u-dep', message: 'odd but not a failure' })
    ]
    await command(s, 'log')
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.match(row(s, ROW_TITLE), /^ SDSF SYSLOG K3D-DEV- \(ALL\)  LINE 18 +COLUMNS 01- 79$/, 'opened at the bottom: 42 lines + 2 marks, 26 rows')
    assert.match(row(s, 29), /BOTTOM OF DATA/)
    assert.equal(row(s, 27).trimEnd(), ' W K3D-DEV- 26326 11:00:40.00 STC00042 00000001  BackOff pod/shop/api-1: Back-off restarting failed container'.slice(0, 80).trimEnd())
    // 79 columns: the reason always fits, the rest of the line is PF11 away
    assert.match(row(s, 28), /^ W K3D-DEV- 26326 11:00:41\.00 {10}00000001  ScalingReplicaSet deployment\/sh$/)
    const screen = s.terminal.screen
    assert.equal(displayCell(screen, screen.address(27, 1)).color, E3270Color.RED)
    assert.equal(displayCell(screen, screen.address(28, 1)).color, E3270Color.YELLOW)
    assert.equal(displayCell(screen, screen.address(26, 1)).color, E3270Color.GREEN)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.MENU)
})

test('LOG: Enter follows the log when at the bottom, and stays put when scrolled up', async () => {
    const { s, source } = await open([podOf('api-1', { uid: 'u-api' })])
    source.events = Array.from({ length: 40 }, (_, i) => eventOf(i))
    await command(s, 'log')
    assert.match(row(s, ROW_TITLE), /LINE 16 /)
    source.events = Array.from({ length: 50 }, (_, i) => eventOf(i))
    await enter(s)
    assert.match(row(s, ROW_TITLE), /LINE 26 /, 'at the bottom: it follows')
    await command(s, 'top')
    source.events = Array.from({ length: 60 }, (_, i) => eventOf(i))
    await command(s, '')
    assert.match(row(s, ROW_TITLE), /LINE 0 /, 'scrolled up: it stays')
    await command(s, 'f event 55')
    assert.match(row(s, ROW_TITLE), /LINE 56 .*FOUND/)
})

test('LOG: DEST and PREFIX filter the events; from DA it goes back to DA', async () => {
    const { s, source } = await openDa([podOf('api-1')])
    source.events = [eventOf(0), eventOf(1, { namespace: 'kube-system', name: 'coredns-1', message: 'dns' }), eventOf(2, { name: 'web-1', message: 'web' })]
    await command(s, 'log')
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.match(row(s, ROW_TITLE), /LINE 0 /)
    await command(s, 'dest kube-system')
    assert.match(row(s, ROW_TITLE), /SYSLOG K3D-DEV- KUBE-SYS/)
    assert.match(row(s, 5), /Pulled pod\/kube-system\/coredns-$/)
    assert.match(row(s, 6), /BOTTOM OF DATA/)
    await command(s, 'dest (all)')
    await command(s, 'prefix web*')
    assert.match(row(s, 5), /Pulled pod\/shop\/web-1: web/)
    assert.match(row(s, 6), /BOTTOM OF DATA/)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.DA)
})

test('LOG: &nn keeps it running; PA1 stops it; a refused read says why', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { s, source } = await open([podOf('api-1', { uid: 'u-api' })])
    source.events = [eventOf(0)]
    await command(s, 'log')
    await command(s, '&3')
    const asked = source.requests.filter(r => r.command === ESdsfCommand.EVENTS).length
    t.mock.timers.tick(3000)
    await settle()
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.EVENTS).length, asked + 1)
    await command(s, '&2000')
    assert.match(row(s, ROW_TITLE), /INVALID INTERVAL$/)
    await aid(s, E3270Aid.PA1)
    assert.match(row(s, ROW_TITLE), /AUTO UPDATE STOPPED$/)
    // leaving the LOG with &nn on stops it: it does not go on refreshing the panel it returns to
    await command(s, '&3')
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.MENU)
    const away = source.requests.length
    t.mock.timers.tick(9000)
    await settle()
    assert.equal(source.requests.length, away)
    await command(s, 'log')
    await command(s, '&')
    source.failEvents = { ok: false, error: ESdsfError.FAILED, detail: 'events are not readable' }
    await command(s, '')
    assert.match(row(s, ROW_TITLE), /REQUEST FAILED$/)
    source.failEvents = new Error('lost')
    await command(s, '')
    assert.match(row(s, ROW_TITLE), /NO RESPONSE FROM KWIRTH$/)
    s.dispose()
})

// ─── ST, O and H (S7) ─────────────────────────────────────────────────────────

const jobOf = (name: string, over: Partial<ISdsfJob> = {}): ISdsfJob => ({
    kind: ESdsfObjectKind.JOB, name, namespace: 'batch', uid: name, jobId: 'JOB00001', owner: 'runner', cronJob: '', schedule: '',
    state: ESdsfJobState.COMPLETE, parallelism: 1, completions: 1, active: 0, succeeded: 1, failed: 0,
    start: '2026-11-22T11:00:00.000Z', end: '2026-11-22T11:01:30.000Z', ...over
})

const batch = () => [
    jobOf('backup-1', { jobId: 'JOB00011', cronJob: 'backup', start: '2026-11-22T10:00:00.000Z' }),
    jobOf('backup-2', { jobId: 'JOB00012', cronJob: 'backup', state: ESdsfJobState.RUNNING, succeeded: 0, active: 1, end: '', start: '2026-11-22T11:30:00.000Z' }),
    jobOf('migrate', { jobId: 'JOB00013', state: ESdsfJobState.FAILED, failed: 3, succeeded: 0, end: '' }),
    jobOf('backup', { kind: ESdsfObjectKind.CRONJOB, jobId: 'JOB00014', schedule: '0 2 * * *', state: ESdsfJobState.SCHEDULED, start: '2026-11-22T02:00:00.000Z', end: '' }),
    jobOf('report', { kind: ESdsfObjectKind.CRONJOB, jobId: 'JOB00015', schedule: '*/5 * * * *', state: ESdsfJobState.SUSPENDED, start: '', end: '' })
]

const podOfJob = (job: string, name: string, created: string) => podOf(name, {
    namespace: 'batch', controllerKind: 'Job', controllerName: job, jobId: 'JOB00099', created,
    containers: [{ name: 'work', init: false, image: 'x', ready: false, restarts: 0, state: 'terminated', reason: 'Completed' }]
})

const openSt = async (verb = 'st') => {
    const o = await open([podOfJob('backup-2', 'backup-2-abc', '2026-11-22T11:30:00.000Z'), podOfJob('backup-1', 'backup-1-old', '2026-11-22T10:00:00.000Z')])
    o.source.jobs = batch()
    await command(o.s, verb)
    return o
}

test('ST lists Jobs and CronJobs as batch jobs: Queue and Status in JES terms', async () => {
    const { s, source } = await openSt()
    assert.equal(s.panel, ESdsfPanel.ST)
    assert.deepEqual(source.requests.map(r => r.command), [ESdsfCommand.LIST, ESdsfCommand.JOBS], 'the pods too: S and ? on a Job go to its pod')
    assert.match(row(s, ROW_TITLE), /^ SDSF STATUS DISPLAY ALL CLASSES +LINE 1-5 \(5\)$/)
    assert.equal(row(s, ROW_HEADERS).trimEnd(), ' NP  JOBNAME  JobID    Owner    Prty Queue     C Status             Age')
    assert.deepEqual(jobnames(s), ['BACKUP-1', 'BACKUP-2', 'MIGRATE', 'BACKUP', 'REPORT'], 'Jobs before CronJobs, then by name')
    assert.match(dataRows(s)[0], /BACKUP-1 JOB00011 RUNNER +1 PRINT +J COMPLETE 1\/1/)
    assert.match(dataRows(s)[1], /BACKUP-2 JOB00012 RUNNER +1 EXECUTION J ACTIVE 0\/1/)
    assert.match(dataRows(s)[2], /MIGRATE +JOB00013 RUNNER +1 PRINT +J FAILED 3/)
    assert.match(dataRows(s)[3], /BACKUP +JOB00014 RUNNER +1 INPUT +C SCHEDULED/)
    assert.match(dataRows(s)[4], /REPORT +JOB00015 RUNNER +1 HOLD +C SUSPENDED/)
    const screen = s.terminal.screen
    assert.equal(displayCell(screen, screen.address(ROW_FIRST_DATA + 2, 50)).color, E3270Color.RED, 'a failed Job in red')
    assert.equal(displayCell(screen, screen.address(ROW_FIRST_DATA + 4, 50)).color, E3270Color.PINK, 'held in pink')
    await aid(s, E3270Aid.PF11)
    assert.match(row(s, ROW_HEADERS), /^ NP  JOBNAME  Schedule +CronJob +Dur Namespace/)
    assert.match(dataRows(s)[0], /BACKUP-1 +backup +61m batch/, 'from 10:00 to 11:01:30')
    assert.match(dataRows(s)[3], /BACKUP +0 2 \* \* \*/)
    await aid(s, E3270Aid.PF11)
    assert.match(row(s, ROW_HEADERS), /^ NP  JOBNAME  JobName/)
})

test('O shows the Jobs that ended; H the CronJobs suspended; DA and ST switch from any table', async () => {
    const { s } = await openSt('o')
    assert.equal(s.panel, ESdsfPanel.OUTPUT)
    assert.match(row(s, ROW_TITLE), /^ SDSF OUTPUT ALL CLASSES ALL FORMS/)
    assert.deepEqual(jobnames(s), ['BACKUP-1', 'MIGRATE'])
    await command(s, 'h')
    assert.equal(s.panel, ESdsfPanel.HELD)
    assert.match(row(s, ROW_TITLE), /^ SDSF HELD OUTPUT DISPLAY ALL CLASSES/)
    assert.deepEqual(jobnames(s), ['REPORT'])
    await command(s, 'st')
    assert.equal(jobnames(s).length, 5)
    await command(s, 'da')
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.deepEqual(jobnames(s), ['BACKUP-1', 'BACKUP-2'], 'the pods, on the DA')
})

test('ST: filters, SORT on its own columns, FIND; going to DA forgets the ST sort', async () => {
    const { s } = await openSt()
    await command(s, 'prefix backup*')
    assert.deepEqual(jobnames(s), ['BACKUP-1', 'BACKUP-2', 'BACKUP'])
    await command(s, 'prefix *')
    await command(s, 'sort queue d')
    assert.match(row(s, ROW_FILTER), /SORT=QUEUE\/D/)
    assert.deepEqual(jobnames(s), ['BACKUP-1', 'MIGRATE', 'BACKUP', 'REPORT', 'BACKUP-2'])
    await command(s, 'sort sio')
    assert.match(row(s, ROW_TITLE), /INVALID COLUMN NAME$/, 'SIO is a DA column, not an ST one')
    await command(s, 'f 0 2 *')
    assert.equal(jobnames(s)[0], 'BACKUP')
    await command(s, 'da')
    assert.match(row(s, ROW_FILTER), /SORT=\*/)
})

test('S on a Job browses its newest pod; on a CronJob, that of its newest run; none means NO OUTPUT', async () => {
    const { s, source } = await openSt()
    source.logs['backup-2-abc/work'] = ['backing up']
    np(s, 3, 's')                                    // the CronJob backup: its newest run is backup-2
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.equal(row(s, 5).trimEnd(), ' backing up')
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.ST, 'back to ST, not DA')
    np(s, 2, 's')                                    // migrate has no pod left
    await enter(s)
    assert.match(row(s, ROW_TITLE), /NO OUTPUT$/)
    assert.equal(s.panel, ESdsfPanel.ST)
})

test('? on a Job shows its pod\'s containers and PF3 returns to ST; D describes the Job', async () => {
    const { s, source } = await openSt()
    np(s, 0, '?')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.CONTAINERS)
    assert.match(row(s, ROW_TITLE), /JOB BACKUP-1/)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.ST)
    np(s, 4, 'd')
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.DESCRIBE).at(-1),
        { command: ESdsfCommand.DESCRIBE, objectKind: ESdsfObjectKind.CRONJOB, targetNamespace: 'batch', targetName: 'report' })
    assert.match(row(s, ROW_TITLE), /SDSF DESCRIBE REPORT   JOB00015/)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.ST)
    np(s, 2, '?')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /NO OUTPUT$/)
})

test('C on a Job and a CronJob: a window each, by line and JOBNAME; 1 deletes them, back on ST', async () => {
    const { s, source } = await openSt()
    np(s, 2, 'c')
    np(s, 4, 'c')
    await enter(s)
    assert.match(screenText(s), /Line number: 3 +MIGRATE/)
    await enter(s)
    assert.match(screenText(s), /Line number: 5 +REPORT/)
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.CANCEL).map(r => [r.objectKind, r.targetName]),
        [[ESdsfObjectKind.JOB, 'migrate'], [ESdsfObjectKind.CRONJOB, 'report']])
    assert.equal(s.panel, ESdsfPanel.ST)
    assert.match(row(s, ROW_TITLE), /COMMAND ISSUED$/)
    assert.deepEqual(jobnames(s), ['BACKUP-1', 'BACKUP-2', 'BACKUP'])
})

test('&nn works on ST too', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const { s, source } = await openSt()
    await command(s, '&4')
    const asked = source.requests.filter(r => r.command === ESdsfCommand.JOBS).length
    t.mock.timers.tick(4000)
    await settle()
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.JOBS).length, asked + 1)
    s.dispose()
})

// ─── DA parameters ────────────────────────────────────────────────────────────

const zoo = () => [
    podOf('api-1'),
    podOf('batch-1', { controllerKind: 'Job', jobId: 'JOB00001' }),
    podOf('debug', { controllerKind: '', jobId: 'TSU00001' }),
    podOf('proxy-1', { controllerKind: 'DaemonSet' }),
    podOf('done-1', { controllerKind: 'Job', phase: 'Succeeded', ready: false }),
    podOf('queued', { phase: 'Pending', ready: false, node: '' }),
    podOf('starting', { phase: 'Pending', ready: false, node: 'node-1' })
]

test('DA parameters: bare DA is the DADFLT, without initiators (DaemonSets) or the ended pods', async () => {
    const { s } = await openDa(zoo())
    assert.deepEqual(jobnames(s).sort(), ['API-1', 'BATCH-1', 'DEBUG', 'QUEUED', 'STARTING'])
})

test('DA parameters: OJOB, OTSU, OINIT, OREADY, INIT and ALL, typed from the menu and from the DA itself', async () => {
    const o = await open(zoo())
    await command(o.s, 'da ojob')
    assert.deepEqual(jobnames(o.s), ['BATCH-1'])
    await command(o.s, 'DA OTSU')
    assert.deepEqual(jobnames(o.s), ['DEBUG'])
    await command(o.s, 'da oinit')
    assert.deepEqual(jobnames(o.s), ['PROXY-1'])
    await command(o.s, 'da oready')
    assert.deepEqual(jobnames(o.s), ['STARTING'])
    await command(o.s, 'da noready noout')
    assert.deepEqual(jobnames(o.s).sort(), ['API-1', 'BATCH-1', 'DEBUG'])
    await command(o.s, 'da oready allt')
    assert.match(row(o.s, ROW_TITLE), /PARAMETER INVALID$/)
    await command(o.s, 'da init')
    assert.deepEqual(jobnames(o.s).sort(), ['API-1', 'BATCH-1', 'DEBUG', 'PROXY-1', 'QUEUED', 'STARTING'])
    await command(o.s, 'da all')
    assert.equal(jobnames(o.s).length, 7)
    await command(o.s, 'da')
    assert.deepEqual(jobnames(o.s).sort(), ['API-1', 'BATCH-1', 'DEBUG', 'QUEUED', 'STARTING'], 'bare DA goes back to the DADFLT')
})

test('DA parameters: a wrong one says PARAMETER INVALID, keeps the command to be fixed and the DA as it was', async () => {
    const o = await open(zoo())
    await command(o.s, 'da ojob oin')
    assert.match(row(o.s, ROW_TITLE), /PARAMETER INVALID$/)
    assert.match(row(o.s, ROW_COMMAND), /===> da ojob oin /)
    assert.equal(o.s.terminal.lock, E3270Lock.NONE)
    await command(o.s, 'da ojob')
    await command(o.s, 'da job stc tsu init in')
    assert.match(row(o.s, ROW_TITLE), /PARAMETER INVALID$/)
    assert.deepEqual(jobnames(o.s), ['BATCH-1'], 'the DA keeps the filter it had')
    await command(o.s, 'da')
    assert.match(row(o.s, ROW_TITLE), /LINE 1-5 \(5\)$/, 'from the DA itself, after the error')
})

test('DA parameters: they stay while moving inside the DA and are forgotten by SDSF DA from READY', async () => {
    const o = await open(zoo())
    await command(o.s, 'da notsu nojob')
    await command(o.s, 'sort jobname d')
    assert.deepEqual(jobnames(o.s), ['STARTING', 'QUEUED', 'API-1'])
    await command(o.s, 'prefix *')
    assert.deepEqual(jobnames(o.s), ['STARTING', 'QUEUED', 'API-1'], 'other commands keep the DA parameters')
    await aid(o.s, E3270Aid.PF3)
    await aid(o.s, E3270Aid.PF3)
    assert.equal(o.s.panel, ESdsfPanel.READY)
    type(o.s, 'sdsf da')
    await enter(o.s)
    assert.deepEqual(jobnames(o.s).sort(), ['API-1', 'BATCH-1', 'DEBUG', 'QUEUED', 'STARTING'])
})

// ─── Terminal models ──────────────────────────────────────────────────────────

const MODEL2 = { rows: 24, cols: 80 }
const MODEL5 = { rows: 27, cols: 132 }
const screenText = (s: SdsfSession) => Array.from({ length: s.terminal.screen.rows }, (_, r) => row(s, r)).join('\n')
const podsN = (n: number) => Array.from({ length: n }, (_, i) => podOf(`pod-${String(i).padStart(2, '0')}`))

// What every panel keeps on any model: SCROLL on the right edge, the PF keys on the last two rows.
const assertFrame = (s: SdsfSession) => {
    const screen = s.terminal.screen
    assert.match(row(s, ROW_COMMAND), /SCROLL ===> PAGE$/)
    assert.equal(row(s, ROW_COMMAND).length, screen.cols)
    assert.match(row(s, screen.rows - 2), /F1=HELP .* F6=BOOK/)
    assert.match(row(s, screen.rows - 1), /F7=UP .* F12=RETRIEVE/)
    assert.equal(row(s, ROW_RULE), ' ' + '-'.repeat(screen.cols - 1))
}

test('3278-2 (24x80): the menu, the DA with 16 rows and its paging, the browse with 18', async () => {
    const o = await open(podsN(40), ESdsfMetricsState.AVAILABLE, MODEL2)
    assertFrame(o.s)
    await command(o.s, 'da')
    assertFrame(o.s)
    assert.match(row(o.s, ROW_TITLE), /LINE 1-16 \(40\)$/)
    assert.equal(dataRows(o.s).length, 16)
    await aid(o.s, E3270Aid.PF8)
    assert.match(row(o.s, ROW_TITLE), /LINE 17-32 \(40\)$/)
    await command(o.s, 'bottom')
    assert.match(row(o.s, ROW_TITLE), /LINE 25-40 \(40\)$/)
    await command(o.s, 'top')
    o.source.logs['pod-00/main'] = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`)
    np(o.s, 0, 's')
    await enter(o.s)
    assertFrame(o.s)
    assert.equal(row(o.s, 4).trim(), '*'.repeat(33) + ' TOP OF DATA ' + '*'.repeat(33))
    assert.match(row(o.s, 21), /^ line 17 *$/, '18 rows of browse: the mark and 17 lines')
    await aid(o.s, E3270Aid.PF8)
    assert.match(row(o.s, 4), /^ line 18 /)
})

test('3278-2 (24x80): the confirm window fits over the DA, above the PF keys', async () => {
    const o = await open(podsN(6), ESdsfMetricsState.AVAILABLE, MODEL2)
    await command(o.s, 'da')
    np(o.s, 5, 'c')
    await enter(o.s)
    const rows = Array.from({ length: 24 }, (_, r) => row(o.s, r))
    assert.equal(rows.findIndex(r => r.slice(25, 26) === '┌'), ROW_HEADERS)
    assert.equal(rows.findIndex(r => r.slice(25, 26) === '└'), ROW_HEADERS + 13, 'the bottom of the frame on row 18, before the PF keys on 22')
    assert.match(screenText(o.s), /Line number: 6 +POD-05/)
    type(o.s, '2')
    await enter(o.s)
    assert.match(row(o.s, ROW_TITLE), /ACTION CANCELLED$/)
})

test('3278-5 (27x132): the DA with 19 rows and more columns on the first page, a 131-column browse, the window on the right', async () => {
    const o = await open(podsN(40).map((p, i) => ({ ...p, cpu: i, memory: 1024 * 1024 })), ESdsfMetricsState.AVAILABLE, MODEL5)
    assertFrame(o.s)
    assert.match(row(o.s, ROW_TITLE), /-+  SDSF PRIMARY OPTION MENU  -+$/)
    await command(o.s, 'da')
    assertFrame(o.s)
    assert.match(row(o.s, ROW_TITLE), /LINE 1-19 \(40\)$/)
    assert.equal(dataRows(o.s).length, 19)
    assert.match(row(o.s, ROW_HEADERS), /SIO +CPU% Status/, 'on 132 columns the CPU% and Status follow without PF11')
    const wide = 'x'.repeat(120) + 'END-OF-LINE' + 'y'.repeat(20)
    o.source.logs['pod-00/main'] = [wide]
    np(o.s, 0, 's')
    await enter(o.s)
    assertFrame(o.s)
    assert.match(row(o.s, ROW_TITLE), /COLUMNS 01- 131$/)
    assert.equal(row(o.s, 4).length, 132)
    assert.equal(row(o.s, 5), ' ' + wide.slice(0, 131))
    await aid(o.s, E3270Aid.PF3)
    np(o.s, 0, 'c')
    await enter(o.s)
    assert.equal(row(o.s, ROW_HEADERS).indexOf('┌'), 132 - 42 - 13, 'on the right, 13 short of the edge, as on 80 columns')
})

test('any model: READY takes the whole width', async () => {
    const o = await open([], ESdsfMetricsState.AVAILABLE, MODEL5)
    await command(o.s, 'end')
    assert.equal(o.s.panel, ESdsfPanel.READY)
    type(o.s, 'x'.repeat(130))
    await enter(o.s)
    assert.equal(row(o.s, 1).trim(), 'x'.repeat(130))
})

// ─── INIT (nodes) ─────────────────────────────────────────────────────────────

const nodeOf = (name: string, over: Partial<ISdsfNode> = {}): ISdsfNode => ({
    name, id: name.slice(-1), status: ESdsfNodeStatus.ACTIVE, roles: [], pods: 3, cpus: 4, memory: 8 * 1024 ** 3, cpu: 12.5, memoryUsed: 512 * 1024 ** 2,
    version: 'v1.31.5+k3s1', internalIp: '172.18.0.2', created: '2026-11-01T12:00:00.000Z', ...over
})

const openInit = async () => {
    const o = await open([podOf('api-1', { node: 'node-a' }), podOf('web-1', { node: 'node-b' }), podOf('proxy-a', { node: 'node-a', controllerKind: 'DaemonSet' })])
    o.source.nodes = [
        nodeOf('node-b', { roles: ['control-plane', 'master'] }),
        nodeOf('node-a'),
        nodeOf('node-c', { status: ESdsfNodeStatus.INACTIVE, cpu: undefined, memoryUsed: undefined })
    ]
    await command(o.s, 'init')
    return o
}

test('INIT lists the nodes as initiators: ID, Status, Classes, Pods, CPU%, Real, CPUs, MemGB, Version', async () => {
    const { s, source } = await openInit()
    assert.equal(s.panel, ESdsfPanel.INIT)
    assert.deepEqual(source.requests.map(r => r.command), [ESdsfCommand.NODES])
    assert.match(row(s, ROW_TITLE), /^ SDSF INITIATOR DISPLAY  ALL CLASSES +LINE 1-3 \(3\)$/)
    assert.match(row(s, ROW_FILTER), /^ PREFIX=\*  DEST=\(ALL\)  OWNER=\*  SORT=\*/)
    assert.equal(row(s, ROW_HEADERS).trimEnd(), ' NP  ID       Status   Classes      Pods   CPU%   Real CPUs  MemGB Version')
    assert.deepEqual(dataRows(s).map(r => r.slice(5, 13).trim()), ['A', 'B', 'C'], 'the IDs, by name')
    assert.match(dataRows(s)[0], /A +ACTIVE +WORKER +3 +12\.50 +512 +4 +8\.0 v1\.31\.5\+k3s1/)
    assert.match(dataRows(s)[1], /CONTROL-PLAN /)
    assert.match(dataRows(s)[2], /INACTIVE .* - +- /)
    const screen = s.terminal.screen
    assert.equal(displayCell(screen, screen.address(ROW_FIRST_DATA + 2, 14)).color, E3270Color.RED, 'INACTIVE in red')
    await aid(s, E3270Aid.PF11)
    assert.match(row(s, ROW_HEADERS), /IP +Age +NodeName/)
    assert.match(dataRows(s)[0], /172\.18\.0\.2 +21d +node-a/)
    await command(s, 'sort pods d')
    await command(s, 'prefix node-b')
    assert.equal(dataRows(s).length, 1)
})

test('INIT: D describes the node; ? shows its pods on the DA, of every type, and PF3 comes back to INIT', async () => {
    const { s, source } = await openInit()
    np(s, 0, 'd')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.BROWSE)
    assert.deepEqual(source.requests.at(-1), { command: ESdsfCommand.DESCRIBE, objectKind: ESdsfObjectKind.NODE, targetNamespace: '', targetName: 'node-a' })
    assert.match(row(s, ROW_TITLE), /DESCRIBE NODE-A {3}INIT/)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.INIT)
    np(s, 0, '?')
    await enter(s)
    assert.equal(s.panel, ESdsfPanel.DA)
    assert.deepEqual(jobnames(s), ['API-1', 'PROXY-A'], 'its pods, the DaemonSet one too')
    assert.match(row(s, ROW_FILTER), /NODE=node-a/)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.INIT)
    await command(s, 'da')
    assert.deepEqual(jobnames(s), ['API-1', 'WEB-1'], 'DA typed again: every node, the DADFLT')
    assert.doesNotMatch(row(s, ROW_FILTER), /NODE=/)
    await aid(s, E3270Aid.PF3)
    assert.equal(s.panel, ESdsfPanel.MENU)
})

test('INIT: Z, S and P ask first; 1 halts, starts and drains; 2 leaves the nodes alone', async () => {
    const { s, source } = await openInit()
    np(s, 0, 'z')
    await enter(s)
    const text = screenText(s)
    assert.match(text, /Confirm Action/)
    assert.match(text, /Line number: 1 +A\b/, 'the node by its ID')
    assert.match(row(s, ROW_FIRST_DATA), /^ Z /)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /Z halts the node: cordon, no new pods/)
    type(s, '2')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /ACTION CANCELLED$/)
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.NODE).length, 0)

    np(s, 0, 'z')
    await enter(s)
    type(s, '1')
    await enter(s)
    assert.deepEqual(source.requests.filter(r => r.command === ESdsfCommand.NODE).at(-1), { command: ESdsfCommand.NODE, objectKind: ESdsfObjectKind.NODE, targetName: 'node-a', nodeAction: ESdsfNodeAction.HALT })
    assert.match(row(s, ROW_TITLE), /COMMAND ISSUED$/)
    assert.match(dataRows(s)[0], /A +HALTED/)

    np(s, 0, 's')
    await enter(s)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /S on INIT starts the node: uncordon/)
    type(s, '1')
    await enter(s)
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.NODE).at(-1)?.nodeAction, ESdsfNodeAction.START)
    assert.match(dataRows(s)[0], / A +ACTIVE/)

    source.evicted = 2
    np(s, 0, 'p')
    await enter(s)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /P drains the node: cordon, and evict its pods but the DaemonSet and static ones/)
    type(s, '1')
    await enter(s)
    assert.equal(source.requests.filter(r => r.command === ESdsfCommand.NODE).at(-1)?.nodeAction, ESdsfNodeAction.DRAIN)
    assert.match(dataRows(s)[0], /A +DRAINED/)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /node node-a: 2 pod\(s\) evicted/)
})

test('INIT: a window per node; a refused one says NOT AUTHORIZED with the reason; C is not an INIT command', async () => {
    const { s, source } = await openInit()
    source.refuseNode.add('node-b')
    np(s, 0, 'z')
    np(s, 1, 'p')
    await enter(s)
    assert.match(screenText(s), /Line number: 1 +A\b/)
    await enter(s)
    assert.match(screenText(s), /Line number: 2 +B\b/)
    await enter(s)
    assert.match(row(s, ROW_TITLE), /NOT AUTHORIZED$/)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /node node-b: needs 'admin'/)
    np(s, 0, 'c')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /INVALID LINE COMMAND$/)
    await aid(s, E3270Aid.PF1)
    assert.match(row(s, ROW_FILTER), /S, \?, D, Z, P/)
    np(s, 0, 'z')
    await enter(s)
    assert.doesNotMatch(row(s, ROW_TITLE), /INVALID/)
})

test('the DA does not take the INIT commands', async () => {
    const { s } = await openDa([podOf('a')])
    np(s, 0, 'z')
    await enter(s)
    assert.match(row(s, ROW_TITLE), /INVALID LINE COMMAND$/)
})

// ─── I (input queue) and ULOG ─────────────────────────────────────────────────

test('the menu: I under DA, LOG after a blank row, ULOG on the right', async () => {
    const { s } = await open()
    assert.match(row(s, 5), /^ DA {4}Active pods\s+INIT  Initiators \(nodes\)/)
    assert.match(row(s, 6), /^ I {5}Input queue \(jobs waiting to run\)/)
    assert.equal(row(s, 10).trim(), '', 'the blank row between the queues and the LOG')
    assert.match(row(s, 11), /^ LOG {3}System log \(events\)\s+ULOG  User session log/)
    assert.match(row(s, 13), /^ END {3}Exit SDSF/)
})

test('I lists what waits to run: the CronJobs scheduled and the Jobs not started; S on a waiting Job has no output', async () => {
    const o = await open([podOfJob('backup-2', 'backup-2-abc', '2026-11-22T11:30:00.000Z')])
    o.source.jobs = [...batch(), jobOf('queued', { jobId: 'JOB00016', state: ESdsfJobState.WAITING, succeeded: 0, start: '', end: '' })]
    await command(o.s, 'i')
    assert.equal(o.s.panel, ESdsfPanel.INPUT)
    assert.match(row(o.s, ROW_TITLE), /^ SDSF INPUT QUEUE DISPLAY ALL CLASSES +LINE 1-2 \(2\)$/)
    assert.deepEqual(jobnames(o.s), ['QUEUED', 'BACKUP'], 'the Job first, then the CronJob')
    assert.match(dataRows(o.s)[0], /QUEUED +JOB00016 RUNNER +1 INPUT +J WAITING/)
    assert.match(dataRows(o.s)[1], /BACKUP +JOB00014 RUNNER +1 INPUT +C SCHEDULED/)
    np(o.s, 0, 's')
    await enter(o.s)
    assert.match(row(o.s, ROW_TITLE), /NO OUTPUT$/)
    assert.equal(o.s.panel, ESdsfPanel.INPUT)
    await command(o.s, 'st')
    assert.equal(jobnames(o.s).length, 6, 'ST shows the waiting one too')
    await command(o.s, 'i')
    await aid(o.s, E3270Aid.PF3)
    assert.equal(o.s.panel, ESdsfPanel.MENU)
})

test('ULOG: every action of the session and what came of it, newest at the bottom; ULOG CLOSE empties it', async () => {
    const o = await openDa([podOf('a'), podOf('b'), podOf('c')])
    o.source.refuseCancel.add('c')
    await command(o.s, 'ulog')
    assert.equal(o.s.panel, ESdsfPanel.BROWSE)
    assert.match(row(o.s, ROW_TITLE), /^ SDSF ULOG CONSOLE K3D-DEV- /)
    assert.match(row(o.s, 4), /TOP OF DATA/)
    assert.match(row(o.s, 5), /BOTTOM OF DATA/, 'nothing done yet')
    await aid(o.s, E3270Aid.PF3)
    assert.equal(o.s.panel, ESdsfPanel.DA, 'PF3 back where it came from')
    np(o.s, 0, 'c')
    np(o.s, 1, 'c')
    np(o.s, 2, 'ca')
    await enter(o.s)
    await enter(o.s)
    type(o.s, '2')
    await enter(o.s)
    await enter(o.s)
    await command(o.s, 'set confirm off')
    await command(o.s, 'ulog')
    const lines = [5, 6, 7, 8].map(r => row(o.s, r))
    assert.equal(lines[0].trimEnd(), ' K3D-DEV- 12:00:00.00  C   shop/a' + ' '.repeat(25) + 'COMMAND ISSUED')
    assert.match(lines[1], /C {3}shop\/b +DISCARDED *$/)
    assert.match(lines[2], /CA  shop\/c +NOT AUTHORIZED: needs $/, 'the rest is past column 79')
    assert.match(lines[3], /SET CONFIRM OFF +CONFIRM OFF/)
    const screen = o.s.terminal.screen
    assert.equal(displayCell(screen, screen.address(5, 2)).color, E3270Color.GREEN)
    assert.equal(displayCell(screen, screen.address(7, 2)).color, E3270Color.RED, 'a refusal in red')
    await aid(o.s, E3270Aid.PF11)
    assert.match(row(o.s, 7), /needs sdsf\$cancel/, 'PF11 brings it')
    await aid(o.s, E3270Aid.PF10)
    await aid(o.s, E3270Aid.PF3)
    await command(o.s, 'ulog close')
    assert.match(row(o.s, ROW_TITLE), /ULOG CLOSED$/)
    await command(o.s, 'ulog')
    assert.match(row(o.s, 5), /BOTTOM OF DATA/)
    await aid(o.s, E3270Aid.PF3)
    await command(o.s, 'ulog now')
    assert.match(row(o.s, ROW_TITLE), /INVALID PARAMETER$/)
})

test('ULOG from the menu goes back to the menu; option 3 and a drain are logged too', async () => {
    const o = await openInit()
    o.source.evicted = 4
    np(o.s, 0, 'p')
    await enter(o.s)
    type(o.s, '3')
    await enter(o.s)
    await aid(o.s, E3270Aid.PF3)
    assert.equal(o.s.panel, ESdsfPanel.MENU)
    await command(o.s, 'ulog')
    assert.match(row(o.s, 5), /SET CONFIRM OFF +CONFIRM OFF \(option 3\)/)
    assert.match(row(o.s, 6), /P {3}node node-a +4 POD\(S\) EVICTED/)
    await aid(o.s, E3270Aid.PF3)
    assert.equal(o.s.panel, ESdsfPanel.MENU)
})
