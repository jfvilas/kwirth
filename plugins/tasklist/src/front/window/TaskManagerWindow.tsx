import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Taskbar, TASKBAR_HEIGHT } from './Taskbar'
import { EShutDownAction, ETasklistCommand, ETasklistError, ITasklistApplication, ITasklistMessageResponse, ITasklistProcess, ITasklistRequest, ITasklistUser } from '../../common/TasklistTypes'
import { ETasklistTab, EUpdateSpeed } from '../TasklistSessionTypes'
import { TasklistSession } from '../TasklistSession'
import { ContextMenu, IMenuBarEntry, IMenuItem, MenuBar, MessageBox, TabStrip } from '../luna/LunaControls'
import { CloseGlyph, ErrorIcon, InfoIcon, MaximizeGlyph, MinimizeGlyph, RestoreGlyph, WarningIcon, WindowIcon } from '../luna/LunaIcons'
import { megabytes, percent } from '../Format'
import { IDLE_UID, ProcessesTab } from './ProcessesTab'
import { ApplicationsTab } from './ApplicationsTab'
import { PerformanceTab } from './PerformanceTab'
import { NetworkingTab } from './NetworkingTab'
import { UsersTab } from './UsersTab'
import { AboutDialog, AboutKubernetesXPDialog, CreateNewTaskDialog, INewTask, PropertiesDialog, SelectColumnsDialog, SHUT_DOWN_TITLES, ShutDownDialog } from './Dialogs'
import { NotepadWindow } from './NotepadWindow'
import { LunaWindow } from '../luna/LunaWindow'
import { CONTROL_PANEL_WINDOW, TASK_MANAGER_WINDOW } from '../TasklistSessionTypes'
import { ControlPanelWindow } from './ControlPanelWindow'
import { NORMAL_HEIGHT, NORMAL_WIDTH } from './Placement'

const TABS = [
    { id: ETasklistTab.APPLICATIONS, label: 'Applications' },
    { id: ETasklistTab.PROCESSES, label: 'Processes' },
    { id: ETasklistTab.PERFORMANCE, label: 'Performance' },
    { id: ETasklistTab.NETWORKING, label: 'Networking' },
    { id: ETasklistTab.USERS, label: 'Users' }
]

interface IContextMenuState {
    items: IMenuItem[]
    x: number
    y: number
}

export interface ITaskManagerWindowProps {
    session: TasklistSession
    width: number
    height: number
    userName: string               // Kwirth's user, at the top of the Start menu
    onTurnOff?: () => void         // stops the channel (the core's stopChannel); absent: Turn Off Computer is disabled
}

