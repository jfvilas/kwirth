import {
    E5250Aid, E5250Lock, GEOMETRY_5250_24X80, I3270Geometry, I5250Input, I5250KeyAction, Painter5250, Screen5250, Terminal5250
} from '@jfvilas/kwirth-dce-blockterm'
import { IWrkDataSource } from './WrkDataSource'
import { EWrkCommand, EWrkError, EWrkJobStatus, EWrkMetricsState, IWrkactjobMessageResponse, IWrkContainer, IWrkJob, IWrkRequest } from './WrkactjobTypes'
import { EWrkView, IActiveJobsFields, IWrkFilter, IWrkRow, NO_FILTER, pageSizeOf, paintActiveJobs, rowsFrom, viewsFor } from './panels/ActiveJobsPanel'
import { MENU_ENTRIES, paintMainMenu, paintSignedOff } from './panels/MainMenu'
import { IClCommand, parseCl } from './panels/ClCommand'
import { rowsOf } from './panels/WrkLayout'
import { ENDJOB_PROMPT, IPromptDef, paintPrompt, PROMPTS, WRKJOB_PROMPT } from './panels/PromptPanel'
import {
    EJobAttributes, EWorkWithJob, ISpooledFileField, paintAttributes, paintMessages, paintSpooledFiles, paintWorkWithJob,
    SPOOLED_FILE_OPTIONS, WORK_WITH_JOB_OPTIONS
} from './panels/JobPanels'
import { columnsShown, controlTarget, findFrom, IBrowse, IBrowseFields, jobLogLine, linesShown, paintBrowse } from './panels/BrowsePanel'
import { qualifiedName, shortName } from './panels/JobIdentity'

export enum EWrkPanel {
    ACTIVE_JOBS = 'activejobs',    // WRKACTJOB: where the session opens (PRD D5)
    MENU = 'menu',                 // the IBM i Main Menu, adapted
    SIGNED_OFF = 'signedoff',      // after SIGNOFF: any key signs on again, at the menu
    PROMPT = 'prompt',             // a CL command prompt: ENDJOB (option 4, F4) or WRKJOB (F4)
    WORK_WITH_JOB = 'workwithjob', // option 5, WRKJOB
    ATTRIBUTES = 'attributes',     // WRKJOB 1 and 2
    MESSAGES = 'messages',         // option 7: why the job is in MSGW
    SPOOLED_FILES = 'spooledfiles',// option 8, WRKJOB 4: the containers
    BROWSE = 'browse'              // DSPSPLF (a container's log) and DSPJOBLOG (the pod's events)
}

// The options WRKACTJOB takes (the legend). Anything else typed in Opt is 'not valid'.
export const VALID_OPTIONS = ['4', '5', '7', '8']

// What the message line says when the back says no and gives no detail.
const ERROR_TEXT: Record<EWrkError, string> = {
    [EWrkError.NOT_AUTHORIZED]: 'Not authorized to the job.',
    [EWrkError.NOT_FOUND]: 'Job not found.',
    [EWrkError.BAD_REQUEST]: 'Request not valid.',
    [EWrkError.FAILED]: 'Request failed.'
}

export const ROLL_LIMIT = 'Roll up or down beyond first or last record in file.'
export const NO_METRICS = 'Metrics provider not installed: CPU figures are not available.'
export const MAX_DELAY = 999999

// A panel opened over WRKACTJOB (or the menu), with what it shows and the fields of its last paint.
interface IFrame {
    panel: EWrkPanel
    job?: IWrkJob
    prompt?: { def: IPromptDef; values: Record<string, string>; fields: Record<string, number> }
    attributes?: EJobAttributes
    browse?: IBrowse
    selection?: number                 // WRKJOB's selection field
    files?: ISpooledFileField[]        // the spooled files' option fields
    browseFields?: IBrowseFields
}

// One option typed on the list, waiting for its turn.
interface IQueued {
    option: string
    job: IWrkJob
}

