import { Terminal3270 } from './terminal/Terminal3270'
import { E3270Aid, E3270Lock, I3270Input, I3270KeyAction } from './terminal/Terminal3270Types'
import { Painter } from './panels/Painter'
import { EMessageLevel } from './panels/SdsfLayout'
import { paintPrimaryMenu } from './panels/PrimaryMenu'
import { columnsFrom, DATA_ROWS, IDaFields, offsetLeftOf, paintDa, ROW_FIRST_DATA } from './panels/DaPanel'
import { cell, DA_COLUMNS, findColumn, IDaColumn, JOBNAME_COLUMN } from './panels/DaColumns'
import { EPrimaryCommand, IPrimaryCommand, parsePrimaryCommand } from './panels/PrimaryCommand'
import { IReadyState, paintReady } from './panels/ReadyPanel'
import { sdsfPatternMatches } from './panels/Wildcard'
import { ISdsfDataSource } from './SdsfDataSource'
import { ESdsfCommand, ESdsfError, ESdsfMetricsState, ISdsfMessageResponse, ISdsfPod } from './SdsfTypes'

export enum ESdsfPanel {
    MENU = 'menu',
    DA = 'da',
    READY = 'ready'                // after END: TSO's READY
}

const RETRIEVE_DEPTH = 10
const MAX_AUTO_SECONDS = 999

const ERROR_MESSAGE: Record<ESdsfError, string> = {
    [ESdsfError.NOT_AUTHORIZED]: 'NOT AUTHORIZED',
    [ESdsfError.NOT_FOUND]: 'NOT FOUND',
    [ESdsfError.BAD_REQUEST]: 'INVALID REQUEST',
    [ESdsfError.FAILED]: 'REQUEST FAILED'
}

// What runs once the fresh list is in: scrolling and finding need to know how many rows there are.
type TAfterList = (view: ISdsfPod[]) => void

/*
    One SDSF session: the terminal and the ISPF-like dialog running on it.

    Like the terminal, it lives in common/ and knows nothing of the DOM or of the websocket: it asks its data
    source and tells its listeners when the screen changed. The same session could be driven by a tn3270
    connection one day (D11).

    Block mode, as on the real thing: an AID locks the keyboard (X SYSTEM), the session asks the back for a
    fresh list when the panel needs one, paints the answer and only then unlocks.
*/
export class SdsfSession {
    readonly terminal = new Terminal3270()
    panel: ESdsfPanel = ESdsfPanel.MENU
    private readonly system: string
    private readonly source: ISdsfDataSource
    private readonly now: () => number
    private listeners = new Set<() => void>()
    private disposed = false

    // command line and messages
    private command = ''
    private scroll = 'PAGE'
    private message = ''
    private messageLevel = EMessageLevel.INFO
    private longMessage = ''
    private showLong = false
    private retrieve: string[] = []
    private retrieveIndex = 0
    private fields = { command: -1, scroll: -1 }

    // DA
    private pods: ISdsfPod[] = []
    private metrics = ESdsfMetricsState.UNAVAILABLE
    private clusterCpu?: number
    private prefix = ''
    private dest = ''
    private owner = ''
    private sortColumn?: IDaColumn
    private sortDescending = false
    private top = 0
    private offset = 0
    private findText = ''
    private auto = 0
    private timer?: ReturnType<typeof setInterval>
    private npFields: IDaFields['np'] = []

    // READY
    private ready: IReadyState = { lines: [] }
    private readyField = -1

    constructor(system: string, source: ISdsfDataSource, now: () => number = Date.now) {
        this.system = system
        this.source = source
        this.now = now
        this.paint()
    }

    // ── Owner's side ────────────────────────────────────────────────────────────────────────────────

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    // The tab is closed or the channel stopped: no more timers, no more repaints.
    dispose = (): void => {
        this.stopAuto()
        this.listeners.clear()
        this.disposed = true
    }

    key = (action: I3270KeyAction): void => {
        if (this.disposed) return
        const input = this.terminal.apply(action)
        if (input) this.attention(input)
        this.notify()
    }

    private notify = (): void => {
        for (const listener of this.listeners) listener()
    }

    // ── Messages ────────────────────────────────────────────────────────────────────────────────────

