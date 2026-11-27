import React, { useState } from 'react'
import { EShutDownAction, ITasklistNode, ITasklistProcess, ITasklistUser } from '../../common/TasklistTypes'
import { EProcessColumn } from '../TasklistSessionTypes'
import { Button, Checkbox, Dialog, IListColumn, ListView, TabStrip } from '../luna/LunaControls'
import { ProcessIcon, RunIcon, WindowIcon } from '../luna/LunaIcons'
import { cpuColumn, kilobytes } from '../Format'
import { PROCESS_COLUMN_LABELS } from './ProcessesTab'

// ─── Properties of a process (a pod): General, and its containers (PRD D3, RF4) ────────────────────

enum EPropertiesTab {
    GENERAL = 'general',
    CONTAINERS = 'containers'
}

export const PropertiesDialog: React.FC<{ process: ITasklistProcess; onClose: () => void }> = ({ process, onClose }) => {
    const [tab, setTab] = useState(EPropertiesTab.GENERAL)
    const [selected, setSelected] = useState<string[]>([])
    const [widths, setWidths] = useState<Record<string, number>>({})
    const columns: IListColumn<ITasklistProcess['containers'][number]>[] = [
        { key: 'name', label: 'Name', width: 80, text: c => c.name, sortValue: c => c.name },
        { key: 'image', label: 'Image', width: 100, text: c => c.image, sortValue: c => c.image },
        { key: 'state', label: 'State', width: 95, text: c => c.state, sortValue: c => c.state },
        { key: 'ready', label: 'Ready', width: 45, text: c => c.ready ? 'Yes' : 'No', sortValue: c => c.ready ? 1 : 0 },
        { key: 'restarts', label: 'Restarts', width: 55, right: true, text: c => String(c.restarts), sortValue: c => c.restarts },
        { key: 'cpu', label: 'CPU', width: 35, right: true, text: c => cpuColumn(c.cpu), sortValue: c => c.cpu ?? -1 },
        { key: 'mem', label: 'Mem Usage', width: 75, right: true, text: c => kilobytes(c.memory), sortValue: c => c.memory ?? -1 }
    ]
    const [sort, setSort] = useState({ column: 'name', descending: false })
    return (
        <Dialog title={`${process.name} Properties`} onClose={onClose} testId='tl-properties'>
            <div className='tl-props'>
                <div className='tl-body'>
                    <TabStrip tabs={[{ id: EPropertiesTab.GENERAL, label: 'General' }, { id: EPropertiesTab.CONTAINERS, label: 'Containers' }]} selected={tab} onSelect={setTab} />
                    <div className='tl-tabpanel'>
                        {tab === EPropertiesTab.GENERAL && (
                            <div className='tl-props-general'>
                                <ProcessIcon /><span style={{ alignSelf: 'center' }}>{process.name}</span>
                                <span className='tl-props-sep' />
                                <span>Type:</span><span>Pod</span>
                                <span>User:</span><span>{process.namespace}</span>
                                <span>Computer:</span><span>{process.node || '(not scheduled)'}</span>
                                <span>PID:</span><span>{process.pid}</span>
                                <span className='tl-props-sep' />
                                <span>Status:</span><span>{process.phase}</span>
                                <span>Started:</span><span>{process.startTime ? new Date(process.startTime).toLocaleString() : ''}</span>
                                <span>Parent:</span><span>{process.owner ? `${process.owner.kind} ${process.owner.name}` : '(none)'}</span>
                                <span className='tl-props-sep' />
                                <span>Threads:</span><span>{process.containers.length} container(s)</span>
                                <span>Mem Usage:</span><span>{kilobytes(process.memory)}</span>
                                <span>Peak:</span><span>{kilobytes(process.peakMemory)}</span>
                            </div>
                        )}
                        {tab === EPropertiesTab.CONTAINERS && (
                            <ListView columns={columns} rows={process.containers} rowKey={c => c.name} selected={selected} onSelect={setSelected}
                                widths={widths} onWidth={(k, w) => setWidths({ ...widths, [k]: w })} sort={sort} onSort={setSort} testId='tl-containers' />
                        )}
                    </div>
                </div>
                <div className='tl-buttons'>
                    <Button label='OK' onClick={onClose} autoFocus />
                    <Button label='Cancel' onClick={onClose} />
                </div>
            </div>
        </Dialog>
    )
}

// ─── View → Select Columns ────────────────────────────────────────────────────────────────────────

export const SelectColumnsDialog: React.FC<{ columns: EProcessColumn[]; onOk: (columns: EProcessColumn[]) => void; onClose: () => void }> = ({ columns, onOk, onClose }) => {
    const [chosen, setChosen] = useState<EProcessColumn[]>(columns)
    // the order is always the catalogue's, Image Name first and fixed — as in XP
    const toggle = (c: EProcessColumn, on: boolean) => setChosen(Object.values(EProcessColumn).filter(x => x === c ? on : chosen.includes(x)))
    return (
        <Dialog title='Select Columns' onClose={onClose} testId='tl-select-columns'>
            <div style={{ width: 300 }}>
                <div>Select the columns that will appear on the Process page of the Task Manager.</div>
                <div className='tl-columns-list'>
                    {Object.values(EProcessColumn).map(c => (
                        <Checkbox key={c} label={PROCESS_COLUMN_LABELS[c]} checked={chosen.includes(c)} disabled={c === EProcessColumn.IMAGE_NAME}
                            onChange={(on) => toggle(c, on)} />
                    ))}
                </div>
                <div className='tl-buttons'>
                    <Button label='OK' onClick={() => { onOk(chosen); onClose() }} autoFocus />
                    <Button label='Cancel' onClick={onClose} />
                </div>
            </div>
        </Dialog>
    )
}

