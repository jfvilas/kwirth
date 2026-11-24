import { E5250Attribute, Painter5250, Screen5250 } from '@jfvilas/kwirth-dce-blockterm'

/*
    Where things go on an IBM i list panel, in any geometry (24x80 or 27x132), counted from the bottom as the
    real screens do: the message line is the last row, the function keys the two above it, the command line
    and its label above them, and 'More...' / 'Bottom' closes the list.
*/
export interface IWrkRows {
    title: number          // the panel's title, centred; the system name on the right
    date: number           // date and time on the right
    stats: number          // CPU %, elapsed time, active jobs
    instructions: number   // 'Type options, press Enter.'
    legend: number         // the options
    headings: number
    firstData: number
    lastData: number
    more: number           // 'More...' or 'Bottom', on the right
    commandLabel: number   // 'Parameters or command'
    command: number        // '===>' and the command line
    keys1: number
    keys2: number
    message: number        // the error/message line
}

// Only the height matters, so a page size can be worked out from a number of rows alone.
export const rowsOf = (screen: Pick<Screen5250, 'rows'>): IWrkRows => {
    const r = screen.rows
    return {
        title: 0, date: 1, stats: 2, instructions: 4, legend: 5, headings: 7,
        firstData: 8, lastData: r - 7, more: r - 6, commandLabel: r - 5, command: r - 4, keys1: r - 3, keys2: r - 2, message: r - 1
    }
}

// The column the command line starts at, after '===>'.
export const COMMAND_COL = 6

// MM/DD/YY  HH:MM:SS, as IBM i shows the date and time on its panels.
export const dateTimeOf = (now: number): string => {
    const d = new Date(now)
    const two = (n: number) => String(n).padStart(2, '0')
    return `${two(d.getMonth() + 1)}/${two(d.getDate())}/${two(d.getFullYear() % 100)}  ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

// hh:mm:ss of a span of milliseconds.
export const elapsedOf = (ms: number): string => {
    const s = Math.max(0, Math.floor(ms / 1000))
    const two = (n: number) => String(n).padStart(2, '0')
    return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`
}

// The title centred and the system name at the right edge, both white, as on every IBM i panel.
export const paintTitle = (p: Painter5250, title: string, system: string, row = 0): void => {
    const cols = p.screen.cols
    p.text(row, Math.floor((cols - title.length) / 2), title, E5250Attribute.WHITE, true)
    const name = system.slice(0, 10)
    if (name) p.text(row, cols - name.length - 1, name, E5250Attribute.WHITE, true)
}

export const paintRight = (p: Painter5250, row: number, text: string, attribute: number = E5250Attribute.WHITE): void => {
    p.text(row, p.screen.cols - text.length - 1, text, attribute, true)
}

// The function keys, in blue, on two rows; each list is laid out with three blanks between keys.
export const paintKeys = (p: Painter5250, rows: IWrkRows, first: string[], second: string[]): void => {
    if (first.length) p.text(rows.keys1, 1, first.join('   '), E5250Attribute.BLUE, true)
    if (second.length) p.text(rows.keys2, 1, second.join('   '), E5250Attribute.BLUE, true)
}

// A message on the message line that does not lock the keyboard (an error goes through Terminal5250.hostError).
export const paintMessage = (p: Painter5250, rows: IWrkRows, text: string): void => {
    if (text) p.text(rows.message, 1, text.slice(0, p.screen.cols - 2), E5250Attribute.WHITE, true)
}

// The command line: its label, the arrow and a monocase input field to the right edge. Returns the field.
export const paintCommandLine = (p: Painter5250, rows: IWrkRows, label: string, value: string): number => {
    p.text(rows.commandLabel, 1, label, E5250Attribute.GREEN, true)
    p.text(rows.command, 1, '===>', E5250Attribute.GREEN, true)
    return p.input(rows.command, COMMAND_COL, p.screen.cols - COMMAND_COL - 2, value, { monocase: true })
}
