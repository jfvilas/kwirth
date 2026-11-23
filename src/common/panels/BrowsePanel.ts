import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { IWrkEvent } from '../WrkactjobTypes'
import { paintRight, paintTitle } from './WrkLayout'

/*
    DSPSPLF and DSPJOBLOG: a text read once and browsed, as IBM i's Display Spooled File lays it out — the file and
    where you are on top, a Control field (T, B, +n, -n, a line number) and a Find field, the ruler, the lines,
    and F16 to find again, F19/F20 to shift left and right.
*/
export interface IBrowse {
    title: string              // 'Display Spooled File' or 'Display Job Log'
    label: string              // 'File' or 'Job'
    name: string               // the file (container) or the job
    lines: string[]
    top: number                // index of the first line shown
    left: number               // index of the first column shown
    find: string               // the last string looked for
}

export interface IBrowseFields {
    control: number
    find: number
}

// The rows of the panel: the header block, the lines between, More/Bottom and the keys below.
export const FIRST_LINE_ROW = 5
export const linesShown = (screenRows: number): number => screenRows - 3 - FIRST_LINE_ROW
export const columnsShown = (screenCols: number): number => screenCols - 2

// '*...+....1....+....2' from column 1; shifted, from the column shown first ('4....+....5' at column 40).
export const rulerFrom = (left: number, width: number): string => {
    let ruler = ''
    for (let c = left + 1; ruler.length < width; c++) {
        // the star is column 1's own: shifted right, the ruler starts with the column's dot, plus or digit
        ruler += c % 10 === 0 ? String((c / 10) % 10) : c % 5 === 0 ? '+' : c === 1 ? '*' : '.'
    }
    return ruler
}

// What the control field asks for: the new first line, or undefined when it is not a control value.
export const controlTarget = (control: string, top: number, total: number, page: number): number | undefined => {
    const c = control.trim().toUpperCase()
    const last = Math.max(0, total - page)
    const clamp = (n: number) => Math.max(0, Math.min(n, last))
    if (c === 'T') return 0
    if (c === 'B') return last
    if (/^[+-]\d+$/.test(c)) return clamp(top + Number(c))
    if (/^\d+$/.test(c)) return clamp(Number(c) - 1)
    return undefined
}

// The next line (after the first one shown) holding the string, wrapping round; undefined when none does.
export const findFrom = (lines: string[], top: number, text: string): number | undefined => {
    const needle = text.toUpperCase()
    for (let i = 1; i <= lines.length; i++) {
        const at = (top + i) % lines.length
        if (lines[at].toUpperCase().includes(needle)) return at
    }
    return undefined
}

// A job log line: when, of what type, why, and what was said.
export const jobLogLine = (e: IWrkEvent): string => {
    const time = e.time ? e.time.slice(11, 19) : '        '
    const count = e.count > 1 ? ` (x${e.count})` : ''
    return `${time}  ${(e.type || '').padEnd(7)}  ${e.reason}: ${e.message}${count}`
}

export const paintBrowse = (p: Painter5250, browse: IBrowse, message: string): IBrowseFields => {
    const screen = p.screen
    const page = linesShown(screen.rows)
    const width = columnsShown(screen.cols)
    paintTitle(p, browse.title, '', 0)
    const position = `Page/Line   1/${browse.lines.length === 0 ? 0 : browse.top + 1}`
    p.text(1, 1, `${browse.label.padEnd(6, ' ')}. . . . . :   ${browse.name}`.slice(0, screen.cols - position.length - 4), E5250Attribute.GREEN, true)
    paintRight(p, 1, position, E5250Attribute.GREEN)
    p.text(2, 1, 'Control . . . . .', E5250Attribute.GREEN, true)
    const control = p.input(2, 21, 5, '', { monocase: true })
    paintRight(p, 2, `Columns     ${browse.left + 1} - ${browse.left + width}`, E5250Attribute.GREEN)
    p.text(3, 1, 'Find  . . . . . .', E5250Attribute.GREEN, true)
    const find = p.input(3, 21, 30, browse.find)
    p.text(4, 1, rulerFrom(browse.left, width), E5250Attribute.WHITE, true)
    browse.lines.slice(browse.top, browse.top + page).forEach((line, i) => {
        const shown = line.slice(browse.left, browse.left + width)
        if (shown) p.text(FIRST_LINE_ROW + i, 1, shown, E5250Attribute.GREEN, true)
    })
    if (browse.lines.length === 0) p.text(FIRST_LINE_ROW, 1, '(Nothing to display)', E5250Attribute.BLUE, true)
    paintRight(p, screen.rows - 3, browse.top + page < browse.lines.length ? 'More...' : 'Bottom')
    // one row of keys, right above the message line: the browse takes every row it can for the text
    p.text(screen.rows - 2, 1, ['F3=Exit', 'F12=Cancel', 'F16=Find', 'F19=Left', 'F20=Right'].join('   '), E5250Attribute.BLUE, true)
    if (message) p.text(screen.rows - 1, 1, message.slice(0, screen.cols - 2), E5250Attribute.WHITE, true)
    return { control, find }
}
