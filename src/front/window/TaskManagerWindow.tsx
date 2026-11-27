import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { AboutDialog, CreateNewTaskDialog, INewTask, PropertiesDialog, SelectColumnsDialog, SHUT_DOWN_TITLES, ShutDownDialog } from './Dialogs'

const TABS = [
    { id: ETasklistTab.APPLICATIONS, label: 'Applications' },
    { id: ETasklistTab.PROCESSES, label: 'Processes' },
    { id: ETasklistTab.PERFORMANCE, label: 'Performance' },
    { id: ETasklistTab.NETWORKING, label: 'Networking' },
    { id: ETasklistTab.USERS, label: 'Users' }
]

// The size of the window when it is not maximised, as far as the tab lets it.
const NORMAL_WIDTH = 620
const NORMAL_HEIGHT = 600

interface IContextMenuState {
    items: IMenuItem[]
    x: number
    y: number
}

export interface ITaskManagerWindowProps {
    session: TasklistSession
    width: number
    height: number
    fullscreen: boolean
}

export const TaskManagerWindow: React.FC<ITaskManagerWindowProps> = ({ session, width, height, fullscreen }) => {
    const [dialog, setDialog] = useState<JSX.Element>()
    const [contextMenu, setContextMenu] = useState<IContextMenuState>()
    const rootRef = useRef<HTMLDivElement>(null)
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
            `The Deployment ${a.namespace}/${a.name} will be deleted, with every pod it keeps. It will not come back.`,
            'Are you sure you want to end this task?'
        ], () => {
            void run({ command: ETasklistCommand.END_TASK, targetNamespace: a.namespace, targetName: a.name }, 'Unable to End Task')
            session.select(ETasklistTab.APPLICATIONS, [])
        })
    }

    // Switch To and Go To Process: the Processes tab, with the application's pods selected.
    const switchTo = (a: ITasklistApplication) => {
        const pods = (snapshot?.processes ?? []).filter(p => p.namespace === a.namespace && p.owner?.kind === 'Deployment' && p.owner.name === a.name)
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

    // ─── menus ────────────────────────────────────────────────────────────────────────────────────
    const speed = session.state.updateSpeed
    const speedItem = (label: string, value: EUpdateSpeed): IMenuItem => ({ label, radio: speed === value, onClick: () => session.setState({ updateSpeed: value }) })
    const admin = session.isAdmin && (snapshot?.nodes.length ?? 0) > 0
    const menus: IMenuBarEntry[] = [
        {
            label: 'File', items: [
                { label: 'New Task (Run...)', disabled: !session.canEnd, onClick: newTask },
                {},
                { label: 'Exit Task Manager', disabled: true }
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

    // ─── the window ───────────────────────────────────────────────────────────────────────────────
    const maximized = fullscreen || session.maximized
    const w = maximized ? width : Math.min(NORMAL_WIDTH, width - 24)
    const h = maximized ? height : Math.min(NORMAL_HEIGHT, height - 24)
    const placement: React.CSSProperties = maximized
        ? { left: 0, top: 0, width, height }
        : { left: Math.max(0, (width - w) / 2), top: Math.max(0, (height - h) / 2), width: w, height: h }

    const metrics = snapshot?.metrics
    const limit = (snapshot?.nodes ?? []).reduce((n, x) => n + x.memoryAllocatable, 0)
    const openMenu = (items: IMenuItem[], x: number, y: number) => setContextMenu({ items, x, y })

    return (
        <div className='tl-root' ref={rootRef} tabIndex={-1} data-testid='tasklist-window-root' style={{ width, height }}>
            <div className={'tl-window' + (maximized ? ' tl-max' : '')} style={placement} data-testid='tasklist-window'>
                <div className='tl-title' onDoubleClick={() => !fullscreen && session.setMaximized(!session.maximized)}>
                    <WindowIcon />
                    <span className='tl-title-text'>Task Manager</span>
                    <span className='tl-caption' aria-label='Minimize'><MinimizeGlyph /></span>
                    <span className='tl-caption' aria-label={maximized ? 'Restore' : 'Maximize'} role='button'
                        onClick={() => !fullscreen && session.setMaximized(!session.maximized)}>{maximized ? <RestoreGlyph /> : <MaximizeGlyph />}</span>
                    <span className='tl-caption tl-close' aria-label='Close'><CloseGlyph /></span>
                </div>
                <div className='tl-frame'>
                    <MenuBar entries={menus} />
                    <div className='tl-body'>
                        <TabStrip tabs={TABS} selected={tab} onSelect={t => session.setState({ tab: t })} />
                        <div className='tl-tabpanel' data-testid={`tl-panel-${tab}`}>
                            {tab === ETasklistTab.APPLICATIONS && <ApplicationsTab session={session} onEndTask={endTask} onSwitchTo={switchTo} onNewTask={newTask} onContextMenu={openMenu} />}
                            {tab === ETasklistTab.PROCESSES && <ProcessesTab session={session} onEndProcess={endProcess} onEndProcessTree={endProcessTree} onProperties={properties} onContextMenu={openMenu} />}
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
                    </div>
                </div>
            </div>
            {contextMenu && <ContextMenu items={contextMenu.items} x={contextMenu.x} y={contextMenu.y} onClose={closeMenu} />}
            {dialog}
        </div>
    )
}
