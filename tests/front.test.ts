import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ETasklistCommand, ITasklistMessageResponse, ITasklistNode, ITasklistProcess, ITasklistRequest, ITasklistSnapshot } from '../src/common/TasklistTypes'
import { cpuColumn, cpuTime, kilobytes, kilobytesBare, linkSpeed, megabytes, meterBytes, networkScale, percent, utilisation } from '../src/front/Format'
import { DEFAULT_COLUMNS, HISTORY_POINTS, networkUtilisation, TasklistSession } from '../src/front/TasklistSession'
import { EProcessColumn, ETasklistTab, EUpdateSpeed } from '../src/front/TasklistSessionTypes'
import { IDLE_UID, idleProcess, visibleProcesses } from '../src/front/window/ProcessesTab'
import { performanceFigures } from '../src/front/window/PerformanceTab'
import { applicationKey, statusOf } from '../src/front/window/ApplicationsTab'
import { listState } from '../src/front/window/ListState'
import { MIN_HEIGHT, MIN_WIDTH, NORMAL_HEIGHT, NORMAL_WIDTH, placementOf, resizedPlacement } from '../src/front/window/Placement'

// ─── the window on the tab's desktop ──────────────────────────────────────────────────────────────

test('placementOf: centred the first time, where it was left after, never bigger than nor out of the desktop', () => {
    const s = new TasklistSession('c', new FakeSource())
    assert.deepEqual(placementOf(s, 1000, 800), [190, 100, NORMAL_WIDTH, NORMAL_HEIGHT])
    assert.deepEqual(placementOf(s, 500, 400), [0, 0, 500, 400])
    s.placeWindow(300, 150, 500, 400)
    assert.deepEqual(placementOf(s, 1000, 800), [300, 150, 500, 400])
    // the tab shrank: the window comes back in
    assert.deepEqual(placementOf(s, 700, 500), [200, 100, 500, 400])
    s.dispose()
})

test('resizedPlacement: right and bottom edges grow the size; left and top ones move the corner; limits kept', () => {
    const start: [number, number, number, number] = [100, 100, 500, 400]
    assert.deepEqual(resizedPlacement(start, 'se', 600, 450, 1000, 800), [100, 100, 600, 450])
    assert.deepEqual(resizedPlacement(start, 'w', 550, 400, 1000, 800), [50, 100, 550, 400])
    assert.deepEqual(resizedPlacement(start, 'nw', 550, 450, 1000, 800), [50, 50, 550, 450])
    // not past the desktop's edges
    assert.deepEqual(resizedPlacement(start, 'e', 2000, 400, 1000, 800), [100, 100, 900, 400])
    assert.deepEqual(resizedPlacement(start, 'n', 500, 2000, 1000, 800), [100, 0, 500, 500])
    // not under the minimum
    assert.deepEqual(resizedPlacement(start, 's', 10, 10, 1000, 800), [100, 100, MIN_WIDTH, MIN_HEIGHT])
    assert.deepEqual(resizedPlacement(start, 'w', 10, 400, 1000, 800), [100 + 500 - MIN_WIDTH, 100, MIN_WIDTH, 400])
})

// ─── Format ───────────────────────────────────────────────────────────────────────────────────────

