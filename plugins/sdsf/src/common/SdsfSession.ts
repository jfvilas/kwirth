import { Terminal3270 } from './terminal/Terminal3270'
import { E3270Aid, E3270Lock, I3270Input, I3270KeyAction } from './terminal/Terminal3270Types'
import { Painter } from './panels/Painter'
import { EMessageLevel } from './panels/SdsfLayout'
import { paintPrimaryMenu } from './panels/PrimaryMenu'
import { columnsFrom, DATA_ROWS, IDaFields, offsetLeftOf, paintDa, ROW_FIRST_DATA } from './panels/DaPanel'
import { cell, DA_COLUMNS, findColumn, IDaColumn, JOBNAME_COLUMN, stepNameOf } from './panels/DaColumns'
import { EPrimaryCommand, IPrimaryCommand, parsePrimaryCommand } from './panels/PrimaryCommand'
import { IReadyState, paintReady } from './panels/ReadyPanel'
import { sdsfPatternMatches } from './panels/Wildcard'
import { ELineCommand, isCancel, parseLineCommand } from './panels/LineCommand'
import { IPendingCancel, paintConfirm } from './panels/ConfirmPopup'
import { dsidOf, IContainerFields, paintContainers } from './panels/ContainersPanel'
import { BROWSE_ROWS, BROWSE_WIDTH, browseRows, paintBrowse, printable, ROW_FIRST_BROWSE } from './panels/BrowsePanel'
import { eventColor, syslogLine } from './panels/SyslogFormat'
import { ISdsfDataSource } from './SdsfDataSource'
import { ESdsfCommand, ESdsfError, ESdsfMetricsState, ISdsfContainer, ISdsfEvent, ISdsfMessageResponse, ISdsfPod, ISdsfRequest } from './SdsfTypes'
import { E3270Color } from './terminal/Terminal3270Types'

export enum ESdsfPanel {
    MENU = 'menu',
    DA = 'da',
    CONTAINERS = 'containers',     // the ? panel: the pod's containers
    BROWSE = 'browse',             // a log or a describe
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

// A line command waiting its turn, with the pod it was typed against.
interface IQueuedLine {
    command: ELineCommand
    pod: ISdsfPod
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

    Line commands run as SDSF runs them: several typed in one Enter are queued. The cancels go together
    through one CONFIRM ACTION window; the others (S, ?, D) one after the other, the next when PF3 comes back
    from the previous one.
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

    // line commands
    private queue: IQueuedLine[] = []
    private confirm?: IPendingCancel[]
    private confirmField = -1
    private containersPod?: ISdsfPod
    private containerFields: IContainerFields['np'] = []
    private browse?: IBrowse

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
            this.confirmAttention(input, (value(this.confirmField) ?? '').trim())
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

        switch (this.panel) {
            case ESdsfPanel.MENU:
                this.menuAttention(input, command)
                return
            case ESdsfPanel.DA:
                this.daAttention(input, command, value)
                return
            case ESdsfPanel.CONTAINERS:
                this.containersAttention(input, command, value)
                return
            case ESdsfPanel.BROWSE:
                this.browseAttention(input, command)
                return
            default:
                this.finish()
        }
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
            case EPrimaryCommand.LOG:
                this.openSyslog(ESdsfPanel.MENU)
                return
            case EPrimaryCommand.ST:
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

        // The line commands typed in NP, in screen order. One that SDSF does not know stops them all.
        const typedLines = this.npFields
            .map(f => ({ typed: value(f.attribute) ?? '', pod: f.pod }))
            .filter(l => l.typed.trim() !== '')
        const queue: IQueuedLine[] = []
        for (const line of typedLines) {
            const parsed = parseLineCommand(line.typed)
            if (!parsed) {
                this.say('INVALID LINE COMMAND', EMessageLevel.ERROR, `'${line.typed.trim()}' is not a line command: S, ?, D, C or CA.`)
                queue.length = 0
                break
            }
            queue.push({ command: parsed, pod: line.pod })
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
                case EPrimaryCommand.LOG:
                    this.queue = []
                    this.openSyslog(ESdsfPanel.DA)
                    return
                case EPrimaryCommand.ST:
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
        this.queue = []
        this.panel = ESdsfPanel.MENU
    }

    private toReady = (): void => {
        this.stopAuto()
        this.panel = ESdsfPanel.READY
        this.ready = { lines: ['READY'] }
    }

    // ── Line commands ───────────────────────────────────────────────────────────────────────────────

