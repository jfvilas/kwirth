import { ETasklistCommand, ITasklistMessageResponse, ITasklistNode, ITasklistRequest, ITasklistSnapshot } from '../common/TasklistTypes'
import { ITasklistDataSource } from './TasklistBackSource'
import { EProcessColumn, ETasklistTab, EUpdateSpeed, INotepadWindow, ITasklistSession, IWindowFrame, TASK_MANAGER_WINDOW, UPDATE_SPEED_MS } from './TasklistSessionTypes'

// How many points each graph keeps: what fits across the widest history box, as XP keeps.
export const HISTORY_POINTS = 120
// The kubelet does not give a link speed (PLAN §3): every adapter is a nominal gigabit.
export const LINK_SPEED_BPS = 1e9

export const DEFAULT_COLUMNS: EProcessColumn[] = [EProcessColumn.IMAGE_NAME, EProcessColumn.USER_NAME, EProcessColumn.CPU, EProcessColumn.MEM_USAGE]

export interface ITasklistHistory {
    cpu: number[]                          // % of the cluster
    memory: number[]                       // bytes in use
    nodeCpu: Record<string, number[]>      // % of each node
    nodeNetwork: Record<string, number[]>  // % of each node's link
}

// A node's network utilisation: what it moved in both directions, over the nominal link.
export const networkUtilisation = (node: ITasklistNode): number | undefined => {
    if (node.rxBytesPerSecond === undefined || node.txBytesPerSecond === undefined) return undefined
    return (node.rxBytesPerSecond + node.txBytesPerSecond) * 8 / LINK_SPEED_BPS * 100
}

const push = (series: number[], value: number): number[] => {
    const next = [...series, value]
    return next.length > HISTORY_POINTS ? next.slice(next.length - HISTORY_POINTS) : next
}

/*
    The Task Manager of one tab: what it shows, how it is set and the history of its graphs. It lives in
    channelObject.data, so switching Kwirth tabs keeps all of it (RF11), and it asks for a snapshot at the
    Update Speed — on its own, as XP does, whether the tab is on screen or not.
*/
export class TasklistSession {
    readonly cluster: string
    private readonly source: ITasklistDataSource
    state: ITasklistSession = {
        tab: ETasklistTab.PROCESSES,
        updateSpeed: EUpdateSpeed.NORMAL,
        allUsers: false,
        columns: [...DEFAULT_COLUMNS],
        widths: {},
        sort: {},
        graphPerCpu: false
    }
    snapshot?: ITasklistSnapshot
    canEnd = false
    isAdmin = false
    error?: string
    history: ITasklistHistory = { cpu: [], memory: [], nodeCpu: {}, nodeNetwork: {} }
    // how many snapshots the graphs have taken: what scrolls their grid
    ticks = 0
    commitPeak = 0
    // what is selected on each tab, and how the windows sit: survive a switch of Kwirth tabs too
    selection: Partial<Record<ETasklistTab, string[]>> = {}
    // XP's "tiny footprint": a double click on the panel hides the title, menus, tabs and status bar; another brings them back
    compact = false
    // the desktop's windows: the Task Manager's, the Notepads open, and which is in front of which (the last, active)
    taskManager: IWindowFrame = { maximized: false, minimized: false }
    // closed with its own close button: off the desktop and the taskbar, asking the cluster nothing; Start opens it again
    taskManagerOpen = true
    notepads: INotepadWindow[] = []
    zOrder: string[] = [TASK_MANAGER_WINDOW]
    private notepadSequence = 0
    private listeners = new Set<() => void>()
    private timer?: ReturnType<typeof setTimeout>
    private asking = false
    private disposed = false

