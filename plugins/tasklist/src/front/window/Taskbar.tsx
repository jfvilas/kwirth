import React, { useEffect, useState } from 'react'
import { TasklistSession } from '../TasklistSession'
import { CONTROL_PANEL_WINDOW, ETasklistTab, TASK_MANAGER_WINDOW } from '../TasklistSessionTypes'
import { ControlPanelIcon, KubernetesLogo, NotepadIcon, TrayCpuIcon, WindowIcon } from '../luna/LunaIcons'
import { percent } from '../Format'
import { StartMenu } from './StartMenu'

export const TASKBAR_HEIGHT = 30

export interface ITaskbarProps {
    session: TasklistSession
    userName: string               // Kwirth's, at the top of the Start menu
    onAbout: () => void            // Start → About KubernetesXP: the product's (the Task Manager's own is in its Help menu)
    onRun: () => void              // Start → Run...: Create New Task
    onTurnOff?: () => void         // Start → Turn Off Computer: stops the channel (absent when the core lends no stopChannel)
}

/*
    XP's taskbar along the bottom of the tab's desktop: the green Start button with its menu, one button per window
    (the Task Manager's, the Control Panel's and every Notepad's, pressed for the one in front), and the notification
    area with the Task Manager's CPU meter and the clock. A window's button minimises it when it is in front, and
    brings it to the front otherwise — as on XP.
*/
export const Taskbar: React.FC<ITaskbarProps> = ({ session, userName, onAbout, onRun, onTurnOff }) => {
    const [startOpen, setStartOpen] = useState(false)
    const [, setMinute] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => setMinute(m => m + 1), 15000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (!startOpen) return
        const close = () => setStartOpen(false)
        window.addEventListener('mousedown', close)
        return () => window.removeEventListener('mousedown', close)
    }, [startOpen])

    const taskManagerOn = (tab: ETasklistTab) => () => {
        session.openTaskManager()
        session.setState({ tab })
    }
    const windows = [
        ...(session.taskManagerOpen ? [{ id: TASK_MANAGER_WINDOW, title: 'Task Manager', icon: <WindowIcon /> }] : []),
        ...(session.controlPanelOpen ? [{ id: CONTROL_PANEL_WINDOW, title: 'Control Panel', icon: <ControlPanelIcon title /> }] : []),
        ...session.notepads.map(n => ({ id: n.id, title: `${n.title} - Notepad`, icon: <NotepadIcon /> }))
    ]
    const active = session.activeWindow()
    const cpu = session.snapshot?.metrics?.cpu
    const clock = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

    return (
        <div className='tl-taskbar' data-testid='tl-taskbar' onContextMenu={e => e.preventDefault()}>
            <div className={'tl-start' + (startOpen ? ' tl-pressed' : '')} role='button' aria-label='start' data-testid='tl-start'
                onMouseDown={(e) => { e.stopPropagation(); setStartOpen(!startOpen) }}>
                <KubernetesLogo />
                <span className='tl-start-text'>start</span>
            </div>
            {startOpen && <StartMenu userName={userName} canRun={session.canEnd} canTurnOff={!!onTurnOff}
                onTaskManager={session.openTaskManager}
                onNotepad={() => session.openNotepad('Untitled', '', false, false)}
                onMyCluster={taskManagerOn(ETasklistTab.PERFORMANCE)}
                onMyNamespaces={taskManagerOn(ETasklistTab.USERS)}
                onControlPanel={session.openControlPanel}
                onRun={onRun} onAbout={onAbout} onTurnOff={() => onTurnOff?.()}
                onClose={() => setStartOpen(false)} />}
            <div className='tl-tasks'>
                {windows.map(w => (
                    <div key={w.id} className={'tl-task' + (active === w.id ? ' tl-active' : '')} role='button' aria-label={w.title} aria-pressed={active === w.id}
                        data-testid={`tl-task-${w.id}`} title={w.title} onClick={() => session.toggleFromTaskbar(w.id)}>
                        {w.icon}
                        <span className='tl-task-text'>{w.title}</span>
                    </div>
                ))}
            </div>
            <div className='tl-tray'>
                {/* the Task Manager's meter, there while it runs — as on XP */}
                {session.taskManagerOpen && <span title={`CPU Usage: ${percent(cpu)}`} data-testid='tl-tray-cpu'><TrayCpuIcon cpu={cpu ?? 0} /></span>}
                <span className='tl-clock'>{clock}</span>
            </div>
        </div>
    )
}