    /*
        The next thing the queue asks for. The cancels go first and all together, through the CONFIRM ACTION
        window; then S, ? and D one by one. With the queue empty, back on the DA with a fresh list.
    */
    private runQueue = (): void => {
        const cancels = this.queue.filter(q => isCancel(q.command))
        if (cancels.length > 0) {
            this.queue = this.queue.filter(q => !isCancel(q.command))
            this.confirm = cancels.map(c => ({ command: c.command as ELineCommand.CANCEL | ELineCommand.CANCEL_FORCE, pod: c.pod }))
            this.panel = ESdsfPanel.DA
            this.finish()
            return
        }
        const next = this.queue.shift()
        if (!next) {
            this.panel = ESdsfPanel.DA
            this.refresh([])
            return
        }
        switch (next.command) {
            case ELineCommand.SELECT: {
                const main = next.pod.containers.find(c => c.name === stepNameOf(next.pod))
                if (!main) {
                    this.say('NO OUTPUT', EMessageLevel.WARNING, `${next.pod.name} has no container whose log could be browsed.`)
                    this.runQueue()
                    return
                }
                this.openLog(next.pod, main, ESdsfPanel.DA)
                return
            }
            case ELineCommand.QUERY:
                this.containersPod = next.pod
                this.panel = ESdsfPanel.CONTAINERS
                this.finish()
                return
            case ELineCommand.DISPLAY:
                this.openDescribe(next.pod)
                return
            default:
                this.runQueue()
        }
    }

    private confirmAttention = (input: I3270Input, selection: string): void => {
        const pending = this.confirm ?? []
        if (input.aid === E3270Aid.PF3 || input.aid === E3270Aid.PF12 || input.aid === E3270Aid.CLEAR || selection === '2') {
            this.confirm = undefined
            this.say('ACTION CANCELLED', EMessageLevel.INFO, 'Nothing was deleted.')
            this.runQueue()
            return
        }
        if (input.aid !== E3270Aid.ENTER || selection !== '1') {
            this.say('ENTER 1 OR 2', EMessageLevel.ERROR, '1 processes the cancel, 2 (or PF3) leaves the pods alone.')
            this.finish()
            return
        }
        this.confirm = undefined
        void this.cancelAll(pending).then(this.runQueue)
    }

    // One CANCEL per pod, in order. The first refusal is what the message says; every failure goes in the long one.
    private cancelAll = async (pending: IPendingCancel[]): Promise<void> => {
        const failures: string[] = []
        let firstError: ISdsfMessageResponse | undefined
        for (const p of pending) {
            const request: ISdsfRequest = { command: ESdsfCommand.CANCEL, podNamespace: p.pod.namespace, podName: p.pod.name, force: p.command === ELineCommand.CANCEL_FORCE }
            try {
                const response = await this.source.request(request)
                if (!response.ok) {
                    firstError = firstError ?? response
                    failures.push(`${p.pod.namespace}/${p.pod.name}: ${response.detail ?? response.error}`)
                }
            }
            catch (err) {
                firstError = firstError ?? { ok: false, error: ESdsfError.FAILED, detail: err instanceof Error ? err.message : String(err) } as ISdsfMessageResponse
                failures.push(`${p.pod.namespace}/${p.pod.name}: ${err instanceof Error ? err.message : String(err)}`)
            }
        }
        if (firstError) {
            this.say(ERROR_MESSAGE[firstError.error ?? ESdsfError.FAILED], EMessageLevel.ERROR, failures.join('; '))
        }
        else {
            this.say('COMMAND ISSUED', EMessageLevel.INFO, `${pending.length} pod(s) cancelled.`)
        }
    }

    private openLog = (pod: ISdsfPod, container: ISdsfContainer, back: ESdsfPanel): void => {
        const heading = `OUTPUT DISPLAY ${pod.name.toUpperCase().slice(0, 8).padEnd(8)} ${pod.jobId}  DSID ${String(dsidOf(pod, container)).padStart(5)}`
        this.openBrowse({ command: ESdsfCommand.LOG, podNamespace: pod.namespace, podName: pod.name, containerName: container.name }, heading, back)
    }

