import {
    E3270Color, E3270Highlight, E3270Intensity, I3270Cell, I3270FieldAttribute, I3270ModifiedField,
    I3270Geometry, MODEL3_GEOMETRY
} from './Terminal3270Types'

export const DEFAULT_ATTRIBUTE: I3270FieldAttribute = {
    protected: true,
    numeric: false,
    intensity: E3270Intensity.NORMAL,
    mdt: false,
    color: E3270Color.DEFAULT,
    highlight: E3270Highlight.DEFAULT
}

const blankCell = (): I3270Cell => ({ char: '', color: E3270Color.DEFAULT, highlight: E3270Highlight.DEFAULT })

/*
    The 3270 presentation space: rows x cols positions addressed 0..size-1, row by row, wrapping at the end.

    As in the real terminal, a field is not an object: it is an ATTRIBUTE BYTE sitting on a position, and the
    field is every position after it up to the next attribute (wrapping round the end of the buffer). The
    attribute's own position shows as a blank and nothing can be typed on it. Panels therefore leave a column
    free before each field, exactly like the real ISPF screens do.
*/
export class Screen3270 {
    readonly rows: number
    readonly cols: number
    readonly size: number
    cells: I3270Cell[]
    cursor = 0

    constructor(geometry: I3270Geometry = MODEL3_GEOMETRY) {
        const { rows, cols } = geometry
        this.rows = rows
        this.cols = cols
        this.size = rows * cols
        this.cells = Array.from({ length: this.size }, blankCell)
    }

    // Erase/Write: every position null, no fields, cursor home.
    clear = (): void => {
        this.cells = Array.from({ length: this.size }, blankCell)
        this.cursor = 0
    }

    wrap = (address: number): number => ((address % this.size) + this.size) % this.size
    address = (row: number, col: number): number => this.wrap(row * this.cols + col)
    rowOf = (address: number): number => Math.floor(this.wrap(address) / this.cols)
    colOf = (address: number): number => this.wrap(address) % this.cols

    // Start Field (SF/SFE): places an attribute byte. Unspecified properties take the 3270 defaults.
    startField = (address: number, attribute: Partial<I3270FieldAttribute> = {}): void => {
        const cell = this.cells[this.wrap(address)]
        cell.char = ''
        cell.attribute = { ...DEFAULT_ATTRIBUTE, ...attribute }
        cell.color = E3270Color.DEFAULT
        cell.highlight = E3270Highlight.DEFAULT
    }

    // Writes characters from an address on, with optional character attributes (SA). Writing over an
    // attribute byte replaces it, as on the real terminal.
    write = (address: number, text: string, color: E3270Color = E3270Color.DEFAULT, highlight: E3270Highlight = E3270Highlight.DEFAULT): void => {
        for (let i = 0; i < text.length; i++) {
            const cell = this.cells[this.wrap(address + i)]
            cell.char = text[i]
            cell.attribute = undefined
            cell.color = color
            cell.highlight = highlight
        }
    }

    isAttribute = (address: number): boolean => this.cells[this.wrap(address)].attribute !== undefined

    isFormatted = (): boolean => this.cells.some(c => c.attribute !== undefined)

    // The attribute byte governing a position: the nearest one at or before it, wrapping. -1 when unformatted.
    attributeAddressOf = (address: number): number => {
        for (let i = 0; i < this.size; i++) {
            const p = this.wrap(address - i)
            if (this.cells[p].attribute) return p
        }
        return -1
    }

    attributeOf = (address: number): I3270FieldAttribute | undefined => {
        const fa = this.attributeAddressOf(address)
        return fa < 0 ? undefined : this.cells[fa].attribute
    }

    // Whether the operator may type on a position. An unformatted screen is all input.
    isProtected = (address: number): boolean => {
        if (this.isAttribute(address)) return true
        const attribute = this.attributeOf(address)
        return attribute ? attribute.protected : false
    }

    // Every attribute address, in buffer order.
    fieldAddresses = (): number[] => {
        const result: number[] = []
        for (let p = 0; p < this.size; p++) if (this.cells[p].attribute) result.push(p)
        return result
    }

    // How many data positions follow an attribute up to the next one.
    fieldLength = (attributeAddress: number): number => {
        for (let i = 1; i < this.size; i++) {
            if (this.cells[this.wrap(attributeAddress + i)].attribute) return i - 1
        }
        return this.size - 1
    }

    // The positions of the field an address belongs to: [first, last], or undefined on an attribute or unformatted.
    fieldBounds = (address: number): { first: number; last: number; attribute: number } | undefined => {
        if (this.isAttribute(address)) return undefined
        const fa = this.attributeAddressOf(address)
        if (fa < 0) return undefined
        const length = this.fieldLength(fa)
        return { attribute: fa, first: this.wrap(fa + 1), last: this.wrap(fa + length) }
    }

    // The field's characters, nulls suppressed.
    fieldValue = (attributeAddress: number): string => {
        const length = this.fieldLength(attributeAddress)
        let value = ''
        for (let i = 1; i <= length; i++) value += this.cells[this.wrap(attributeAddress + i)].char
        return value
    }

    // The first data position of the first unprotected, non-empty field AFTER an address (wrapping), or -1.
    nextUnprotectedField = (from: number): number => {
        for (let i = 1; i <= this.size; i++) {
            const p = this.wrap(from + i)
            const attribute = this.cells[p].attribute
            if (attribute && !attribute.protected && this.fieldLength(p) > 0) return this.wrap(p + 1)
        }
        return -1
    }

    // The fields the operator changed, as a Read Modified returns them.
    modifiedFields = (): I3270ModifiedField[] =>
        this.fieldAddresses()
            .filter(p => this.cells[p].attribute!.mdt)
            .map(address => ({ address, value: this.fieldValue(address) }))

    // The text of one row as shown (attributes and nulls are blanks). Handy for tests and for FIND.
    rowText = (row: number): string => {
        let text = ''
        for (let c = 0; c < this.cols; c++) {
            const cell = this.cells[row * this.cols + c]
            text += cell.attribute || cell.char === '' ? ' ' : cell.char
        }
        return text
    }
}
