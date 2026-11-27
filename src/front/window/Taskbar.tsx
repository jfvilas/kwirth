import React, { useEffect, useState } from 'react'
import { TasklistSession } from '../TasklistSession'
import { IMenuItem, PopupMenu } from '../luna/LunaControls'
import { KubernetesLogo, TrayCpuIcon, WindowIcon } from '../luna/LunaIcons'
import { percent } from '../Format'

export const TASKBAR_HEIGHT = 30

export interface ITaskbarProps {
    session: TasklistSession
    onAbout: () => void
}

/*
    XP's taskbar along the bottom of the tab's desktop: the green Start button, one button per window (the Task
    Manager's), and the notification area with the Task Manager's CPU meter and the clock. A click on the window's
    button minimises it when it is on top, and brings it back when it is minimised — as on XP.
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
        { label: 'Task Manager', isDefault: true, onClick: () => session.setMinimized(false) },
        {},
        { label: 'About Task Manager', onClick: onAbout },
        {},
        { label: 'Log Off', disabled: true },
        { label: 'Turn Off Computer...', disabled: true }
    ]
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
                <div className={'tl-task' + (session.minimized ? '' : ' tl-active')} role='button' aria-label='Task Manager' aria-pressed={!session.minimized} data-testid='tl-task'
                    onClick={() => session.setMinimized(!session.minimized)}>
                    <WindowIcon />
                    <span className='tl-task-text'>Task Manager</span>
                </div>
            </div>
            <div className='tl-tray'>
                <span title={`CPU Usage: ${percent(cpu)}`} data-testid='tl-tray-cpu'><TrayCpuIcon cpu={cpu ?? 0} /></span>
                <span className='tl-clock'>{clock}</span>
            </div>
        </div>
    )
}
