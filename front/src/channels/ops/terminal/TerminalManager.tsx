// terminalManager.ts
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"

export interface ManagedTerminal {
    term: Terminal
    fitAddon: FitAddon
    started: boolean
    index: number
}

export class TerminalManager {
    public terminals: Map<string, ManagedTerminal> = new Map()
    public onClose?: (id:string) => void


    constructor (onCloseCallback?: (id:string) => void) {
        this.onClose = onCloseCallback
    }

    attachTerminal(id: string): ManagedTerminal | undefined {
        const existing = this.terminals.get(id)
        if (existing) return existing
        return undefined
    }

    createTerminal(id: string, socket:WebSocket): ManagedTerminal {
        const existing = this.terminals.get(id)
        if (existing) return existing

        const term = new Terminal({
            //convertEol: true,
            //fontFamily: "monospace",
            fontSize: 14,
            scrollback: 10000
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        if (!socket) console.log('****horror****')

        socket.onopen = () => term.write('Connected to backend...\r\n')
        socket.onmessage = (event) => term.write(event.data)
        socket.onclose = () => {
            term.write('\r\nConnection closed.\r\n')
            term.dispose()
            this.terminals.delete(id)
            if (this.onClose) this.onClose(id)
        }

        term.onData((data) => {
            if (socket) socket.send(data)
        })

        const managed: ManagedTerminal = { term, fitAddon, started:false, index:0 }
        this.terminals.set(id, managed)
        return managed
    }

    getTerminal(id: string): ManagedTerminal | undefined {
        return this.terminals.get(id)
    }

    destroyTerminal(id: string): void {
        const m = this.terminals.get(id)
        if (!m) return

        m.term.dispose()
        this.terminals.delete(id)
    }
}
