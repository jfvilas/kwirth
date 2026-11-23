import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkJobStatus, EWrkJobType, IWrkJob } from '../WrkactjobTypes'
import { dateTimeOf, elapsedOf, IWrkRows, paintCommandLine, paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'
import { genericMatches } from './ClCommand'

// ─── The rows: each subsystem, then its jobs ─────────────────────────────────────────────────────

// One line of the list: a subsystem (a namespace) or one of its jobs (a pod).
export interface IWrkRow {
    subsystem: string          // the namespace, as Kubernetes has it
    job?: IWrkJob              // undefined on the subsystem's own row
    jobs: IWrkJob[]            // the subsystem's jobs (on its row; the job's siblings on a job row)
}

// What WRKACTJOB SBS(...) JOB(...) keeps: a subsystem and a generic job name.
export interface IWrkFilter {
    subsystem: string          // '' or *ALL: every subsystem
    job: string                // '' or *ALL: every job; API* starts with API
}

export const NO_FILTER: IWrkFilter = { subsystem: '', job: '' }

// Subsystems in name order, each followed by its jobs in name order. A subsystem shows only with jobs to show.
export const rowsFrom = (jobs: IWrkJob[], filter: IWrkFilter = NO_FILTER): IWrkRow[] => {
    const kept = jobs.filter(j => genericMatches(filter.subsystem, j.namespace) && genericMatches(filter.job, j.name))
    const bySubsystem = new Map<string, IWrkJob[]>()
    for (const job of kept) bySubsystem.set(job.namespace, [...(bySubsystem.get(job.namespace) ?? []), job])
    const rows: IWrkRow[] = []
    for (const subsystem of [...bySubsystem.keys()].sort()) {
        const own = bySubsystem.get(subsystem)!.sort((a, b) => a.name.localeCompare(b.name))
        rows.push({ subsystem, jobs: own })
        for (const job of own) rows.push({ subsystem, job, jobs: own })
    }
    return rows
}

// ─── The columns of each view (F11, PRD D9) ──────────────────────────────────────────────────────

export enum EWrkView {
    STATUS = 'status',         // User, Type, CPU %, Function, Status
    ELAPSED = 'elapsed',       // Type, Pool, Pty, CPU, AuxIO
    NAMES = 'names'            // the subsystem's and the job's full Kubernetes names
}

export interface IWrkColumn {
    heading: string
    width: number
    right?: boolean            // numbers are right-aligned
    value: (row: IWrkRow) => string
}

const up = (s: string, width: number): string => s.toUpperCase().slice(0, width)

// IBM i writes .0, 1.2, 12.3: one decimal, no leading zero.
export const percentOf = (n: number | undefined): string => n === undefined ? '' : n.toFixed(1).replace(/^0\./, '.')

const sum = (jobs: IWrkJob[], of: (j: IWrkJob) => number | undefined): number | undefined => {
    const values = jobs.map(of).filter((v): v is number => v !== undefined)
    return values.length ? values.reduce((a, b) => a + b, 0) : undefined
}

const USER: IWrkColumn = { heading: 'User', width: 10, value: r => r.job ? up(r.job.user, 10) : '' }
const TYPE: IWrkColumn = { heading: 'Type', width: 4, value: r => r.job ? r.job.type : EWrkJobType.SBS }
const CPU_PERCENT: IWrkColumn = { heading: 'CPU %', width: 5, right: true, value: r => percentOf(r.job ? r.job.cpu : sum(r.jobs, j => j.cpu)) }
const STATUS: IWrkColumn = { heading: 'Status', width: 6, value: r => r.job ? r.job.status : EWrkJobStatus.DEQW }
const POOL: IWrkColumn = { heading: 'Pool', width: 10, value: r => r.job ? up(r.job.node, 10) : '' }
const PTY: IWrkColumn = { heading: 'Pty', width: 10, value: r => r.job ? up(r.job.priorityClass, 10) : '' }
const CPU_SECONDS: IWrkColumn = { heading: 'CPU', width: 9, right: true, value: r => { const v = r.job ? r.job.cpuSeconds : sum(r.jobs, j => j.cpuSeconds); return v === undefined ? '' : v.toFixed(1) } }
const AUX_IO: IWrkColumn = { heading: 'AuxIO', width: 5, right: true, value: r => String(r.job ? r.job.restarts : r.jobs.reduce((n, j) => n + j.restarts, 0)) }
const functionColumn = (width: number): IWrkColumn => ({ heading: 'Function', width, value: r => r.job && r.job.program ? up('PGM-' + r.job.program, width) : '' })
const NAMESPACE: IWrkColumn = { heading: 'Namespace', width: 24, value: r => r.subsystem.slice(0, 24) }
const podColumn = (width: number): IWrkColumn => ({ heading: 'Pod', width, value: r => r.job ? r.job.name.slice(0, width) : '' })

// Where the columns after Subsystem/Job start: Opt is columns 1-3, the name 6-18.
export const OPT_COL = 2
export const NAME_COL = 6
export const NAME_WIDTH = 13
const FIRST_COL = NAME_COL + NAME_WIDTH + 2

// The views a width offers, in F11 order. At 132 columns the status and elapsed data fit together.
export const viewsFor = (cols: number): EWrkView[] => cols >= 132 ? [EWrkView.STATUS, EWrkView.NAMES] : [EWrkView.STATUS, EWrkView.ELAPSED, EWrkView.NAMES]

export const columnsOf = (view: EWrkView, cols: number): IWrkColumn[] => {
    const room = cols - FIRST_COL - 1
    switch (view) {
        case EWrkView.ELAPSED:
            return [TYPE, POOL, PTY, CPU_SECONDS, AUX_IO]
        case EWrkView.NAMES:
            return [NAMESPACE, podColumn(room - NAMESPACE.width - 2)]
        default:
            return cols >= 132
                ? [USER, TYPE, CPU_PERCENT, functionColumn(20), STATUS, POOL, PTY, CPU_SECONDS, AUX_IO]
                : [USER, TYPE, CPU_PERCENT, functionColumn(15), STATUS]
    }
}

// What F11 says it will show next.
export const F11_LABEL: Record<EWrkView, string> = {
    [EWrkView.STATUS]: 'F11=Display elapsed data',
    [EWrkView.ELAPSED]: 'F11=Display names',
    [EWrkView.NAMES]: 'F11=Display status'
}

// The name column: a subsystem flush left, its jobs two to the right, ten characters each as on IBM i.
export const nameOf = (row: IWrkRow): string => row.job ? '  ' + up(row.job.name, 10) : up(row.subsystem, 10)

// ─── Painting ────────────────────────────────────────────────────────────────────────────────────

export interface IActiveJobsState {
    system: string
    now: number
    elapsedMs: number          // since the statistics were last restarted (F10)
    clusterCpu?: number
    activeJobs: number
    rows: IWrkRow[]            // the whole list, filtered
    top: number                // index of the first row shown
    view: EWrkView
    command: string
    message: string
}

export interface IActiveJobsFields {
    options: { start: number; row: IWrkRow }[]
    command: number
}

// How many list rows fit on this screen.
export const pageSizeOf = (rows: IWrkRows): number => rows.lastData - rows.firstData + 1

export const OPTIONS_LEGEND = '4=End   5=Work with   7=Display message   8=Work with spooled files'

export const paintActiveJobs = (p: Painter5250, state: IActiveJobsState): IActiveJobsFields => {
    const screen = p.screen
    const rows = rowsOf(screen)
    const columns = columnsOf(state.view, screen.cols)
    paintTitle(p, 'Work with Active Jobs', state.system, rows.title)
    paintRight(p, rows.date, dateTimeOf(state.now))
    p.text(rows.stats, 1, `CPU %:  ${percentOf(state.clusterCpu).padStart(5)}     Elapsed time:   ${elapsedOf(state.elapsedMs)}     Active jobs:  ${String(state.activeJobs).padStart(5)}`, E5250Attribute.GREEN, true)
    p.text(rows.instructions, 1, 'Type options, press Enter.', E5250Attribute.BLUE, true)
    p.text(rows.legend, 3, OPTIONS_LEGEND, E5250Attribute.BLUE, true)

    // headings: Opt, Subsystem/Job, then the view's columns
    let heading = 'Opt  ' + 'Subsystem/Job'.padEnd(NAME_WIDTH + 2)
    for (const c of columns) heading += (c.right ? c.heading.padStart(c.width) : c.heading.padEnd(c.width)) + '  '
    p.text(rows.headings, 1, heading.trimEnd(), E5250Attribute.WHITE, true)

    const fields: IActiveJobsFields = { options: [], command: -1 }
    const page = state.rows.slice(state.top, state.top + pageSizeOf(rows))
    page.forEach((row, i) => {
        const r = rows.firstData + i
        fields.options.push({ start: p.input(r, OPT_COL, 2), row })
        let line = nameOf(row).padEnd(NAME_WIDTH + 2)
        for (const c of columns) {
            const v = c.value(row).slice(0, c.width)
            line += (c.right ? v.padStart(c.width) : v.padEnd(c.width)) + '  '
        }
        p.text(r, NAME_COL, line.trimEnd(), E5250Attribute.GREEN, true)
        // a job waiting for the operator stands out
        if (row.job?.status === EWrkJobStatus.MSGW && columns.includes(STATUS)) {
            const at = NAME_COL + NAME_WIDTH + 2 + columns.slice(0, columns.indexOf(STATUS)).reduce((n, c) => n + c.width + 2, 0)
            p.text(r, at, EWrkJobStatus.MSGW, E5250Attribute.WHITE, true)
        }
    })
    if (state.rows.length === 0) p.text(rows.firstData, NAME_COL, '(No active jobs to display)', E5250Attribute.BLUE, true)
    paintRight(p, rows.more, state.top + pageSizeOf(rows) < state.rows.length ? 'More...' : 'Bottom')

    fields.command = paintCommandLine(p, rows, 'Parameters or command', state.command)
    paintKeys(p, rows, ['F3=Exit', 'F5=Refresh', 'F7=Find', 'F10=Restart statistics'], [F11_LABEL[state.view], 'F12=Cancel'])
    paintMessage(p, rows, state.message)
    return fields
}
