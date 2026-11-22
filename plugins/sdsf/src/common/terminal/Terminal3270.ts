import { Screen3270 } from './Screen3270'
import { E3270Aid, E3270Key, E3270Lock, I3270Input, I3270KeyAction } from './Terminal3270Types'

// Characters allowed in a numeric field, as on the 3278 with the numeric lock feature.
const NUMERIC = /^[0-9.\-]$/

/*
    The operator's side of the terminal: what every key does to the buffer before anything is sent, and the
    keyboard lock the OIA shows.

    Everything here is local, as on the real 3270: typing, moving, erasing, tabbing never reach the host. Only
    an AID does, and from that moment the keyboard is locked ('X SYSTEM') until the host answers and unlocks it.
*/
export class Terminal3270 {
    readonly screen: Screen3270
    insert = false
    lock: E3270Lock = E3270Lock.NONE

    constructor(screen: Screen3270 = new Screen3270()) {
        this.screen = screen
    }

    // The host's answer arrived and was painted (WCC keyboard restore).
    unlock = (): void => {
        this.lock = E3270Lock.NONE
    }

    // One key, already translated. Returns the input to send when the key was an AID.
    apply = (action: I3270KeyAction): I3270Input | undefined => {
        // Reset is the only key that works with an operator error showing, and nothing works under X SYSTEM.
        if (action.key === E3270Key.RESET) {
            this.reset()
            return undefined
        }
        if (this.lock !== E3270Lock.NONE) return undefined

        switch (action.key) {
            case E3270Key.CHAR:
                if (action.char) this.type(action.char)
                return undefined
            case E3270Key.AID:
                return action.aid === undefined ? undefined : this.aid(action.aid)
            case E3270Key.NEWLINE:
                this.newline()
                return undefined
            case E3270Key.TAB:
                this.tab()
                return undefined
            case E3270Key.BACKTAB:
                this.backtab()
                return undefined
            case E3270Key.HOME:
                this.home()
                return undefined
            case E3270Key.UP:
                this.screen.cursor = this.screen.wrap(this.screen.cursor - this.screen.cols)
                return undefined
            case E3270Key.DOWN:
                this.screen.cursor = this.screen.wrap(this.screen.cursor + this.screen.cols)
                return undefined
            case E3270Key.LEFT:
                this.screen.cursor = this.screen.wrap(this.screen.cursor - 1)
                return undefined
            case E3270Key.RIGHT:
                this.screen.cursor = this.screen.wrap(this.screen.cursor + 1)
                return undefined
            case E3270Key.BACKSPACE:
                this.backspace()
                return undefined
            case E3270Key.DELETE:
                this.deleteChar()
                return undefined
            case E3270Key.ERASE_EOF:
                this.eraseEof()
                return undefined
            case E3270Key.INSERT:
                this.insert = !this.insert
                return undefined
            case E3270Key.MOVE_CURSOR:
                if (action.address !== undefined) this.screen.cursor = this.screen.wrap(action.address)
                return undefined
            default:
                return undefined
        }
    }

    // Reset clears an operator error and leaves insert mode; it cannot clear X SYSTEM.
    reset = (): void => {
        if (this.lock !== E3270Lock.SYSTEM) this.lock = E3270Lock.NONE
        this.insert = false
    }

    private markModified = (attributeAddress: number): void => {
        const attribute = this.screen.cells[attributeAddress].attribute
        if (attribute) attribute.mdt = true
    }

    type = (char: string): void => {
        const screen = this.screen
        const cursor = screen.cursor
        if (screen.isProtected(cursor)) {
            this.lock = E3270Lock.PROTECTED
            return
        }
        const bounds = screen.fieldBounds(cursor)
        if (bounds && screen.cells[bounds.attribute].attribute!.numeric && !NUMERIC.test(char)) {
            this.lock = E3270Lock.NUMERIC
            return
        }
        if (this.insert) {
            // Room is a null (or a blank) at the end of the field; without it the character would fall off.
            const last = bounds ? bounds.last : screen.wrap(screen.size - 1)
            const lastChar = screen.cells[last].char
            if (lastChar !== '' && lastChar !== ' ') {
                this.lock = E3270Lock.OVERFLOW
                return
            }
            for (let p = last; p !== cursor; p = screen.wrap(p - 1)) {
                screen.cells[p].char = screen.cells[screen.wrap(p - 1)].char
            }
        }
        screen.cells[cursor].char = char
        if (bounds) this.markModified(bounds.attribute)

        // Past the last position of the field the cursor skips to the next field the operator can type in.
        const next = screen.wrap(cursor + 1)
        if (bounds && cursor === bounds.last) {
            const skip = screen.nextUnprotectedField(cursor)
            screen.cursor = skip < 0 ? next : skip
        }
        else {
            screen.cursor = next
        }
    }

