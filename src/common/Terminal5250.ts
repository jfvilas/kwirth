import { Screen5250 } from './Screen5250'
import {
    E5250Adjust, E5250Aid, E5250Attribute, E5250Error, E5250Key, E5250Lock, E5250Shift, I5250Cell, I5250Field, I5250Input,
    I5250KeyAction
} from './Terminal5250Types'

// What each shift lets the operator type. Shifts not listed take anything.
const SHIFT_ALLOWS: Partial<Record<E5250Shift, RegExp>> = {
    [E5250Shift.ALPHA_ONLY]: /^[A-Za-z,.\- ]$/,
    [E5250Shift.NUMERIC_ONLY]: /^[0-9+,.\- ]$/,
    [E5250Shift.DIGITS_ONLY]: /^[0-9]$/,
    [E5250Shift.SIGNED_NUMERIC]: /^[0-9]$/
}

const NUMERIC_SHIFTS = new Set([E5250Shift.NUMERIC_ONLY, E5250Shift.SIGNED_NUMERIC, E5250Shift.DIGITS_ONLY, E5250Shift.NUMERIC_SHIFT])

/*
    The operator's side of the 5250: what every key does to the buffer before anything is sent, and the
    keyboard lock.

    As on the real display station, typing, moving and erasing never reach the host; only an AID does, and
    then the keyboard is locked until the host answers. An operator error (typing where there is no input field,
    a letter in a numeric field…) locks it too, with its code, until Reset. And when the host answers with an
    error message, it goes on the error line (the last row) and Reset puts back what that line had.
*/
export class Terminal5250 {
    readonly screen: Screen5250
    insert = false
    lock: E5250Lock = E5250Lock.NONE
    error?: E5250Error                 // the operator error code while lock is OPERATOR
    private errorLine?: I5250Cell[]    // the last row as it was before a host error message covered it

    constructor(screen: Screen5250 = new Screen5250()) {
        this.screen = screen
    }

    // The host's answer arrived and was painted.
    unlock = (): void => {
        this.lock = E5250Lock.NONE
        this.error = undefined
        this.errorLine = undefined
    }

    /*
        The host's answer is an error message (Write Error Code): it covers the error line, the keyboard stays
        locked and Reset brings the line back. The cursor goes where the host says, normally the wrong field.
    */
    hostError = (message: string, cursor?: number, attribute: number = E5250Attribute.WHITE): void => {
        const screen = this.screen
        const row = screen.rows - 1
        const first = screen.address(row, 0)
        this.errorLine = screen.cells.slice(first, first + screen.cols).map(c => ({ ...c }))
        for (let c = 0; c < screen.cols; c++) screen.cells[first + c] = { char: '' }
        screen.setAttribute(first, attribute)
        screen.write(first + 1, message.slice(0, screen.cols - 2))
        screen.setAttribute(first + screen.cols - 1, E5250Attribute.GREEN)
        if (cursor !== undefined) screen.cursor = screen.wrap(cursor)
        this.lock = E5250Lock.HOST_ERROR
        this.error = undefined
    }

    private operatorError = (code: E5250Error): void => {
        this.lock = E5250Lock.OPERATOR
        this.error = code
    }

