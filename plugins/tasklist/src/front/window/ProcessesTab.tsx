import React from 'react'
import { isSystemUser, ITasklistProcess } from '../../common/TasklistTypes'
import { EProcessColumn, ETasklistTab } from '../TasklistSessionTypes'
import { TasklistSession } from '../TasklistSession'
import { Button, Checkbox, IListColumn, IMenuItem, ListView } from '../luna/LunaControls'
import { cpuColumn, cpuTime, kilobytes } from '../Format'
import { listState } from './ListState'

export const PROCESS_COLUMN_LABELS: Record<EProcessColumn, string> = {
    [EProcessColumn.IMAGE_NAME]: 'Image Name',
    [EProcessColumn.PID]: 'PID (Process Identifier)',
    [EProcessColumn.USER_NAME]: 'User Name',
    [EProcessColumn.CPU]: 'CPU Usage',
    [EProcessColumn.CPU_TIME]: 'CPU Time',
    [EProcessColumn.MEM_USAGE]: 'Memory Usage',
    [EProcessColumn.PEAK_MEM_USAGE]: 'Peak Memory Usage',
    [EProcessColumn.THREADS]: 'Thread Count',
    [EProcessColumn.IO_READ_BYTES]: 'I/O Read Bytes',
    [EProcessColumn.IO_WRITE_BYTES]: 'I/O Write Bytes'
}

const bytes = (n: number | undefined): string => n === undefined ? '' : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// The list's own columns: the header XP drew, and how each cell reads.
const COLUMNS: Record<EProcessColumn, IListColumn<ITasklistProcess>> = {
    [EProcessColumn.IMAGE_NAME]: { key: EProcessColumn.IMAGE_NAME, label: 'Image Name', width: 190, text: p => p.name, sortValue: p => p.name },
    [EProcessColumn.PID]: { key: EProcessColumn.PID, label: 'PID', width: 45, right: true, text: p => String(p.pid), sortValue: p => p.pid },
    [EProcessColumn.USER_NAME]: { key: EProcessColumn.USER_NAME, label: 'User Name', width: 120, text: p => p.namespace, sortValue: p => p.namespace },
    [EProcessColumn.CPU]: { key: EProcessColumn.CPU, label: 'CPU', width: 35, right: true, text: p => cpuColumn(p.cpu), sortValue: p => p.cpu ?? -1 },
    [EProcessColumn.CPU_TIME]: { key: EProcessColumn.CPU_TIME, label: 'CPU Time', width: 70, right: true, text: p => cpuTime(p.cpuTime), sortValue: p => p.cpuTime ?? -1 },
    [EProcessColumn.MEM_USAGE]: { key: EProcessColumn.MEM_USAGE, label: 'Mem Usage', width: 80, right: true, text: p => kilobytes(p.memory), sortValue: p => p.memory ?? -1 },
    [EProcessColumn.PEAK_MEM_USAGE]: { key: EProcessColumn.PEAK_MEM_USAGE, label: 'Peak Mem Usage', width: 95, right: true, text: p => kilobytes(p.peakMemory), sortValue: p => p.peakMemory ?? -1 },
    [EProcessColumn.THREADS]: { key: EProcessColumn.THREADS, label: 'Threads', width: 60, right: true, text: p => String(p.containers.length), sortValue: p => p.containers.length },
    [EProcessColumn.IO_READ_BYTES]: { key: EProcessColumn.IO_READ_BYTES, label: 'I/O Read Bytes', width: 95, right: true, text: p => bytes(p.ioRead), sortValue: p => p.ioRead ?? -1 },
    [EProcessColumn.IO_WRITE_BYTES]: { key: EProcessColumn.IO_WRITE_BYTES, label: 'I/O Write Bytes', width: 95, right: true, text: p => bytes(p.ioWrite), sortValue: p => p.ioWrite ?? -1 }
}

export const IDLE_UID = 'system-idle-process'

