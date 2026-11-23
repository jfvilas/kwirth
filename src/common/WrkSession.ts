import {
    E5250Aid, E5250Lock, GEOMETRY_5250_24X80, I3270Geometry, I5250Input, I5250KeyAction, Painter5250, Screen5250, Terminal5250
} from '@jfvilas/kwirth-dce-blockterm'
import { IWrkDataSource } from './WrkDataSource'
import { EWrkCommand, EWrkError, EWrkMetricsState, IWrkactjobMessageResponse, IWrkJob } from './WrkactjobTypes'
import { EWrkView, IActiveJobsFields, IWrkFilter, IWrkRow, NO_FILTER, pageSizeOf, paintActiveJobs, rowsFrom, viewsFor } from './panels/ActiveJobsPanel'
import { MENU_ENTRIES, paintMainMenu, paintSignedOff } from './panels/MainMenu'
import { parseCl } from './panels/ClCommand'
import { rowsOf } from './panels/WrkLayout'

export enum EWrkPanel {
    ACTIVE_JOBS = 'activejobs',    // WRKACTJOB: where the session opens (PRD D5)
    MENU = 'menu',                 // the IBM i Main Menu, adapted
    SIGNED_OFF = 'signedoff'       // after SIGNOFF: any key signs on again, at the menu
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

/*
    One 5250 session: the terminal, the panel it shows and what the panel needs, and the talk with the back.

    It lives in channelObject.data, not in React, so it survives switching tabs. Block mode: nothing changes on
    the screen until the operator presses an AID key, and the keyboard stays locked (X SYSTEM) until the
    answer is painted — or until the host's error message is, which keeps it locked until Reset.
*/
export class WrkSession {
    readonly terminal: Terminal5250
    panel = EWrkPanel.ACTIVE_JOBS
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
        switch (this.panel) {
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
        this.message = ''
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

    // ── Attention ───────────────────────────────────────────────────────────────────────────────────

    private attention = (input: I5250Input): void => {
        switch (this.panel) {
            case EWrkPanel.SIGNED_OFF:
                // any key signs on again
                this.panel = EWrkPanel.MENU
                this.finish()
                return
            case EWrkPanel.MENU:
                this.menuAttention(input)
                return
            default:
                this.activeJobsAttention(input)
        }
    }

    private valueOf = (input: I5250Input, start: number): string | undefined => input.fields.find(f => f.start === start)?.value

    private menuAttention = (input: I5250Input): void => {
        switch (input.aid) {
            case E5250Aid.F3:
            case E5250Aid.F12:
                this.signOff()
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
                this.panel = EWrkPanel.MENU
                this.finish()
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

    // Enter: the options typed first (all of them checked before any runs), then the command, else a refresh.
    private enter = (input: I5250Input): void => {
        const typed = this.fields.options
            .map(o => ({ ...o, option: (this.valueOf(input, o.start) ?? '').trim() }))
            .filter(o => o.option !== '')
        const wrong = typed.find(o => !VALID_OPTIONS.includes(o.option))
        if (wrong) {
            this.error(`Option ${wrong.option} not valid.`, wrong.start)
            return
        }
        if (typed.length > 0) {
            // S5 runs them: until then the panel says so, and the options stay typed.
            this.error(`Option ${typed[0].option} not available yet.`, typed[0].start)
            return
        }
        const command = (this.valueOf(input, this.fields.command) ?? '').trim()
        if (command) {
            this.runCommand(command, this.fields.command)
            return
        }
        void this.refresh()
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
                const unknown = Object.keys(cl.params).find(k => k !== 'SBS' && k !== 'JOB')
                if (unknown) {
                    this.error(`Keyword ${unknown} not valid for this command.`, field)
                    return
                }
                this.filter = { subsystem: cl.params.SBS ?? '', job: cl.params.JOB ?? '' }
                this.top = 0
                this.panel = EWrkPanel.ACTIVE_JOBS
                void this.refresh()
                return
            }
            case 'SIGNOFF':
                this.signOff()
                return
            default:
                this.error(`Command ${cl.verb} in library *LIBL not found.`, field)
        }
    }

    private signOff = (): void => {
        this.panel = EWrkPanel.SIGNED_OFF
        this.filter = NO_FILTER
        this.top = 0
        this.finish()
    }

    // ── WRKACTJOB ───────────────────────────────────────────────────────────────────────────────────

    // F5, Enter, F10 and WRKACTJOB: the list asked for again and painted; the keyboard waits meanwhile.
    private refresh = async (): Promise<void> => {
        this.terminal.lock = E5250Lock.SYSTEM
        this.notify()
        let response: IWrkactjobMessageResponse
        try {
            response = await this.source.request({ command: EWrkCommand.LIST })
        }
        catch (err) {
            this.finish()
            this.error(`Kwirth did not respond: ${err instanceof Error ? err.message : String(err)}`)
            return
        }
        if (this.disposed) return
        if (!response.ok) {
            this.finish()
            this.error(this.errorOf(response))
            return
        }
        this.jobs = response.jobs ?? []
        this.clusterCpu = response.clusterCpu
        this.rows = rowsFrom(this.jobs, this.filter)
        this.top = Math.max(0, Math.min(this.top, this.rows.length - 1))
        if (response.metrics === EWrkMetricsState.UNAVAILABLE && !this.metricsTold) {
            this.metricsTold = true
            this.message = NO_METRICS
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
