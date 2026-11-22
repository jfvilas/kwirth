import { E3270Aid, E3270Key, I3270KeyAction, PF_AIDS } from '../../common/terminal/Terminal3270Types'

// The part of a KeyboardEvent the mapper reads, so the tests can feed it plain objects.
export interface IKeyEventLike {
    code: string
    key: string
    shiftKey: boolean
    ctrlKey: boolean
    altKey: boolean
    metaKey: boolean
}

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/
const PA_KEYS: Record<string, E3270Aid> = { Digit1: E3270Aid.PA1, Digit2: E3270Aid.PA2, Digit3: E3270Aid.PA3 }

/*
    PC keyboard -> 3270 keyboard, laid out as PCOMM and x3270 do on a PC:

      Right Ctrl     ENTER (the AID)          Left Ctrl      RESET
      Intro          NEWLINE (sends nothing)  Esc            CLEAR
      F1..F12        PF1..PF12                Shift+F1..F12  PF13..PF24
      PgUp / PgDn    PF7 / PF8                Alt+1/2/3      PA1/PA2/PA3
      End            ERASE EOF                Insert         insert mode

    The two Ctrl keys act on RELEASE and only when pressed alone: held down with another key they are an
    ordinary Ctrl, so Ctrl+C, and Kwirth's Ctrl+Shift+Enter for full screen, keep working.

    Anything that maps to nothing is left alone (undefined), so it reaches the browser and Kwirth untouched.
*/
export class KeyMapper {
    private ctrlAlone?: string

    down = (e: IKeyEventLike): I3270KeyAction | undefined => {
        if (e.code === 'ControlRight' || e.code === 'ControlLeft') {
            this.ctrlAlone = e.code
            return undefined
        }
        this.ctrlAlone = undefined
        if (e.metaKey || e.ctrlKey) return undefined

        if (e.altKey) {
            const pa = PA_KEYS[e.code]
            return pa === undefined ? undefined : { key: E3270Key.AID, aid: pa }
        }

        const fn = FUNCTION_KEY.exec(e.key)
        if (fn) return { key: E3270Key.AID, aid: PF_AIDS[Number(fn[1]) - 1 + (e.shiftKey ? 12 : 0)] }

        switch (e.key) {
            case 'Enter':
                return { key: E3270Key.NEWLINE }
            case 'Escape':
                return { key: E3270Key.AID, aid: E3270Aid.CLEAR }
            case 'Tab':
                return { key: e.shiftKey ? E3270Key.BACKTAB : E3270Key.TAB }
            case 'Home':
                return { key: E3270Key.HOME }
            case 'End':
                return { key: E3270Key.ERASE_EOF }
            case 'Insert':
                return { key: E3270Key.INSERT }
            case 'Delete':
                return { key: E3270Key.DELETE }
            case 'Backspace':
                return { key: E3270Key.BACKSPACE }
            case 'ArrowUp':
                return { key: E3270Key.UP }
            case 'ArrowDown':
                return { key: E3270Key.DOWN }
            case 'ArrowLeft':
                return { key: E3270Key.LEFT }
            case 'ArrowRight':
                return { key: E3270Key.RIGHT }
            case 'PageUp':
                return { key: E3270Key.AID, aid: E3270Aid.PF7 }
            case 'PageDown':
                return { key: E3270Key.AID, aid: E3270Aid.PF8 }
            default:
                break
        }
        // A printable character: one code point that is not a control character.
        if ([...e.key].length === 1 && e.key >= ' ' && e.key !== '\u007f') return { key: E3270Key.CHAR, char: e.key }
        return undefined
    }

    up = (e: IKeyEventLike): I3270KeyAction | undefined => {
        const alone = this.ctrlAlone === e.code
        this.ctrlAlone = undefined
        if (!alone) return undefined
        if (e.code === 'ControlRight') return { key: E3270Key.AID, aid: E3270Aid.ENTER }
        if (e.code === 'ControlLeft') return { key: E3270Key.RESET }
        return undefined
    }

    // Focus lost with a Ctrl held: its release will not come here, so it must not count as pressed alone.
    cancel = (): void => {
        this.ctrlAlone = undefined
    }
}
