import { Painter } from './Painter'
import { EMessageLevel, paintActionBar, paintCommandLine, paintPfKeys, paintShortMessage, ROW_TITLE } from './SdsfLayout'
import { cell, DA_COLUMNS, IDaColumn, JOBNAME_COLUMN } from './DaColumns'
import { ISdsfPod } from '../SdsfTypes'
import { E3270Color, E3270Intensity } from '../terminal/Terminal3270Types'

/*
    The DA panel, laid out like the reference capture of a 32x80 DA:

      row 2     SDSF DA K3D-DEV  (ALL)     PAG  0  CPU/L/Z  12/ 12/  0          LINE 1-24 (57)
      row 3     COMMAND INPUT ===>                                          SCROLL ===> PAGE
      row 4     PREFIX=*  DEST=(ALL)  OWNER=*  SORT=*                         (turquoise)
      row 5     NP   JOBNAME  StepName ProcStep JobID    Owner    C Pos DP  Real Paging     SIO
      6..29     one pod per row, NP is where line commands are typed
      30..31    PF keys

    NP and JOBNAME stay put; the other columns scroll sideways from `offset`.
*/
export const ROW_FILTER = 4
export const ROW_HEADERS = 5
export const ROW_FIRST_DATA = 6
export const DATA_ROWS = 24

const NP_COL = 1
const NP_LENGTH = 3
const JOBNAME_COL = 5
const FIRST_SCROLL_ATTRIBUTE = 13

export interface IDaPaintState {
    system: string
    dest: string
    prefix: string
    owner: string
    sort: string               // as shown on the filter line: 'JOBNAME/A', or '' for the natural order
    auto: number               // seconds of the automatic update, 0 when off
    pods: ISdsfPod[]           // already filtered and sorted
    top: number
    offset: number
    clusterCpu?: number
    command: string
    scroll: string
    message: string
    messageLevel: EMessageLevel
    longMessage: string        // shown on the filter line when the operator asks (PF1)
    now: number
}

export interface IDaFields {
    command: number
    scroll: number
    np: { attribute: number; pod: ISdsfPod }[]
    shown: number              // how many scrolling columns fit from the offset
}

// The scrolling columns that fit from an offset, with the position of each one's attribute.
export const columnsFrom = (offset: number, cols: number): { column: IDaColumn; attribute: number }[] => {
    const result: { column: IDaColumn; attribute: number }[] = []
    let x = FIRST_SCROLL_ATTRIBUTE
    for (let i = offset; i < DA_COLUMNS.length; i++) {
        const column = DA_COLUMNS[i]
        if (x + column.width > cols - 1) break
        result.push({ column, attribute: x })
        x += column.width + 1
    }
    return result
}

// The offset PF10 goes back to: as many columns to the left as would fill the screen ending before `offset`.
export const offsetLeftOf = (offset: number, cols: number): number => {
    let room = cols - 1 - FIRST_SCROLL_ATTRIBUTE
    let i = offset
    while (i > 0 && room - (DA_COLUMNS[i - 1].width + 1) >= 0) {
        room -= DA_COLUMNS[i - 1].width + 1
        i--
    }
    return i
}

export const paintDa = (p: Painter, state: IDaPaintState): IDaFields => {
    const screen = p.screen
    const total = state.pods.length
    const last = Math.min(state.top + DATA_ROWS, total)
    paintActionBar(p)

    const cpu = state.clusterCpu === undefined ? '  -' : String(Math.round(state.clusterCpu)).padStart(3)
    const title = `SDSF DA ${state.system.toUpperCase().slice(0, 8).padEnd(8)} ${(state.dest || '(ALL)').toUpperCase().slice(0, 8).padEnd(8)} PAG  0  CPU/L/Z ${cpu}/${cpu}/  0`
    const lines = `LINE ${total ? state.top + 1 : 0}-${last} (${total})`
    p.text(ROW_TITLE, 1, title, { color: E3270Color.WHITE })
    p.text(ROW_TITLE, screen.cols - lines.length, lines, { color: E3270Color.WHITE })
    paintShortMessage(p, state.message, state.messageLevel)
    const fields = paintCommandLine(p, state.command, state.scroll)

    if (state.longMessage) {
        p.text(ROW_FILTER, 1, state.longMessage.slice(0, screen.cols - 1), { color: E3270Color.WHITE, intensity: E3270Intensity.HIGH })
    }
    else {
        const filter = `PREFIX=${state.prefix || '*'}  DEST=${state.dest || '(ALL)'}  OWNER=${state.owner || '*'}  SORT=${state.sort || '*'}${state.auto ? `  &${state.auto}` : ''}`
        p.text(ROW_FILTER, 1, filter.slice(0, screen.cols - 1), { color: E3270Color.TURQUOISE })
    }

    const columns = columnsFrom(state.offset, screen.cols)
    const header = (col: number, column: IDaColumn) =>
        p.text(ROW_HEADERS, col, column.right ? column.header.padStart(column.width) : column.header.padEnd(column.width), { color: E3270Color.TURQUOISE })
    p.text(ROW_HEADERS, NP_COL, 'NP ', { color: E3270Color.BLUE })
    header(JOBNAME_COL, JOBNAME_COLUMN)
    for (const c of columns) header(c.attribute + 1, c.column)

    const np: IDaFields['np'] = []
    for (let i = 0; i < DATA_ROWS && state.top + i < total; i++) {
        const pod = state.pods[state.top + i]
        const row = ROW_FIRST_DATA + i
        np.push({ attribute: p.input(row, NP_COL, NP_LENGTH, '', { intensity: E3270Intensity.HIGH }), pod })
        p.text(row, JOBNAME_COL, cell(JOBNAME_COLUMN, pod, state.now), { color: JOBNAME_COLUMN.color(pod) })
        for (const c of columns) p.text(row, c.attribute + 1, cell(c.column, pod, state.now), { color: c.column.color(pod) })
    }
    paintPfKeys(p)
    return { command: fields.command, scroll: fields.scroll, np, shown: columns.length }
}