/*
    One 5250 session: the terminal, the panels it shows and what they need, and the talk with the back.

    It lives in channelObject.data, not in React, so it survives switching tabs. Block mode: nothing changes on
    the screen until the operator presses an AID key, and the keyboard stays locked (X SYSTEM) until the answer
    is painted — or until the host's error message is, which keeps it locked until Reset.

    WRKACTJOB (or the menu) is the base; the job panels open over it as a stack: F12 goes back one, F3 leaves
    them all. Several options typed in one Enter run in order, top to bottom, each when the previous one is
    left; when the last is left, the list is asked for again.
*/
export class WrkSession {
    readonly terminal: Terminal5250
    private base = EWrkPanel.ACTIVE_JOBS
    private stack: IFrame[] = []
    private readonly painter: Painter5250
    private readonly system: string
    private readonly source: IWrkDataSource
    private readonly now: () => number
    private listeners = new Set<() => void>()
    private disposed = false

    // WRKACTJOB
    private jobs: IWrkJob[] = []
    private rows: IWrkRow[] = []
    private filter: IWrkFilter = NO_FILTER
    private top = 0
    private view = EWrkView.STATUS
    private clusterCpu?: number
    private statsFrom: number
    private metricsTold = false
    private fields: IActiveJobsFields = { options: [], command: -1 }
    private queue: IQueued[] = []

    // menu and messages
    private menuField = -1
    private message = ''

    constructor(system: string, source: IWrkDataSource, geometry: I3270Geometry = GEOMETRY_5250_24X80, now: () => number = Date.now) {
        this.terminal = new Terminal5250(new Screen5250(geometry))
        this.painter = new Painter5250(this.terminal.screen)
        this.system = system.toUpperCase()
        this.source = source
        this.now = now
        this.statsFrom = now()
        this.paint()
        // Nothing can be asked until Kwirth confirms the instance: until then the keyboard waits.
        this.terminal.lock = E5250Lock.SYSTEM
    }

    // The panel on the screen: the top of the stack, or the base under it.
    get panel(): EWrkPanel {
        return this.stack.length ? this.stack[this.stack.length - 1].panel : this.base
    }

    private get frame(): IFrame | undefined {
        return this.stack[this.stack.length - 1]
    }

    // ── Owner's side ────────────────────────────────────────────────────────────────────────────────

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    dispose = (): void => {
        this.listeners.clear()
        this.disposed = true
    }

    // Kwirth confirmed the instance: the first list can be asked for.
    connected = (): void => {
        if (this.disposed) return
        void this.refresh()
    }

    key = (action: I5250KeyAction): void => {
        if (this.disposed) return
        const input = this.terminal.apply(action)
        if (input) this.attention(input)
        this.notify()
    }

    private notify = (): void => {
        for (const listener of this.listeners) listener()
    }

    // ── Painting ────────────────────────────────────────────────────────────────────────────────────

    private paint = (): void => {
        const screen = this.terminal.screen
        screen.clear()
        const frame = this.frame
        if (frame) this.paintFrame(frame)
        else this.paintBase()
        this.message = ''
    }

    private paintBase = (): void => {
        const screen = this.terminal.screen
        switch (this.base) {
            case EWrkPanel.MENU:
                this.menuField = paintMainMenu(this.painter, this.system, '', this.message)
                screen.cursor = this.menuField
                break
            case EWrkPanel.SIGNED_OFF:
                paintSignedOff(this.painter, this.system)
                screen.cursor = 0
                break
            default:
                this.fields = paintActiveJobs(this.painter, {
                    system: this.system, now: this.now(), elapsedMs: this.now() - this.statsFrom, clusterCpu: this.clusterCpu,
                    activeJobs: this.jobs.length, rows: this.rows, top: this.top, view: this.view, command: '', message: this.message
                })
                screen.cursor = this.fields.options[0]?.start ?? this.fields.command
        }
    }

