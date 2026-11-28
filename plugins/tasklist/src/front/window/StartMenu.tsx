import React, { useState } from 'react'
import { IMenuItem, PopupMenu } from '../luna/LunaControls'
import { ComputerIcon, ControlPanelIcon, GreenArrow, HelpIcon, KubernetesLogo, LogOffIcon, NotepadIcon, RunIcon, TurnOffIcon, UsersIcon, WindowIcon } from '../luna/LunaIcons'

export interface IStartMenuProps {
    userName: string
    canRun: boolean                    // Run... creates a pod: tasklist$end
    canTurnOff: boolean                // the core lends stopChannel
    onTaskManager: () => void
    onNotepad: () => void
    onMyCluster: () => void            // the Task Manager on Performance
    onMyNamespaces: () => void         // the Task Manager on Users
    onControlPanel: () => void
    onRun: () => void                  // Create New Task
    onAbout: () => void
    onTurnOff: () => void
    onClose: () => void
}

/*
    XP's Start menu: the user at the top on blue; the programs on the left, on white (big icons with a line under the
    name, and All Programs at the foot with its green arrow); the places on the right, on pale blue; Log Off and
    Turn Off Computer at the bottom. Any choice closes it.
*/
export const StartMenu: React.FC<IStartMenuProps> = (props) => {
    const [allPrograms, setAllPrograms] = useState(false)
    const choose = (action: () => void) => () => { props.onClose(); action() }

    const program = (icon: JSX.Element, name: string, line: string, onClick: () => void, testId: string) =>
        <div className='tl-sm-item tl-sm-program' role='menuitem' aria-label={name} data-testid={testId} onClick={choose(onClick)}>
            <span className='tl-sm-big'>{icon}</span>
            <span><b>{name}</b><br /><span className='tl-sm-line'>{line}</span></span>
        </div>

    const place = (icon: JSX.Element, name: string, onClick: (() => void) | undefined, bold = false) =>
        <div className={'tl-sm-item tl-sm-place' + (onClick ? '' : ' tl-disabled')} role='menuitem' aria-label={name} aria-disabled={!onClick}
            onClick={onClick ? choose(onClick) : undefined}>
            <span className='tl-sm-slot'>{icon}</span>
            <span style={{ fontWeight: bold ? 700 : 400 }}>{name}</span>
        </div>

    const programs: IMenuItem[] = [
        { label: 'Task Manager', onClick: choose(props.onTaskManager) },
        { label: 'Notepad', onClick: choose(props.onNotepad) }
    ]

    return (
        <div className='tl-sm' data-testid='tl-start-menu' role='menu' onMouseDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
            <div className='tl-sm-head'>
                <span className='tl-sm-picture'><KubernetesLogo /></span>
                <span className='tl-sm-user' data-testid='tl-start-user'>{props.userName}</span>
            </div>
            <div className='tl-sm-body'>
                <div className='tl-sm-left'>
                    {program(<WindowIcon />, 'Task Manager', 'Processes and performance', props.onTaskManager, 'tl-sm-taskmanager')}
                    {program(<NotepadIcon />, 'Notepad', 'Logs and YAML', props.onNotepad, 'tl-sm-notepad')}
                    <div className='tl-sm-fill' />
                    <div className='tl-sm-sep' />
                    <div className={'tl-sm-item tl-sm-all' + (allPrograms ? ' tl-open' : '')} role='menuitem' aria-label='All Programs'
                        onMouseEnter={() => setAllPrograms(true)} onMouseLeave={() => setAllPrograms(false)} onClick={() => setAllPrograms(!allPrograms)}>
                        <b>All Programs</b>
                        <GreenArrow />
                        {allPrograms && <PopupMenu items={programs} x={190} bottom={-4} onClose={props.onClose} testId='tl-sm-programs' />}
                    </div>
                </div>
                <div className='tl-sm-right'>
                    {place(<ComputerIcon />, 'My Cluster', props.onMyCluster, true)}
                    {place(<UsersIcon />, 'My Namespaces', props.onMyNamespaces, true)}
                    <div className='tl-sm-sep' />
                    {place(<ControlPanelIcon />, 'Control Panel', props.onControlPanel)}
                    <div className='tl-sm-sep' />
                    {place(<RunIcon />, 'Run...', props.canRun ? props.onRun : undefined)}
                    {place(<span className='tl-sm-icon tl-sm-logo'><KubernetesLogo /></span>, 'About KubernetesXP', props.onAbout)}
                    {place(<HelpIcon />, 'Help and Support', undefined)}
                </div>
            </div>
            <div className='tl-sm-foot'>
                {/* Log Off waits for the core to let a channel close its tab (PLAN B1) */}
                <span className='tl-sm-button tl-disabled' role='button' aria-label='Log Off' aria-disabled='true'><LogOffIcon />Log Off</span>
                <span className={'tl-sm-button' + (props.canTurnOff ? '' : ' tl-disabled')} role='button' aria-label='Turn Off Computer'
                    aria-disabled={!props.canTurnOff} onClick={props.canTurnOff ? choose(props.onTurnOff) : undefined}><TurnOffIcon />Turn Off Computer</span>
            </div>
        </div>
    )
}
