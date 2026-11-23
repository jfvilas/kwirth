import { Screen3270 } from './Screen3270'
import { Terminal3270 } from './Terminal3270'
import { E3270Color, E3270Highlight, E3270Intensity, E3270Lock, I3270FieldAttribute } from './Terminal3270Types'
import { IGlassRun } from './GlassTypes'

/*
    What the operator SEES, worked out from the buffer: no DOM here, so the rules are tested on their own and
    any renderer (the browser today) only has to paint runs.
*/

/*
    The base-colour rule of the 3270: a field that does not say its colour takes it from its two attribute
    bits. Protected normal is blue, protected intensified white, input normal green, input intensified red.
    It is the reason a typed ISPF command shows red, and the labels blue, with nobody choosing it.
*/
export const baseColor = (attribute: I3270FieldAttribute | undefined): E3270Color => {
    if (!attribute) return E3270Color.GREEN
    const high = attribute.intensity === E3270Intensity.HIGH
    if (attribute.protected) return high ? E3270Color.WHITE : E3270Color.BLUE
    return high ? E3270Color.RED : E3270Color.GREEN
}

/*
    A monochrome 3278 has no colours, only two intensities. It ignores the extended colour attributes, and
    what ISPF asks for in colour reaches it as intensity: the emphasised CUA colours (white, red, yellow) and
    any intensified field are bright, the rest normal. The two levels are given back as WHITE (bright) and
    GREEN (normal), so a renderer only has to paint those two in phosphor green.
*/
const MONO_BRIGHT = new Set([E3270Color.WHITE, E3270Color.RED, E3270Color.YELLOW])

const monoColor = (color: E3270Color, attribute: I3270FieldAttribute | undefined): E3270Color =>
    attribute?.intensity === E3270Intensity.HIGH || MONO_BRIGHT.has(color) ? E3270Color.WHITE : E3270Color.GREEN

export interface IDisplayCell {
    text: string               // one character; a blank for attributes, nulls and hidden fields
    color: E3270Color          // never DEFAULT: always resolved
    highlight: E3270Highlight
}

export const displayCell = (screen: Screen3270, address: number, mono = false): IDisplayCell => {
    const cell = screen.cells[address]
    if (cell.attribute) return { text: ' ', color: mono ? E3270Color.GREEN : baseColor(cell.attribute), highlight: E3270Highlight.DEFAULT }
    const attribute = screen.attributeOf(address)
    const hidden = attribute?.intensity === E3270Intensity.HIDDEN
    const color = cell.color !== E3270Color.DEFAULT ? cell.color
        : attribute && attribute.color !== E3270Color.DEFAULT ? attribute.color
        : baseColor(attribute)
    const highlight = cell.highlight !== E3270Highlight.DEFAULT ? cell.highlight
        : attribute ? attribute.highlight
        : E3270Highlight.DEFAULT
    return { text: hidden || cell.char === '' ? ' ' : cell.char, color: mono ? monoColor(color, attribute) : color, highlight }
}

export interface IDisplayRun {
    text: string
    color: E3270Color
    highlight: E3270Highlight
    cursor: boolean            // this run is the single position under the cursor
}

// A row as runs of equal appearance; the cursor position is always a run of its own.
export const displayRow = (screen: Screen3270, row: number, showCursor: boolean, mono = false): IDisplayRun[] => {
    const runs: IDisplayRun[] = []
    for (let col = 0; col < screen.cols; col++) {
        const address = row * screen.cols + col
        const cell = displayCell(screen, address, mono)
        const cursor = showCursor && address === screen.cursor
        const last = runs[runs.length - 1]
        if (last && !cursor && !last.cursor && last.color === cell.color && last.highlight === cell.highlight) {
            last.text += cell.text
        }
        else {
            runs.push({ text: cell.text, color: cell.color, highlight: cell.highlight, cursor })
        }
    }
    return runs
}

// A row as the glass paints it: the 3270's single highlight becomes the glass's flags. 3270 has no separators.
export const glassRow3270 = (screen: Screen3270, row: number, showCursor: boolean, mono = false): IGlassRun[] =>
    displayRow(screen, row, showCursor, mono).map(run => ({
        text: run.text,
        color: run.color,
        reverse: run.highlight === E3270Highlight.REVERSE,
        underscore: run.highlight === E3270Highlight.UNDERSCORE,
        blink: run.highlight === E3270Highlight.BLINK,
        separator: false,
        cursor: run.cursor
    }))

// The Operator Information Area, the status line under the screen.
export interface IOia {
    ready: string              // '4A': model 4-series terminal, session A connected
    lock: string               // 'X SYSTEM', 'X Protected'… or '' when the keyboard is free
    insert: boolean
    position: string           // 'rr/ccc', 1-based, as PCOMM shows it
}

const LOCK_TEXT: Record<E3270Lock, string> = {
    [E3270Lock.NONE]: '',
    [E3270Lock.SYSTEM]: 'X SYSTEM',
    [E3270Lock.PROTECTED]: 'X Protected',
    [E3270Lock.NUMERIC]: 'X Numeric',
    [E3270Lock.OVERFLOW]: 'X Overflow'
}

export const oiaOf = (terminal: Terminal3270): IOia => {
    const screen = terminal.screen
    return {
        ready: '4A',
        lock: LOCK_TEXT[terminal.lock],
        insert: terminal.insert,
        position: String(screen.rowOf(screen.cursor) + 1).padStart(2, '0') + '/' + String(screen.colOf(screen.cursor) + 1).padStart(3, '0')
    }
}