    private paintFrame = (frame: IFrame): void => {
        const p = this.painter
        const screen = this.terminal.screen
        const job = frame.job!
        switch (frame.panel) {
            case EWrkPanel.PROMPT: {
                const prompt = frame.prompt!
                prompt.fields = paintPrompt(p, prompt.def, prompt.values, job ? job.namespace : '', this.message)
                // on the first value still to be given, else on the first one
                const empty = prompt.def.params.find(param => !(prompt.values[param.keyword] ?? param.initial))
                screen.cursor = prompt.fields[(empty ?? prompt.def.params[0]).keyword]
                break
            }
            case EWrkPanel.WORK_WITH_JOB:
                frame.selection = paintWorkWithJob(p, job, this.system, this.message)
                screen.cursor = frame.selection
                break
            case EWrkPanel.ATTRIBUTES:
                paintAttributes(p, job, frame.attributes!, this.system)
                screen.cursor = 0
                break
            case EWrkPanel.MESSAGES:
                paintMessages(p, job, this.system)
                screen.cursor = 0
                break
            case EWrkPanel.SPOOLED_FILES:
                frame.files = paintSpooledFiles(p, job, this.message)
                screen.cursor = frame.files[0]?.start ?? 0
                break
            default:
                frame.browseFields = paintBrowse(p, frame.browse!, this.message)
                screen.cursor = frame.browseFields.control
        }
    }

    // The answer is painted: the keyboard is free again.
    private finish = (): void => {
        if (this.disposed) return
        this.paint()
        this.terminal.unlock()
        this.notify()
    }

    // The host says no: the message on the error line, the keyboard locked until Reset, the cursor on the culprit.
    private error = (text: string, cursor?: number): void => {
        if (this.disposed) return
        this.terminal.hostError(text, cursor)
        this.notify()
    }

    private errorOf = (response: IWrkactjobMessageResponse): string =>
        response.detail || ERROR_TEXT[response.error ?? EWrkError.FAILED]

    /*
        A question for the back: the keyboard waits, and the answer comes back resolved — or undefined, with
        the error already on the screen, when the back said no or never answered.
    */
    private ask = async (request: IWrkRequest): Promise<IWrkactjobMessageResponse | undefined> => {
        this.terminal.lock = E5250Lock.SYSTEM
        this.notify()
        let response: IWrkactjobMessageResponse
        try {
            response = await this.source.request(request)
        }
        catch (err) {
            this.finish()
            this.error(`Kwirth did not respond: ${err instanceof Error ? err.message : String(err)}`)
            return undefined
        }
        if (this.disposed) return undefined
        if (!response.ok) {
            this.finish()
            this.error(this.errorOf(response))
            return undefined
        }
        return response
    }

    // ── The stack ───────────────────────────────────────────────────────────────────────────────────

    private open = (frame: IFrame): void => {
        this.stack.push(frame)
        this.finish()
    }

    // F12, or Enter on a display: one panel back. Leaving the last one runs the next option typed.
    private back = (): void => {
        this.stack.pop()
        if (this.stack.length === 0) {
            this.runQueue()
            return
        }
        this.finish()
    }

    // F3: every panel and every option still waiting are left at once.
    private exitAll = (): void => {
        this.stack = []
        this.queue = []
        this.runQueue()
    }

    // ── Attention ───────────────────────────────────────────────────────────────────────────────────

    private valueOf = (input: I5250Input, start: number): string | undefined => input.fields.find(f => f.start === start)?.value

    private attention = (input: I5250Input): void => {
        const frame = this.frame
        if (frame) {
            // F3 and F12 mean the same on every job panel
            if (input.aid === E5250Aid.F3) {
                this.exitAll()
                return
            }
            if (input.aid === E5250Aid.F12) {
                this.back()
                return
            }
            switch (frame.panel) {
                case EWrkPanel.PROMPT:
                    this.promptAttention(input, frame)
                    return
                case EWrkPanel.WORK_WITH_JOB:
                    this.workWithJobAttention(input, frame)
                    return
                case EWrkPanel.SPOOLED_FILES:
                    this.spooledFilesAttention(input, frame)
                    return
                case EWrkPanel.BROWSE:
                    this.browseAttention(input, frame)
                    return
                default:
                    // the displays (attributes, messages): Enter continues
                    if (input.aid === E5250Aid.ENTER) this.back()
                    else this.error('Function key not allowed.')
                    return
            }
        }
        switch (this.base) {
            case EWrkPanel.SIGNED_OFF:
                // any key signs on again
                this.base = EWrkPanel.MENU
                this.finish()
                return
            case EWrkPanel.MENU:
                this.menuAttention(input)
                return
            default:
                this.activeJobsAttention(input)
        }
    }