    // One key, already translated. Returns the input to send when the key was an AID.
    apply = (action: I5250KeyAction): I5250Input | undefined => {
        // Reset is the only key that works under an error, and nothing works while the host has not answered.
        if (action.key === E5250Key.RESET) {
            this.reset()
            return undefined
        }
        if (this.lock !== E5250Lock.NONE) return undefined

        const screen = this.screen
        switch (action.key) {
            case E5250Key.CHAR:
                if (action.char) this.type(action.char)
                return undefined
            case E5250Key.AID:
                return action.aid === undefined ? undefined : this.aid(action.aid)
            case E5250Key.FIELD_EXIT:
            case E5250Key.FIELD_PLUS:
                this.fieldExit(false)
                return undefined
            case E5250Key.FIELD_MINUS:
                this.fieldExit(true)
                return undefined
            case E5250Key.NEWLINE:
                this.newline()
                return undefined
            case E5250Key.TAB:
                this.tab()
                return undefined
            case E5250Key.BACKTAB:
                this.backtab()
                return undefined
            case E5250Key.HOME:
                this.home()
                return undefined
            case E5250Key.UP:
                screen.cursor = screen.wrap(screen.cursor - screen.cols)
                return undefined
            case E5250Key.DOWN:
                screen.cursor = screen.wrap(screen.cursor + screen.cols)
                return undefined
            case E5250Key.LEFT:
                screen.cursor = screen.wrap(screen.cursor - 1)
                return undefined
            case E5250Key.RIGHT:
                screen.cursor = screen.wrap(screen.cursor + 1)
                return undefined
            case E5250Key.BACKSPACE:
                this.backspace()
                return undefined
            case E5250Key.DELETE:
                this.deleteChar()
                return undefined
            case E5250Key.ERASE_EOF:
                this.eraseEof()
                return undefined
            case E5250Key.ERASE_INPUT:
                this.eraseInput()
                return undefined
            case E5250Key.INSERT:
                this.insert = !this.insert
                return undefined
            case E5250Key.MOVE_CURSOR:
                if (action.address !== undefined) screen.cursor = screen.wrap(action.address)
                return undefined
            default:
                return undefined
        }
    }

    // Reset clears an operator error, brings back the error line a host message covered, and leaves insert mode.
    reset = (): void => {
        if (this.lock === E5250Lock.SYSTEM) return
        if (this.lock === E5250Lock.HOST_ERROR && this.errorLine) {
            const first = this.screen.address(this.screen.rows - 1, 0)
            this.errorLine.forEach((cell, c) => { this.screen.cells[first + c] = cell })
        }
        this.lock = E5250Lock.NONE
        this.error = undefined
        this.errorLine = undefined
        this.insert = false
    }

    // The input field under the cursor, or an operator error when there is none.
    private inputField = (): I5250Field | undefined => {
        const field = this.screen.fieldAt(this.screen.cursor)
        if (!field || field.format.bypass) {
            this.operatorError(E5250Error.PROTECTED)
            return undefined
        }
        return field
    }

    private last = (field: I5250Field): number => field.start + field.length - 1

    // In a signed numeric field the last position is the sign's: digits go before it.
    private lastData = (field: I5250Field): number =>
        field.format.shift === E5250Shift.SIGNED_NUMERIC && field.length > 1 ? this.last(field) - 1 : this.last(field)

    type = (typed: string): void => {
        const screen = this.screen
        const field = this.inputField()
        if (!field) return
        const allowed = SHIFT_ALLOWS[field.format.shift]
        if (allowed && !allowed.test(typed)) {
            this.operatorError(E5250Error.NUMERIC_ONLY)
            return
        }
        const cursor = screen.cursor
        const lastData = this.lastData(field)
        if (cursor > lastData) {
            this.operatorError(E5250Error.PROTECTED)
            return
        }
        const char = field.format.monocase ? typed.toUpperCase() : typed
        if (this.insert) {
            const lastChar = screen.cells[lastData].char
            if (lastChar !== '' && lastChar !== ' ') {
                this.operatorError(E5250Error.NO_ROOM_TO_INSERT)
                return
            }
            for (let p = lastData; p > cursor; p--) screen.cells[p].char = screen.cells[p - 1].char
        }
        screen.cells[cursor].char = char
        field.mdt = true

        // Past the last position: on to the next input field, unless the field wants a Field Exit first.
        if (cursor < lastData) {
            screen.cursor = cursor + 1
        }
        else if (!field.format.fieldExitRequired) {
            screen.cursor = screen.nextInputField(cursor)?.start ?? cursor
        }
    }

