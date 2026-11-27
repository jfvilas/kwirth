import React from 'react'
import { ITasklistUser } from '../../common/TasklistTypes'
import { ETasklistTab } from '../TasklistSessionTypes'
import { TasklistSession } from '../TasklistSession'
import { Button, IListColumn, IMenuItem, ListView } from '../luna/LunaControls'
import { listState } from './ListState'

// PRD D11: a user is a namespace. Its session is how many processes (pods) it runs.
const COLUMNS: IListColumn<ITasklistUser>[] = [
    { key: 'user', label: 'User', width: 170, text: u => u.name, sortValue: u => u.name },
    { key: 'id', label: 'ID', width: 40, right: true, text: u => String(u.id), sortValue: u => u.id },
    { key: 'status', label: 'Status', width: 85, text: u => u.phase, sortValue: u => u.phase },
    { key: 'client', label: 'Client Name', width: 90, text: () => '', sortValue: () => '' },
    { key: 'session', label: 'Session', width: 60, right: true, text: u => String(u.pods), sortValue: u => u.pods }
]

export interface IUsersTabProps {
    session: TasklistSession
    onLogOff: (user: ITasklistUser) => void
    onContextMenu: (items: IMenuItem[], x: number, y: number) => void
}

export const UsersTab: React.FC<IUsersTabProps> = ({ session, onLogOff, onContextMenu }) => {
    const users = session.snapshot?.users ?? []
    const selectedKeys = session.selection[ETasklistTab.USERS] ?? []
    const selected = users.find(u => selectedKeys.includes(u.name))

    const menuFor = (u: ITasklistUser): IMenuItem[] => [
        { label: 'Send Message...', disabled: true },
        { label: 'Connect', disabled: true },
        { label: 'Disconnect', disabled: true },
        { label: 'Log Off', disabled: !session.isAdmin, onClick: () => onLogOff(u) }
    ]

    return (
        <>
            <ListView columns={COLUMNS} rows={users} rowKey={u => u.name} testId='tl-users'
                selected={selectedKeys} onSelect={keys => session.select(ETasklistTab.USERS, keys.slice(-1))}
                {...listState(session, 'users')}
                onContextMenu={(u, x, y) => { if (u) onContextMenu(menuFor(u), x, y) }} />
            <div className='tl-buttons'>
                <Button label='Disconnect' disabled />
                <Button label='Logoff' onClick={() => selected && onLogOff(selected)} disabled={!selected || !session.isAdmin} testId='tl-logoff' />
                <Button label='Send Message...' disabled />
            </div>
        </>
    )
}