    private say = (message: string, level: EMessageLevel, long = ''): void => {
        this.message = message
        this.messageLevel = level
        this.longMessage = long
    }

    private clearMessage = (): void => this.say('', EMessageLevel.INFO)

    // ── Attention ───────────────────────────────────────────────────────────────────────────────────

    private attention = (input: I3270Input): void => {
        const value = (address: number): string | undefined => input.fields.find(f => f.address === address)?.value
        this.showLong = false

        if (this.panel === ESdsfPanel.READY) {
            this.readyAttention((value(this.readyField) ?? '').trim())
            return
        }

        const scroll = value(this.fields.scroll)
        if (scroll !== undefined) this.scroll = scroll.trim().toUpperCase() || 'PAGE'
        // An untouched command field did not travel, but what is painted in it still counts, as in ISPF.
        const typed = value(this.fields.command) ?? this.command
        const command = parsePrimaryCommand(typed)
        this.command = ''
        const keepMessage = input.aid === E3270Aid.PF1
        if (!keepMessage) this.clearMessage()
        // What PF12 brought back is not typed again: remembering it would restart the walk back at every press.
        const retrieving = input.aid === E3270Aid.PF12 || command.verb === EPrimaryCommand.RETRIEVE
        if (!retrieving && command.verb !== EPrimaryCommand.NONE && command.verb !== EPrimaryCommand.AMOUNT) this.remember(command.text)

        if (this.panel === ESdsfPanel.MENU) this.menuAttention(input, command)
        else this.daAttention(input, command, value)
    }

    private remember = (text: string): void => {
        if (this.retrieve[this.retrieve.length - 1] !== text) this.retrieve.push(text)
        if (this.retrieve.length > RETRIEVE_DEPTH) this.retrieve.shift()
        this.retrieveIndex = 0
    }

    // PF12: the commands typed before, the newest first, one more on every press.
    private retrieveCommand = (): void => {
        if (this.retrieve.length === 0) return
        this.command = this.retrieve[this.retrieve.length - 1 - (this.retrieveIndex % this.retrieve.length)]
        this.retrieveIndex++
    }

    private finish = (): void => {
        if (this.disposed) return
        this.paint()
        this.terminal.unlock()
        this.notify()
    }

    private invalid = (command: IPrimaryCommand, message = 'INVALID COMMAND'): void => {
        this.say(message, EMessageLevel.ERROR, `'${command.text}' is not a command SDSF knows here.`)
        this.command = command.text
    }

    private notAvailable = (command: IPrimaryCommand): void => {
        this.say('NOT AVAILABLE', EMessageLevel.WARNING, `${command.text.toUpperCase()} is not available yet in this SDSF.`)
        this.command = command.text
    }

    // Filters and sort work from any panel, as in SDSF. Returns false when the command was not one of them.
    private filterCommand = (command: IPrimaryCommand): boolean => {
        const arg = command.args[0] ?? ''
        switch (command.verb) {
            case EPrimaryCommand.PREFIX:
                this.prefix = arg === '*' ? '' : arg.toUpperCase()
                this.top = 0
                return true
            case EPrimaryCommand.DEST:
                this.dest = arg === '*' || arg.toUpperCase() === '(ALL)' ? '' : arg.toLowerCase()
                this.top = 0
                return true
            case EPrimaryCommand.OWNER:
                this.owner = arg === '*' ? '' : arg.toUpperCase()
                this.top = 0
                return true
            case EPrimaryCommand.SORT: {
                if (!arg) {
                    this.sortColumn = undefined
                    this.sortDescending = false
                    return true
                }
                const column = findColumn(arg)
                const order = (command.args[1] ?? 'A').toUpperCase()
                if (!column || (order !== 'A' && order !== 'D')) {
                    this.invalid(command, 'INVALID COLUMN NAME')
                    return true
                }
                this.sortColumn = column
                this.sortDescending = order === 'D'
                return true
            }
            default:
                return false
        }
    }