test('figures as XP wrote them', () => {
    assert.equal(kilobytes(4128 * 1024), '4,128 K')
    assert.equal(kilobytes(17_200 * 1024), '17,200 K')
    assert.equal(kilobytes(undefined), '')
    assert.equal(kilobytesBare(1_041_440 * 1024), '1,041,440')
    assert.equal(cpuColumn(0.2), '00')
    assert.equal(cpuColumn(7.6), '08')
    assert.equal(cpuColumn(99), '99')
    assert.equal(cpuColumn(140), '100')
    assert.equal(cpuColumn(undefined), '')
    assert.equal(cpuTime(12), '0:00:12')
    assert.equal(cpuTime(3725.9), '1:02:05')
    assert.equal(cpuTime(undefined), '')
    assert.equal(percent(1.4), '1%')
    assert.equal(percent(undefined), '--')
    assert.equal(megabytes(276 * 1024 * 1024), '276M')
    assert.equal(meterBytes(276 * 1024 * 1024), '276 MB')
    assert.equal(meterBytes(12 * 1024 ** 3), '12.0 GB')
    assert.equal(utilisation(undefined), '0 %')
    assert.equal(utilisation(0), '0 %')
    assert.equal(utilisation(0.04), '0.04 %')
    assert.equal(utilisation(12.4), '12 %')
    assert.equal(linkSpeed(1e9), '1 Gbps')
    assert.equal(linkSpeed(1e8), '100 Mbps')
})

test('networkScale grows in XP\'s steps', () => {
    assert.equal(networkScale([]), 1)
    assert.equal(networkScale([0.5]), 1)
    assert.equal(networkScale([0.5, 3]), 5)
    assert.equal(networkScale([30]), 50)
    assert.equal(networkScale([300]), 100)
})

// ─── the session ──────────────────────────────────────────────────────────────────────────────────

const node = (name: string, over: Partial<ITasklistNode> = {}): ITasklistNode => ({
    name, ready: true, unschedulable: false, cpuCapacity: 4, cpuAllocatable: 4, memoryCapacity: 8e9, memoryAllocatable: 7e9, cpu: 20, ...over
})

const process = (name: string, namespace: string, over: Partial<ITasklistProcess> = {}): ITasklistProcess => ({
    uid: `${namespace}/${name}`, pid: 4, name, namespace, node: 'n1', phase: 'Running', containers: [{ name: 'c', image: 'i', state: 'Running', ready: true, restarts: 0 }], ...over
})

const snapshot = (over: Partial<ITasklistSnapshot> = {}): ITasklistSnapshot => ({
    processes: [process('api', 'payroll'), process('coredns', 'kube-system')],
    nodes: [node('n1', { rxBytesPerSecond: 1_250_000, txBytesPerSecond: 0 }), node('n2')],
    users: [], applications: [], requests: { cpu: 1, memory: 3e9 },
    metrics: { cpu: 30, memory: 2e9, interval: 10 },
    ...over
})

class FakeSource {
    requests: ITasklistRequest[] = []
    answers: (ITasklistMessageResponse | Error)[] = []
    request = async (request: ITasklistRequest): Promise<ITasklistMessageResponse> => {
        this.requests.push(request)
        const answer = this.answers.shift() ?? { ok: true, snapshot: snapshot(), canEnd: true, isAdmin: false } as ITasklistMessageResponse
        if (answer instanceof Error) throw answer
        return answer
    }
}

test('networkUtilisation: both directions over the nominal gigabit; nothing without readings', () => {
    assert.equal(networkUtilisation(node('n', { rxBytesPerSecond: 1_250_000, txBytesPerSecond: 0 })), 1)
    assert.equal(networkUtilisation(node('n')), undefined)
})

test('the session starts on Processes, Normal speed, the four XP columns, no system users', () => {
    const s = new TasklistSession('c', new FakeSource())
    assert.equal(s.state.tab, ETasklistTab.PROCESSES)
    assert.equal(s.state.updateSpeed, EUpdateSpeed.NORMAL)
    assert.deepEqual(s.state.columns, DEFAULT_COLUMNS)
    assert.deepEqual(DEFAULT_COLUMNS, [EProcessColumn.IMAGE_NAME, EProcessColumn.USER_NAME, EProcessColumn.CPU, EProcessColumn.MEM_USAGE])
    assert.equal(s.state.allUsers, false)
    s.dispose()
})