    private menuAttention = (input: I5250Input): void => {
        switch (input.aid) {
            case E5250Aid.F3:
            case E5250Aid.F12:
                this.signOff()
                return
            case E5250Aid.F4:
                this.promptCommand((this.valueOf(input, this.menuField) ?? '').trim(), this.menuField)
                return
            case E5250Aid.ENTER: {
                const typed = (this.valueOf(input, this.menuField) ?? '').trim()
                const entry = MENU_ENTRIES.find(e => e.option === typed)
                this.runCommand(entry ? entry.command : typed, this.menuField)
                return
            }
            default:
                this.error('Function key not allowed.')
        }
    }

    private activeJobsAttention = (input: I5250Input): void => {
        switch (input.aid) {
            case E5250Aid.F3:
            case E5250Aid.F12:
                this.base = EWrkPanel.MENU
                this.finish()
                return
            case E5250Aid.F4:
                this.promptCommand((this.valueOf(input, this.fields.command) ?? '').trim(), this.fields.command)
                return
            case E5250Aid.F5:
                void this.refresh()
                return
            case E5250Aid.F10:
                this.statsFrom = this.now()
                void this.refresh()
                return
            case E5250Aid.F11: {
                const views = viewsFor(this.terminal.screen.cols)
                this.view = views[(views.indexOf(this.view) + 1) % views.length]
                this.finish()
                return
            }
            case E5250Aid.F7:
                this.find((this.valueOf(input, this.fields.command) ?? '').trim())
                return
            case E5250Aid.ROLL_UP:
            case E5250Aid.ROLL_DOWN:
                this.roll(input.aid === E5250Aid.ROLL_UP)
                return
            case E5250Aid.ENTER:
                this.enter(input)
                return
            default:
                this.error('Function key not allowed.')
        }
    }

    /*
        Enter on the list: every option typed is checked before any runs (the first wrong one is reported, on its
        field); then they run in order; without options, the command; without either, a refresh.
    */
    private enter = (input: I5250Input): void => {
        const typed = this.fields.options
            .map(o => ({ ...o, option: (this.valueOf(input, o.start) ?? '').trim() }))
            .filter(o => o.option !== '')
        for (const o of typed) {
            if (!VALID_OPTIONS.includes(o.option)) {
                this.error(`Option ${o.option} not valid.`, o.start)
                return
            }
            if (!o.row.job) {
                this.error(`Option ${o.option} not valid for a subsystem.`, o.start)
                return
            }
            if (o.option === '7' && o.row.job.status !== EWrkJobStatus.MSGW) {
                this.error(`No messages to display for job ${shortName(o.row.job.name)}.`, o.start)
                return
            }
        }
        if (typed.length > 0) {
            this.queue = typed.map(o => ({ option: o.option, job: o.row.job! }))
            this.runQueue()
            return
        }
        const command = (this.valueOf(input, this.fields.command) ?? '').trim()
        if (command) {
            this.runCommand(command, this.fields.command)
            return
        }
        void this.refresh()
    }

    // The next option waiting; with none left, back to the base, the list asked for again.
    private runQueue = (): void => {
        const next = this.queue.shift()
        if (!next) {
            if (this.base === EWrkPanel.ACTIVE_JOBS) void this.refresh()
            else this.finish()
            return
        }
        switch (next.option) {
            case '4':
                this.open({ panel: EWrkPanel.PROMPT, job: next.job, prompt: { def: ENDJOB_PROMPT, values: { JOB: next.job.name.toUpperCase() }, fields: {} } })
                return
            case '5':
                this.open({ panel: EWrkPanel.WORK_WITH_JOB, job: next.job })
                return
            case '7':
                this.open({ panel: EWrkPanel.MESSAGES, job: next.job })
                return
            default:
                this.open({ panel: EWrkPanel.SPOOLED_FILES, job: next.job })
        }
    }

    // ── Commands ────────────────────────────────────────────────────────────────────────────────────