    private menuAttention = (input: I3270Input, command: IPrimaryCommand): void => {
        if (input.aid === E3270Aid.PF3 || input.aid === E3270Aid.PF4 || command.verb === EPrimaryCommand.END || command.verb === EPrimaryCommand.RETURN) {
            this.toReady()
            this.finish()
            return
        }
        if (input.aid === E3270Aid.PF12 || command.verb === EPrimaryCommand.RETRIEVE) {
            this.retrieveCommand()
            this.finish()
            return
        }
        if (this.filterCommand(command)) {
            this.finish()
            return
        }
        switch (command.verb) {
            case EPrimaryCommand.DA:
                this.panel = ESdsfPanel.DA
                this.top = 0
                this.refresh([])
                return
            case EPrimaryCommand.ST:
            case EPrimaryCommand.LOG:
            case EPrimaryCommand.INIT:
                this.notAvailable(command)
                break
            case EPrimaryCommand.NONE:
                break
            default:
                this.invalid(command)
                break
        }
        this.finish()
    }

    private daAttention = (input: I3270Input, command: IPrimaryCommand, value: (address: number) => string | undefined): void => {
        const after: TAfterList[] = []
        switch (input.aid) {
            case E3270Aid.CLEAR:
                this.finish()
                return
            case E3270Aid.PA1:
                if (this.auto) this.say('AUTO UPDATE STOPPED', EMessageLevel.INFO)
                this.stopAuto()
                this.finish()
                return
            case E3270Aid.PF1:
                this.showLong = this.longMessage !== ''
                this.finish()
                return
            case E3270Aid.PF3:
            case E3270Aid.PF4:
                this.toMenu()
                this.finish()
                return
            case E3270Aid.PF12:
                this.retrieveCommand()
                this.finish()
                return
            case E3270Aid.PF5:
                after.push(view => this.find(view, true))
                break
            case E3270Aid.PF7:
            case E3270Aid.PF8: {
                const amount = command.verb === EPrimaryCommand.AMOUNT ? command.args[0] : this.scroll
                const down = input.aid === E3270Aid.PF8
                after.push(view => this.scrollBy(view, amount, down, input.cursor))
                break
            }
            case E3270Aid.PF10:
                this.offset = offsetLeftOf(this.offset, this.terminal.screen.cols)
                break
            case E3270Aid.PF11:
                this.scrollRight()
                break
            default:
                break
        }

        // Line commands arrive in S4: for now they are refused, visibly.
        if (this.npFields.some(f => (value(f.attribute) ?? '').trim() !== '')) {
            this.say('NOT AVAILABLE', EMessageLevel.WARNING, 'Line commands (S, ?, D, C, CA) are not available yet in this SDSF.')
        }

        if (!this.filterCommand(command)) {
            switch (command.verb) {
                case EPrimaryCommand.END:
                case EPrimaryCommand.RETURN:
                    this.toMenu()
                    this.finish()
                    return
                case EPrimaryCommand.RETRIEVE:
                    this.retrieveCommand()
                    this.finish()
                    return
                case EPrimaryCommand.NONE:
                case EPrimaryCommand.DA:
                case EPrimaryCommand.AMOUNT:
                    break
                case EPrimaryCommand.ST:
                case EPrimaryCommand.LOG:
                case EPrimaryCommand.INIT:
                    this.notAvailable(command)
                    break
                case EPrimaryCommand.TOP:
                    this.top = 0
                    break
                case EPrimaryCommand.BOTTOM:
                    after.push(view => { this.top = Math.max(0, view.length - DATA_ROWS) })
                    break
                case EPrimaryCommand.UP:
                case EPrimaryCommand.DOWN: {
                    const amount = command.args[0] ?? this.scroll
                    const down = command.verb === EPrimaryCommand.DOWN
                    after.push(view => this.scrollBy(view, amount.toUpperCase(), down, input.cursor))
                    break
                }
                case EPrimaryCommand.LEFT:
                    this.offset = offsetLeftOf(this.offset, this.terminal.screen.cols)
                    break
                case EPrimaryCommand.RIGHT:
                    this.scrollRight()
                    break
                case EPrimaryCommand.FIND: {
                    const text = command.args.join(' ')
                    if (!text) {
                        this.invalid(command, 'ENTER A FIND STRING')
                        break
                    }
                    this.findText = text
                    after.push(view => this.find(view, false))
                    break
                }
                case EPrimaryCommand.RFIND:
                    after.push(view => this.find(view, true))
                    break
                case EPrimaryCommand.AUTO: {
                    const seconds = Number(command.args[0] ?? 0)
                    if (seconds === 0) {
                        this.stopAuto()
                    }
                    else if (seconds > MAX_AUTO_SECONDS) {
                        this.invalid(command, 'INVALID INTERVAL')
                    }
                    else {
                        this.startAuto(seconds)
                    }
                    break
                }
                default:
                    this.invalid(command)
                    break
            }
        }
        this.refresh(after)
    }