test('refresh: takes the snapshot, the permissions and one point per graph; tells its listeners', async () => {
    const source = new FakeSource()
    const s = new TasklistSession('c', source)
    let told = 0
    s.subscribe(() => told++)
    s.setState({ updateSpeed: EUpdateSpeed.PAUSED })
    told = 0
    await s.refresh()
    assert.deepEqual(source.requests, [{ command: ETasklistCommand.SNAPSHOT }])
    assert.equal(told, 1)
    assert.equal(s.canEnd, true)
    assert.equal(s.isAdmin, false)
    assert.equal(s.ticks, 1)
    assert.deepEqual(s.history.cpu, [30])
    assert.deepEqual(s.history.memory, [2e9])
    assert.deepEqual(s.history.nodeCpu, { n1: [20], n2: [20] })
    assert.deepEqual(s.history.nodeNetwork, { n1: [1], n2: [0] })
    assert.equal(s.commitPeak, 3e9)
    s.dispose()
})

test('the history keeps the last points, follows the nodes, and the commit peak only grows', () => {
    const s = new TasklistSession('c', new FakeSource())
    for (let i = 0; i < HISTORY_POINTS + 5; i++) s.take(snapshot({ metrics: { cpu: i, memory: 1, interval: 10 } }))
    assert.equal(s.history.cpu.length, HISTORY_POINTS)
    assert.equal(s.history.cpu[HISTORY_POINTS - 1], HISTORY_POINTS + 4)
    s.take(snapshot({ nodes: [node('n2')], requests: { cpu: 1, memory: 1e9 }, metrics: undefined }))
    assert.deepEqual(Object.keys(s.history.nodeCpu), ['n2'])
    assert.equal(s.history.cpu.at(-1), 0)
    assert.equal(s.commitPeak, 3e9)
    s.dispose()
})

test('refresh: a failed answer or a lost socket is shown in the status, and the last snapshot stays', async () => {
    const source = new FakeSource()
    const s = new TasklistSession('c', source)
    s.setState({ updateSpeed: EUpdateSpeed.PAUSED })
    await s.refresh()
    source.answers.push({ ok: false, detail: 'forbidden' } as ITasklistMessageResponse)
    await s.refresh()
    assert.equal(s.error, 'forbidden')
    assert.ok(s.snapshot)
    source.answers.push(new Error('The connection to Kwirth was lost.'))
    await s.refresh()
    assert.equal(s.error, 'The connection to Kwirth was lost.')
    await s.refresh()
    assert.equal(s.error, undefined)
    s.dispose()
})

test('the Update Speed asks again on its own; Paused stops; dispose stops for good', async () => {
    const source = new FakeSource()
    const s = new TasklistSession('c', source)
    s.setState({ updateSpeed: EUpdateSpeed.HIGH })
    await s.refresh()
    await new Promise(r => setTimeout(r, 1150))
    assert.ok(source.requests.length >= 2)
    s.setState({ updateSpeed: EUpdateSpeed.PAUSED })
    const asked = source.requests.length
    await new Promise(r => setTimeout(r, 1150))
    assert.equal(source.requests.length, asked)
    s.dispose()
    await s.refresh()
    assert.equal(source.requests.length, asked)
})

test('act: the answer for the dialog, and a fresh snapshot only when it worked', async () => {
    const source = new FakeSource()
    const s = new TasklistSession('c', source)
    s.setState({ updateSpeed: EUpdateSpeed.PAUSED })
    source.answers.push({ ok: false, detail: 'Access is denied.' } as ITasklistMessageResponse)
    const denied = await s.act({ command: ETasklistCommand.END_PROCESS, targetNamespace: 'a', targetName: 'b' })
    assert.equal(denied.ok, false)
    assert.equal(source.requests.length, 1)
    source.answers.push({ ok: true } as ITasklistMessageResponse)
    await s.act({ command: ETasklistCommand.END_PROCESS, targetNamespace: 'a', targetName: 'b' })
    await new Promise(r => setTimeout(r, 10))
    assert.deepEqual(source.requests.map(r => r.command), [ETasklistCommand.END_PROCESS, ETasklistCommand.END_PROCESS, ETasklistCommand.SNAPSHOT])
    s.dispose()
})

