import { E5250Aid, E5250Key, F_AIDS, I5250KeyAction } from '../common/Terminal5250Types'
import { IKeyEventLike } from './KeyMapper'

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/

/*
    PC keyboard -> 5250 keyboard, laid out as PCOMM does on a PC:

      Right Ctrl     ENTER (the AID)           Left Ctrl         RESET
      Intro          FIELD EXIT                Numpad + / -      FIELD+ / FIELD-
      F1..F12        F1..F12                   Shift+F1..F12     F13..F24
      PgDn / PgUp    ROLL UP / ROLL DOWN       End               ERASE EOF
      Alt+End        ERASE INPUT               Insert            insert mode

    The two Ctrl keys act on RELEASE and only when pressed alone, as in the 3270 mapper: held down with another
    key they are an ordinary Ctrl, so Ctrl+C and Kwirth's Ctrl+Shift+Enter keep working. F1 is F1: IBM i panels
    take it as Help themselves.

    Anything that maps to nothing is left alone (undefined), so it reaches the browser and Kwirth untouched.
*/
export class KeyMapper5250 {
    private ctrlAlone?: string

    down = (e: IKeyEventLike): I5250KeyAction | undefined => {
        if (e.code === 'ControlRight' || e.code === 'ControlLeft') {
            this.ctrlAlone = e.code
            return undefined
        }
        this.ctrlAlone = undefined
        if (e.metaKey || e.ctrlKey) return undefined

        if (e.altKey) return e.key === 'End' ? { key: E5250Key.ERASE_INPUT } : undefined

        const fn = FUNCTION_KEY.exec(e.key)
        if (fn) return { key: E5250Key.AID, aid: F_AIDS[Number(fn[1]) - 1 + (e.shiftKey ? 12 : 0)] }

        switch (e.code) {
            case 'NumpadAdd':
                return { key: E5250Key.FIELD_PLUS }
            case 'NumpadSubtract':
                return { key: E5250Key.FIELD_MINUS }
            default:
                break
        }

        switch (e.key) {
            case 'Enter':
                return { key: E5250Key.FIELD_EXIT }
            case 'Tab':
                return { key: e.shiftKey ? E5250Key.BACKTAB : E5250Key.TAB }
            case 'Home':
                return { key: E5250Key.HOME }
            case 'End':
                return { key: E5250Key.ERASE_EOF }
            case 'Insert':
                return { key: E5250Key.INSERT }
            case 'Delete':
                return { key: E5250Key.DELETE }
            case 'Backspace':
                return { key: E5250Key.BACKSPACE }
            case 'ArrowUp':
                return { key: E5250Key.UP }
            case 'ArrowDown':
                return { key: E5250Key.DOWN }
            case 'ArrowLeft':
                return { key: E5250Key.LEFT }
            case 'ArrowRight':
                return { key: E5250Key.RIGHT }
            case 'PageDown':
                return { key: E5250Key.AID, aid: E5250Aid.ROLL_UP }
            case 'PageUp':
                return { key: E5250Key.AID, aid: E5250Aid.ROLL_DOWN }
            default:
                break
        }
        // A printable character: one code point that is not a control character.
        if ([...e.key].length === 1 && e.key >= ' ' && e.key !== '\u007f') return { key: E5250Key.CHAR, char: e.key }
        return undefined
    }

    up = (e: IKeyEventLike): I5250KeyAction | undefined => {
        const alone = this.ctrlAlone === e.code
        this.ctrlAlone = undefined
        if (!alone) return undefined
        if (e.code === 'ControlRight') return { key: E5250Key.AID, aid: E5250Aid.ENTER }
        if (e.code === 'ControlLeft') return { key: E5250Key.RESET }
        return undefined
    }

    // Focus lost with a Ctrl held: its release will not come here, so it must not count as pressed alone.
    cancel = (): void => {
        this.ctrlAlone = undefined
    }
}
