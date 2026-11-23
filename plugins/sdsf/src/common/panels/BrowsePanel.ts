import { E3270Color, I3270Geometry, Painter } from '@jfvilas/kwirth-dce-blockterm'
import { EMessageLevel, paintActionBar, paintCommandLine, paintPfKeys, paintShortMessage, ROW_TITLE, rowPfKeys } from './SdsfLayout'

/*
    The output browse (SDSF's ODS): a container log or a describe, read once, shown 79 columns at a time (131
    on a 27x132)
    between the TOP OF DATA and BOTTOM OF DATA marks, as in the reference capture of SDSF.LOG.

      row 2     SDSF OUTPUT DISPLAY API-7D9F STC43981  DSID   101  LINE 0       COLUMNS 01- 79
      row 3     COMMAND INPUT ===>                                          SCROLL ===> PAGE
      4..29     the lines (green), the marks (white), down to the PF keys
*/
export const ROW_FIRST_BROWSE = 4
export const browseHeight = (g: I3270Geometry): number => rowPfKeys(g) - ROW_FIRST_BROWSE
export const browseWidth = (g: I3270Geometry): number => g.cols - 1

// '***** TOP OF DATA *****' across the screen, the words in the middle.
export const dataMark = (words: string, cols: number): string => {
    const text = ` ${words} `
    const left = Math.floor((cols - text.length) / 2)
    return '*'.repeat(left) + text + '*'.repeat(cols - left - text.length)
}

// ANSI escape sequences (colours, cursor moves) that container logs often carry.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b[@-_]/g

/*
    A log line made printable on a 3270: no escape sequences, tabs expanded to the next multiple of 8, and any
    other control character shown as a dot, as ODS shows unprintable bytes.
*/
export const printable = (line: string): string => {
    let result = ''
    for (const c of line.replace(ANSI, '').replace(/\r$/, '')) {
        if (c === '\t') result += ' '.repeat(8 - (result.length % 8))
        else if (c < ' ' || c === '\u007f') result += '.'
        else result += c
    }
    return result
}

export interface IBrowseState {
    heading: string            // 'OUTPUT DISPLAY API-7D9F STC43981  DSID   101' or 'DESCRIBE API-7D9F STC43981'
    lines: string[]            // already printable
    colors?: E3270Color[]      // one per line when the lines are not all alike (the SYSLOG); green otherwise
    top: number                // index in [TOP mark, ...lines, BOTTOM mark]
    left: number               // first column shown, 0-based
    command: string
    scroll: string
    message: string
    messageLevel: EMessageLevel
}

// The browse as shown: the two marks around the lines.
export const browseRows = (lines: string[], cols: number): string[] => [dataMark('TOP OF DATA', cols), ...lines, dataMark('BOTTOM OF DATA', cols)]

export const paintBrowse = (p: Painter, state: IBrowseState): { command: number; scroll: number } => {
    const screen = p.screen
    paintActionBar(p)
    const width = browseWidth(screen)
    const columns = `COLUMNS ${String(state.left + 1).padStart(2, '0')}- ${String(state.left + width).padStart(2, '0')}`
    p.text(ROW_TITLE, 1, `SDSF ${state.heading}  LINE ${state.top}`.slice(0, screen.cols - columns.length - 3), { color: E3270Color.WHITE })
    p.text(ROW_TITLE, screen.cols - columns.length, columns, { color: E3270Color.WHITE })
    paintShortMessage(p, state.message, state.messageLevel)
    const fields = paintCommandLine(p, state.command, state.scroll)

    const rows = browseRows(state.lines, screen.cols)
    for (let i = 0; i < browseHeight(screen) && state.top + i < rows.length; i++) {
        const index = state.top + i
        const mark = index === 0 || index === rows.length - 1
        // The marks do not scroll sideways: they say where the data ends, whatever the column.
        const text = mark ? rows[index] : rows[index].slice(state.left, state.left + width)
        const color = mark ? E3270Color.WHITE : state.colors?.[index - 1] ?? E3270Color.GREEN
        p.text(ROW_FIRST_BROWSE + i, 1, text.slice(0, width), { color })
    }
    paintPfKeys(p)
    return fields
}
