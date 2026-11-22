import { Terminal3270 } from './terminal/Terminal3270'
import { E3270Aid, I3270Input, I3270KeyAction } from './terminal/Terminal3270Types'
import { Painter } from './panels/Painter'
import { EMessageLevel } from './panels/SdsfLayout'
import { MENU_LEFT, MENU_RIGHT, paintPrimaryMenu } from './panels/PrimaryMenu'

/*
    One SDSF session: the terminal and the dialog running on it.

    Like the terminal, it lives in common/ and knows nothing of the DOM or of the websocket, so the same session
    could be driven by a tn3270 connection one day. Its owner hands it the keys and repaints when it says so.

    Stream S1: only the primary option menu, to exercise the terminal. The panels with data (DA, browse,
    confirm) arrive in S3 and S4.
*/
export class SdsfSession {
    readonly terminal = new Terminal3270()
    private system: string
    private command = ''
    private scroll = 'PAGE'
    private message = ''
    private messageLevel = EMessageLevel.INFO
    private fields = { command: -1, scroll: -1 }

    constructor(system: string) {
        this.system = system
        this.paint()
    }

    // A key from the operator. Returns true when the screen changed and has to be repainted.
    key = (action: I3270KeyAction): boolean => {
        const input = this.terminal.apply(action)
        if (input) this.attention(input)
        return true
    }

    private fieldValue = (input: I3270Input, address: number): string | undefined =>
        input.fields.find(f => f.address === address)?.value

    private attention = (input: I3270Input): void => {
        // The fields the operator did not touch did not travel: they keep what was painted.
        const scroll = this.fieldValue(input, this.fields.scroll)
        if (scroll !== undefined) this.scroll = scroll.trim().toUpperCase() || 'PAGE'
        const typed = (this.fieldValue(input, this.fields.command) ?? '').trim().toUpperCase()
        this.message = ''
        this.messageLevel = EMessageLevel.INFO

        if (input.aid === E3270Aid.ENTER && typed) {
            const option = [...MENU_LEFT, ...MENU_RIGHT].find(o => o.code === typed)
            if (option || typed === 'END') {
                this.message = 'NOT AVAILABLE'
                this.messageLevel = EMessageLevel.WARNING
            }
            else {
                this.message = 'INVALID COMMAND'
                this.messageLevel = EMessageLevel.ERROR
            }
            this.command = typed
        }
        else {
            this.command = ''
        }
        this.paint()
        this.terminal.unlock()
    }

    private paint = (): void => {
        const screen = this.terminal.screen
        screen.clear()
        const painter = new Painter(screen)
        this.fields = paintPrimaryMenu(painter, {
            system: this.system,
            command: this.command,
            scroll: this.scroll,
            message: this.message,
            messageLevel: this.messageLevel
        })
        screen.cursor = this.fields.command + 1
    }
}
