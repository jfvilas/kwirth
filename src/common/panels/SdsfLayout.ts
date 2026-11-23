import { Painter } from './Painter'
import { E3270Color, E3270Highlight, E3270Intensity, I3270Geometry } from '../terminal/Terminal3270Types'

/*
    The pieces every SDSF panel shares, placed where the reference captures of a 32x80 place them. The top
    rows are the same on every model; the PF keys take the last two rows and SCROLL the right edge, so a
    24x80 or a 27x132 lays out the same panels in its own size:

      row 0   action bar            Display  Filter  View  Print  Options  Search  Help
      row 1   rule                  ------------------------------------------------ (blue)
      row 2   title                 SDSF DA ...                       short message / LINE a-b (n)
      row 3   command line          COMMAND INPUT ===> ________          SCROLL ===> PAGE
      ...     the panel's own body
      last 2  PF keys               F1=HELP  F2=SPLIT  F3=END ...
*/

export const ROW_ACTION_BAR = 0
export const ROW_RULE = 1
export const ROW_TITLE = 2
export const ROW_COMMAND = 3
export const ROW_FIRST_BODY = 4
export const COMMAND_COL = 20
export const SCROLL_LENGTH = 4

export const rowPfKeys = (g: I3270Geometry): number => g.rows - 2
export const scrollCol = (g: I3270Geometry): number => g.cols - SCROLL_LENGTH
// The command field runs up to two blanks before 'SCROLL ===>': 42 positions on 80 columns, as in ISPF.
export const commandLength = (g: I3270Geometry): number => scrollCol(g) - 12 - COMMAND_COL - 2

export enum EMessageLevel {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

const ACTION_BAR = ['Display', 'Filter', 'View', 'Print', 'Options', 'Search', 'Help']

const PF_KEYS = [
    ' F1=HELP      F2=SPLIT     F3=END       F4=RETURN    F5=IFIND     F6=BOOK',
    ' F7=UP        F8=DOWN      F9=SWAP     F10=LEFT     F11=RIGHT    F12=RETRIEVE'
]

export const paintActionBar = (p: Painter): void => {
    let col = 2
    for (const entry of ACTION_BAR) {
        p.text(ROW_ACTION_BAR, col, entry, { color: E3270Color.WHITE })
        // The mnemonic letter, underscored as in CUA.
        p.attribute(ROW_ACTION_BAR, col, 1, E3270Color.WHITE, E3270Highlight.UNDERSCORE)
        col += entry.length + 2
    }
    p.text(ROW_RULE, 1, '-'.repeat(p.screen.cols - 1), { color: E3270Color.BLUE })
}

export const paintTitle = (p: Painter, title: string): void => {
    p.text(ROW_TITLE, 1, title.slice(0, p.screen.cols - 1), { color: E3270Color.WHITE })
}

// The ISPF short message: top right, over the end of the title line.
export const paintShortMessage = (p: Painter, message: string, level: EMessageLevel): void => {
    if (!message) return
    const text = message.slice(0, 30)
    const col = p.screen.cols - text.length
    const color = level === EMessageLevel.ERROR ? E3270Color.RED : level === EMessageLevel.WARNING ? E3270Color.YELLOW : E3270Color.WHITE
    p.text(ROW_TITLE, col, text, { color, intensity: E3270Intensity.HIGH })
}

// Returns the attribute addresses of the command and scroll fields.
export const paintCommandLine = (p: Painter, command: string, scroll: string): { command: number; scroll: number } => {
    p.text(ROW_COMMAND, 1, 'COMMAND INPUT ===>', { color: E3270Color.WHITE })
    const commandField = p.input(ROW_COMMAND, COMMAND_COL, commandLength(p.screen), command)
    p.text(ROW_COMMAND, scrollCol(p.screen) - 12, 'SCROLL ===>', { color: E3270Color.WHITE })
    const scrollField = p.input(ROW_COMMAND, scrollCol(p.screen), SCROLL_LENGTH, scroll)
    return { command: commandField, scroll: scrollField }
}

export const paintPfKeys = (p: Painter): void => {
    PF_KEYS.forEach((line, i) => p.text(rowPfKeys(p.screen) + i, 1, line.slice(1), { color: E3270Color.WHITE }))
}