    private readyAttention = (typed: string): void => {
        const upper = typed.toUpperCase()
        if (upper === 'SDSF' || upper === 'SDSF DA') {
            this.ready = { lines: [] }
            this.clearMessage()
            if (upper === 'SDSF DA') {
                this.panel = ESdsfPanel.DA
                this.top = 0
                this.refresh([])
                return
            }
            this.panel = ESdsfPanel.MENU
            this.finish()
            return
        }
        if (typed) {
            this.ready.lines.push(typed)
            this.ready.lines.push(`IKJ56500I COMMAND ${upper.split(/\s+/)[0]} NOT FOUND`)
        }
        this.ready.lines.push('READY')
        this.finish()
    }

    private toMenu = (): void => {
        this.stopAuto()
        this.panel = ESdsfPanel.MENU
    }

    private toReady = (): void => {
        this.stopAuto()
        this.panel = ESdsfPanel.READY
        this.ready = { lines: ['READY'] }
    }

    // ── Data ────────────────────────────────────────────────────────────────────────────────────────

    // Asks for a fresh list, then runs what needed it and paints. The keyboard stays locked meanwhile.
    private refresh = (after: TAfterList[]): void => {
        this.source.request({ command: ESdsfCommand.LIST })
            .then(response => this.applyList(response, after))
            .catch((err: unknown) => this.say('NO RESPONSE FROM KWIRTH', EMessageLevel.ERROR, err instanceof Error ? err.message : String(err)))
            .finally(this.finish)
    }

    private applyList = (response: ISdsfMessageResponse, after: TAfterList[]): void => {
        if (!response.ok) {
            const code = response.error ?? ESdsfError.FAILED
            this.say(ERROR_MESSAGE[code], EMessageLevel.ERROR, response.detail ?? '')
            return
        }
        this.pods = response.pods ?? []
        this.metrics = response.metrics ?? ESdsfMetricsState.UNAVAILABLE
        this.clusterCpu = response.clusterCpu
        const view = this.view()
        for (const run of after) run(view)
        this.top = Math.max(0, Math.min(this.top, view.length - 1))
        if (!this.message && this.metrics === ESdsfMetricsState.UNAVAILABLE) {
            this.say('METRICS PROVIDER NOT AVAILABLE', EMessageLevel.WARNING, "Real and CPU% need Kwirth's 'metrics' provider, which is not installed on this cluster.")
        }
    }