export const TaskManagerWindow: React.FC<ITaskManagerWindowProps> = ({ session, width, height, userName, onTurnOff }) => {
    const [dialog, setDialog] = useState<JSX.Element>()
    const [contextMenu, setContextMenu] = useState<IContextMenuState>()
    const rootRef = useRef<HTMLDivElement>(null)
    // the desktop the window lives on: state, not a ref, so the drag gets it from the first render after mounting
    const [desktop, setDesktop] = useState<HTMLDivElement | null>(null)
    const close = useCallback(() => setDialog(undefined), [])
    const closeMenu = useCallback(() => setContextMenu(undefined), [])
    const snapshot = session.snapshot
    const tab = session.state.tab

    // ─── message boxes ────────────────────────────────────────────────────────────────────────────
    const errorBox = (title: string, lines: string[]) =>
        setDialog(<MessageBox title={title} icon={<ErrorIcon />} lines={lines} onClose={close} buttons={[{ label: 'OK', onClick: close }]} testId='tl-error' />)

    const infoBox = (title: string, lines: string[]) =>
        setDialog(<MessageBox title={title} icon={<InfoIcon />} lines={lines} onClose={close} buttons={[{ label: 'OK', onClick: close }]} testId='tl-info' />)

    const confirm = (title: string, lines: string[], onYes: () => void) =>
        setDialog(<MessageBox title={title} icon={<WarningIcon />} lines={lines} onClose={close} testId='tl-warning'
            buttons={[{ label: 'Yes', onClick: () => { close(); onYes() } }, { label: 'No', onClick: close }]} />)

    // An action and its answer: nothing to say when it worked (as in XP), the error box when it did not.
    const run = async (request: ITasklistRequest, failTitle: string, done?: (response: ITasklistMessageResponse) => void) => {
        try {
            const response = await session.act(request)
            if (response.ok) done?.(response)
            else if (response.error === ETasklistError.ACCESS_DENIED) errorBox(failTitle, ['The operation could not be completed.', 'Access is denied.'])
            else errorBox(failTitle, ['The operation could not be completed.', response.detail ?? 'Unknown error.'])
        }
        catch (err) {
            errorBox(failTitle, ['The operation could not be completed.', err instanceof Error ? err.message : String(err)])
        }
    }

    // ─── actions ──────────────────────────────────────────────────────────────────────────────────
    const endProcess = (processes: ITasklistProcess[]) => {
        if (processes.length === 0) return
        if (processes.some(p => p.uid === IDLE_UID)) {
            errorBox('Unable to Terminate Process', ['The operation could not be completed.', 'Access is denied.'])
            return
        }
        confirm('Task Manager Warning', [
            'WARNING: Terminating a process can cause undesired results including loss of data and system instability. The process will not be given the chance to save its state or data before it is terminated.',
            processes.length === 1 ? `The pod ${processes[0].namespace}/${processes[0].name} will be deleted; its controller, if it has one, may start it again.` : `${processes.length} pods will be deleted.`,
            'Are you sure you want to terminate the process?'
        ], () => {
            for (const p of processes) void run({ command: ETasklistCommand.END_PROCESS, targetNamespace: p.namespace, targetName: p.name }, 'Unable to Terminate Process')
            session.select(ETasklistTab.PROCESSES, [])
        })
    }

    const endProcessTree = (p: ITasklistProcess) => {
        if (p.uid === IDLE_UID) {
            errorBox('Unable to Terminate Process', ['The operation could not be completed.', 'Access is denied.'])
            return
        }
        confirm('Task Manager Warning', [
            'WARNING: Terminating a process tree can cause undesired results including loss of data and system instability. The processes will not be given the chance to save their state or data before they are terminated.',
            p.owner ? `The ${p.owner.kind} ${p.namespace}/${p.owner.name} will be deleted, with every pod it keeps.` : `The pod ${p.namespace}/${p.name} has no controller: only it will be deleted.`,
            'Are you sure you want to terminate the process tree?'
        ], () => {
            void run({ command: ETasklistCommand.END_PROCESS_TREE, targetNamespace: p.namespace, targetName: p.name }, 'Unable to Terminate Process')
            session.select(ETasklistTab.PROCESSES, [])
        })
    }

    const endTask = (a: ITasklistApplication) => {
        confirm('Task Manager Warning', [
            `The ${a.kind} ${a.namespace}/${a.name} will be deleted, with every pod it keeps. It will not come back.`,
            'Are you sure you want to end this task?'
        ], () => {
            void run({ command: ETasklistCommand.END_TASK, targetNamespace: a.namespace, targetName: a.name, targetKind: a.kind }, 'Unable to End Task')
            session.select(ETasklistTab.APPLICATIONS, [])
        })
    }

    // Switch To and Go To Process: the Processes tab, with the application's pods selected.
    const switchTo = (a: ITasklistApplication) => {
        const pods = (snapshot?.processes ?? []).filter(p => p.namespace === a.namespace && p.owner?.kind === a.kind && p.owner.name === a.name)
        session.select(ETasklistTab.PROCESSES, pods.map(p => p.uid))
        session.setState({ tab: ETasklistTab.PROCESSES, allUsers: session.state.allUsers || pods.some(p => p.namespace.startsWith('kube-')) })
        setTimeout(() => {
            const list = rootRef.current?.querySelector('[data-testid="tl-processes"]') as HTMLElement | null
            list?.focus()
            list?.querySelector('.tl-list-row.tl-selected')?.scrollIntoView({ block: 'nearest' })
        }, 0)
    }

    const newTask = () => setDialog(<CreateNewTaskDialog users={snapshot?.users ?? []} onClose={close}
        onOk={(task: INewTask) => void run({ command: ETasklistCommand.NEW_TASK, targetNamespace: task.namespace, targetName: task.name, image: task.image }, 'Create New Task')} />)

    const logOff = (u: ITasklistUser) => {
        confirm('Task Manager Warning', [
            `Logging off ${u.name} deletes the namespace, and everything in it: its ${u.pods} process(es) and every other object. It cannot be undone.`,
            'Are you sure you want to log off the selected user?'
        ], () => {
            void run({ command: ETasklistCommand.LOG_OFF, targetName: u.name }, 'Unable to Log Off')
            session.select(ETasklistTab.USERS, [])
        })
    }

    const shutDown = (action: EShutDownAction) => setDialog(<ShutDownDialog action={action} nodes={snapshot?.nodes ?? []} onClose={close}
        onOk={node => void run({ command: ETasklistCommand.SHUT_DOWN, targetName: node, shutDown: action }, SHUT_DOWN_TITLES[action],
            response => infoBox(SHUT_DOWN_TITLES[action], [`${node}: ${response.detail ?? 'done'}.`]))} />)

    const properties = (p: ITasklistProcess) => setDialog(<PropertiesDialog process={p} onClose={close} />)

    // View Log (PRD D16): the container's last lines, read once, in Notepad.
    const viewLog = async (p: ITasklistProcess, container: string) => {
        try {
            const response = await session.request({ command: ETasklistCommand.LOG, targetNamespace: p.namespace, targetName: p.name, containerName: container })
            if (!response.ok) {
                errorBox('View Log', ['The log could not be read.', response.error === ETasklistError.ACCESS_DENIED ? 'Access is denied.' : (response.detail ?? 'Unknown error.')])
                return
            }
            session.openNotepad(`${p.name}-${container}.log`, (response.lines ?? []).join('\n'), true, false)
        }
        catch (err) {
            errorBox('View Log', ['The log could not be read.', err instanceof Error ? err.message : String(err)])
        }
    }

    // Restart (PRD D16): the pod is replaced — by its controller, or recreated when it has none.
    const restart = (p: ITasklistProcess) => confirm('Task Manager Warning', [
        'WARNING: Restarting a process ends it first. It will not be given the chance to save its state or data before it is terminated.',
        p.owner ? `The pod ${p.namespace}/${p.name} will be deleted, and its ${p.owner.kind} ${p.owner.name} will start another.` : `The pod ${p.namespace}/${p.name} has no controller: it will be deleted and created again from its own definition.`,
        'Are you sure you want to restart the process?'
    ], () => void run({ command: ETasklistCommand.RESTART_PROCESS, targetNamespace: p.namespace, targetName: p.name }, 'Unable to Restart Process'))

    // Edit (PRD D18): the object's YAML in Notepad; File → Save replaces it.
    const edit = async (kind: string, namespace: string, name: string) => {
        try {
            const response = await session.request({ command: ETasklistCommand.GET_YAML, targetKind: kind, targetNamespace: namespace, targetName: name })
            if (!response.ok) {
                errorBox('Edit', [`The ${kind} could not be read.`, response.error === ETasklistError.ACCESS_DENIED ? 'Access is denied.' : (response.detail ?? 'Unknown error.')])
                return
            }
            const save = async (text: string): Promise<string | undefined> => {
                const saved = await session.act({ command: ETasklistCommand.APPLY_YAML, targetKind: kind, targetNamespace: namespace, targetName: name, yaml: text })
                if (saved.ok) return undefined
                return saved.error === ETasklistError.ACCESS_DENIED ? 'Access is denied.' : (saved.detail ?? 'Unknown error.')
            }
            session.openNotepad(`${name}.yaml`, response.yaml ?? '', false, true, save)
        }
        catch (err) {
            errorBox('Edit', [`The ${kind} could not be read.`, err instanceof Error ? err.message : String(err)])
        }
    }

    // ─── menus ────────────────────────────────────────────────────────────────────────────────────
    const speed = session.state.updateSpeed
    const speedItem = (label: string, value: EUpdateSpeed): IMenuItem => ({ label, radio: speed === value, onClick: () => session.setState({ updateSpeed: value }) })
    const admin = session.isAdmin && (snapshot?.nodes.length ?? 0) > 0
    const menus: IMenuBarEntry[] = [
        {
            label: 'File', items: [
                { label: 'New Task (Run...)', disabled: !session.canEnd, onClick: newTask },
                {},
                { label: 'Exit Task Manager', onClick: session.closeTaskManager }
            ]
        },
        {
            label: 'Options', items: [
                { label: 'Always On Top', checked: true, disabled: true },
                { label: 'Minimize On Use', checked: true, disabled: true },
                { label: 'Hide When Minimized', disabled: true }
            ]
        },
        {
            label: 'View', items: [
                { label: 'Refresh Now', onClick: () => void session.refresh() },
                {
                    label: 'Update Speed', items: [
                        speedItem('High', EUpdateSpeed.HIGH),
                        speedItem('Normal', EUpdateSpeed.NORMAL),
                        speedItem('Low', EUpdateSpeed.LOW),
                        speedItem('Paused', EUpdateSpeed.PAUSED)
                    ]
                },
                {},
                ...(tab === ETasklistTab.PROCESSES ? [{
                    label: 'Select Columns...',
                    onClick: () => setDialog(<SelectColumnsDialog columns={session.state.columns} onClose={close} onOk={columns => session.setState({ columns })} />)
                }] : []),
                ...(tab === ETasklistTab.PERFORMANCE ? [
                    {
                        label: 'CPU History', items: [
                            { label: 'One Graph, All CPUs', radio: !session.state.graphPerCpu, onClick: () => session.setState({ graphPerCpu: false }) },
                            { label: 'One Graph Per CPU', radio: session.state.graphPerCpu, onClick: () => session.setState({ graphPerCpu: true }) }
                        ]
                    },
                    { label: 'Show Kernel Times', disabled: true }
                ] : []),
                ...(tab !== ETasklistTab.PROCESSES && tab !== ETasklistTab.PERFORMANCE ? [{ label: 'Select Columns...', disabled: true }] : [])
            ]
        },
        ...(tab === ETasklistTab.APPLICATIONS ? [{
            label: 'Windows', items: [
                { label: 'Tile Horizontally', disabled: true },
                { label: 'Tile Vertically', disabled: true },
                { label: 'Minimize', disabled: true },
                { label: 'Maximize', disabled: true },
                { label: 'Cascade', disabled: true },
                { label: 'Bring To Front', disabled: true }
            ]
        }] : []),
        {
            label: 'Shut Down', items: [
                { label: 'Stand By', disabled: !admin, onClick: () => shutDown(EShutDownAction.STAND_BY) },
                { label: 'Hibernate', disabled: true },
                { label: 'Turn Off', disabled: !admin, onClick: () => shutDown(EShutDownAction.TURN_OFF) },
                { label: 'Restart', disabled: !admin, onClick: () => shutDown(EShutDownAction.RESTART) },
                {},
                { label: 'Log Off', disabled: true },
                { label: 'Switch User', disabled: true },
                { label: 'Lock Computer', disabled: true }
            ]
        },
        {
            label: 'Help', items: [
                { label: 'Task Manager Help Topics', disabled: true },
                {},
                { label: 'About Task Manager', onClick: () => setDialog(<AboutDialog cluster={session.cluster} onClose={close} />) }
            ]
        }
    ]

    // F5 refreshes, as in XP; the rest of the keys belong to the lists.
    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        const key = (e: KeyboardEvent) => {
            if (e.key === 'F5') { e.preventDefault(); void session.refresh() }
        }
        root.addEventListener('keydown', key)
        return () => root.removeEventListener('keydown', key)
    }, [session])

    // ─── the desktop ──────────────────────────────────────────────────────────────────────────────
    /*
        The tab above the taskbar: where the windows are placed, dragged and maximised. Kwirth's full screen only gives
        it more room; a window's Maximize is its own (they are independent).
    */
    const deskWidth = width
    const deskHeight = Math.max(0, height - TASKBAR_HEIGHT)
    const maximized = session.taskManager.maximized
    const zIndexOf = (id: string) => 10 + Math.max(0, session.zOrder.indexOf(id))

    const metrics = snapshot?.metrics
    const limit = (snapshot?.nodes ?? []).reduce((n, x) => n + x.memoryAllocatable, 0)
    const openMenu = (items: IMenuItem[], x: number, y: number) => setContextMenu({ items, x, y })

    return (
        <div className='tl-root' ref={rootRef} tabIndex={-1} data-testid='tasklist-window-root' style={{ width, height }}>
            <div className='tl-desktop' ref={setDesktop} style={{ height: deskHeight }} data-testid='tl-desktop'>
            {/* closed, it is off the desktop and asks nothing; Start → Task Manager opens it again, as it was */}
            {session.taskManagerOpen && <LunaWindow title='Task Manager' icon={<WindowIcon />} frame={session.taskManager} firstWidth={NORMAL_WIDTH} firstHeight={NORMAL_HEIGHT}
                desktop={desktop} desktopWidth={deskWidth} desktopHeight={deskHeight} active={session.activeWindow() === TASK_MANAGER_WINDOW}
                zIndex={zIndexOf(TASK_MANAGER_WINDOW)} compact={session.compact} testId='tasklist-window'
                onFrame={patch => session.setFrame(TASK_MANAGER_WINDOW, patch)} onActivate={() => session.activate(TASK_MANAGER_WINDOW)}
                onClose={session.closeTaskManager}>
                <div className='tl-frame'>
                    <MenuBar entries={menus} />
                    <div className='tl-body'>
                        <TabStrip tabs={TABS} selected={tab} onSelect={t => session.setState({ tab: t })} />
                        {/*
                            XP's tiny footprint: a double click on the panel's own frame, or on a graph, hides the window's
                            chrome; another brings it back. A double click on a list row is still that row's.
                        */}
                        <div className='tl-tabpanel' data-testid={`tl-panel-${tab}`} onDoubleClick={e => {
                            const target = e.target as HTMLElement
                            if (target === e.currentTarget || target.closest('.tl-screen, .tl-net-graphs, .tl-perf')) session.setCompact(!session.compact)
                        }}>
                            {tab === ETasklistTab.APPLICATIONS && <ApplicationsTab session={session} onEndTask={endTask} onSwitchTo={switchTo} onNewTask={newTask}
                                onEdit={a => void edit(a.kind, a.namespace, a.name)} onContextMenu={openMenu} />}
                            {tab === ETasklistTab.PROCESSES && <ProcessesTab session={session} onEndProcess={endProcess} onEndProcessTree={endProcessTree} onProperties={properties}
                                onViewLog={(p, c) => void viewLog(p, c)} onRestart={restart} onEdit={p => void edit('Pod', p.namespace, p.name)} onContextMenu={openMenu} />}
                            {tab === ETasklistTab.PERFORMANCE && <PerformanceTab session={session} />}
                            {tab === ETasklistTab.NETWORKING && <NetworkingTab session={session} />}
                            {tab === ETasklistTab.USERS && <UsersTab session={session} onLogOff={logOff} onContextMenu={openMenu} />}
                        </div>
                    </div>
                    <div className='tl-status' data-testid='tl-status'>
                        <div className='tl-status-panel' style={{ width: 110 }}>{session.error ? 'Not responding' : `Processes: ${snapshot?.processes.length ?? 0}`}</div>
                        <div className='tl-status-panel' style={{ width: 110 }}>CPU Usage: {percent(metrics?.cpu)}</div>
                        <div className='tl-status-panel' style={{ flex: 1 }} title={session.error}>
                            {session.error ?? `Commit Charge: ${megabytes(snapshot?.requests.memory ?? 0)} / ${limit > 0 ? megabytes(limit) : '--'}`}
                        </div>
                        {/* the size grip is drawn here; the resizing is the corner handle's, which sits on top of it */}
                        {!maximized && <span className='tl-grip' data-testid='tl-grip' />}
                    </div>
                </div>
            </LunaWindow>}
            {session.controlPanelOpen && <ControlPanelWindow session={session} desktop={desktop} desktopWidth={deskWidth} desktopHeight={deskHeight}
                zIndex={zIndexOf(CONTROL_PANEL_WINDOW)} />}
            {session.notepads.map(n => (
                <NotepadWindow key={n.id} session={session} notepad={n} desktop={desktop} desktopWidth={deskWidth} desktopHeight={deskHeight} zIndex={zIndexOf(n.id)} />
            ))}
            {/* the Task Manager's dialogs: modal over the desktop, the taskbar left free */}
            {dialog}
            </div>
            <Taskbar session={session} userName={userName} onRun={newTask}
                onAbout={() => setDialog(<AboutKubernetesXPDialog cluster={session.cluster} onClose={close} />)}
                onTurnOff={onTurnOff && (() => setDialog(<MessageBox title='Turn Off Computer' icon={<WarningIcon />} testId='tl-turn-off'
                    lines={['KubernetesXP will be turned off: the channel stops, and its windows close.', 'Start the channel again to turn it back on.']}
                    onClose={close} buttons={[{ label: 'Turn Off', onClick: () => { close(); onTurnOff() } }, { label: 'Cancel', onClick: close }]} />))} />
            {contextMenu && <ContextMenu items={contextMenu.items} x={contextMenu.x} y={contextMenu.y} onClose={closeMenu} />}
        </div>
    )
}
