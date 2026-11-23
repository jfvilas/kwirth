import { Screen5250 } from './Screen5250'
import { Terminal5250 } from './Terminal5250'
import { E3270Color } from './Terminal3270Types'
import { E5250AttributeBit, E5250Lock } from './Terminal5250Types'
import { IGlassOia, IGlassRun } from './GlassTypes'

/*
    What the operator SEES on a 5250, worked out from the buffer: no DOM here, so the rules are tested on their
    own and the browser only paints runs.
*/

// How a screen attribute byte looks.
export interface I5250Look {
    color: E3270Color
    reverse: boolean
    underscore: boolean
    blink: boolean
    separator: boolean
    hidden: boolean
}

// Any combination with reverse, high intensity and underscore together is non-display, on every display.
const NONDISPLAY_BITS = E5250AttributeBit.REVERSE | E5250AttributeBit.HIGH | E5250AttributeBit.UNDERSCORE
const isNondisplay = (attribute: number): boolean => (attribute & NONDISPLAY_BITS) === NONDISPLAY_BITS

/*
    A colour display (5292-2, 3477-FC) reuses the bits of the monochrome attribute to mean colours, so the 32
    bytes are a table rather than bits. It is IBM's table: green and white with reverse and underscore; red with
    blink; turquoise and yellow with column separators; pink and blue.
*/
const C = E3270Color
const COLOR_TABLE: [E3270Color, boolean, boolean, boolean, boolean][] = [
    //  colour       reverse underscore blink separator
    [C.GREEN,     false, false, false, false],   // 0x20
    [C.GREEN,     true,  false, false, false],   // 0x21
    [C.WHITE,     false, false, false, false],   // 0x22
    [C.WHITE,     true,  false, false, false],   // 0x23
    [C.GREEN,     false, true,  false, false],   // 0x24
    [C.GREEN,     true,  true,  false, false],   // 0x25
    [C.WHITE,     false, true,  false, false],   // 0x26
    [C.GREEN,     false, false, false, false],   // 0x27 non-display
    [C.RED,       false, false, false, false],   // 0x28
    [C.RED,       true,  false, false, false],   // 0x29
    [C.RED,       false, false, true,  false],   // 0x2A
    [C.RED,       true,  false, true,  false],   // 0x2B
    [C.RED,       false, true,  false, false],   // 0x2C
    [C.RED,       true,  true,  false, false],   // 0x2D
    [C.RED,       false, true,  true,  false],   // 0x2E
    [C.RED,       false, false, false, false],   // 0x2F non-display
    [C.TURQUOISE, false, false, false, true],    // 0x30
    [C.TURQUOISE, true,  false, false, true],    // 0x31
    [C.YELLOW,    false, false, false, true],    // 0x32
    [C.YELLOW,    true,  false, false, true],    // 0x33
    [C.TURQUOISE, false, true,  false, false],   // 0x34
    [C.TURQUOISE, true,  true,  false, false],   // 0x35
    [C.YELLOW,    false, true,  false, false],   // 0x36
    [C.TURQUOISE, false, false, false, false],   // 0x37 non-display
    [C.PINK,      false, false, false, false],   // 0x38
    [C.PINK,      true,  false, false, false],   // 0x39
    [C.BLUE,      false, false, false, false],   // 0x3A
    [C.BLUE,      true,  false, false, false],   // 0x3B
    [C.PINK,      false, true,  false, false],   // 0x3C
    [C.PINK,      true,  true,  false, false],   // 0x3D
    [C.BLUE,      false, true,  false, false],   // 0x3E
    [C.BLUE,      false, false, false, false]    // 0x3F non-display
]

// On a monochrome display, the colours that stand out reach it as the bright level.
const MONO_BRIGHT = new Set([E3270Color.WHITE, E3270Color.RED, E3270Color.YELLOW])