    // The pods as the DA shows them: filtered by PREFIX, OWNER and DEST, in the SORT order.
    view = (): ISdsfPod[] => {
        const now = this.now()
        const pods = this.pods.filter(p =>
            sdsfPatternMatches(this.prefix, p.name) &&
            sdsfPatternMatches(this.owner, p.owner) &&
            (!this.dest || p.namespace.toLowerCase() === this.dest))
        const column = this.sortColumn
        if (!column) return pods.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name))
        const sign = this.sortDescending ? -1 : 1
        return pods.sort((a, b) => {
            const x = column.sortKey(a, now)
            const y = column.sortKey(b, now)
            const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
            return sign * order || a.name.localeCompare(b.name)
        })
    }

    /*
        How far a PF7/PF8 goes, from the scroll amount: PAGE, HALF, DATA (a page less one row), CSR (the
        cursor's row goes to the top, or the bottom going up), MAX, or a number of rows.
    */
    private scrollBy = (view: ISdsfPod[], amount: string, down: boolean, cursor: number): void => {
        const cursorRow = this.terminal.screen.rowOf(cursor) - ROW_FIRST_DATA
        const onData = cursorRow >= 0 && cursorRow < DATA_ROWS
        let rows: number
        switch (amount) {
            case 'PAGE':
                rows = DATA_ROWS
                break
            case 'HALF':
                rows = Math.floor(DATA_ROWS / 2)
                break
            case 'DATA':
                rows = DATA_ROWS - 1
                break
            case 'CSR':
                rows = !onData ? DATA_ROWS : down ? (cursorRow || DATA_ROWS) : (DATA_ROWS - 1 - cursorRow || DATA_ROWS)
                break
            case 'M':
            case 'MAX':
                this.top = down ? Math.max(0, view.length - DATA_ROWS) : 0
                return
            default:
                if (!/^\d+$/.test(amount)) {
                    this.say('INVALID SCROLL AMOUNT', EMessageLevel.ERROR, `'${amount}' is not PAGE, HALF, DATA, CSR, MAX or a number.`)
                    return
                }
                rows = Number(amount)
        }
        this.top = down ? Math.min(this.top + rows, Math.max(0, view.length - 1)) : Math.max(0, this.top - rows)
    }

    // PF11: to the first column that did not fit; at the last page it stays.
    private scrollRight = (): void => {
        const next = this.offset + columnsFrom(this.offset, this.terminal.screen.cols).length
        if (next < DA_COLUMNS.length) this.offset = next
    }

    // FIND / RFIND: the next pod whose row (every column, the full name too) contains the text, wrapping.
    private find = (view: ISdsfPod[], again: boolean): void => {
        if (!this.findText) {
            this.say('NO PREVIOUS FIND', EMessageLevel.ERROR, 'RFIND (PF5) repeats a FIND: there has been none yet.')
            return
        }
        const now = this.now()
        const wanted = this.findText.toUpperCase()
        // every column as shown, plus the names whole: a column may cut them
        const text = (p: ISdsfPod) => [...[JOBNAME_COLUMN, ...DA_COLUMNS].map(c => cell(c, p, now)), p.namespace, p.name].join(' ').toUpperCase()
        const start = again ? this.top + 1 : this.top
        for (let i = 0; i < view.length; i++) {
            const index = (start + i) % view.length
            if (text(view[index]).includes(wanted)) {
                this.top = index
                if (again && index < start) this.say('BOTTOM OF DATA REACHED', EMessageLevel.INFO, 'The search went past the last row and continued from the first.')
                return
            }
        }
        this.say('NOT FOUND', EMessageLevel.WARNING, `'${this.findText}' is not in any row.`)
    }

    // ── Automatic update (&nn) ──────────────────────────────────────────────────────────────────────

    private startAuto = (seconds: number): void => {
        this.stopAuto()
        this.auto = seconds
        this.timer = setInterval(this.tick, seconds * 1000)
    }

    private stopAuto = (): void => {
        if (this.timer) clearInterval(this.timer)
        this.timer = undefined
        this.auto = 0
    }

    // A refresh the operator did not ask for: only on the DA, never over a locked keyboard or half-typed input.
    tick = (): void => {
        if (this.disposed || this.panel !== ESdsfPanel.DA) return
        if (this.terminal.lock !== E3270Lock.NONE || this.terminal.screen.modifiedFields().length > 0) return
        this.terminal.lock = E3270Lock.SYSTEM
        this.notify()
        this.refresh([])
    }

    // ── Paint ───────────────────────────────────────────────────────────────────────────────────────

    private paint = (): void => {
        const screen = this.terminal.screen
        screen.clear()
        const painter = new Painter(screen)
        switch (this.panel) {
            case ESdsfPanel.MENU:
                this.npFields = []
                this.fields = paintPrimaryMenu(painter, {
                    system: this.system, command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel
                })
                screen.cursor = this.fields.command + 1
                return
            case ESdsfPanel.DA: {
                const sort = this.sortColumn ? `${this.sortColumn.header.toUpperCase()}/${this.sortDescending ? 'D' : 'A'}` : ''
                const fields = paintDa(painter, {
                    system: this.system, dest: this.dest, prefix: this.prefix, owner: this.owner, sort, auto: this.auto,
                    pods: this.view(), top: this.top, offset: this.offset, clusterCpu: this.clusterCpu,
                    command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel,
                    longMessage: this.showLong ? this.longMessage : '',
                    now: this.now()
                })
                this.fields = { command: fields.command, scroll: fields.scroll }
                this.npFields = fields.np
                screen.cursor = fields.command + 1
                return
            }
            case ESdsfPanel.READY:
                this.npFields = []
                this.fields = { command: -1, scroll: -1 }
                this.readyField = paintReady(painter, this.ready)
                return
            default:
                return
        }
    }
}
