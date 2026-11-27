import React from 'react'
import { ITasklistNode } from '../../common/TasklistTypes'
import { ETasklistTab } from '../TasklistSessionTypes'
import { HISTORY_POINTS, LINK_SPEED_BPS, networkUtilisation, TasklistSession } from '../TasklistSession'
import { Graph, IListColumn, ListView } from '../luna/LunaControls'
import { linkSpeed, networkScale, utilisation } from '../Format'
import { listState } from './ListState'

// A node is a network adapter (its default interface): Operational while the node is Ready.
const stateOf = (n: ITasklistNode): string => n.ready ? 'Operational' : 'Disconnected'

const COLUMNS: IListColumn<ITasklistNode>[] = [
    { key: 'adapter', label: 'Adapter Name', width: 170, text: n => n.name, sortValue: n => n.name },
    { key: 'utilization', label: 'Network Utilization', width: 115, right: true, text: n => utilisation(networkUtilisation(n)), sortValue: n => networkUtilisation(n) ?? -1 },
    { key: 'speed', label: 'Link Speed', width: 75, right: true, text: () => linkSpeed(LINK_SPEED_BPS), sortValue: () => LINK_SPEED_BPS },
    { key: 'state', label: 'State', width: 95, text: stateOf, sortValue: stateOf }
]

export const NetworkingTab: React.FC<{ session: TasklistSession }> = ({ session }) => {
    const nodes = session.snapshot?.nodes ?? []
    return (
        <div className='tl-net'>
            <div className='tl-net-graphs' data-testid='tl-network-graphs'>
                {nodes.length === 0 && <div className='tl-empty'>No network adapters: seeing the cluster's nodes needs the 'cluster' scope.</div>}
                {nodes.map(n => {
                    const values = session.history.nodeNetwork[n.name] ?? []
                    const scale = networkScale(values)
                    return (
                        <div key={n.name} className='tl-net-graph'>
                            <div className='tl-graph-label'>{n.name}</div>
                            <div className='tl-graph-row'>
                                <div className='tl-net-axis'><span>{scale} %</span><span>{scale / 2} %</span><span>0 %</span></div>
                                <Graph lines={[{ values, colour: '#00ff00' }]} max={scale} points={HISTORY_POINTS} ticks={session.ticks} />
                            </div>
                        </div>
                    )
                })}
            </div>
            <ListView columns={COLUMNS} rows={nodes} rowKey={n => n.name} testId='tl-adapters'
                selected={session.selection[ETasklistTab.NETWORKING] ?? []} onSelect={keys => session.select(ETasklistTab.NETWORKING, keys.slice(-1))}
                {...listState(session, 'adapters')} />
        </div>
    )
}