// ─── File → New Task (Run...) (PRD D12) ───────────────────────────────────────────────────────────

export interface INewTask {
    image: string
    name: string
    namespace: string
}

const nameOfImage = (image: string): string => {
    const last = image.split('/').pop() ?? ''
    const base = last.split('@')[0].split(':')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')
    return `${base || 'task'}-${Math.random().toString(36).slice(2, 7)}`
}

export const CreateNewTaskDialog: React.FC<{ users: ITasklistUser[]; onOk: (task: INewTask) => void; onClose: () => void }> = ({ users, onOk, onClose }) => {
    const [image, setImage] = useState('')
    const [name, setName] = useState('')
    const [namespace, setNamespace] = useState(users.find(u => u.name === 'default')?.name ?? users[0]?.name ?? '')
    const ok = () => { if (image.trim()) { onOk({ image: image.trim(), name: name.trim() || nameOfImage(image.trim()), namespace }); onClose() } }
    return (
        <Dialog title='Create New Task' onClose={onClose} testId='tl-new-task'>
            <div style={{ width: 360 }}>
                <div className='tl-message'>
                    <RunIcon />
                    <div>Type the name of a container image, and Kubernetes will run it for you as a new process.</div>
                </div>
                <div className='tl-form'>
                    <span>Open:</span>
                    <input className='tl-input' value={image} onChange={e => setImage(e.target.value)} autoFocus aria-label='Open'
                        onKeyDown={e => { if (e.key === 'Enter') ok() }} placeholder='busybox:1.36' />
                    <span>Name:</span>
                    <input className='tl-input' value={name} onChange={e => setName(e.target.value)} aria-label='Name' placeholder='(from the image)' />
                    <span>User:</span>
                    <select className='tl-input' value={namespace} onChange={e => setNamespace(e.target.value)} aria-label='User'>
                        {users.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                    </select>
                </div>
                <div className='tl-buttons'>
                    <Button label='OK' onClick={ok} disabled={!image.trim() || !namespace} />
                    <Button label='Cancel' onClick={onClose} />
                    <Button label='Browse...' disabled />
                </div>
            </div>
        </Dialog>
    )
}

// ─── Shut Down, on a node (PRD D6) ────────────────────────────────────────────────────────────────

export const SHUT_DOWN_TITLES: Record<EShutDownAction, string> = {
    [EShutDownAction.STAND_BY]: 'Stand By',
    [EShutDownAction.TURN_OFF]: 'Turn Off',
    [EShutDownAction.RESTART]: 'Restart'
}

const SHUT_DOWN_TEXT: Record<EShutDownAction, string> = {
    [EShutDownAction.STAND_BY]: 'The computer (node) will be cordoned: what runs on it goes on running, but nothing new will be scheduled there.',
    [EShutDownAction.TURN_OFF]: 'The computer (node) will be drained: cordoned, and every process on it but a DaemonSet\'s evicted.',
    [EShutDownAction.RESTART]: 'The computer (node) will be uncordoned: new processes can be scheduled on it again.'
}

export const ShutDownDialog: React.FC<{ action: EShutDownAction; nodes: ITasklistNode[]; onOk: (node: string) => void; onClose: () => void }> = ({ action, nodes, onOk, onClose }) => {
    const [node, setNode] = useState(nodes[0]?.name ?? '')
    return (
        <Dialog title={SHUT_DOWN_TITLES[action]} onClose={onClose} testId='tl-shut-down'>
            <div style={{ width: 340 }}>
                <div>{SHUT_DOWN_TEXT[action]}</div>
                <div className='tl-form'>
                    <span>Computer:</span>
                    <select className='tl-input' value={node} onChange={e => setNode(e.target.value)} aria-label='Computer'>
                        {nodes.map(n => <option key={n.name} value={n.name}>{n.name}{n.unschedulable ? ' (cordoned)' : ''}</option>)}
                    </select>
                </div>
                <div className='tl-buttons'>
                    <Button label='OK' onClick={() => { onOk(node); onClose() }} disabled={!node} />
                    <Button label='Cancel' onClick={onClose} autoFocus />
                </div>
            </div>
        </Dialog>
    )
}

// ─── Help → About Task Manager ────────────────────────────────────────────────────────────────────

export const AboutDialog: React.FC<{ cluster: string; onClose: () => void }> = ({ cluster, onClose }) =>
    <Dialog title='About Task Manager' onClose={onClose} testId='tl-about'>
        <div className='tl-about'>
            <WindowIcon />
            <div>
                <div style={{ fontWeight: 700 }}>Task Manager for Kwirth</div>
                <div>A plugin by jfvilas, MIT licence. Not affiliated with Microsoft.</div>
                <div style={{ marginTop: 8 }}>This computer is the cluster <b>{cluster}</b>: its pods are the processes, its Deployments the applications, its nodes the CPUs and network adapters, and its namespaces the users.</div>
            </div>
        </div>
        <div className='tl-buttons'><Button label='OK' onClick={onClose} autoFocus /></div>
    </Dialog>
