import { Terminal3270 } from './terminal/Terminal3270'
import { E3270Aid, E3270Color, E3270Lock, I3270Geometry, I3270Input, I3270KeyAction, MODEL3_GEOMETRY } from './terminal/Terminal3270Types'
import { Screen3270 } from './terminal/Screen3270'
import { Painter } from './panels/Painter'
import { EMessageLevel } from './panels/SdsfLayout'
import { paintPrimaryMenu } from './panels/PrimaryMenu'
import { columnsFrom, dataRows, filterLine, ITableFields, offsetLeftOf, paintDa, paintTable, ROW_FIRST_DATA, ROW_HEADERS } from './panels/DaPanel'
import { cell, DA_COLUMNS, findColumn, IDaColumn, JOBNAME_COLUMN, stepNameOf } from './panels/DaColumns'
import { ST_COLUMNS, ST_JOBNAME_COLUMN } from './panels/JobColumns'
import { EPrimaryCommand, IPrimaryCommand, parsePrimaryCommand } from './panels/PrimaryCommand'
import { IReadyState, paintReady } from './panels/ReadyPanel'
import { sdsfPatternMatches } from './panels/Wildcard'
import { daFilterMatches, DEFAULT_DA_FILTER, IDaFilter, parseDaParameters } from './panels/DaFilter'
import { ELineCommand, INIT_LINE_COMMANDS, isCancel, JC_LINE_COMMANDS, parseLineCommand, SR_LINE_COMMANDS, TABLE_LINE_COMMANDS } from './panels/LineCommand'
import { INIT_COLUMNS, INIT_ID_COLUMN } from './panels/NodeColumns'
import { JC_CLASS_COLUMN, JC_COLUMNS } from './panels/ClassColumns'
import { SR_COLUMNS, SR_REPLY_COLUMN } from './panels/RequestColumns'
import { ACTION_HELP, IActionTarget, IPendingAction, paintConfirm } from './panels/ConfirmPopup'
import { dsidOf, IContainerFields, paintContainers } from './panels/ContainersPanel'
import { browseHeight, browseRows, browseWidth, paintBrowse, printable, ROW_FIRST_BROWSE } from './panels/BrowsePanel'
import { eventColor, syslogLine } from './panels/SyslogFormat'
import { ISdsfUlogEntry, ulogColor, ulogLine } from './panels/UlogFormat'
import { ISdsfDataSource } from './SdsfDataSource'
import {
    ESdsfCommand, ESdsfError, ESdsfJobState, ESdsfMetricsState, ESdsfNodeAction, ESdsfObjectKind, ISdsfContainer, ISdsfEvent, ISdsfJob,
    ISdsfJobClass, ISdsfMessageResponse, ISdsfNode, ISdsfPod, ISdsfRequest, ISdsfSystemRequest
} from './SdsfTypes'

export enum ESdsfPanel {
    MENU = 'menu',
    DA = 'da',
    ST = 'st',                     // every Job and CronJob
    INPUT = 'input',               // I: what waits to run: CronJobs scheduled, Jobs not started
    OUTPUT = 'output',             // O: the Jobs that ended
    HELD = 'held',                 // H: the CronJobs suspended
    INIT = 'init',                 // the nodes, as initiators
    JC = 'jc',                     // the PriorityClasses, as job classes
    SR = 'sr',                     // the pending CSRs, as system requests
    CONTAINERS = 'containers',     // the ? panel: a pod's containers
    BROWSE = 'browse',             // a log, a describe or the SYSLOG
    READY = 'ready'                // after END: TSO's READY
}

// The panels that are a table of objects with NP line commands.
const TABLE_PANELS: ESdsfPanel[] = [ESdsfPanel.DA, ESdsfPanel.ST, ESdsfPanel.INPUT, ESdsfPanel.OUTPUT, ESdsfPanel.HELD, ESdsfPanel.INIT, ESdsfPanel.JC, ESdsfPanel.SR]
const isTable = (panel: ESdsfPanel): boolean => TABLE_PANELS.includes(panel)
const isJobTable = (panel: ESdsfPanel): boolean => panel === ESdsfPanel.ST || panel === ESdsfPanel.INPUT || panel === ESdsfPanel.OUTPUT || panel === ESdsfPanel.HELD
// The tables that share columns, sort and offset: the Job tables (ST, I, O, H) are one family; every other table is its own.
const familyOf = (panel: ESdsfPanel): ESdsfPanel => {
    if (isJobTable(panel)) return ESdsfPanel.ST
    switch (panel) {
        case ESdsfPanel.INIT:
        case ESdsfPanel.JC:
        case ESdsfPanel.SR:
            return panel
        default:
            return ESdsfPanel.DA
    }
}

const INIT_TITLE = 'SDSF INITIATOR DISPLAY  ALL CLASSES'
const JC_TITLE = 'SDSF JOB CLASS DISPLAY ALL CLASSES'
const SR_TITLE = 'SDSF SYSTEM REQUESTS DISPLAY ALL'

// What a describe of a cluster-scoped object says where a pod's says its JobID: the panel it came from.
const DESCRIBE_TAG: Partial<Record<ESdsfObjectKind, string>> = {
    [ESdsfObjectKind.NODE]: 'INIT',
    [ESdsfObjectKind.PRIORITY_CLASS]: 'JC',
    [ESdsfObjectKind.CSR]: 'SR'
}

// The line commands each table takes.
const lineCommandsOf = (panel: ESdsfPanel): ELineCommand[] => {
    switch (panel) {
        case ESdsfPanel.INIT:
            return INIT_LINE_COMMANDS
        case ESdsfPanel.JC:
            return JC_LINE_COMMANDS
        case ESdsfPanel.SR:
            return SR_LINE_COMMANDS
        default:
            return TABLE_LINE_COMMANDS
    }
}

// A family's columns, for what only needs their headers and widths: SORT and the sideways scroll.
const familyColumns = (family: ESdsfPanel): { fixed: IDaColumn<never>; columns: IDaColumn<never>[] } => {
    switch (family) {
        case ESdsfPanel.ST:
            return { fixed: ST_JOBNAME_COLUMN, columns: ST_COLUMNS }
        case ESdsfPanel.INIT:
            return { fixed: INIT_ID_COLUMN, columns: INIT_COLUMNS }
        case ESdsfPanel.JC:
            return { fixed: JC_CLASS_COLUMN, columns: JC_COLUMNS }
        case ESdsfPanel.SR:
            return { fixed: SR_REPLY_COLUMN, columns: SR_COLUMNS }
        default:
            return { fixed: JOBNAME_COLUMN, columns: DA_COLUMNS }
    }
}
const jobKindOrder = (j: ISdsfJob): number => j.kind === ESdsfObjectKind.JOB ? 0 : 1

