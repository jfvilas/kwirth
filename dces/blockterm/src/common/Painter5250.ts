import { Screen5250 } from './Screen5250'
import { E5250Attribute, I5250FieldFormat } from './Terminal5250Types'

/*
    How a panel is laid out on a 5250 buffer, the way IBM i display files do it: every constant is preceded by
    its screen attribute byte on the column before it, and an input field is a Start of Field (its attribute
    before it, its ending attribute after it). So panels start at column 1 and leave a blank between pieces,
    as the real ones do ('Opt' at column 2 of WRKACTJOB, its input fields underlined).
*/
export interface I5250FieldStyle extends Partial<I5250FieldFormat> {
    attribute?: number     // the field's screen attribute; green underscore, as IBM i input fields are
}

export class Painter5250 {
    readonly screen: Screen5250

    constructor(screen: Screen5250) {
        this.screen = screen
    }

    /*
        A constant: its attribute on column col-1, so col must be at least 1. What follows takes the same look
        until the next attribute, as on the real screen; `close` puts normal green back right after it.
    */
    text = (row: number, col: number, text: string, attribute: number = E5250Attribute.GREEN, close = false): void => {
        const screen = this.screen
        const address = screen.address(row, col)
        screen.setAttribute(address - 1, attribute)
        screen.write(address, text)
        if (close) screen.setAttribute(address + text.length, E5250Attribute.GREEN)
    }

    // An input field of `length` positions starting at col, pre-filled with value. Returns its first position.
    input = (row: number, col: number, length: number, value: string = '', style: I5250FieldStyle = {}): number => {
        const screen = this.screen
        const { attribute, ...format } = style
        const start = screen.startField(screen.address(row, col), length, format, attribute ?? E5250Attribute.GREEN_UNDERSCORE)
        const field = screen.fieldAt(start)!
        screen.setFieldValue(field, value.slice(0, length))
        return start
    }

    cursor = (row: number, col: number): void => {
        this.screen.cursor = this.screen.address(row, col)
    }
}