    /*
        Field Exit (and Field+): nulls from the cursor to the end of the field, the field right-adjusted when its
        format says so, and the cursor to the next input field. Field- does the same in a numeric field and marks
        it negative; anywhere else it is an operator error.
    */
    fieldExit = (negative: boolean): void => {
        const screen = this.screen
        const field = this.inputField()
        if (!field) return
        if (negative && !NUMERIC_SHIFTS.has(field.format.shift)) {
            this.operatorError(E5250Error.FIELD_MINUS)
            return
        }
        const lastData = this.lastData(field)
        for (let p = Math.max(screen.cursor, field.start); p <= lastData; p++) screen.cells[p].char = ''

        const adjust = field.format.adjust
        const signed = field.format.shift === E5250Shift.SIGNED_NUMERIC
        if (adjust === E5250Adjust.ZERO_FILL || adjust === E5250Adjust.BLANK_FILL || signed) {
            // the data positions only (never the sign's), nulls and blanks dropped
            let data = ''
            for (let p = field.start; p <= lastData; p++) data += screen.cells[p].char
            data = data.replace(/ /g, '')
            const width = lastData - field.start + 1
            const adjusted = data.padStart(width, adjust === E5250Adjust.ZERO_FILL ? '0' : ' ')
            for (let i = 0; i < width; i++) screen.cells[field.start + i].char = adjusted[i]
        }
        // the sign position: a minus for Field-, a blank otherwise
        if (signed && field.length > 1) screen.cells[this.last(field)].char = negative ? '-' : ' '
        field.mdt = true
        screen.cursor = screen.nextInputField(field.start)?.start ?? field.start
    }

    tab = (): void => {
        const next = this.screen.nextInputField(this.screen.cursor)
        if (next) this.screen.cursor = next.start
    }

    // Inside an input field and past its start: to its start. Otherwise to the start of the previous field.
    backtab = (): void => {
        const screen = this.screen
        const field = screen.fieldAt(screen.cursor)
        if (field && !field.format.bypass && screen.cursor !== field.start) {
            screen.cursor = field.start
            return
        }
        const previous = screen.previousInputField(field ? field.start : screen.cursor)
        if (previous) screen.cursor = previous.start
    }

    // The first input field of the screen.
    home = (): void => {
        const first = this.screen.inputFields()[0]
        if (first) this.screen.cursor = first.start
    }

    // To the first input field that starts on a later row; the first of the screen when there is none.
    newline = (): void => {
        const screen = this.screen
        const row = screen.rowOf(screen.cursor)
        const inputs = screen.inputFields()
        const target = inputs.find(f => screen.rowOf(f.start) > row) ?? inputs[0]
        screen.cursor = target ? target.start : screen.address(row + 1, 0)
    }

    // Destructive backspace, as PC emulators do it: one position left, then delete there.
    backspace = (): void => {
        const field = this.inputField()
        if (!field) return
        if (this.screen.cursor === field.start) return
        this.screen.cursor -= 1
        this.deleteChar()
    }

    // Deletes the character under the cursor; the rest of the field shifts left and a null enters at the end.
    deleteChar = (): void => {
        const screen = this.screen
        const field = this.inputField()
        if (!field) return
        const lastData = this.lastData(field)
        for (let p = screen.cursor; p < lastData; p++) screen.cells[p].char = screen.cells[p + 1].char
        screen.cells[lastData].char = ''
        field.mdt = true
    }

    // Erase EOF: nulls from the cursor to the end of the field.
    eraseEof = (): void => {
        const screen = this.screen
        const field = this.inputField()
        if (!field) return
        for (let p = screen.cursor; p <= this.lastData(field); p++) screen.cells[p].char = ''
        field.mdt = true
    }

    // Erase Input: every input field emptied and unmodified, the cursor on the first one.
    eraseInput = (): void => {
        for (const field of this.screen.inputFields()) {
            this.screen.setFieldValue(field, '')
            field.mdt = false
        }
        this.home()
    }

    // An attention key: builds the Read MDT Fields and locks the keyboard until the host answers.
    aid = (aid: E5250Aid): I5250Input => {
        const input: I5250Input = { aid, cursor: this.screen.cursor, fields: aid === E5250Aid.CLEAR ? [] : this.screen.modifiedFields() }
        if (aid === E5250Aid.CLEAR) this.screen.clear()
        this.lock = E5250Lock.SYSTEM
        this.insert = false
        return input
    }
}