    tab = (): void => {
        const next = this.screen.nextUnprotectedField(this.screen.cursor)
        this.screen.cursor = next < 0 ? 0 : next
    }

    backtab = (): void => {
        const screen = this.screen
        const bounds = screen.fieldBounds(screen.cursor)
        const inInput = bounds && !screen.cells[bounds.attribute].attribute!.protected
        // Inside an input field and past its start: to its start. Otherwise to the start of the previous one.
        if (inInput && screen.cursor !== bounds!.first) {
            screen.cursor = bounds!.first
            return
        }
        const from = bounds ? bounds.attribute : screen.cursor
        let target = -1
        for (let i = 1; i <= screen.size; i++) {
            const p = screen.wrap(from - i)
            const attribute = screen.cells[p].attribute
            if (attribute && !attribute.protected && screen.fieldLength(p) > 0) {
                target = screen.wrap(p + 1)
                break
            }
        }
        screen.cursor = target < 0 ? 0 : target
    }

    // The first input position of the screen.
    home = (): void => {
        const first = this.screen.nextUnprotectedField(this.screen.size - 1)
        this.screen.cursor = first < 0 ? 0 : first
    }

    // To the first input position of the next row or, if that row has none, of the next field after it.
    newline = (): void => {
        const screen = this.screen
        const rowStart = screen.address(screen.rowOf(screen.cursor) + 1, 0)
        for (let c = 0; c < screen.cols; c++) {
            const p = rowStart + c
            if (!screen.isProtected(p)) {
                screen.cursor = p
                return
            }
        }
        const next = screen.nextUnprotectedField(rowStart)
        screen.cursor = next < 0 ? rowStart : next
    }

    // Destructive backspace, as PC emulators do it: one position left, then delete there.
    backspace = (): void => {
        const screen = this.screen
        const bounds = screen.fieldBounds(screen.cursor)
        if (screen.isProtected(screen.cursor) || !bounds) {
            this.lock = E3270Lock.PROTECTED
            return
        }
        if (screen.cursor === bounds.first) return
        screen.cursor = screen.wrap(screen.cursor - 1)
        this.deleteChar()
    }

    // Deletes the character under the cursor; the rest of the field shifts left and a null enters at the end.
    deleteChar = (): void => {
        const screen = this.screen
        const bounds = screen.fieldBounds(screen.cursor)
        if (screen.isProtected(screen.cursor) || !bounds) {
            this.lock = E3270Lock.PROTECTED
            return
        }
        for (let p = screen.cursor; p !== bounds.last; p = screen.wrap(p + 1)) {
            screen.cells[p].char = screen.cells[screen.wrap(p + 1)].char
        }
        screen.cells[bounds.last].char = ''
        this.markModified(bounds.attribute)
    }

    // Erase EOF: nulls from the cursor to the end of the field.
    eraseEof = (): void => {
        const screen = this.screen
        const bounds = screen.fieldBounds(screen.cursor)
        if (screen.isProtected(screen.cursor) || !bounds) {
            this.lock = E3270Lock.PROTECTED
            return
        }
        for (let p = screen.cursor; ; p = screen.wrap(p + 1)) {
            screen.cells[p].char = ''
            if (p === bounds.last) break
        }
        this.markModified(bounds.attribute)
    }

    /*
        An attention key: builds the Read Modified and locks the keyboard until the host answers. CLEAR and the
        PA keys are a short read — no fields travel — and CLEAR also wipes the screen, as the terminal does
        before telling the host.
    */
    aid = (aid: E3270Aid): I3270Input => {
        const shortRead = aid === E3270Aid.CLEAR || aid === E3270Aid.PA1 || aid === E3270Aid.PA2 || aid === E3270Aid.PA3
        const input: I3270Input = { aid, cursor: this.screen.cursor, fields: shortRead ? [] : this.screen.modifiedFields() }
        if (aid === E3270Aid.CLEAR) this.screen.clear()
        this.lock = E3270Lock.SYSTEM
        this.insert = false
        return input
    }
}