/*
    'System Idle Process': what the machine is not doing, a fixed row as in XP (PID 0, user SYSTEM). It is there
    only when the cluster's CPU is known, and it cannot be ended.
*/
export const idleProcess = (clusterCpu: number): ITasklistProcess => ({
    uid: IDLE_UID,
    pid: 0,
    name: 'System Idle Process',
    namespace: 'SYSTEM',
    node: '',
    phase: 'Running',
    cpu: Math.max(0, 100 - clusterCpu),
    memory: 16 * 1024,
    containers: []
})

// What the list shows: the snapshot's processes, without the system's users unless asked, and the idle one.
export const visibleProcesses = (session: TasklistSession): ITasklistProcess[] => {
    const snapshot = session.snapshot
    if (!snapshot) return []
    const all = session.state.allUsers
    const processes = snapshot.processes.filter(p => all || !isSystemUser(p.namespace))
    if (all && snapshot.metrics) processes.push(idleProcess(snapshot.metrics.cpu))
    return processes
}

export interface IProcessesTabProps {
    session: TasklistSession
    onEndProcess: (processes: ITasklistProcess[]) => void
    onEndProcessTree: (process: ITasklistProcess) => void
    onProperties: (process: ITasklistProcess) => void
    onViewLog: (process: ITasklistProcess, container: string) => void
    onRestart: (process: ITasklistProcess) => void
    onEdit: (process: ITasklistProcess) => void
    onContextMenu: (items: IMenuItem[], x: number, y: number) => void
}

export const ProcessesTab: React.FC<IProcessesTabProps> = ({ session, onEndProcess, onEndProcessTree, onProperties, onViewLog, onRestart, onEdit, onContextMenu }) => {
    const processes = visibleProcesses(session)
    const selectedKeys = session.selection[ETasklistTab.PROCESSES] ?? []
    const selected = processes.filter(p => selectedKeys.includes(p.uid))
    const columns = session.state.columns.map(c => COLUMNS[c])

    const menuFor = (p: ITasklistProcess): IMenuItem[] => {
        const idle = p.uid === IDLE_UID
        // one thread (container): its log straight away; several, a submenu to pick one
        const viewLog: IMenuItem = p.containers.length === 1
            ? { label: 'View Log', onClick: () => onViewLog(p, p.containers[0].name) }
            : { label: 'View Log', disabled: idle || p.containers.length === 0, items: p.containers.map(c => ({ label: c.name, onClick: () => onViewLog(p, c.name) })) }
        return [
            { label: 'End Process', onClick: () => onEndProcess([p]) },
            { label: 'End Process Tree', onClick: () => onEndProcessTree(p) },
            { label: 'Restart', disabled: idle || !session.canEnd, onClick: () => onRestart(p) },
            { label: 'Debug', disabled: true },
            {},
            { label: 'Set Priority', disabled: true, items: [] },
            {},
            viewLog,
            { label: 'Edit...', disabled: idle || !session.canEnd, onClick: () => onEdit(p) },
            {},
            { label: 'Properties', isDefault: true, disabled: idle, onClick: () => onProperties(p) }
        ]
    }

    return (
        <>
            <ListView columns={columns} rows={processes} rowKey={p => p.uid} testId='tl-processes'
                selected={selectedKeys} onSelect={keys => session.select(ETasklistTab.PROCESSES, keys)}
                {...listState(session, 'processes')}
                onActivate={p => { if (p.uid !== IDLE_UID) onProperties(p) }}
                onKeyDown={e => { if (e.key === 'Delete' && selected.length > 0) onEndProcess(selected) }}
                onContextMenu={(p, x, y) => { if (p) onContextMenu(menuFor(p), x, y) }} />
            <div className='tl-buttons' style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Checkbox label='Show processes from all users' checked={session.state.allUsers} onChange={allUsers => session.setState({ allUsers })} testId='tl-all-users' />
                <Button label='End Process' onClick={() => onEndProcess(selected)} disabled={selected.length === 0} testId='tl-end-process' />
            </div>
        </>
    )
}
