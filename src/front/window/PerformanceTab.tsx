import React from 'react'
import { TasklistSession, HISTORY_POINTS } from '../TasklistSession'
import { Field, Graph, GroupBox, Meter } from '../luna/LunaControls'
import { kilobytesBare, meterBytes, percent } from '../Format'

const CPU_LINE = '#00ff00'
const MEMORY_LINE = '#ffff00'

// The figures of the four boxes at the bottom, out of the snapshot (PLAN §3). Pure, for the tests.
export const performanceFigures = (session: TasklistSession) => {
    const snapshot = session.snapshot
    const nodes = snapshot?.nodes ?? []
    const capacity = nodes.reduce((n, x) => n + x.memoryCapacity, 0)
    const allocatable = nodes.reduce((n, x) => n + x.memoryAllocatable, 0)
    const used = snapshot?.metrics?.memory
    return {
        processes: snapshot?.processes.length ?? 0,
        threads: snapshot?.processes.reduce((n, p) => n + p.containers.length, 0) ?? 0,
        physicalTotal: nodes.length > 0 ? capacity : undefined,
        physicalAvailable: nodes.length > 0 && used !== undefined ? Math.max(0, capacity - used) : undefined,
        systemCache: nodes.length > 0 ? capacity - allocatable : undefined,
        commitTotal: snapshot?.requests.memory,
        commitLimit: nodes.length > 0 ? allocatable : undefined,
        commitPeak: snapshot ? session.commitPeak : undefined,
        memoryUsed: used
    }
}

export const PerformanceTab: React.FC<{ session: TasklistSession }> = ({ session }) => {
    const snapshot = session.snapshot
    const f = performanceFigures(session)
    const cpu = snapshot?.metrics?.cpu
    const memoryMax = f.physicalTotal ?? Math.max(1, ...session.history.memory)
    const nodes = snapshot?.nodes ?? []
    const perCpu = session.state.graphPerCpu && nodes.length > 0
    const columns = Math.ceil(Math.sqrt(nodes.length || 1))

    return (
        <div className='tl-perf'>
            <div className='tl-perf-row tl-grow'>
                <div className='tl-perf-meter'>
                    <GroupBox label='CPU Usage'>
                        <Meter value={cpu ?? 0} max={100} text={percent(cpu)} testId='tl-cpu-meter' />
                    </GroupBox>
                </div>
                <div className='tl-perf-history'>
                    <GroupBox label='CPU Usage History'>
                        {perCpu
                            ? <div className='tl-graphs' style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }} data-testid='tl-cpu-graphs'>
                                {nodes.map(n => (
                                    <div key={n.name} className='tl-graph-cell'>
                                        <Graph lines={[{ values: session.history.nodeCpu[n.name] ?? [], colour: CPU_LINE }]} max={100} points={HISTORY_POINTS} ticks={session.ticks} />
                                    </div>
                                ))}
                            </div>
                            : <Graph lines={[{ values: session.history.cpu, colour: CPU_LINE }]} max={100} points={HISTORY_POINTS} ticks={session.ticks} testId='tl-cpu-history' />
                        }
                    </GroupBox>
                </div>
            </div>
            <div className='tl-perf-row tl-grow'>
                <div className='tl-perf-meter'>
                    <GroupBox label='PF Usage'>
                        <Meter value={f.memoryUsed ?? 0} max={memoryMax} text={f.memoryUsed === undefined ? '--' : meterBytes(f.memoryUsed)} testId='tl-pf-meter' />
                    </GroupBox>
                </div>
                <div className='tl-perf-history'>
                    <GroupBox label='Page File Usage History'>
                        <Graph lines={[{ values: session.history.memory, colour: MEMORY_LINE }]} max={memoryMax} points={HISTORY_POINTS} ticks={session.ticks} testId='tl-pf-history' />
                    </GroupBox>
                </div>
            </div>
            <div className='tl-perf-totals'>
                <GroupBox label='Totals'>
                    <Field label='Handles' value='' />
                    <Field label='Threads' value={String(f.threads)} testId='tl-threads' />
                    <Field label='Processes' value={String(f.processes)} testId='tl-processes-total' />
                </GroupBox>
                <GroupBox label='Physical Memory (K)'>
                    <Field label='Total' value={kilobytesBare(f.physicalTotal)} testId='tl-physical-total' />
                    <Field label='Available' value={kilobytesBare(f.physicalAvailable)} />
                    <Field label='System Cache' value={kilobytesBare(f.systemCache)} />
                </GroupBox>
                <GroupBox label='Commit Charge (K)'>
                    <Field label='Total' value={kilobytesBare(f.commitTotal)} testId='tl-commit-total' />
                    <Field label='Limit' value={kilobytesBare(f.commitLimit)} />
                    <Field label='Peak' value={kilobytesBare(f.commitPeak)} />
                </GroupBox>
                <GroupBox label='Kernel Memory (K)'>
                    <Field label='Total' value='' />
                    <Field label='Paged' value='' />
                    <Field label='Nonpaged' value='' />
                </GroupBox>
            </div>
        </div>
    )
}