    private runCommand = (text: string, field: number): void => {
        if (!text) {
            this.finish()
            return
        }
        const cl = parseCl(text)
        if (cl.error) {
            this.error(cl.error, field)
            return
        }
        switch (cl.verb) {
            case 'WRKACTJOB': {
                if (!this.keywordsOk(cl, ['SBS', 'JOB'], field)) return
                this.filter = { subsystem: cl.params.SBS ?? '', job: cl.params.JOB ?? '' }
                this.top = 0
                this.base = EWrkPanel.ACTIVE_JOBS
                void this.refresh()
                return
            }
            case 'WRKJOB': {
                if (!this.keywordsOk(cl, ['JOB'], field)) return
                const job = this.jobNamed(cl.params.JOB ?? '', field)
                if (job) this.open({ panel: EWrkPanel.WORK_WITH_JOB, job })
                return
            }
            case 'ENDJOB':
                if (!this.keywordsOk(cl, ['JOB', 'OPTION', 'DELAY'], field)) return
                void this.endJob(cl.params, undefined, () => field)
                return
            case 'SIGNOFF':
                this.signOff()
                return
            default:
                this.error(`Command ${cl.verb} in library *LIBL not found.`, field)
        }
    }

    private keywordsOk = (cl: IClCommand, allowed: string[], field: number): boolean => {
        const unknown = Object.keys(cl.params).find(k => !allowed.includes(k))
        if (unknown) this.error(`Keyword ${unknown} not valid for this command.`, field)
        return !unknown
    }

    // F4: the prompt of the command on the command line, with what was typed for it.
    private promptCommand = (text: string, field: number): void => {
        if (!text) {
            this.error('Type a command, then press F4 to prompt it.', field)
            return
        }
        const cl = parseCl(text)
        const def = PROMPTS.find(d => d.command === cl.verb)
        if (!def) {
            this.error(cl.error ?? `Command ${cl.verb} cannot be prompted here.`, field)
            return
        }
        this.open({ panel: EWrkPanel.PROMPT, prompt: { def, values: { ...cl.params }, fields: {} } })
    }

    // The job a name means: the full pod name, in any case. Several pods can share a name in different namespaces.
    private jobNamed = (name: string, field: number): IWrkJob | undefined => {
        if (!name) {
            this.error('Value for parameter JOB required.', field)
            return undefined
        }
        const found = this.jobs.filter(j => j.name.toUpperCase() === name.toUpperCase())
        if (found.length === 1) return found[0]
        this.error(found.length === 0 ? `Job ${name} not found.` : `More than one job named ${name}: select it from the list.`, field)
        return undefined
    }

    private signOff = (): void => {
        this.base = EWrkPanel.SIGNED_OFF
        this.stack = []
        this.queue = []
        this.filter = NO_FILTER
        this.top = 0
        this.finish()
    }

    // ── ENDJOB ──────────────────────────────────────────────────────────────────────────────────────

    /*
        ENDJOB, from its prompt or the command line: OPTION(*CNTRLD) gives the job DELAY seconds, *IMMED none.
        Each wrong value is reported on its field. Returns whether the job was ended.
    */
    private endJob = async (params: Record<string, string>, target: IWrkJob | undefined, fieldOf: (keyword: string) => number | undefined): Promise<boolean> => {
        const name = (params.JOB ?? '').trim()
        const job = target && name.toUpperCase() === target.name.toUpperCase() ? target : this.jobNamed(name, fieldOf('JOB') ?? -1)
        if (!job) return false
        const option = (params.OPTION || '*CNTRLD').trim()
        if (option !== '*CNTRLD' && option !== '*IMMED') {
            this.error(`Value ${option} for parameter OPTION not valid.`, fieldOf('OPTION'))
            return false
        }
        const delayText = (params.DELAY || '30').trim()
        const delay = Number(delayText)
        if (!/^\d+$/.test(delayText) || delay < 1 || delay > MAX_DELAY) {
            this.error(`Value ${delayText} for parameter DELAY not valid: 1 to ${MAX_DELAY}.`, fieldOf('DELAY'))
            return false
        }
        const response = await this.ask({ command: EWrkCommand.END, targetNamespace: job.namespace, targetName: job.name, delay, immediate: option === '*IMMED' })
        if (!response) return false
        this.message = `End of job ${qualifiedName(job)} requested.`
        if (this.stack.length === 0) void this.refresh()
        return true
    }