const JOB_TITLES: Partial<Record<ESdsfPanel, string>> = {
    [ESdsfPanel.ST]: 'SDSF STATUS DISPLAY ALL CLASSES',
    [ESdsfPanel.INPUT]: 'SDSF INPUT QUEUE DISPLAY ALL CLASSES',
    [ESdsfPanel.OUTPUT]: 'SDSF OUTPUT ALL CLASSES ALL FORMS',
    [ESdsfPanel.HELD]: 'SDSF HELD OUTPUT DISPLAY ALL CLASSES'
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
type TAfterList = () => void

// The row a line command was typed against: a pod (DA), a Job/CronJob (ST, I, O, H), a node (INIT), a class (JC) or a CSR (SR).
interface ILineTarget {
    pod?: ISdsfPod
    job?: ISdsfJob
    node?: ISdsfNode
    jobClass?: ISdsfJobClass
    request?: ISdsfSystemRequest
}

// What S, Z and P on INIT ask the back to do with the node.
const NODE_ACTION: Partial<Record<ELineCommand, ESdsfNodeAction>> = {
    [ELineCommand.SELECT]: ESdsfNodeAction.START,
    [ELineCommand.HALT]: ESdsfNodeAction.HALT,
    [ELineCommand.PURGE]: ESdsfNodeAction.DRAIN
}

interface IQueuedLine {
    command: ELineCommand
    target: ILineTarget
    line: number               // the row of the table, 1-based
}

// What a run of confirmed actions came to, said when the last window closes.
interface IActionResults {
    processed: number
    done: string[]             // what the back said about each one, for the long message
    failures: string[]
    firstError?: ESdsfError
}

// The browse on screen, and where PF3 goes back to.
interface IBrowse {
    heading: string
    lines: string[]
    colors?: E3270Color[]
    top: number
    left: number
    back: ESdsfPanel
    found?: { index: number; col: number }
    syslog?: boolean           // the LOG panel: Enter (and &nn) reads the events again
}

/*
    One SDSF session: the terminal and the ISPF-like dialog running on it.

    Like the terminal, it lives in common/ and knows nothing of the DOM or of the websocket: it asks its data
    source and tells its listeners when the screen changed. The same session could be driven by a tn3270
    connection one day (D11).

    Block mode, as on the real thing: an AID locks the keyboard (X SYSTEM), the session asks the back when the
    panel needs it, paints the answer and only then unlocks.

    The tables (DA for pods; ST, O and H for Jobs and CronJobs) share everything: filters, SORT, scrolling,
    FIND and the line commands. Several line commands typed in one Enter are queued as SDSF does: the cancels
    together through one CONFIRM ACTION window, then S, ? and D one after the other, the next when PF3 comes
    back from the previous one.
*/
export class SdsfSession {
    readonly terminal: Terminal3270
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

    // tables
    private listPanel = ESdsfPanel.DA       // the table PF3 from a browse or the ? panel returns to
    private pods: ISdsfPod[] = []
    private jobs: ISdsfJob[] = []
    private nodes: ISdsfNode[] = []
    private classes: ISdsfJobClass[] = []
    private requests: ISdsfSystemRequest[] = []
    private nodeFilter = ''                 // ? on INIT: the DA of one node's pods, PF3 back to INIT
    private classFilter = ''                // ? on JC: the DA of one class's pods, PF3 back to JC
    private metrics = ESdsfMetricsState.UNAVAILABLE
    private clusterCpu?: number
    private prefix = ''
    private dest = ''
    private owner = ''
    private daFilter: IDaFilter = DEFAULT_DA_FILTER   // the DA parameters: types and positions
    private sortHeader = ''
    private sortDescending = false
    private top = 0
    private offset = 0
    private findText = ''
    private auto = 0
    private timer?: ReturnType<typeof setInterval>
    private npFields: { attribute: number; target: ILineTarget }[] = []

    // line commands
    private queue: IQueuedLine[] = []
    private confirm?: IPendingAction[]     // the actions still to confirm; the window shows the first
    private confirmField = -1
    private confirmOn = true                // SET CONFIRM; option 3 of the window turns it off
    private results: IActionResults = { processed: 0, done: [], failures: [] }
    private ulog: ISdsfUlogEntry[] = []     // what this operator did in the session: the ULOG panel
    private containersPod?: ISdsfPod
    private containerFields: IContainerFields['np'] = []
    private browse?: IBrowse

    // READY
    private ready: IReadyState = { lines: [] }
    private readyField = -1

    // The geometry is the terminal's model (24x80, 32x80 or 27x132): every panel lays itself out in it.
    constructor(system: string, source: ISdsfDataSource, geometry: I3270Geometry = MODEL3_GEOMETRY, now: () => number = Date.now) {
        this.terminal = new Terminal3270(new Screen3270(geometry))
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

    private sayError = (response: ISdsfMessageResponse): void => {
        this.say(ERROR_MESSAGE[response.error ?? ESdsfError.FAILED], EMessageLevel.ERROR, response.detail ?? '')
    }

    private sayNoResponse = (err: unknown): void => {
        this.say('NO RESPONSE FROM KWIRTH', EMessageLevel.ERROR, err instanceof Error ? err.message : String(err))
    }

    // ── Attention ───────────────────────────────────────────────────────────────────────────────────

    private attention = (input: I3270Input): void => {
        const value = (address: number): string | undefined => input.fields.find(f => f.address === address)?.value
        this.showLong = false

        if (this.panel === ESdsfPanel.READY) {
            this.readyAttention((value(this.readyField) ?? '').trim())
            return
        }
        if (this.confirm) {
            // the selection comes pre-filled with 1: untouched, it does not travel, and it still says 1
            this.confirmAttention(input, (value(this.confirmField) ?? '1').trim())
            return
        }

        const scroll = value(this.fields.scroll)
        if (scroll !== undefined) this.scroll = scroll.trim().toUpperCase() || 'PAGE'
        // An untouched command field did not travel, but what is painted in it still counts, as in ISPF.
        const typed = value(this.fields.command) ?? this.command
        const command = parsePrimaryCommand(typed)
        this.command = ''
        if (input.aid !== E3270Aid.PF1) this.clearMessage()
        // What PF12 brought back is not typed again: remembering it would restart the walk back at every press.
        const retrieving = input.aid === E3270Aid.PF12 || command.verb === EPrimaryCommand.RETRIEVE
        if (!retrieving && command.verb !== EPrimaryCommand.NONE && command.verb !== EPrimaryCommand.AMOUNT) this.remember(command.text)

        if (this.panel === ESdsfPanel.MENU) this.menuAttention(input, command)
        else if (isTable(this.panel)) this.tableAttention(input, command, value)
        else if (this.panel === ESdsfPanel.CONTAINERS) this.containersAttention(input, command, value)
        else if (this.panel === ESdsfPanel.BROWSE) this.browseAttention(input, command)
        else this.finish()
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

    // DA takes its parameters each time it is typed; bare, it is the DADFLT. False when they are not valid.
    private daParameters = (command: IPrimaryCommand): boolean => {
        if (command.verb !== EPrimaryCommand.DA) return true
        const filter = parseDaParameters(command.args)
        if (!filter) {
            this.say('PARAMETER INVALID', EMessageLevel.ERROR,
                `'${command.text}': DA takes up to 4 of IN OUT TRANS READY, JOB STC TSU INIT and their O and NO forms (one O at most), or ALL, ALLT or ALLP alone.`)
            this.command = command.text
            return false
        }
        this.daFilter = filter
        return true
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
            case EPrimaryCommand.SET: {
                // SET CONFIRM ON|OFF, as on SDSF: the session's own, every new session asks again
                const value = (command.args[1] ?? '').toUpperCase()
                if (arg.toUpperCase() !== 'CONFIRM' || (value !== 'ON' && value !== 'OFF')) {
                    this.invalid(command, 'INVALID PARAMETER')
                    return true
                }
                this.confirmOn = value === 'ON'
                this.record(`SET CONFIRM ${value}`, '', `CONFIRM ${value}`, true)
                this.say(`CONFIRM ${value}`, EMessageLevel.INFO, this.confirmOn
                    ? 'C, CA and the INIT actions ask for confirmation.'
                    : 'C, CA and the INIT actions are processed without asking: SET CONFIRM ON asks again.')
                return true
            }
            case EPrimaryCommand.SORT: {
                if (!arg) {
                    this.sortHeader = ''
                    this.sortDescending = false
                    return true
                }
                // on the menu, SORT is for the DA; on any other table, for its columns
                const { fixed, columns } = familyColumns(familyOf(this.panel))
                const column = findColumn(arg, [fixed, ...columns])
                const order = (command.args[1] ?? 'A').toUpperCase()
                if (!column || (order !== 'A' && order !== 'D')) {
                    this.invalid(command, 'INVALID COLUMN NAME')
                    return true
                }
                this.sortHeader = column.header
                this.sortDescending = order === 'D'
                return true
            }
            default:
                return false
        }
    }

    // DA, ST, O, H and INIT from any panel. Going from one family of tables to another starts the view afresh.
    private openTable = (panel: ESdsfPanel): void => {
        if (familyOf(panel) !== familyOf(this.listPanel)) {
            this.offset = 0
            this.sortHeader = ''
            this.sortDescending = false
        }
        this.top = 0
        this.panel = panel
        this.listPanel = panel
        this.queue = []
        this.refresh([])
    }

    private tableFor = (verb: EPrimaryCommand): ESdsfPanel | undefined => {
        switch (verb) {
            case EPrimaryCommand.DA:
                return ESdsfPanel.DA
            case EPrimaryCommand.ST:
                return ESdsfPanel.ST
            case EPrimaryCommand.INPUT:
                return ESdsfPanel.INPUT
            case EPrimaryCommand.OUTPUT:
                return ESdsfPanel.OUTPUT
            case EPrimaryCommand.HELD:
                return ESdsfPanel.HELD
            case EPrimaryCommand.INIT:
                return ESdsfPanel.INIT
            case EPrimaryCommand.JC:
                return ESdsfPanel.JC
            case EPrimaryCommand.SR:
                return ESdsfPanel.SR
            default:
                return undefined
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
        if (!this.daParameters(command)) {
            this.finish()
            return
        }
        const table = this.tableFor(command.verb)
        if (table) {
            this.clearNarrow()
            this.openTable(table)
            return
        }
        switch (command.verb) {
            case EPrimaryCommand.LOG:
                this.openSyslog(ESdsfPanel.MENU)
                return
            case EPrimaryCommand.ULOG:
                this.ulogCommand(command)
                return
            case EPrimaryCommand.NONE:
                break
            default:
                this.invalid(command)
                break
        }
        this.finish()
    }

    private tableAttention = (input: I3270Input, command: IPrimaryCommand, value: (address: number) => string | undefined): void => {
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
                this.back()
                return
            case E3270Aid.PF12:
                this.retrieveCommand()
                this.finish()
                return
            case E3270Aid.PF5:
                after.push(() => this.find(true))
                break
            case E3270Aid.PF7:
            case E3270Aid.PF8: {
                const amount = command.verb === EPrimaryCommand.AMOUNT ? command.args[0] : this.scroll
                const down = input.aid === E3270Aid.PF8
                after.push(() => this.scrollBy(amount, down, input.cursor))
                break
            }
            case E3270Aid.PF10:
                this.scrollLeft()
                break
            case E3270Aid.PF11:
                this.scrollRight()
                break
            default:
                break
        }

        // The line commands typed in NP, in screen order. One that SDSF does not know stops them all.
        const typedLines = this.npFields
            .map((f, i) => ({ typed: value(f.attribute) ?? '', target: f.target, line: this.top + i + 1 }))
            .filter(l => l.typed.trim() !== '')
        const queue: IQueuedLine[] = []
        const allowed = lineCommandsOf(this.panel)
        for (const line of typedLines) {
            const parsed = parseLineCommand(line.typed, allowed)
            if (!parsed) {
                this.say('INVALID LINE COMMAND', EMessageLevel.ERROR, `'${line.typed.trim()}' is not a line command here: ${allowed.join(', ')}.`)
                queue.length = 0
                break
            }
            queue.push({ command: parsed, target: line.target, line: line.line })
        }

        if (!this.filterCommand(command)) {
            if (!this.daParameters(command)) {
                this.finish()
                return
            }
            const table = this.tableFor(command.verb)
            if (table && (table !== this.panel || command.verb === EPrimaryCommand.DA)) {
                this.clearNarrow()
                this.openTable(table)
                return
            }
            switch (command.verb) {
                case EPrimaryCommand.END:
                case EPrimaryCommand.RETURN:
                    this.back()
                    return
                case EPrimaryCommand.RETRIEVE:
                    this.retrieveCommand()
                    this.finish()
                    return
                case EPrimaryCommand.NONE:
                case EPrimaryCommand.AMOUNT:
                case EPrimaryCommand.DA:
                case EPrimaryCommand.ST:
                case EPrimaryCommand.OUTPUT:
                case EPrimaryCommand.INPUT:
                case EPrimaryCommand.HELD:
                case EPrimaryCommand.INIT:
                case EPrimaryCommand.JC:
                case EPrimaryCommand.SR:
                    break
                case EPrimaryCommand.LOG:
                    this.queue = []
                    this.openSyslog(this.panel)
                    return
                case EPrimaryCommand.ULOG:
                    this.queue = []
                    this.ulogCommand(command)
                    return
                case EPrimaryCommand.TOP:
                    this.top = 0
                    break
                case EPrimaryCommand.BOTTOM:
                    after.push(() => { this.top = Math.max(0, this.viewSize() - dataRows(this.terminal.screen)) })
                    break
                case EPrimaryCommand.UP:
                case EPrimaryCommand.DOWN: {
                    const amount = command.args[0] ?? this.scroll
                    const down = command.verb === EPrimaryCommand.DOWN
                    after.push(() => this.scrollBy(amount.toUpperCase(), down, input.cursor))
                    break
                }
                case EPrimaryCommand.LEFT:
                    this.scrollLeft()
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
                    after.push(() => this.find(false))
                    break
                }
                case EPrimaryCommand.RFIND:
                    after.push(() => this.find(true))
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

        if (queue.length > 0) {
            this.queue = queue
            this.runQueue()
            return
        }
        this.refresh(after)
    }

    private readyAttention = (typed: string): void => {
        const upper = typed.toUpperCase()
        if (upper === 'SDSF' || upper === 'SDSF DA') {
            this.ready = { lines: [] }
            this.clearMessage()
            if (upper === 'SDSF DA') {
                this.daFilter = DEFAULT_DA_FILTER
                this.openTable(ESdsfPanel.DA)
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

    // PF3 (or END) on a table: to the menu; from the DA of a node's or a class's pods (? on INIT or JC), back there.
    private back = (): void => {
        if (this.panel === ESdsfPanel.DA && (this.nodeFilter || this.classFilter)) {
            const back = this.nodeFilter ? ESdsfPanel.INIT : ESdsfPanel.JC
            this.clearNarrow()
            this.daFilter = DEFAULT_DA_FILTER
            this.openTable(back)
            return
        }
        this.toMenu()
        this.finish()
    }

    private clearNarrow = (): void => {
        this.nodeFilter = ''
        this.classFilter = ''
    }

    // The DA of one node's or one class's pods: every type, PF3 back to the table it came from.
    private openNarrowedDa = (): void => {
        this.queue = []
        this.daFilter = parseDaParameters(['ALLT']) ?? DEFAULT_DA_FILTER
        this.openTable(ESdsfPanel.DA)
    }

    private toMenu = (): void => {
        this.stopAuto()
        this.queue = []
        this.clearNarrow()
        this.panel = ESdsfPanel.MENU
    }

    private toReady = (): void => {
        this.stopAuto()
        this.panel = ESdsfPanel.READY
        this.ready = { lines: ['READY'] }
    }

    // ── Line commands ───────────────────────────────────────────────────────────────────────────────

    // The pod a line command on a Job means: its newest. For a CronJob, the newest pod of its newest Job.
    private podOfJob = (job: ISdsfJob): ISdsfPod | undefined => {
        const newestPod = (j: ISdsfJob) => this.pods
            .filter(p => p.namespace === j.namespace && p.controllerKind === 'Job' && p.controllerName === j.name)
            .sort((a, b) => b.created.localeCompare(a.created))[0]
        if (job.kind === ESdsfObjectKind.JOB) return newestPod(job)
        const runs = this.jobs
            .filter(j => j.kind === ESdsfObjectKind.JOB && j.namespace === job.namespace && j.cronJob === job.name)
            .sort((a, b) => b.start.localeCompare(a.start))
        for (const run of runs) {
            const pod = newestPod(run)
            if (pod) return pod
        }
        return undefined
    }

    private actionTargetOf = (target: ILineTarget): IActionTarget => {
        if (target.node) return { kind: ESdsfObjectKind.NODE, namespace: '', name: target.node.name, jobId: '' }
        if (target.jobClass) return { kind: ESdsfObjectKind.PRIORITY_CLASS, namespace: '', name: target.jobClass.name, jobId: '' }
        if (target.request) return { kind: ESdsfObjectKind.CSR, namespace: '', name: target.request.name, jobId: '' }
        if (target.job) return { kind: target.job.kind, namespace: target.job.namespace, name: target.job.name, jobId: target.job.jobId }
        return { kind: ESdsfObjectKind.POD, namespace: target.pod!.namespace, name: target.pod!.name, jobId: target.pod!.jobId }
    }

    // What changes the cluster and is confirmed first: C and CA; on INIT, S, Z and P.
    private needsConfirm = (line: IQueuedLine): boolean => line.target.node ? NODE_ACTION[line.command] !== undefined : isCancel(line.command)

    // The JOBNAME as the table shows it (the ID on INIT): what the Confirm Action window names.
    private jobnameOf = (target: ILineTarget): string =>
        (target.node?.id ?? target.jobClass?.name ?? target.request?.id ?? target.job?.name ?? target.pod?.name ?? '').toUpperCase().slice(0, 8)

    /*
        The next thing the queue asks for. What changes the cluster goes first: one Confirm Action window per
        action, in order (or none at all with SET CONFIRM OFF). Then S, ? and D one by one. With the queue
        empty, back on the table with a fresh list.
    */
    private runQueue = (): void => {
        const actions = this.queue.filter(this.needsConfirm)
        if (actions.length > 0) {
            this.queue = this.queue.filter(q => !this.needsConfirm(q))
            this.confirm = actions.map(a => ({ command: a.command, target: this.actionTargetOf(a.target), line: a.line, jobname: this.jobnameOf(a.target) }))
            this.results = { processed: 0, done: [], failures: [] }
            this.panel = this.listPanel
            if (this.confirmOn) {
                this.finish()
                return
            }
            void this.processRest()
            return
        }
        const next = this.queue.shift()
        if (!next) {
            this.panel = this.listPanel
            this.refresh([])
            return
        }
        const { node, jobClass } = next.target
        if (node || jobClass || next.target.request) {
            if (next.command === ELineCommand.QUERY && (node || jobClass)) {
                // The node's or the class's pods: the DA of every type, PF3 back. What else was queued is dropped.
                this.clearNarrow()
                if (node) this.nodeFilter = node.name
                if (jobClass) this.classFilter = jobClass.name
                this.openNarrowedDa()
                return
            }
            this.openDescribe(this.actionTargetOf(next.target))
            return
        }
        const job = next.target.job
        const pod = job ? this.podOfJob(job) : next.target.pod
        switch (next.command) {
            case ELineCommand.SELECT: {
                const main = pod?.containers.find(c => c.name === stepNameOf(pod))
                if (!pod || !main) {
                    this.say('NO OUTPUT', EMessageLevel.WARNING, `${job?.name ?? pod?.name ?? ''} has no pod whose log could be browsed.`)
                    this.runQueue()
                    return
                }
                this.openLog(pod, main, this.listPanel)
                return
            }
            case ELineCommand.QUERY:
                if (!pod) {
                    this.say('NO OUTPUT', EMessageLevel.WARNING, `${job?.name ?? ''} has no pod to show.`)
                    this.runQueue()
                    return
                }
                this.containersPod = pod
                this.panel = ESdsfPanel.CONTAINERS
                this.finish()
                return
            case ELineCommand.DISPLAY:
                this.openDescribe(this.actionTargetOf(next.target))
                return
            default:
                this.runQueue()
        }
    }

    /*
        The answer to the window on screen, about its one action: 1 processes it, 2 (or PF3, PF12) discards it,
        3 processes it and sets confirmation off, so the rest go without asking. PF1 says what the action does.
    */
    private confirmAttention = (input: I3270Input, selection: string): void => {
        const current = this.confirm?.[0]
        if (!current) return
        if (input.aid === E3270Aid.PF1) {
            this.say(`${current.command} ACTION`, EMessageLevel.INFO, ACTION_HELP[current.command] ?? '')
            this.showLong = true
            this.finish()
            return
        }
        if (input.aid === E3270Aid.PF3 || input.aid === E3270Aid.PF12 || input.aid === E3270Aid.CLEAR || (input.aid === E3270Aid.ENTER && selection === '2')) {
            this.record(current.command, this.whatOf(current), 'DISCARDED', true)
            this.confirm = this.confirm!.slice(1)
            this.nextConfirm()
            return
        }
        if (input.aid !== E3270Aid.ENTER || (selection !== '1' && selection !== '3')) {
            this.say('INVALID SELECTION', EMessageLevel.ERROR, '1 processes the action, 2 (or PF3) discards it, 3 processes it and sets confirmation off.')
            this.finish()
            return
        }
        if (selection === '3') {
            this.confirmOn = false
            this.record('SET CONFIRM OFF', '', 'CONFIRM OFF (option 3)', true)
        }
        this.confirm = this.confirm!.slice(1)
        void this.process(current).then(this.nextConfirm)
    }

    // After one window: the next one, or, with confirmation off, the rest without asking; then what came of them.
    private nextConfirm = (): void => {
        if ((this.confirm ?? []).length > 0) {
            if (this.confirmOn) {
                this.finish()
                return
            }
            void this.processRest()
            return
        }
        this.concludeActions()
    }

    private processRest = async (): Promise<void> => {
        const rest = this.confirm ?? []
        this.confirm = undefined
        for (const p of rest) await this.process(p)
        this.concludeActions()
    }

    // The message for the whole run: the first refusal, or COMMAND ISSUED, or ACTION CANCELLED if all were discarded.
    private concludeActions = (): void => {
        const r = this.results
        this.confirm = undefined
        if (r.firstError) this.say(ERROR_MESSAGE[r.firstError], EMessageLevel.ERROR, r.failures.join('; '))
        else if (r.processed > 0) this.say('COMMAND ISSUED', EMessageLevel.INFO, r.done.length ? r.done.join('; ') : `${r.processed} action(s) done.`)
        else this.say('ACTION CANCELLED', EMessageLevel.INFO, 'Nothing was done.')
        this.runQueue()
    }

    private requestOf = (p: IPendingAction): ISdsfRequest => p.target.kind === ESdsfObjectKind.NODE
        ? { command: ESdsfCommand.NODE, objectKind: ESdsfObjectKind.NODE, targetName: p.target.name, nodeAction: NODE_ACTION[p.command] }
        : { command: ESdsfCommand.CANCEL, objectKind: p.target.kind, targetNamespace: p.target.namespace, targetName: p.target.name, force: p.command === ELineCommand.CANCEL_FORCE }

    private whatOf = (p: IPendingAction): string => p.target.kind === ESdsfObjectKind.NODE ? `node ${p.target.name}` : `${p.target.namespace}/${p.target.name}`

    // ── ULOG ────────────────────────────────────────────────────────────────────────────────────────

    private record = (command: string, target: string, response: string, ok: boolean): void => {
        this.ulog.push({ time: new Date(this.now()).toISOString(), command, target, response, ok })
    }

    // ULOG shows the session's log, newest at the bottom; ULOG CLOSE empties it.
    private ulogCommand = (command: IPrimaryCommand): void => {
        const arg = (command.args[0] ?? '').toUpperCase()
        if (arg === 'CLOSE') {
            this.ulog = []
            this.say('ULOG CLOSED', EMessageLevel.INFO, 'The user session log is empty; actions from now on start a new one.')
            this.finish()
            return
        }
        if (arg) {
            this.invalid(command, 'INVALID PARAMETER')
            this.finish()
            return
        }
        const back = isTable(this.panel) ? this.panel : ESdsfPanel.MENU
        const lines = this.ulog.map(e => printable(ulogLine(e, this.system)))
        const bottom = Math.max(0, browseRows(lines, this.terminal.screen.cols).length - browseHeight(this.terminal.screen))
        this.stopAuto()
        this.browse = {
            heading: `ULOG CONSOLE ${this.system.toUpperCase().slice(0, 8).padEnd(8)}`,
            lines,
            colors: this.ulog.map(ulogColor),
            top: bottom,
            left: 0,
            back
        }
        this.panel = ESdsfPanel.BROWSE
        this.finish()
    }

    // One action, asked of the back; what it says goes into the run's results and the ULOG.
    private process = async (p: IPendingAction): Promise<void> => {
        const r = this.results
        r.processed++
        const what = this.whatOf(p)
        try {
            const response = await this.source.request(this.requestOf(p))
            if (!response.ok) {
                const error = response.error ?? ESdsfError.FAILED
                r.firstError = r.firstError ?? error
                r.failures.push(`${what}: ${response.detail ?? response.error}`)
                this.record(p.command, what, `${ERROR_MESSAGE[error]}: ${response.detail ?? ''}`, false)
            }
            else if (response.evicted !== undefined) {
                r.done.push(`${what}: ${response.evicted} pod(s) evicted`)
                this.record(p.command, what, `${response.evicted} POD(S) EVICTED`, true)
            }
            else {
                this.record(p.command, what, 'COMMAND ISSUED', true)
            }
        }
        catch (err) {
            const text = err instanceof Error ? err.message : String(err)
            r.firstError = r.firstError ?? ESdsfError.FAILED
            r.failures.push(`${what}: ${text}`)
            this.record(p.command, what, `NO RESPONSE FROM KWIRTH: ${text}`, false)
        }
    }

    private openLog = (pod: ISdsfPod, container: ISdsfContainer, back: ESdsfPanel): void => {
        const heading = `OUTPUT DISPLAY ${pod.name.toUpperCase().slice(0, 8).padEnd(8)} ${pod.jobId}  DSID ${String(dsidOf(pod, container)).padStart(5)}`
        this.openBrowse({ command: ESdsfCommand.LOG, objectKind: ESdsfObjectKind.POD, targetNamespace: pod.namespace, targetName: pod.name, containerName: container.name }, heading, back)
    }

    private openDescribe = (target: IActionTarget): void => {
        const heading = `DESCRIBE ${target.name.toUpperCase().slice(0, 8).padEnd(8)} ${target.jobId || DESCRIBE_TAG[target.kind] || ''}`
        this.openBrowse({ command: ESdsfCommand.DESCRIBE, objectKind: target.kind, targetNamespace: target.namespace, targetName: target.name }, heading, this.listPanel)
    }

    // Asks for the lines and opens the browse; when they do not come, the message stays on the panel it came from.
    private openBrowse = (request: ISdsfRequest, heading: string, back: ESdsfPanel): void => {
        this.source.request(request)
            .then(response => {
                if (!response.ok) {
                    this.sayError(response)
                    return
                }
                this.browse = { heading, lines: (response.lines ?? []).map(printable), top: 0, left: 0, back }
                this.panel = ESdsfPanel.BROWSE
            })
            .catch(this.sayNoResponse)
            .finally(() => {
                if (this.panel !== ESdsfPanel.BROWSE && isTable(back) && this.queue.length === 0) {
                    this.panel = back
                    this.refresh([])
                    return
                }
                this.finish()
            })
    }

    private containersAttention = (input: I3270Input, command: IPrimaryCommand, value: (address: number) => string | undefined): void => {
        const pod = this.containersPod
        if (!pod || input.aid === E3270Aid.PF3 || input.aid === E3270Aid.PF4 || command.verb === EPrimaryCommand.END || command.verb === EPrimaryCommand.RETURN) {
            this.containersPod = undefined
            this.panel = this.listPanel
            this.runQueue()
            return
        }
        if (input.aid === E3270Aid.PF12 || command.verb === EPrimaryCommand.RETRIEVE) {
            this.retrieveCommand()
            this.finish()
            return
        }
        const typed = this.containerFields.map(f => ({ typed: value(f.attribute) ?? '', container: f.container })).find(l => l.typed.trim() !== '')
        if (typed) {
            if (parseLineCommand(typed.typed) !== ELineCommand.SELECT) {
                this.say('INVALID LINE COMMAND', EMessageLevel.ERROR, `On a container only S browses its log.`)
                this.finish()
                return
            }
            this.openLog(pod, typed.container, ESdsfPanel.CONTAINERS)
            return
        }
        if (command.verb !== EPrimaryCommand.NONE) {
            this.invalid(command)
            this.finish()
            return
        }
        // Enter alone: the containers as they are now.
        this.source.request({ command: ESdsfCommand.LIST })
            .then(response => {
                if (!response.ok) {
                    this.sayError(response)
                    return
                }
                this.pods = response.pods ?? this.pods
                const fresh = this.pods.find(p => p.uid === pod.uid)
                if (fresh) this.containersPod = fresh
                else this.say('POD NO LONGER EXISTS', EMessageLevel.WARNING, `${pod.namespace}/${pod.name} is gone: what you see is how it was.`)
            })
            .catch(this.sayNoResponse)
            .finally(this.finish)
    }

    private browseAttention = (input: I3270Input, command: IPrimaryCommand): void => {
        const browse = this.browse
        if (!browse || input.aid === E3270Aid.PF3 || input.aid === E3270Aid.PF4 || command.verb === EPrimaryCommand.END || command.verb === EPrimaryCommand.RETURN) {
            const back = browse?.back ?? this.listPanel
            // the automatic update belongs to the LOG: leaving it stops it, as leaving a table does
            if (browse?.syslog) this.stopAuto()
            this.browse = undefined
            this.panel = back
            if (isTable(back)) this.runQueue()
            else this.finish()
            return
        }
        browse.found = undefined
        if (browse.syslog && this.syslogCommand(input, command)) return
        switch (input.aid) {
            case E3270Aid.PF12:
                this.retrieveCommand()
                this.finish()
                return
            case E3270Aid.PF5:
                this.browseFind(browse, true)
                this.finish()
                return
            case E3270Aid.PF7:
            case E3270Aid.PF8:
                this.browseScroll(browse, command.verb === EPrimaryCommand.AMOUNT ? command.args[0] : this.scroll, input.aid === E3270Aid.PF8, input.cursor)
                this.finish()
                return
            case E3270Aid.PF10:
            case E3270Aid.PF11:
                this.browseSideways(browse, command.verb === EPrimaryCommand.AMOUNT ? command.args[0] : this.scroll, input.aid === E3270Aid.PF11, input.cursor)
                this.finish()
                return
            default:
                break
        }
        switch (command.verb) {
            case EPrimaryCommand.NONE:
            case EPrimaryCommand.AMOUNT:
                break
            case EPrimaryCommand.TOP:
                browse.top = 0
                break
            case EPrimaryCommand.BOTTOM:
                this.browseScroll(browse, 'MAX', true, input.cursor)
                break
            case EPrimaryCommand.UP:
            case EPrimaryCommand.DOWN:
                this.browseScroll(browse, (command.args[0] ?? this.scroll).toUpperCase(), command.verb === EPrimaryCommand.DOWN, input.cursor)
                break
            case EPrimaryCommand.LEFT:
            case EPrimaryCommand.RIGHT:
                this.browseSideways(browse, (command.args[0] ?? this.scroll).toUpperCase(), command.verb === EPrimaryCommand.RIGHT, input.cursor)
                break
            case EPrimaryCommand.FIND: {
                const text = command.args.join(' ')
                if (!text) {
                    this.invalid(command, 'ENTER A FIND STRING')
                    break
                }
                this.findText = text
                this.browseFind(browse, false)
                break
            }
            case EPrimaryCommand.RFIND:
                this.browseFind(browse, true)
                break
            default:
                this.invalid(command)
                break
        }
        this.finish()
    }

    // ── LOG (the SYSLOG) ────────────────────────────────────────────────────────────────────────────

    /*
        What only the LOG does on top of a browse: Enter alone reads the events again, PREFIX and DEST filter
        them (by object name and namespace, as they filter the tables), and &nn keeps it running. Returns true
        when it took the command; false lets the browse handle it (scrolling, FIND…).
    */
    private syslogCommand = (input: I3270Input, command: IPrimaryCommand): boolean => {
        if (input.aid === E3270Aid.PA1) {
            if (this.auto) this.say('AUTO UPDATE STOPPED', EMessageLevel.INFO)
            this.stopAuto()
            this.finish()
            return true
        }
        if (input.aid !== E3270Aid.ENTER) return false
        if (command.verb === EPrimaryCommand.PREFIX || command.verb === EPrimaryCommand.DEST) {
            this.filterCommand(command)
            this.openSyslog(this.browse?.back ?? ESdsfPanel.MENU)
            return true
        }
        if (command.verb === EPrimaryCommand.AUTO) {
            const seconds = Number(command.args[0] ?? 0)
            if (seconds === 0) this.stopAuto()
            else if (seconds > MAX_AUTO_SECONDS) this.invalid(command, 'INVALID INTERVAL')
            else this.startAuto(seconds)
            this.finish()
            return true
        }
        if (command.verb === EPrimaryCommand.NONE) {
            this.openSyslog(this.browse?.back ?? ESdsfPanel.MENU)
            return true
        }
        return false
    }

    /*
        Reads the events (and the pods, for the JobIDs) and shows them as the SYSLOG. It opens at the bottom,
        where the newest lines are, and on a refresh it stays at the bottom if it was there — following the
        log — or where the operator left it if they had scrolled up.
    */
    private openSyslog = (back: ESdsfPanel): void => {
        const previous = this.browse?.syslog ? this.browse : undefined
        const wasAtBottom = !previous || previous.top >= Math.max(0, browseRows(previous.lines, this.terminal.screen.cols).length - browseHeight(this.terminal.screen))
        Promise.all([this.source.request({ command: ESdsfCommand.LIST }), this.source.request({ command: ESdsfCommand.EVENTS })])
            .then(([list, events]) => {
                if (list.ok) this.pods = list.pods ?? this.pods
                if (!events.ok) {
                    this.sayError(events)
                    return
                }
                const shown = (events.events ?? []).filter(e =>
                    sdsfPatternMatches(this.prefix, e.name) && (!this.dest || e.namespace.toLowerCase() === this.dest))
                const jobIdOf = (e: ISdsfEvent) => e.kind === 'Pod' ? this.pods.find(p => p.uid === e.uid)?.jobId ?? '' : ''
                const lines = shown.map(e => printable(syslogLine(e, this.system, jobIdOf(e))))
                const total = browseRows(lines, this.terminal.screen.cols).length
                const bottom = Math.max(0, total - browseHeight(this.terminal.screen))
                this.browse = {
                    heading: `SYSLOG ${this.system.toUpperCase().slice(0, 8).padEnd(8)} ${this.dest ? this.dest.toUpperCase().slice(0, 8) : '(ALL)'}`,
                    lines,
                    colors: shown.map(eventColor),
                    top: wasAtBottom ? bottom : Math.min(previous!.top, bottom),
                    left: previous?.left ?? 0,
                    back,
                    syslog: true
                }
                this.panel = ESdsfPanel.BROWSE
            })
            .catch(this.sayNoResponse)
            .finally(this.finish)
    }

    // ── Data ────────────────────────────────────────────────────────────────────────────────────────

    /*
        Asks for a fresh list, then runs what needed it and paints. The keyboard stays locked meanwhile. A Job
        table asks for the pods too: S and ? on a Job go to its pod.
    */
    private refresh = (after: TAfterList[]): void => {
        Promise.all(this.listRequests().map(r => this.source.request(r)))
            .then(responses => this.applyLists(responses, after))
            .catch(this.sayNoResponse)
            .finally(this.finish)
    }

    // What a table needs: a Job table the pods too (S and ? on a Job go to its pod).
    private listRequests = (): ISdsfRequest[] => {
        switch (familyOf(this.panel)) {
            case ESdsfPanel.ST:
                return [{ command: ESdsfCommand.LIST }, { command: ESdsfCommand.JOBS }]
            case ESdsfPanel.INIT:
                return [{ command: ESdsfCommand.NODES }]
            case ESdsfPanel.JC:
                return [{ command: ESdsfCommand.CLASSES }]
            case ESdsfPanel.SR:
                return [{ command: ESdsfCommand.REQUESTS }]
            default:
                return [{ command: ESdsfCommand.LIST }]
        }
    }

    private applyLists = (responses: ISdsfMessageResponse[], after: TAfterList[]): void => {
        const failed = responses.find(r => !r.ok)
        if (failed) {
            this.sayError(failed)
            return
        }
        for (const response of responses) {
            switch (response.command) {
                case ESdsfCommand.JOBS:
                    this.jobs = response.jobs ?? []
                    break
                case ESdsfCommand.NODES:
                    this.nodes = response.nodes ?? []
                    break
                case ESdsfCommand.CLASSES:
                    this.classes = response.classes ?? []
                    break
                case ESdsfCommand.REQUESTS:
                    this.requests = response.requests ?? []
                    break
                default:
                    this.pods = response.pods ?? []
                    this.metrics = response.metrics ?? ESdsfMetricsState.UNAVAILABLE
                    this.clusterCpu = response.clusterCpu
            }
        }
        for (const run of after) run()
        this.top = Math.max(0, Math.min(this.top, this.viewSize() - 1))
        if (!this.message && this.panel === ESdsfPanel.DA && this.metrics === ESdsfMetricsState.UNAVAILABLE) {
            this.say('METRICS PROVIDER NOT AVAILABLE', EMessageLevel.WARNING, "Real and CPU% need Kwirth's 'metrics' provider, which is not installed on this cluster.")
        }
    }

    private sortRows = <T extends { name: string }>(rows: T[], columns: IDaColumn<T>[], natural: (a: T, b: T) => number): T[] => {
        const now = this.now()
        const column = this.sortHeader ? findColumn(this.sortHeader, columns) : undefined
        if (!column) return rows.sort(natural)
        const sign = this.sortDescending ? -1 : 1
        return rows.sort((a, b) => {
            const x = column.sortKey(a, now)
            const y = column.sortKey(b, now)
            const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
            return sign * order || a.name.localeCompare(b.name)
        })
    }

    // The pods as the DA shows them: filtered by its parameters, PREFIX, OWNER and DEST, in the SORT order.
    view = (): ISdsfPod[] => this.sortRows(
        this.pods.filter(p =>
            daFilterMatches(this.daFilter, p) &&
            (!this.nodeFilter || p.node === this.nodeFilter) &&
            (!this.classFilter || p.priorityClass === this.classFilter) &&
            sdsfPatternMatches(this.prefix, p.name) &&
            sdsfPatternMatches(this.owner, p.owner) &&
            (!this.dest || p.namespace.toLowerCase() === this.dest)),
        [JOBNAME_COLUMN, ...DA_COLUMNS],
        (a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name))

    // The Jobs and CronJobs a Job table shows: ST all of them, O the Jobs that ended, H the CronJobs suspended.
    jobView = (): ISdsfJob[] => {
        const inPanel = (j: ISdsfJob) => {
            switch (this.panel) {
                case ESdsfPanel.INPUT:
                    return j.state === ESdsfJobState.SCHEDULED || j.state === ESdsfJobState.WAITING
                case ESdsfPanel.OUTPUT:
                    return j.kind === ESdsfObjectKind.JOB && (j.state === ESdsfJobState.COMPLETE || j.state === ESdsfJobState.FAILED)
                case ESdsfPanel.HELD:
                    return j.state === ESdsfJobState.SUSPENDED
                default:
                    return true
            }
        }
        return this.sortRows(
            this.jobs.filter(j =>
                inPanel(j) &&
                sdsfPatternMatches(this.prefix, j.name) &&
                sdsfPatternMatches(this.owner, j.owner) &&
                (!this.dest || j.namespace.toLowerCase() === this.dest)),
            [ST_JOBNAME_COLUMN, ...ST_COLUMNS],
            // Jobs before CronJobs: what ran, then what will run
            (a, b) => a.namespace.localeCompare(b.namespace) || jobKindOrder(a) - jobKindOrder(b) || a.name.localeCompare(b.name))
    }

    // The nodes INIT shows: PREFIX filters them by name; DEST and OWNER do not apply to a node.
    nodeView = (): ISdsfNode[] => this.sortRows(
        this.nodes.filter(n => sdsfPatternMatches(this.prefix, n.name)),
        [INIT_ID_COLUMN, ...INIT_COLUMNS],
        (a, b) => a.name.localeCompare(b.name))

    // The JC classes: PREFIX filters them by name. By priority, highest first, as the scheduler reads them.
    classView = (): ISdsfJobClass[] => this.sortRows(
        this.classes.filter(c => sdsfPatternMatches(this.prefix, c.name)),
        [JC_CLASS_COLUMN, ...JC_COLUMNS],
        (a, b) => b.value - a.value || a.name.localeCompare(b.name))

    // The SR requests: PREFIX filters them by name. In order of arrival, as their reply IDs.
    requestView = (): ISdsfSystemRequest[] => this.sortRows(
        this.requests.filter(r => sdsfPatternMatches(this.prefix, r.name)),
        [SR_REPLY_COLUMN, ...SR_COLUMNS],
        (a, b) => a.id.localeCompare(b.id))

    private viewSize = (): number => {
        switch (familyOf(this.panel)) {
            case ESdsfPanel.ST:
                return this.jobView().length
            case ESdsfPanel.INIT:
                return this.nodeView().length
            case ESdsfPanel.JC:
                return this.classView().length
            case ESdsfPanel.SR:
                return this.requestView().length
            default:
                return this.view().length
        }
    }

    // Every row as text: every column as shown, plus the names whole (a column may cut them). What FIND searches.
    private viewTexts = (): string[] => {
        const now = this.now()
        if (isJobTable(this.panel)) {
            const columns = [ST_JOBNAME_COLUMN, ...ST_COLUMNS]
            return this.jobView().map(j => [...columns.map(c => cell(c, j, now)), j.namespace, j.name].join(' ').toUpperCase())
        }
        if (this.panel === ESdsfPanel.INIT) {
            const columns = [INIT_ID_COLUMN, ...INIT_COLUMNS]
            return this.nodeView().map(n => [...columns.map(c => cell(c, n, now)), n.name].join(' ').toUpperCase())
        }
        if (this.panel === ESdsfPanel.JC) {
            const columns = [JC_CLASS_COLUMN, ...JC_COLUMNS]
            return this.classView().map(c => [...columns.map(col => cell(col, c, now)), c.name].join(' ').toUpperCase())
        }
        if (this.panel === ESdsfPanel.SR) {
            const columns = [SR_REPLY_COLUMN, ...SR_COLUMNS]
            return this.requestView().map(r => [...columns.map(c => cell(c, r, now)), r.name].join(' ').toUpperCase())
        }
        const columns = [JOBNAME_COLUMN, ...DA_COLUMNS]
        return this.view().map(p => [...columns.map(c => cell(c, p, now)), p.namespace, p.name].join(' ').toUpperCase())
    }

    /*
        How many rows a vertical scroll moves, from the scroll amount: PAGE, HALF, DATA (a page less one row),
        CSR (the cursor's row goes to the top, or to the bottom going up), MAX, or a number. undefined for an
        amount that is none of those (the message is already said).
    */
    private rowsFor = (amount: string, down: boolean, page: number, cursorRow: number): number | 'MAX' | undefined => {
        const onData = cursorRow >= 0 && cursorRow < page
        switch (amount) {
            case 'PAGE':
                return page
            case 'HALF':
                return Math.floor(page / 2)
            case 'DATA':
                return page - 1
            case 'CSR':
                return !onData ? page : down ? (cursorRow || page) : (page - 1 - cursorRow || page)
            case 'M':
            case 'MAX':
                return 'MAX'
            default:
                if (/^\d+$/.test(amount)) return Number(amount)
                this.say('INVALID SCROLL AMOUNT', EMessageLevel.ERROR, `'${amount}' is not PAGE, HALF, DATA, CSR, MAX or a number.`)
                return undefined
        }
    }

    private scrollBy = (amount: string, down: boolean, cursor: number): void => {
        const size = this.viewSize()
        const rows = this.rowsFor(amount, down, dataRows(this.terminal.screen), this.terminal.screen.rowOf(cursor) - ROW_FIRST_DATA)
        if (rows === undefined) return
        if (rows === 'MAX') {
            this.top = down ? Math.max(0, size - dataRows(this.terminal.screen)) : 0
            return
        }
        this.top = down ? Math.min(this.top + rows, Math.max(0, size - 1)) : Math.max(0, this.top - rows)
    }

    // PF10: a screen of columns back. PF11: to the first column that did not fit; at the last page it stays.
    private scrollLeft = (): void => {
        this.offset = offsetLeftOf(this.offset, this.terminal.screen.cols, familyColumns(familyOf(this.panel)).columns)
    }

    private scrollRight = (): void => {
        const { columns } = familyColumns(familyOf(this.panel))
        const shown = columnsFrom(this.offset, this.terminal.screen.cols, columns).length
        if (this.offset + shown < columns.length) this.offset += shown
    }

    // FIND / RFIND: the next row (every column, the full names too) that contains the text, wrapping.
    private find = (again: boolean): void => {
        if (!this.findText) {
            this.say('NO PREVIOUS FIND', EMessageLevel.ERROR, 'RFIND (PF5) repeats a FIND: there has been none yet.')
            return
        }
        const wanted = this.findText.toUpperCase()
        const texts = this.viewTexts()
        const start = again ? this.top + 1 : this.top
        for (let i = 0; i < texts.length; i++) {
            const index = (start + i) % texts.length
            if (texts[index].includes(wanted)) {
                this.top = index
                if (again && index < start) this.say('BOTTOM OF DATA REACHED', EMessageLevel.INFO, 'The search went past the last row and continued from the first.')
                return
            }
        }
        this.say('NOT FOUND', EMessageLevel.WARNING, `'${this.findText}' is not in any row.`)
    }

    // ── Browse ──────────────────────────────────────────────────────────────────────────────────────

    private browseScroll = (browse: IBrowse, amount: string, down: boolean, cursor: number): void => {
        const total = browseRows(browse.lines, this.terminal.screen.cols).length
        const rows = this.rowsFor(amount, down, browseHeight(this.terminal.screen), this.terminal.screen.rowOf(cursor) - ROW_FIRST_BROWSE)
        if (rows === undefined) return
        if (rows === 'MAX') {
            browse.top = down ? Math.max(0, total - browseHeight(this.terminal.screen)) : 0
            return
        }
        browse.top = down ? Math.min(browse.top + rows, total - 1) : Math.max(0, browse.top - rows)
    }

    // PF10/PF11: by a page of columns, half of it, the cursor's column, to the edge (MAX) or a number of them.
    private browseSideways = (browse: IBrowse, amount: string, right: boolean, cursor: number): void => {
        const width = browseWidth(this.terminal.screen)
        const widest = browse.lines.reduce((w, l) => Math.max(w, l.length), 0)
        const edge = Math.max(0, widest - width)
        let cols: number
        switch (amount) {
            case 'PAGE':
                cols = width
                break
            case 'HALF':
                cols = Math.floor(width / 2)
                break
            case 'DATA':
                cols = width - 1
                break
            case 'CSR': {
                const col = this.terminal.screen.colOf(cursor) - 1
                cols = col > 0 ? (right ? col : width - 1 - col) : width
                break
            }
            case 'M':
            case 'MAX':
                browse.left = right ? edge : 0
                return
            default:
                if (!/^\d+$/.test(amount)) {
                    this.say('INVALID SCROLL AMOUNT', EMessageLevel.ERROR, `'${amount}' is not PAGE, HALF, DATA, CSR, MAX or a number.`)
                    return
                }
                cols = Number(amount)
        }
        browse.left = right ? Math.min(browse.left + cols, edge) : Math.max(0, browse.left - cols)
    }

    // FIND in a browse: the line goes to the top and the cursor onto the text, as ISPF does; wrapping once.
    private browseFind = (browse: IBrowse, again: boolean): void => {
        if (!this.findText) {
            this.say('NO PREVIOUS FIND', EMessageLevel.ERROR, 'RFIND (PF5) repeats a FIND: there has been none yet.')
            return
        }
        const wanted = this.findText.toUpperCase()
        const lines = browse.lines
        // indices in the browse rows: line i is row i+1 (row 0 is the TOP OF DATA mark)
        const from = Math.max(0, browse.top - 1 + (again ? 1 : 0))
        for (let i = 0; i < lines.length; i++) {
            const line = (from + i) % lines.length
            const col = lines[line].toUpperCase().indexOf(wanted)
            if (col >= 0) {
                browse.top = line + 1
                if (col < browse.left || col + wanted.length > browse.left + browseWidth(this.terminal.screen)) browse.left = Math.max(0, col - 10)
                browse.found = { index: line + 1, col }
                const wrapped = line < from
                this.say(wrapped ? 'BOTTOM OF DATA REACHED' : `CHARS '${this.findText}' FOUND`.slice(0, 30), EMessageLevel.INFO,
                    wrapped ? 'The search went past the last line and continued from the first.' : '')
                return
            }
        }
        this.say('NOT FOUND', EMessageLevel.WARNING, `'${this.findText}' is not in this output.`)
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

    // A refresh the operator did not ask for: on a table or the LOG, never over a locked keyboard, a window or input.
    tick = (): void => {
        if (this.disposed || this.confirm) return
        const onLog = this.panel === ESdsfPanel.BROWSE && this.browse?.syslog === true
        if (!isTable(this.panel) && !onLog) return
        if (this.terminal.lock !== E3270Lock.NONE || this.terminal.screen.modifiedFields().length > 0) return
        this.terminal.lock = E3270Lock.SYSTEM
        this.notify()
        if (onLog) this.openSyslog(this.browse!.back)
        else this.refresh([])
    }

    // ── Paint ───────────────────────────────────────────────────────────────────────────────────────

    private paint = (): void => {
        const screen = this.terminal.screen
        screen.clear()
        const painter = new Painter(screen)
        this.npFields = []
        this.containerFields = []
        const sort = this.sortHeader ? `${this.sortHeader.toUpperCase()}/${this.sortDescending ? 'D' : 'A'}` : ''
        switch (this.panel) {
            case ESdsfPanel.MENU:
                this.fields = paintPrimaryMenu(painter, {
                    system: this.system, command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel
                })
                screen.cursor = this.fields.command + 1
                return
            case ESdsfPanel.DA: {
                const fields = paintDa(painter, {
                    system: this.system, dest: this.dest, prefix: this.prefix, owner: this.owner, sort, auto: this.auto,
                    narrow: this.nodeFilter ? `NODE=${this.nodeFilter}` : this.classFilter ? `CLASS=${this.classFilter}` : '', pods: this.view(), top: this.top, offset: this.offset, clusterCpu: this.clusterCpu,
                    command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel,
                    longMessage: this.showLong ? this.longMessage : '',
                    now: this.now()
                })
                this.tableFields(fields, f => ({ pod: f.row }))
                this.paintPending(painter)
                return
            }
            case ESdsfPanel.ST:
            case ESdsfPanel.INPUT:
            case ESdsfPanel.OUTPUT:
            case ESdsfPanel.HELD: {
                const fields = paintTable(painter, {
                    title: JOB_TITLES[this.panel] ?? '',
                    filter: filterLine(this.prefix, this.dest, this.owner, sort, this.auto),
                    fixed: ST_JOBNAME_COLUMN,
                    columns: ST_COLUMNS,
                    rows: this.jobView(),
                    top: this.top, offset: this.offset, command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel,
                    longMessage: this.showLong ? this.longMessage : '',
                    now: this.now()
                })
                this.tableFields(fields, f => ({ job: f.row }))
                this.paintPending(painter)
                return
            }
            case ESdsfPanel.INIT: {
                const fields = paintTable(painter, {
                    title: INIT_TITLE,
                    filter: filterLine(this.prefix, '', '', sort, this.auto),
                    fixed: INIT_ID_COLUMN,
                    columns: INIT_COLUMNS,
                    rows: this.nodeView(),
                    top: this.top, offset: this.offset, command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel,
                    longMessage: this.showLong ? this.longMessage : '',
                    now: this.now()
                })
                this.tableFields(fields, f => ({ node: f.row }))
                this.paintPending(painter)
                return
            }
            case ESdsfPanel.JC: {
                const fields = paintTable(painter, {
                    title: JC_TITLE,
                    filter: filterLine(this.prefix, '', '', sort, this.auto),
                    fixed: JC_CLASS_COLUMN,
                    columns: JC_COLUMNS,
                    rows: this.classView(),
                    top: this.top, offset: this.offset, command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel,
                    longMessage: this.showLong ? this.longMessage : '',
                    now: this.now()
                })
                this.tableFields(fields, f => ({ jobClass: f.row }))
                return
            }
            case ESdsfPanel.SR: {
                const fields = paintTable(painter, {
                    title: SR_TITLE,
                    filter: filterLine(this.prefix, '', '', sort, this.auto),
                    fixed: SR_REPLY_COLUMN,
                    columns: SR_COLUMNS,
                    rows: this.requestView(),
                    top: this.top, offset: this.offset, command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel,
                    longMessage: this.showLong ? this.longMessage : '',
                    now: this.now()
                })
                this.tableFields(fields, f => ({ request: f.row }))
                return
            }
            case ESdsfPanel.CONTAINERS: {
                if (!this.containersPod) return
                const fields = paintContainers(painter, {
                    pod: this.containersPod, command: this.command, scroll: this.scroll,
                    message: this.message, messageLevel: this.messageLevel
                })
                this.fields = { command: fields.command, scroll: fields.scroll }
                this.containerFields = fields.np
                screen.cursor = fields.command + 1
                return
            }
            case ESdsfPanel.BROWSE: {
                const browse = this.browse
                if (!browse) return
                this.fields = paintBrowse(painter, {
                    heading: browse.heading, lines: browse.lines, colors: browse.colors, top: browse.top, left: browse.left,
                    command: this.command, scroll: this.scroll, message: this.message, messageLevel: this.messageLevel
                })
                screen.cursor = browse.found && browse.found.index === browse.top
                    ? screen.address(ROW_FIRST_BROWSE, 1 + browse.found.col - browse.left)
                    : this.fields.command + 1
                return
            }
            case ESdsfPanel.READY:
                this.fields = { command: -1, scroll: -1 }
                this.readyField = paintReady(painter, this.ready)
                return
            default:
                return
        }
    }

    /*
        The actions waiting for confirmation: each one's letter stays on its row's NP, as on SDSF, and the
        Confirm Action window asks about the first.
    */
    private paintPending = (painter: Painter): void => {
        const current = this.confirm?.[0]
        if (!current) return
        const screen = this.terminal.screen
        for (const pending of this.confirm!) {
            const field = this.npFields.find(f => {
                const t = this.actionTargetOf(f.target)
                return t.kind === pending.target.kind && t.namespace === pending.target.namespace && t.name === pending.target.name
            })
            if (field) screen.write(field.attribute + 1, pending.command)
        }
        this.confirmField = paintConfirm(painter, current, ROW_HEADERS)
    }

    // What a table paint returns, kept for the next attention: the command line and each row's NP field.
    private tableFields = <T>(fields: ITableFields<T>, targetOf: (f: { row: T }) => ILineTarget): void => {
        this.fields = { command: fields.command, scroll: fields.scroll }
        this.npFields = fields.np.map(f => ({ attribute: f.attribute, target: targetOf(f) }))
        this.terminal.screen.cursor = fields.command + 1
    }
}