    constructor(cluster: string, source: ITasklistDataSource) {
        this.cluster = cluster
        this.source = source
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    private changed = (): void => {
        for (const listener of this.listeners) listener()
    }

    // The instance exists: the first snapshot, and the rest at the Update Speed.
    connected = (): void => {
        void this.refresh()
    }

    dispose = (): void => {
        this.disposed = true
        if (this.timer) clearTimeout(this.timer)
        this.timer = undefined
        this.listeners.clear()
    }

    private schedule = (): void => {
        if (this.timer) clearTimeout(this.timer)
        this.timer = undefined
        const ms = UPDATE_SPEED_MS[this.state.updateSpeed]
        if (this.disposed || ms === 0 || !this.taskManagerOpen) return
        this.timer = setTimeout(() => { void this.refresh() }, ms)
    }

    // View → Refresh Now, and every tick. One question at a time: a slow cluster does not pile them up.
    refresh = async (): Promise<void> => {
        if (this.disposed || this.asking) return
        this.asking = true
        try {
            const response = await this.source.request({ command: ETasklistCommand.SNAPSHOT })
            if (this.disposed) return
            if (response.ok && response.snapshot) {
                this.take(response.snapshot)
                this.canEnd = response.canEnd === true
                this.isAdmin = response.isAdmin === true
                this.error = undefined
            }
            else {
                this.error = response.detail ?? 'The snapshot failed'
            }
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : String(err)
        }
        finally {
            this.asking = false
        }
        if (this.disposed) return
        this.changed()
        this.schedule()
    }

    // A new snapshot: one more point on every graph.
    take = (snapshot: ITasklistSnapshot): void => {
        this.snapshot = snapshot
        this.ticks++
        const h = this.history
        h.cpu = push(h.cpu, snapshot.metrics?.cpu ?? 0)
        h.memory = push(h.memory, snapshot.metrics?.memory ?? 0)
        const nodeCpu: Record<string, number[]> = {}
        const nodeNetwork: Record<string, number[]> = {}
        for (const node of snapshot.nodes) {
            nodeCpu[node.name] = push(h.nodeCpu[node.name] ?? [], node.cpu ?? 0)
            nodeNetwork[node.name] = push(h.nodeNetwork[node.name] ?? [], networkUtilisation(node) ?? 0)
        }
        // a node that left the cluster takes its graphs with it
        h.nodeCpu = nodeCpu
        h.nodeNetwork = nodeNetwork
        this.commitPeak = Math.max(this.commitPeak, snapshot.requests.memory)
    }

    select = (tab: ETasklistTab, keys: string[]): void => {
        this.selection = { ...this.selection, [tab]: keys }
        this.changed()
    }

    setCompact = (compact: boolean): void => {
        this.compact = compact
        this.changed()
    }

    // ─── the desktop's windows ────────────────────────────────────────────────────────────────────

    // A window's frame; none for a window that is not on the desktop (a closed Task Manager, a closed Notepad).
    frameOf = (id: string): IWindowFrame | undefined =>
        id === TASK_MANAGER_WINDOW ? (this.taskManagerOpen ? this.taskManager : undefined) : this.notepads.find(n => n.id === id)?.frame

    // The window in front: the last of the z-order that is not minimised.
    activeWindow = (): string | undefined =>
        [...this.zOrder].reverse().find(id => this.frameOf(id)?.minimized === false)

    // A move, a resize, a maximise or a minimise of a window. Restoring one brings it to the front.
    setFrame = (id: string, patch: Partial<IWindowFrame>): void => {
        const frame = this.frameOf(id)
        if (!frame) return
        Object.assign(frame, patch)
        if (patch.minimized === false) this.zOrder = [...this.zOrder.filter(w => w !== id), id]
        this.changed()
    }

    activate = (id: string): void => {
        if (this.zOrder[this.zOrder.length - 1] === id && this.frameOf(id)?.minimized === false) return
        this.setFrame(id, { minimized: false })
    }

    // Its taskbar button: the window in front is minimised; any other comes to the front.
    toggleFromTaskbar = (id: string): void => {
        if (this.activeWindow() === id) this.setFrame(id, { minimized: true })
        else this.activate(id)
    }

    // Its close button: the window goes, and the snapshots stop until it is opened again.
    closeTaskManager = (): void => {
        this.taskManagerOpen = false
        this.zOrder = this.zOrder.filter(w => w !== TASK_MANAGER_WINDOW)
        if (this.timer) clearTimeout(this.timer)
        this.timer = undefined
        this.changed()
    }

    // Start → Task Manager: in front if it is open; opened again, where it was, and asked for a snapshot if not.
    openTaskManager = (): void => {
        if (this.taskManagerOpen) {
            this.activate(TASK_MANAGER_WINDOW)
            return
        }
        this.taskManagerOpen = true
        this.taskManager.minimized = false
        this.zOrder = [...this.zOrder, TASK_MANAGER_WINDOW]
        this.changed()
        void this.refresh()
    }

    // A new Notepad on the desktop, in front, a little down and right of the last one opened (as Windows cascades them).
    openNotepad = (title: string, text: string, readOnly: boolean, yaml: boolean, save?: (text: string) => Promise<string | undefined>): string => {
        const id = `notepad-${++this.notepadSequence}`
        const step = (this.notepads.length % 8) * 24
        this.notepads = [...this.notepads, { id, title, text, saved: text, readOnly, yaml, save, frame: { x: 40 + step, y: 30 + step, maximized: false, minimized: false } }]
        this.zOrder = [...this.zOrder, id]
        this.changed()
        return id
    }

    setNotepadText = (id: string, text: string, saved?: boolean): void => {
        const notepad = this.notepads.find(n => n.id === id)
        if (!notepad) return
        notepad.text = text
        if (saved) notepad.saved = text
        this.changed()
    }

    closeNotepad = (id: string): void => {
        this.notepads = this.notepads.filter(n => n.id !== id)
        this.zOrder = this.zOrder.filter(w => w !== id)
        this.changed()
    }

    setState = (patch: Partial<ITasklistSession>): void => {
        const speedChanged = patch.updateSpeed !== undefined && patch.updateSpeed !== this.state.updateSpeed
        this.state = { ...this.state, ...patch }
        if (speedChanged) this.schedule()
        this.changed()
    }

    // A question that changes nothing (a log, an object's YAML): its answer, and no refresh.
    request = (request: ITasklistRequest): Promise<ITasklistMessageResponse> => this.source.request(request)

    // An action (End Process, New Task…): its answer for the dialog, and a fresh snapshot after it.
    act = async (request: ITasklistRequest): Promise<ITasklistMessageResponse> => {
        const response = await this.source.request(request)
        if (response.ok) void this.refresh()
        return response
    }
}