    // ── The job panels ──────────────────────────────────────────────────────────────────────────────

    private promptAttention = (input: I5250Input, frame: IFrame): void => {
        if (input.aid !== E5250Aid.ENTER) {
            this.error('Function key not allowed.')
            return
        }
        const prompt = frame.prompt!
        for (const param of prompt.def.params) {
            const typed = this.valueOf(input, prompt.fields[param.keyword])
            if (typed !== undefined) prompt.values[param.keyword] = typed.trim()
        }
        const fieldOf = (keyword: string) => prompt.fields[keyword]
        if (prompt.def === WRKJOB_PROMPT) {
            const job = this.jobNamed(prompt.values.JOB ?? '', fieldOf('JOB'))
            if (!job) return
            this.stack.pop()
            this.open({ panel: EWrkPanel.WORK_WITH_JOB, job })
            return
        }
        // the END answered: this prompt is done, on to whatever comes next (the message goes with it)
        void this.endJob(prompt.values, frame.job, fieldOf).then(ended => {
            if (ended && !this.disposed) this.back()
        })
    }

    private workWithJobAttention = (input: I5250Input, frame: IFrame): void => {
        if (input.aid !== E5250Aid.ENTER) {
            this.error('Function key not allowed.')
            return
        }
        const selection = (this.valueOf(input, frame.selection!) ?? '').trim()
        const job = frame.job!
        if (!selection) {
            this.finish()
            return
        }
        if (!WORK_WITH_JOB_OPTIONS.includes(selection)) {
            this.error(`Selection ${selection} not valid.`, frame.selection)
            return
        }
        switch (selection) {
            case EWorkWithJob.STATUS:
                this.open({ panel: EWrkPanel.ATTRIBUTES, job, attributes: EJobAttributes.STATUS })
                return
            case EWorkWithJob.DEFINITION:
                this.open({ panel: EWrkPanel.ATTRIBUTES, job, attributes: EJobAttributes.DEFINITION })
                return
            case EWorkWithJob.SPOOLED_FILES:
                this.open({ panel: EWrkPanel.SPOOLED_FILES, job })
                return
            default:
                void this.openJobLog(job)
        }
    }

    private spooledFilesAttention = (input: I5250Input, frame: IFrame): void => {
        if (input.aid !== E5250Aid.ENTER) {
            this.error('Function key not allowed.')
            return
        }
        const typed = (frame.files ?? [])
            .map(f => ({ ...f, option: (this.valueOf(input, f.start) ?? '').trim() }))
            .filter(f => f.option !== '')
        const wrong = typed.find(f => !SPOOLED_FILE_OPTIONS.includes(f.option))
        if (wrong) {
            this.error(`Option ${wrong.option} not valid.`, wrong.start)
            return
        }
        if (typed.length === 0) {
            this.finish()
            return
        }
        void this.openSpooledFile(frame.job!, typed[0].container)
    }

    // DSPSPLF: the container's log, read once.
    private openSpooledFile = async (job: IWrkJob, container: IWrkContainer): Promise<void> => {
        const response = await this.ask({ command: EWrkCommand.LOG, targetNamespace: job.namespace, targetName: job.name, containerName: container.name })
        if (!response) return
        this.open({ panel: EWrkPanel.BROWSE, job, browse: { title: 'Display Spooled File', label: 'File', name: container.name, lines: response.lines ?? [], top: 0, left: 0, find: '' } })
    }

    // DSPJOBLOG: the pod's events, oldest first.
    private openJobLog = async (job: IWrkJob): Promise<void> => {
        const response = await this.ask({ command: EWrkCommand.EVENTS, targetNamespace: job.namespace, targetName: job.name })
        if (!response) return
        this.open({ panel: EWrkPanel.BROWSE, job, browse: { title: 'Display Job Log', label: 'Job', name: job.name, lines: (response.events ?? []).map(jobLogLine), top: 0, left: 0, find: '' } })
    }

