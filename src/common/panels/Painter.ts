import { Screen3270 } from '../terminal/Screen3270'
import { E3270Color, E3270Highlight, E3270Intensity, I3270FieldAttribute } from '../terminal/Terminal3270Types'

/*
    How a panel is laid out on the 3270 buffer, ISPF style: every piece of text is a field, and its attribute
    byte sits on the column BEFORE it. That is why panels start at column 1 and leave a blank between pieces —
    the real SDSF screens are built the same way (the cursor after 'COMMAND INPUT ===> ' is at column 21).
*/

export interface ITextStyle {
    color?: E3270Color
    intensity?: E3270Intensity
    highlight?: E3270Highlight
}

export class Painter {
    readonly screen: Screen3270

    constructor(screen: Screen3270) {
        this.screen = screen
    }

    // Protected text. Its attribute goes on column col-1, so col must be at least 1.
    text = (row: number, col: number, text: string, style: ITextStyle = {}): void => {
        const screen = this.screen
        screen.startField(screen.address(row, col) - 1, {
            protected: true,
            color: style.color ?? E3270Color.DEFAULT,
            intensity: style.intensity ?? E3270Intensity.NORMAL,
            highlight: style.highlight ?? E3270Highlight.DEFAULT
        })
        screen.write(screen.address(row, col), text)
    }

    // Character attributes over text already painted: a different colour or highlight for part of a field.
    attribute = (row: number, col: number, length: number, color: E3270Color, highlight: E3270Highlight = E3270Highlight.DEFAULT): void => {
        const screen = this.screen
        for (let i = 0; i < length; i++) {
            const cell = screen.cells[screen.address(row, col + i)]
            if (cell.attribute) continue
            cell.color = color
            cell.highlight = highlight
        }
    }

    /*
        An input field of `length` positions starting at col, pre-filled with value. It is closed with a
        protected attribute right after it, so typing past its end skips instead of running over what follows.
        Returns the field's attribute address, which is how its value is read back.
    */
    input = (row: number, col: number, length: number, value: string = '', style: ITextStyle & { numeric?: boolean } = {}): number => {
        const screen = this.screen
        const attribute = screen.address(row, col) - 1
        const field: Partial<I3270FieldAttribute> = {
            protected: false,
            numeric: style.numeric ?? false,
            color: style.color ?? E3270Color.DEFAULT,
            intensity: style.intensity ?? E3270Intensity.HIGH,
            highlight: style.highlight ?? E3270Highlight.DEFAULT
        }
        screen.startField(attribute, field)
        screen.write(screen.address(row, col), value.slice(0, length))
        screen.startField(screen.address(row, col) + length, { protected: true })
        return screen.wrap(attribute)
    }

    cursor = (row: number, col: number): void => {
        this.screen.cursor = this.screen.address(row, col)
    }

    // Every input field becomes protected, keeping its look: the panel under a pop-up window cannot be typed on.
    protectAll = (): void => {
        for (const address of this.screen.fieldAddresses()) this.screen.cells[address].attribute!.protected = true
    }

    /*
        A pop-up window over what is painted: a frame of `width` columns, each row one protected field. Right
        after the frame the field that was under it is started again, so the panel beside the window keeps its
        colours instead of taking the window's.
    */
    window = (row: number, col: number, width: number, title: string, lines: string[], style: ITextStyle = {}): void => {
        const screen = this.screen
        const inner = width - 2
        const titled = ` ${title} `
        const left = Math.floor((inner - titled.length) / 2)
        const rows = [
            '+' + '-'.repeat(left) + titled + '-'.repeat(inner - left - titled.length) + '+',
            ...lines.map(l => '|' + l.slice(0, inner).padEnd(inner) + '|'),
            '+' + '-'.repeat(inner) + '+'
        ]
        rows.forEach((text, i) => {
            const after = screen.address(row + i, col + width)
            const under = screen.isAttribute(after) ? undefined : screen.attributeOf(after)
            this.text(row + i, col, text, style)
            if (under) screen.startField(after, { ...under })
        })
    }
}
