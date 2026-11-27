import React from 'react'
import { ITasklistApplication } from '../../common/TasklistTypes'
import { ETasklistTab } from '../TasklistSessionTypes'
import { TasklistSession } from '../TasklistSession'
import { Button, IListColumn, IMenuItem, ListView } from '../luna/LunaControls'
import { ApplicationIcon } from '../luna/LunaIcons'
import { listState } from './ListState'

export const applicationKey = (a: ITasklistApplication): string => `${a.namespace}/${a.name}`

// A Deployment that has fewer pods ready than it wants is an application that does not answer.
export const statusOf = (a: ITasklistApplication): string => a.readyReplicas >= a.replicas ? 'Running' : 'Not Responding'

const COLUMNS: IListColumn<ITasklistApplication>[] = [
    { key: 'task', label: 'Task', width: 340, text: a => <span className='tl-cell-icon'><ApplicationIcon />{a.name} - {a.namespace}</span>, sortValue: a => a.name },
    { key: 'status', label: 'Status', width: 100, text: statusOf, sortValue: statusOf }
]

export interface IApplicationsTabProps {
    session: TasklistSession
    onEndTask: (application: ITasklistApplication) => void
    onSwitchTo: (application: ITasklistApplication) => void
    onNewTask: () => void
    onContextMenu: (items: IMenuItem[], x: number, y: number) => void
}

export const ApplicationsTab: React.FC<IApplicationsTabProps> = ({ session, onEndTask, onSwitchTo, onNewTask, onContextMenu }) => {
    const applications = session.snapshot?.applications ?? []
    const selectedKeys = session.selection[ETasklistTab.APPLICATIONS] ?? []
    const selected = applications.find(a => selectedKeys.includes(applicationKey(a)))

    const menuFor = (a: ITasklistApplication): IMenuItem[] => [
        { label: 'Switch To', isDefault: true, onClick: () => onSwitchTo(a) },
        { label: 'Bring To Front', disabled: true },
        {},
        { label: 'Minimize', disabled: true },
        { label: 'Maximize', disabled: true },
        {},
        { label: 'Cascade', disabled: true },
        { label: 'Tile Horizontally', disabled: true },
        { label: 'Tile Vertically', disabled: true },
        {},
        { label: 'End Task', onClick: () => onEndTask(a) },
        { label: 'Go To Process', onClick: () => onSwitchTo(a) }
    ]

    return (
        <>
            <ListView columns={COLUMNS} rows={applications} rowKey={applicationKey} testId='tl-applications'
                selected={selectedKeys} onSelect={keys => session.select(ETasklistTab.APPLICATIONS, keys.slice(-1))}
                {...listState(session, 'applications')}
                onActivate={onSwitchTo}
                onKeyDown={e => { if (e.key === 'Delete' && selected) onEndTask(selected) }}
                onContextMenu={(a, x, y) => { if (a) onContextMenu(menuFor(a), x, y) }} />
            <div className='tl-buttons'>
                <Button label='End Task' onClick={() => selected && onEndTask(selected)} disabled={!selected} testId='tl-end-task' />
                <Button label='Switch To' onClick={() => selected && onSwitchTo(selected)} disabled={!selected} testId='tl-switch-to' />
                <Button label='New Task...' onClick={onNewTask} disabled={!session.canEnd} testId='tl-new-task-button' />
            </div>
        </>
    )
}
