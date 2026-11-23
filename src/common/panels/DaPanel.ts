import { Painter } from './Painter'
import { EMessageLevel, paintActionBar, paintCommandLine, paintPfKeys, paintShortMessage, ROW_TITLE, rowPfKeys } from './SdsfLayout'
import { cell, DA_COLUMNS, IDaColumn, JOBNAME_COLUMN } from './DaColumns'
import { ISdsfPod } from '../SdsfTypes'
import { E3270Color, E3270Intensity, I3270Geometry } from '../terminal/Terminal3270Types'

/*
    The SDSF tabular panels (DA, and ST/O/H for Jobs), laid out like the reference capture of a 32x80 DA:

      row 2     SDSF DA K3D-DEV  (ALL)     PAG  0  CPU/L/Z  12/ 12/  0          LINE 1-24 (57)
      row 3     COMMAND INPUT ===>                                          SCROLL ===> PAGE
      row 4     PREFIX=*  DEST=(ALL)  OWNER=*  SORT=*                         (turquoise)
      row 5     NP   JOBNAME  StepName ProcStep JobID    Owner    C Pos DP  Real Paging     SIO
      6..29     one object per row, NP is where line commands are typed (as many as the model has rows for)
      30..31    PF keys

    NP and the fixed column (JOBNAME) stay put; the other columns scroll sideways from `offset`.
*/
export const ROW_FILTER = 4
export const ROW_HEADERS = 5
export const ROW_FIRST_DATA = 6
// 24 on a 32x80, 16 on a 24x80, 19 on a 27x132.
export const dataRows = (g: I3270Geometry): number => rowPfKeys(g) - ROW_FIRST_DATA

const NP_COL = 1
const NP_LENGTH = 3
const FIXED_COL = 5
const FIRST_SCROLL_ATTRIBUTE = 13

// ── Any table ───────────────────────────────────────────────────────────────────────────────────────

export interface ITablePaintState<T> {
    title: string              // the left of row 2; the LINE count goes on its right
    filter: string             // row 4, in turquoise
    fixed: IDaColumn<T>        // JOBNAME: never scrolls
    columns: IDaColumn<T>[]    // the ones PF10/PF11 scroll through
    rows: T[]                  // already filtered and sorted
    top: number
    offset: number
    command: string
    scroll: string
    message: string
    messageLevel: EMessageLevel
    longMessage: string        // shown on the filter line when the operator asks (PF1)
    now: number
}

export interface ITableFields<T> {
    command: number
    scroll: number
    np: { attribute: number; row: T }[]
    shown: number              // how many scrolling columns fit from the offset
}

// The scrolling columns that fit from an offset, with the position of each one's attribute.
export const columnsFrom = <T>(offset: number, cols: number, columns: IDaColumn<T>[]): { column: IDaColumn<T>; attribute: number }[] => {
    const result: { column: IDaColumn<T>; attribute: number }[] = []
    let x = FIRST_SCROLL_ATTRIBUTE
    for (let i = offset; i < columns.length; i++) {
        const column = columns[i]
        if (x + column.width > cols - 1) break
        result.push({ column, attribute: x })
        x += column.width + 1
    }
    return result
}

// The offset PF10 goes back to: as many columns to the left as would fill the screen ending before `offset`.
export const offsetLeftOf = <T>(offset: number, cols: number, columns: IDaColumn<T>[]): number => {
    let room = cols - 1 - FIRST_SCROLL_ATTRIBUTE
    let i = offset
    while (i > 0 && room - (columns[i - 1].width + 1) >= 0) {
        room -= columns[i - 1].width + 1
        i--
    }
    return i
}