/*
    The look of an attribute byte, from the colour table.

    On a monochrome display (a 5251, green phosphor) the screen is the same one the host would paint in colour,
    brought down to two intensities: IBM i knows the device and never sends it colours, it sends intensity. So,
    as the 3278 of SDSF does, what is white, red or yellow in colour is the bright green (returned as WHITE) and
    the rest the normal green (GREEN); reverse, underscore, blink and column separators stay as the attribute
    has them. Decoding the raw bits instead would turn every blue help text into column separators that blink.
*/
export const attributeLook = (attribute: number, mono = false): I5250Look => {
    const hidden = isNondisplay(attribute)
    const [color, reverse, underscore, blink, separator] = COLOR_TABLE[attribute & 0x1F]
    const shown = mono ? (MONO_BRIGHT.has(color) ? E3270Color.WHITE : E3270Color.GREEN) : color
    return { color: shown, reverse, underscore, blink, separator, hidden }
}

// The attribute governing a position: the nearest byte at or before it on the screen, not wrapping (a 5250
// screen starts in normal green). The position of a byte itself shows as a blank in normal green.
const governing = (screen: Screen5250, address: number): number => {
    for (let p = address - 1; p >= 0; p--) {
        const attribute = screen.cells[p].attribute
        if (attribute !== undefined) return attribute
    }
    return 0x20
}

type TGlassCell = Omit<IGlassRun, 'cursor'>

// The position of an attribute byte: a plain blank.
const ATTRIBUTE_CELL: TGlassCell = { text: ' ', color: E3270Color.GREEN, reverse: false, underscore: false, blink: false, separator: false }

const cellOf = (screen: Screen5250, address: number, governingAttribute: number, mono: boolean): TGlassCell => {
    const cell = screen.cells[address]
    if (cell.attribute !== undefined) return ATTRIBUTE_CELL
    const { hidden, ...look } = attributeLook(governingAttribute, mono)
    return { text: hidden || cell.char === '' ? ' ' : cell.char, ...look }
}

export const displayCell5250 = (screen: Screen5250, address: number, mono = false): TGlassCell =>
    cellOf(screen, address, governing(screen, address), mono)

const sameLook = (a: TGlassCell, b: TGlassCell): boolean =>
    a.color === b.color && a.reverse === b.reverse && a.underscore === b.underscore && a.blink === b.blink && a.separator === b.separator

// A row as runs of equal look; the cursor position is always a run of its own.
export const displayRow5250 = (screen: Screen5250, row: number, showCursor: boolean, mono = false): IGlassRun[] => {
    const runs: IGlassRun[] = []
    let governingAttribute = governing(screen, row * screen.cols)
    for (let col = 0; col < screen.cols; col++) {
        const address = row * screen.cols + col
        const cell = cellOf(screen, address, governingAttribute, mono)
        const own = screen.cells[address].attribute
        if (own !== undefined) governingAttribute = own
        const cursor = showCursor && address === screen.cursor
        const last = runs[runs.length - 1]
        if (last && !cursor && !last.cursor && sameLook(last, cell)) {
            last.text += cell.text
        }
        else {
            runs.push({ ...cell, cursor })
        }
    }
    return runs
}

const LOCK_TEXT: Record<E5250Lock, string> = {
    [E5250Lock.NONE]: '',
    [E5250Lock.SYSTEM]: 'X SYSTEM',
    [E5250Lock.OPERATOR]: 'X II',
    [E5250Lock.HOST_ERROR]: 'X II'
}

// The OIA of a 5250 as PCOMM shows it: 'MA' (machine available, session a), the lock and the error code.
export const oiaOf5250 = (terminal: Terminal5250): IGlassOia => {
    const screen = terminal.screen
    const lock = LOCK_TEXT[terminal.lock]
    return {
        ready: 'MA',
        lock: terminal.error ? `${lock} ${terminal.error}` : lock,
        insert: terminal.insert,
        position: String(screen.rowOf(screen.cursor) + 1).padStart(2, '0') + '/' + String(screen.colOf(screen.cursor) + 1).padStart(3, '0')
    }
}