test('selection and window state live in the session', () => {
    const s = new TasklistSession('c', new FakeSource())
    s.select(ETasklistTab.PROCESSES, ['x'])
    s.setMaximized(true)
    assert.deepEqual(s.selection[ETasklistTab.PROCESSES], ['x'])
    assert.equal(s.maximized, true)
    s.dispose()
})

// ─── what the tabs show ───────────────────────────────────────────────────────────────────────────

test('visibleProcesses: the system users only when asked, and then the idle process too', () => {
    const s = new TasklistSession('c', new FakeSource())
    assert.deepEqual(visibleProcesses(s), [])
    s.take(snapshot())
    assert.deepEqual(visibleProcesses(s).map(p => p.name), ['api'])
    s.setState({ allUsers: true })
    assert.deepEqual(visibleProcesses(s).map(p => p.name), ['api', 'coredns', 'System Idle Process'])
    const idle = visibleProcesses(s).find(p => p.uid === IDLE_UID)!
    assert.equal(idle.pid, 0)
    assert.equal(idle.namespace, 'SYSTEM')
    assert.equal(idle.cpu, 70)
    assert.equal(idleProcess(130).cpu, 0)
    s.take(snapshot({ metrics: undefined }))
    assert.ok(!visibleProcesses(s).some(p => p.uid === IDLE_UID))
    s.dispose()
})

test('performanceFigures: the boxes of the Performance tab (PLAN §3)', () => {
    const s = new TasklistSession('c', new FakeSource())
    assert.deepEqual(performanceFigures(s), {
        processes: 0, threads: 0, physicalTotal: undefined, physicalAvailable: undefined, systemCache: undefined,
        commitTotal: undefined, commitLimit: undefined, commitPeak: undefined, memoryUsed: undefined
    })
    s.take(snapshot())
    assert.deepEqual(performanceFigures(s), {
        processes: 2, threads: 2, physicalTotal: 16e9, physicalAvailable: 14e9, systemCache: 2e9,
        commitTotal: 3e9, commitLimit: 14e9, commitPeak: 3e9, memoryUsed: 2e9
    })
    // below 'cluster' there are no nodes: the machine's boxes stay empty
    s.take(snapshot({ nodes: [] }))
    assert.equal(performanceFigures(s).physicalTotal, undefined)
    assert.equal(performanceFigures(s).commitLimit, undefined)
    s.dispose()
})

test('applications: Running when every replica is ready, Not Responding when not', () => {
    assert.equal(statusOf({ namespace: 'a', name: 'b', replicas: 2, readyReplicas: 2 }), 'Running')
    assert.equal(statusOf({ namespace: 'a', name: 'b', replicas: 2, readyReplicas: 1 }), 'Not Responding')
    assert.equal(statusOf({ namespace: 'a', name: 'b', replicas: 0, readyReplicas: 0 }), 'Running')
    assert.equal(applicationKey({ namespace: 'a', name: 'b', replicas: 1, readyReplicas: 1 }), 'a/b')
})

test('listState: widths and sort kept per list in the session', () => {
    const s = new TasklistSession('c', new FakeSource())
    const p = listState(s, 'processes', { column: 'x', descending: false })
    assert.deepEqual(p.sort, { column: 'x', descending: false })
    p.onWidth('cpu', 50)
    p.onSort({ column: 'cpu', descending: true })
    listState(s, 'users').onWidth('cpu', 99)
    const again = listState(s, 'processes')
    assert.deepEqual(again.widths, { cpu: 50 })
    assert.deepEqual(again.sort, { column: 'cpu', descending: true })
    assert.deepEqual(listState(s, 'users').widths, { cpu: 99 })
    s.dispose()
})
