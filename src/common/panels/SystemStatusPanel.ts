import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { IWrkPool, IWrkSystem } from '../WrkactjobTypes'
import { leader } from './JobIdentity'
import { percentOf } from './ActiveJobsPanel'
import { dateTimeOf, elapsedOf, paintCommandLine, paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

/*
    WRKSYSSTS, Work with System Status (PRD-fase3 §2.1): the system's figures on top, then its main storage
    pools, which here are the nodes (D13), numbered from 1 in name order. Pure painting, like the other panels.
*/

export enum ESystemView {
    FAULTS = 'faults',         // pool size, reserved, max active, DB fault (jobs in MSGW), non-DB fault (restarts)
    ACTIVITY = 'activity',     // active jobs, CPU %, memory used
    NAMES = 'names',           // the pool's name: the node
    WIDE = 'wide'              // 132 columns: everything at once
}

// The views a width offers, in F11 order.
export const systemViewsFor = (cols: number): ESystemView[] =>
    cols >= 132 ? [ESystemView.WIDE] : [ESystemView.FAULTS, ESystemView.ACTIVITY, ESystemView.NAMES]

export const SYSTEM_F11_LABEL: Record<ESystemView, string> = {
    [ESystemView.FAULTS]: 'F11=Display activity',
    [ESystemView.ACTIVITY]: 'F11=Display pool names',
    [ESystemView.NAMES]: 'F11=Display faults',
    [ESystemView.WIDE]: ''
}

// IBM i's 'not available'.
export const NOT_AVAILABLE = '*N'

// What a key below 'cluster' is told (D17), on every refresh.
export const RESTRICTED_MESSAGE = 'Not authorized to some system values.'

const MIB = 1024 ** 2
const GIB = 1024 ** 3

// Megabytes with two decimals, as the pool sizes read on IBM i.
export const megabytesOf = (bytes: number | undefined): string => bytes === undefined ? '' : (bytes / MIB).toFixed(2)

// The system ASP in gigabytes: '15.00 G'.
export const gigabytesOf = (bytes: number): string => `${(bytes / GIB).toFixed(2)} G`

// '% system ASP used' with four decimals, as IBM i writes it (66.6667).
export const aspPercentOf = (bound: number, capacity: number): string => capacity > 0 ? (bound / capacity * 100).toFixed(4) : '.0000'

interface ISystemColumn {
    heading1: string
    heading2: string
    width: number
    right: boolean
    value: (pool: IWrkPool, index: number) => string
}

const column = (heading1: string, heading2: string, width: number, value: (pool: IWrkPool, index: number) => string, right = true): ISystemColumn =>
    ({ heading1, heading2, width, right, value })

const NUMBER = column('System', 'Pool', 6, (_p, i) => String(i + 1))
const SIZE = column('Pool', 'Size (M)', 10, p => megabytesOf(p.memory))
const RESERVED = column('Reserved', 'Size (M)', 10, p => megabytesOf(p.reserved))
const MAX_ACTIVE = column('Max', 'Active', 6, p => String(p.maxActive))
const DB_FAULT = column('DB', 'Fault', 6, p => String(p.failing))
const NON_DB_FAULT = column('Non-DB', 'Fault', 6, p => String(p.restarts))
const ACTIVE = column('', 'Active', 6, p => String(p.jobs))
const CPU = column('', 'CPU %', 6, p => p.cpu === undefined ? '' : percentOf(p.cpu))
const USED = column('Used', 'Size (M)', 10, p => megabytesOf(p.memoryUsed))
const nameColumn = (width: number): ISystemColumn => column('Pool', 'Name', width, p => p.name, false)

const FIRST_COL = 1

export const systemColumnsOf = (view: ESystemView, cols: number): ISystemColumn[] => {
    const fixed = (list: ISystemColumn[]) => list.reduce((n, c) => n + c.width + 2, FIRST_COL)
    switch (view) {
        case ESystemView.ACTIVITY:
            return [NUMBER, SIZE, ACTIVE, CPU, USED]
        case ESystemView.NAMES:
            return [NUMBER, SIZE, nameColumn(cols - fixed([NUMBER, SIZE]) - 1)]
        case ESystemView.WIDE: {
            const list = [NUMBER, SIZE, RESERVED, MAX_ACTIVE, DB_FAULT, NON_DB_FAULT, ACTIVE, CPU, USED]
            return [...list, nameColumn(cols - fixed(list) - 1)]
        }
        default:
            return [NUMBER, SIZE, RESERVED, MAX_ACTIVE, DB_FAULT, NON_DB_FAULT]
    }
}

export interface ISystemStatusState {
    system: string
    now: number
    elapsedMs: number          // since the panel opened or F10
    status?: IWrkSystem        // undefined until the first answer
    top: number                // the first pool shown
    view: ESystemView
    command: string
    message: string
}

// The rows of the pool list: below the figures, up to 'More...'/'Bottom'.
export const POOL_HEADINGS = 7
// The last one is the list's last row on every IBM i list panel (WrkLayout's lastData).
export const poolRowsOf = (screenRows: number): { first: number; last: number } =>
    ({ first: POOL_HEADINGS + 2, last: screenRows - 7 })

export const poolPageSizeOf = (screenRows: number): number => {
    const { first, last } = poolRowsOf(screenRows)
    return last - first + 1
}

// The figures: left half from column 1, right half (auxiliary storage) from the middle; 80 columns hold both.
const LEFT_LABEL = 27
const RIGHT_LABEL = 25    // odd, like the left one: the dot leader needs it to end in " : "
const VALUE_WIDTH = 11

const figure = (p: Painter5250, row: number, col: number, labelWidth: number, label: string, value: string): void => {
    p.text(row, col, leader(label, labelWidth), E5250Attribute.GREEN, true)
    p.text(row, col + labelWidth, value.padStart(VALUE_WIDTH), E5250Attribute.WHITE, true)
}

// Returns the command line field.
export const paintSystemStatus = (p: Painter5250, state: ISystemStatusState): number => {
    const screen = p.screen
    const rows = rowsOf(screen)
    const status = state.status
    paintTitle(p, 'Work with System Status', state.system, rows.title)
    paintRight(p, rows.date, dateTimeOf(state.now))

    const restricted = status?.restricted ?? false
    const cpu = status?.cpu === undefined ? NOT_AVAILABLE : percentOf(status.cpu)
    const mainStorage = !status || restricted ? NOT_AVAILABLE : megabytesOf(status.pools.reduce((n, pool) => n + pool.memory, 0))
    figure(p, 2, 1, LEFT_LABEL, '% CPU used', cpu)
    figure(p, 3, 1, LEFT_LABEL, 'Elapsed time', elapsedOf(state.elapsedMs))
    figure(p, 4, 1, LEFT_LABEL, 'Jobs in system', status ? String(status.jobs) : NOT_AVAILABLE)
    figure(p, 5, 1, LEFT_LABEL, 'Main storage size (M)', mainStorage)
    const right = Math.floor(screen.cols / 2) + 1
    const storage = status?.storage
    p.text(2, right, 'Auxiliary storage:', E5250Attribute.GREEN, true)
    figure(p, 3, right + 2, RIGHT_LABEL, 'System ASP', storage ? gigabytesOf(storage.capacity) : NOT_AVAILABLE)
    figure(p, 4, right + 2, RIGHT_LABEL, '% system ASP used', storage ? aspPercentOf(storage.bound, storage.capacity) : NOT_AVAILABLE)

    const columns = systemColumnsOf(state.view, screen.cols)
    let h1 = ''
    let h2 = ''
    for (const c of columns) {
        h1 += (c.right ? c.heading1.padStart(c.width) : c.heading1.padEnd(c.width)) + '  '
        h2 += (c.right ? c.heading2.padStart(c.width) : c.heading2.padEnd(c.width)) + '  '
    }
    p.text(POOL_HEADINGS, FIRST_COL, h1.trimEnd(), E5250Attribute.WHITE, true)
    p.text(POOL_HEADINGS + 1, FIRST_COL, h2.trimEnd(), E5250Attribute.WHITE, true)

    const pools = status?.pools ?? []
    const { first } = poolRowsOf(screen.rows)
    const page = pools.slice(state.top, state.top + poolPageSizeOf(screen.rows))
    page.forEach((pool, i) => {
        let line = ''
        for (const c of columns) {
            const v = c.value(pool, state.top + i).slice(0, c.width)
            line += (c.right ? v.padStart(c.width) : v.padEnd(c.width)) + '  '
        }
        p.text(first + i, FIRST_COL, line.trimEnd(), E5250Attribute.GREEN, true)
    })
    if (status && pools.length === 0) p.text(first, FIRST_COL, '(No pools to display)', E5250Attribute.BLUE, true)
    paintRight(p, rows.more, state.top + poolPageSizeOf(screen.rows) < pools.length ? 'More...' : 'Bottom')

    const command = paintCommandLine(p, rows, 'Command', state.command)
    paintKeys(p, rows, ['F3=Exit', 'F4=Prompt', 'F5=Refresh', 'F10=Restart', 'F12=Cancel'], [SYSTEM_F11_LABEL[state.view]].filter(Boolean))
    paintMessage(p, rows, state.message)
    return command
}