    private openDescribe = (pod: ISdsfPod): void => {
        const heading = `DESCRIBE ${pod.name.toUpperCase().slice(0, 8).padEnd(8)} ${pod.jobId}`
        this.openBrowse({ command: ESdsfCommand.DESCRIBE, podNamespace: pod.namespace, podName: pod.name }, heading, ESdsfPanel.DA)
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
                if (this.panel !== ESdsfPanel.BROWSE && back === ESdsfPanel.DA && this.queue.length === 0) {
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
            this.panel = ESdsfPanel.DA
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
            const back = browse?.back ?? ESdsfPanel.DA
            // the automatic update belongs to the LOG: leaving it stops it, as leaving the DA does
            if (browse?.syslog) this.stopAuto()
            this.browse = undefined
            this.panel = back
            if (back === ESdsfPanel.DA) this.runQueue()
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
        them (by object name and namespace, as they filter the DA), and &nn keeps it running. Returns true
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
        const wasAtBottom = !previous || previous.top >= Math.max(0, browseRows(previous.lines).length - BROWSE_ROWS)
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
                const total = browseRows(lines).length
                const bottom = Math.max(0, total - BROWSE_ROWS)
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

    // Asks for a fresh list, then runs what needed it and paints. The keyboard stays locked meanwhile.
    private refresh = (after: TAfterList[]): void => {
        this.source.request({ command: ESdsfCommand.LIST })
            .then(response => this.applyList(response, after))
            .catch(this.sayNoResponse)
            .finally(this.finish)
    }

    private applyList = (response: ISdsfMessageResponse, after: TAfterList[]): void => {
        if (!response.ok) {
            this.sayError(response)
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
        How many rows a vertical scroll moves, from the scroll amount: PAGE, HALF, DATA (a page less one row),
        CSR (the cursor's row goes to the top, or to the bottom going up), MAX, or a number. undefined for MAX
        (the caller goes to the end) and for an amount that is none of those (the message is already said).
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

    private scrollBy = (view: ISdsfPod[], amount: string, down: boolean, cursor: number): void => {
        const rows = this.rowsFor(amount, down, DATA_ROWS, this.terminal.screen.rowOf(cursor) - ROW_FIRST_DATA)
        if (rows === undefined) return
        if (rows === 'MAX') {
            this.top = down ? Math.max(0, view.length - DATA_ROWS) : 0
            return
        }
        this.top = down ? Math.min(this.top + rows, Math.max(0, view.length - 1)) : Math.max(0, this.top - rows)
    }

    // PF11: to the first column that did not fit; at the last page it stays.
    private scrollRight = (): void => {
        const next = this.offset + columnsFrom(this.offset, this.terminal.screen.cols).length
        if (next < DA_COLUMNS.length) this.offset = next
    }

    // FIND / RFIND: the next pod whose row (every column, the full names too) contains the text, wrapping.
    private find = (view: ISdsfPod[], again: boolean): void => {
        if (!this.findText) {
            this.say('NO PREVIOUS FIND', EMessageLevel.ERROR, 'RFIND (PF5) repeats a FIND: there has been none yet.')
            return
        }
        const now = this.now()
        const wanted = this.findText.toUpperCase()
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

    // ── Browse ──────────────────────────────────────────────────────────────────────────────────────

    private browseScroll = (browse: IBrowse, amount: string, down: boolean, cursor: number): void => {
        const total = browseRows(browse.lines).length
        const rows = this.rowsFor(amount, down, BROWSE_ROWS, this.terminal.screen.rowOf(cursor) - ROW_FIRST_BROWSE)
        if (rows === undefined) return
        if (rows === 'MAX') {
            browse.top = down ? Math.max(0, total - BROWSE_ROWS) : 0
            return
        }
        browse.top = down ? Math.min(browse.top + rows, total - 1) : Math.max(0, browse.top - rows)
    }

    // PF10/PF11: by a page of columns, half of it, the cursor's column, to the edge (MAX) or a number of them.
    private browseSideways = (browse: IBrowse, amount: string, right: boolean, cursor: number): void => {
        const widest = browse.lines.reduce((w, l) => Math.max(w, l.length), 0)
        const edge = Math.max(0, widest - BROWSE_WIDTH)
        let cols: number
        switch (amount) {
            case 'PAGE':
                cols = BROWSE_WIDTH
                break
            case 'HALF':
                cols = Math.floor(BROWSE_WIDTH / 2)
                break
            case 'DATA':
                cols = BROWSE_WIDTH - 1
                break
            case 'CSR': {
                const col = this.terminal.screen.colOf(cursor) - 1
                cols = col > 0 ? (right ? col : BROWSE_WIDTH - 1 - col) : BROWSE_WIDTH
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
                if (col < browse.left || col + wanted.length > browse.left + BROWSE_WIDTH) browse.left = Math.max(0, col - 10)
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

    // A refresh the operator did not ask for: on the DA or the LOG, never over a locked keyboard, a window or input.
    tick = (): void => {
        if (this.disposed || this.confirm) return
        const onLog = this.panel === ESdsfPanel.BROWSE && this.browse?.syslog === true
        if (this.panel !== ESdsfPanel.DA && !onLog) return
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
        switch (this.panel) {
            case ESdsfPanel.MENU:
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
                if (this.confirm) this.confirmField = paintConfirm(painter, this.confirm)
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
}
