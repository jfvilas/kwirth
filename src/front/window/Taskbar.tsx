import React, { useEffect, useState } from 'react'
import { TasklistSession } from '../TasklistSession'
import { TASK_MANAGER_WINDOW } from '../TasklistSessionTypes'
import { IMenuItem, PopupMenu } from '../luna/LunaControls'
import { KubernetesLogo, NotepadIcon, TrayCpuIcon, WindowIcon } from '../luna/LunaIcons'
import { percent } from '../Format'

export const TASKBAR_HEIGHT = 30

export interface ITaskbarProps {
    session: TasklistSession
    onAbout: () => void
}

/*
    XP's taskbar along the bottom of the tab's desktop: the green Start button with its menu, one button per window
    (the Task Manager's and every Notepad's, pressed for the one in front), and the notification area with the Task
    Manager's CPU meter and the clock. A window's button minimises it when it is in front, and brings it to the
    front otherwise — as on XP.
*/
export const Taskbar: React.FC<ITaskbarProps> = ({ session, onAbout }) => {
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

    const startItems: IMenuItem[] = [
        { label: 'Task Manager', isDefault: true, onClick: session.openTaskManager },
        { label: 'Notepad', onClick: () => session.openNotepad('Untitled', '', false, false) },
        {},
        { label: 'About Task Manager', onClick: onAbout },
        {},
        { label: 'Log Off', disabled: true },
        { label: 'Turn Off Computer...', disabled: true }
    ]
    const windows = [
        ...(session.taskManagerOpen ? [{ id: TASK_MANAGER_WINDOW, title: 'Task Manager', icon: <WindowIcon /> }] : []),
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
            {startOpen && <PopupMenu items={startItems} x={0} bottom={TASKBAR_HEIGHT} onClose={() => setStartOpen(false)} testId='tl-start-menu' />}
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