    private browseAttention = (input: I5250Input, frame: IFrame): void => {
        const browse = frame.browse!
        const fields = frame.browseFields!
        const screen = this.terminal.screen
        const page = linesShown(screen.rows)
        const width = columnsShown(screen.cols)
        const typedFind = this.valueOf(input, fields.find)
        if (typedFind !== undefined) browse.find = typedFind.trim()
        switch (input.aid) {
            case E5250Aid.ROLL_UP:
            case E5250Aid.ROLL_DOWN: {
                const forward = input.aid === E5250Aid.ROLL_UP
                const target = forward ? browse.top + page : browse.top - page
                if ((forward && target >= browse.lines.length) || (!forward && browse.top === 0)) this.message = ROLL_LIMIT
                else browse.top = Math.max(0, target)
                this.finish()
                return
            }
            case E5250Aid.F19:
                browse.left = Math.max(0, browse.left - Math.floor(width / 2))
                this.finish()
                return
            case E5250Aid.F20:
                browse.left += Math.floor(width / 2)
                this.finish()
                return
            case E5250Aid.F16:
                this.findInBrowse(browse, fields)
                return
            case E5250Aid.ENTER: {
                const control = (this.valueOf(input, fields.control) ?? '').trim()
                if (control) {
                    const target = controlTarget(control, browse.top, browse.lines.length, page)
                    if (target === undefined) {
                        this.error(`Control value ${control} not valid.`, fields.control)
                        return
                    }
                    browse.top = target
                    this.finish()
                    return
                }
                // a Find string typed and Enter: look for it, as F16 does
                if (typedFind !== undefined && browse.find) {
                    this.findInBrowse(browse, fields)
                    return
                }
                this.finish()
                return
            }
            default:
                this.error('Function key not allowed.')
        }
    }

    private findInBrowse = (browse: IBrowse, fields: IBrowseFields): void => {
        if (!browse.find) {
            this.error('Type the string to find, then press F16.', fields.find)
            return
        }
        const at = findFrom(browse.lines, browse.top, browse.find)
        if (at === undefined) this.message = `String ${browse.find} not found.`
        else browse.top = at
        this.finish()
    }

    // ── WRKACTJOB ───────────────────────────────────────────────────────────────────────────────────

    // F5, Enter, F10, WRKACTJOB and the end of the options: the list asked for again and painted.
    private refresh = async (): Promise<void> => {
        const kept = this.message
        const response = await this.ask({ command: EWrkCommand.LIST })
        if (!response) return
        this.jobs = response.jobs ?? []
        this.clusterCpu = response.clusterCpu
        this.rows = rowsFrom(this.jobs, this.filter)
        this.top = Math.max(0, Math.min(this.top, this.rows.length - 1))
        this.message = kept
        if (response.metrics === EWrkMetricsState.UNAVAILABLE && !this.metricsTold) {
            this.metricsTold = true
            this.message = this.message || NO_METRICS
        }
        this.finish()
    }

    private pageSize = (): number => pageSizeOf(rowsOf(this.terminal.screen))

    private roll = (forward: boolean): void => {
        const page = this.pageSize()
        const target = forward ? this.top + page : this.top - page
        if ((forward && target >= this.rows.length) || (!forward && this.top === 0)) {
            this.message = ROLL_LIMIT
        }
        else {
            this.top = Math.max(0, target)
        }
        this.finish()
    }

    /*
        F7: the list positioned at the next row (after the first one shown) whose name holds what is typed on the
        command line, wrapping round. A simplification of IBM i's Find window: the string is the command line.
    */
    private find = (text: string): void => {
        if (!text) {
            this.error('Type the string to find on the command line, then press F7.', this.fields.command)
            return
        }
        const needle = text.toUpperCase()
        const holds = (row: IWrkRow) => (row.job ? row.job.name : row.subsystem).toUpperCase().includes(needle)
        const n = this.rows.length
        for (let i = 1; i <= n; i++) {
            const at = (this.top + i) % n
            if (holds(this.rows[at])) {
                this.top = at
                this.finish()
                return
            }
        }
        this.error(`String ${text} not found.`, this.fields.command)
    }
}
