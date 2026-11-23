import { I3270Geometry } from './Terminal3270Types'
import { E5250Adjust, E5250Attribute, E5250Shift, GEOMETRY_5250_24X80, I5250Cell, I5250Field, I5250FieldFormat, I5250ModifiedField } from './Terminal5250Types'

export const DEFAULT_FIELD_FORMAT: I5250FieldFormat = {
    bypass: false,
    shift: E5250Shift.ALPHA,
    monocase: false,
    adjust: E5250Adjust.NONE,
    fieldExitRequired: false
}

const blankCell = (): I5250Cell => ({ char: '' })

/*
    The 5250 display buffer: rows x cols positions addressed 0..size-1, row by row.

    Two things live on it, as on the real display station:
      - screen attribute bytes (0x20-0x3F), each on its own position, shown as a blank. Everything after one
        takes its look until the next, wherever it is: a heading, a label, an input field.
      - the format table: the input fields the host started, each with its Field Format Word. Typing is only
        possible inside them; the rest of the screen is protected whatever its attributes say.
*/
export class Screen5250 {
    readonly rows: number
    readonly cols: number
    readonly size: number
    cells: I5250Cell[]
    fields: I5250Field[] = []
    cursor = 0

    constructor(geometry: I3270Geometry = GEOMETRY_5250_24X80) {
        this.rows = geometry.rows
        this.cols = geometry.cols
        this.size = geometry.rows * geometry.cols
        this.cells = Array.from({ length: this.size }, blankCell)
    }

    // Clear Unit: every position null, no fields, cursor home.
    clear = (): void => {
        this.cells = Array.from({ length: this.size }, blankCell)
        this.fields = []
        this.cursor = 0
    }

    wrap = (address: number): number => ((address % this.size) + this.size) % this.size
    address = (row: number, col: number): number => this.wrap(row * this.cols + col)
    rowOf = (address: number): number => Math.floor(this.wrap(address) / this.cols)
    colOf = (address: number): number => this.wrap(address) % this.cols

    // Puts a screen attribute byte on a position.
    setAttribute = (address: number, attribute: number): void => {
        const cell = this.cells[this.wrap(address)]
        cell.char = ''
        cell.attribute = attribute
    }

    // Writes characters from an address on. Writing over an attribute byte replaces it.
    write = (address: number, text: string): void => {
        for (let i = 0; i < text.length; i++) {
            const cell = this.cells[this.wrap(address + i)]
            cell.char = text[i]
            cell.attribute = undefined
        }
    }

    /*
        Start of Field: the attribute byte on the position before the field, the field in the format table, and
        the ending attribute (normal green) on the position after it, so what follows does not take its look.
        Returns the field's first data position, which is how its value is read back.
    */
    startField = (start: number, length: number, format: Partial<I5250FieldFormat> = {}, attribute: number = E5250Attribute.GREEN_UNDERSCORE): number => {
        const first = this.wrap(start)
        this.setAttribute(first - 1, attribute)
        this.setAttribute(first + length, E5250Attribute.GREEN)
        this.fields = this.fields.filter(f => f.start !== first)
        this.fields.push({ start: first, length, format: { ...DEFAULT_FIELD_FORMAT, ...format }, mdt: false })
        this.fields.sort((a, b) => a.start - b.start)
        return first
    }

    // The input field a position belongs to, bypass fields included; undefined outside every field.
    fieldAt = (address: number): I5250Field | undefined => {
        const p = this.wrap(address)
        return this.fields.find(f => p >= f.start && p < f.start + f.length)
    }

    // Whether the operator may type on a position: inside a field that is not a bypass (output) field.
    isInput = (address: number): boolean => {
        const field = this.fieldAt(address)
        return field !== undefined && !field.format.bypass
    }

    inputFields = (): I5250Field[] => this.fields.filter(f => !f.format.bypass && f.length > 0)

    // The first input field that starts AFTER an address, wrapping round; undefined when there is none.
    nextInputField = (from: number): I5250Field | undefined => {
        const inputs = this.inputFields()
        const p = this.wrap(from)
        return inputs.find(f => f.start > p) ?? inputs[0]
    }

    // The last input field that starts BEFORE an address, wrapping round.
    previousInputField = (from: number): I5250Field | undefined => {
        const inputs = this.inputFields()
        const p = this.wrap(from)
        return [...inputs].reverse().find(f => f.start < p) ?? inputs[inputs.length - 1]
    }

    // The field's characters, nulls suppressed.
    fieldValue = (field: I5250Field): string => {
        let value = ''
        for (let i = 0; i < field.length; i++) value += this.cells[this.wrap(field.start + i)].char
        return value
    }

    // Writes a value into a field, nulls after it; it does not set the MDT (that is the operator's doing).
    setFieldValue = (field: I5250Field, value: string): void => {
        for (let i = 0; i < field.length; i++) {
            const cell = this.cells[this.wrap(field.start + i)]
            cell.char = i < value.length ? value[i] : ''
            cell.attribute = undefined
        }
    }

    // The fields the operator changed, as a Read MDT Fields returns them.
    modifiedFields = (): I5250ModifiedField[] =>
        this.fields.filter(f => f.mdt).map(f => ({ start: f.start, value: this.fieldValue(f) }))

    // The text of one row as shown (attributes and nulls are blanks). Handy for tests and for finding text.
    rowText = (row: number): string => {
        let text = ''
        for (let c = 0; c < this.cols; c++) {
            const cell = this.cells[row * this.cols + c]
            text += cell.attribute !== undefined || cell.char === '' ? ' ' : cell.char
        }
        return text
    }
}