export const paintTable = <T>(p: Painter, state: ITablePaintState<T>): ITableFields<T> => {
    const screen = p.screen
    const total = state.rows.length
    const last = Math.min(state.top + dataRows(screen), total)
    paintActionBar(p)

    const lines = `LINE ${total ? state.top + 1 : 0}-${last} (${total})`
    p.text(ROW_TITLE, 1, state.title, { color: E3270Color.WHITE })
    p.text(ROW_TITLE, screen.cols - lines.length, lines, { color: E3270Color.WHITE })
    paintShortMessage(p, state.message, state.messageLevel)
    const fields = paintCommandLine(p, state.command, state.scroll)

    if (state.longMessage) {
        p.text(ROW_FILTER, 1, state.longMessage.slice(0, screen.cols - 1), { color: E3270Color.WHITE, intensity: E3270Intensity.HIGH })
    }
    else {
        p.text(ROW_FILTER, 1, state.filter.slice(0, screen.cols - 1), { color: E3270Color.TURQUOISE })
    }

    const columns = columnsFrom(state.offset, screen.cols, state.columns)
    const header = (col: number, column: IDaColumn<T>) =>
        p.text(ROW_HEADERS, col, column.right ? column.header.padStart(column.width) : column.header.padEnd(column.width), { color: E3270Color.TURQUOISE })
    p.text(ROW_HEADERS, NP_COL, 'NP ', { color: E3270Color.BLUE })
    header(FIXED_COL, state.fixed)
    for (const c of columns) header(c.attribute + 1, c.column)

    const np: ITableFields<T>['np'] = []
    for (let i = 0; i < dataRows(screen) && state.top + i < total; i++) {
        const item = state.rows[state.top + i]
        const row = ROW_FIRST_DATA + i
        np.push({ attribute: p.input(row, NP_COL, NP_LENGTH, '', { intensity: E3270Intensity.HIGH }), row: item })
        p.text(row, FIXED_COL, cell(state.fixed, item, state.now), { color: state.fixed.color(item) })
        for (const c of columns) p.text(row, c.attribute + 1, cell(c.column, item, state.now), { color: c.column.color(item) })
    }
    paintPfKeys(p)
    return { command: fields.command, scroll: fields.scroll, np, shown: columns.length }
}

// The filter line every table shares; NODE= only when the DA shows one node's pods (? on INIT).
export const filterLine = (prefix: string, dest: string, owner: string, sort: string, auto: number, node = ''): string =>
    `PREFIX=${prefix || '*'}  DEST=${dest || '(ALL)'}  OWNER=${owner || '*'}  SORT=${sort || '*'}${node ? `  NODE=${node}` : ''}${auto ? `  &${auto}` : ''}`

// ── DA ──────────────────────────────────────────────────────────────────────────────────────────────

export interface IDaPaintState {
    system: string
    dest: string
    prefix: string
    owner: string
    sort: string               // as shown on the filter line: 'JOBNAME/A', or '' for the natural order
    auto: number               // seconds of the automatic update, 0 when off
    node: string               // the node whose pods are shown (? on INIT), '' for every node
    pods: ISdsfPod[]           // already filtered and sorted
    top: number
    offset: number
    clusterCpu?: number
    command: string
    scroll: string
    message: string
    messageLevel: EMessageLevel
    longMessage: string
    now: number
}

export type IDaFields = ITableFields<ISdsfPod>

export const paintDa = (p: Painter, state: IDaPaintState): IDaFields => {
    const cpu = state.clusterCpu === undefined ? '  -' : String(Math.round(state.clusterCpu)).padStart(3)
    return paintTable(p, {
        title: `SDSF DA ${state.system.toUpperCase().slice(0, 8).padEnd(8)} ${(state.dest || '(ALL)').toUpperCase().slice(0, 8).padEnd(8)} PAG  0  CPU/L/Z ${cpu}/${cpu}/  0`,
        filter: filterLine(state.prefix, state.dest, state.owner, state.sort, state.auto, state.node),
        fixed: JOBNAME_COLUMN,
        columns: DA_COLUMNS,
        rows: state.pods,
        top: state.top, offset: state.offset, command: state.command, scroll: state.scroll,
        message: state.message, messageLevel: state.messageLevel, longMessage: state.longMessage, now: state.now
    })
}
