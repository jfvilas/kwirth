import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkRunStatus, IWrkSchedule } from '../WrkactjobTypes'
import { EScheduleFrequency, nextRunOf, parseCron, scheduleWordsOf } from '../Cron'
import { IDisplayList } from './DisplayList'
import { leader, shortName } from './JobIdentity'
import { dateTimeOf, paintCommandLine, paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

/*
    WRKJOBSCDE, Work with Job Schedule Entries (PRD-fase3 §2.4): the CronJobs, each as a job schedule entry — held
    (HLD) when suspended, scheduled (SCD) otherwise — with its schedule in IBM i's words when it has them (D16).
*/

export enum EScheduleOption {
    HOLD = '3',
    DETAILS = '5',
    RELEASE = '6',
    LAST_SUBMISSION = '8',
    SUBMIT = '10'
}

// 4=Remove is not one of them (D14): not in the legend, and not valid. 2=Change neither: nothing is edited here.
export const SCHEDULE_OPTIONS: string[] = [EScheduleOption.HOLD, EScheduleOption.DETAILS, EScheduleOption.RELEASE, EScheduleOption.LAST_SUBMISSION, EScheduleOption.SUBMIT]

export const SCHEDULE_LEGEND_1 = '3=Hold   5=Display details   6=Release'
export const SCHEDULE_LEGEND_2 = '8=Work with last submission   10=Submit immediately'

export enum EScheduleStatus {
    SCHEDULED = 'SCD',
    HELD = 'HLD'
}

export const statusOf = (s: IWrkSchedule): EScheduleStatus => s.held ? EScheduleStatus.HELD : EScheduleStatus.SCHEDULED

export enum EScheduleView {
    SCHEDULE = 'schedule',     // status, date, time, frequency, next submit date
    NAMES = 'names',           // the subsystem, the full name and the cron expression
    WIDE = 'wide'              // 132 columns: everything at once
}

export const scheduleViewsFor = (cols: number): EScheduleView[] =>
    cols >= 132 ? [EScheduleView.WIDE] : [EScheduleView.SCHEDULE, EScheduleView.NAMES]

export const SCHEDULE_F11_LABEL: Record<EScheduleView, string> = {
    [EScheduleView.SCHEDULE]: 'F11=Display names',
    [EScheduleView.NAMES]: 'F11=Display schedule',
    [EScheduleView.WIDE]: ''
}

// MM/DD/YY of an instant, as the date columns read.
const dateOf = (ms: number | undefined): string => ms === undefined ? '' : dateTimeOf(ms).slice(0, 8)

// The next run of an entry after `now`, in its own time zone. A held entry keeps it, as IBM i keeps the date.
export const nextSubmitOf = (s: IWrkSchedule, now: number): number | undefined => {
    const cron = parseCron(s.schedule)
    return cron ? nextRunOf(cron, now, s.timeZone) : undefined
}

// The schedule columns: date, time and frequency in IBM i's words, or the expression across date and time (*CRON).
export const scheduleColumnsOf = (s: IWrkSchedule): { date: string; time: string; frequency: string } => {
    const words = scheduleWordsOf(parseCron(s.schedule))
    if (words.frequency === EScheduleFrequency.CRON) return { date: s.schedule, time: '', frequency: EScheduleFrequency.CRON }
    return { date: words.date, time: words.time, frequency: words.frequency }
}

// ─── Layout ──────────────────────────────────────────────────────────────────────────────────────

// Two legend lines and two heading lines, so the list starts lower than on the other list panels.
const INSTRUCTIONS = 3
const LEGEND = 4
const HEADINGS = 7
const FIRST = 9

export const schedulePageSizeOf = (screenRows: number): number => rowsOf({ rows: screenRows }).lastData - FIRST + 1

const OPT_COL = 2
const JOB_COL = 6
const STATUS_COL = 18
const DATE_COL = 26
const TIME_COL = 36
const FREQUENCY_COL = 46
const NEXT_COL = 58

export interface IScheduleEntriesState {
    system: string
    now: number
    schedules: IWrkSchedule[]
    top: number
    view: EScheduleView
    message: string
}

export interface IScheduleEntriesFields {
    options: { start: number; schedule: IWrkSchedule }[]
    command: number
}

// The schedule part of a row, from the Status column on.
const scheduleText = (s: IWrkSchedule, now: number): string => {
    const c = scheduleColumnsOf(s)
    const status = statusOf(s).padEnd(DATE_COL - STATUS_COL - 2)
    if (c.frequency === EScheduleFrequency.CRON) {
        const expression = c.date.slice(0, FREQUENCY_COL - DATE_COL - 2).padEnd(FREQUENCY_COL - DATE_COL)
        return `${status}  ${expression}${c.frequency.padEnd(NEXT_COL - FREQUENCY_COL)}${dateOf(nextSubmitOf(s, now))}`
    }
    return `${status}  ${c.date.slice(0, 8).padEnd(TIME_COL - DATE_COL)}${c.time.padEnd(FREQUENCY_COL - TIME_COL)}${c.frequency.padEnd(NEXT_COL - FREQUENCY_COL)}${dateOf(nextSubmitOf(s, now))}`
}

// Narrow enough for the cron expression to fit after them at 80 columns.
const NAMESPACE_WIDTH = 16
const NAME_WIDTH = 24

const namesText = (s: IWrkSchedule, width: number): string =>
    `${s.namespace.slice(0, NAMESPACE_WIDTH).padEnd(NAMESPACE_WIDTH)}  ${s.name.slice(0, NAME_WIDTH).padEnd(NAME_WIDTH)}  ${s.schedule}`.slice(0, width)

export const paintScheduleEntries = (p: Painter5250, state: IScheduleEntriesState): IScheduleEntriesFields => {
    const screen = p.screen
    const rows = rowsOf(screen)
    paintTitle(p, 'Work with Job Schedule Entries', state.system, rows.title)
    paintRight(p, rows.date, dateTimeOf(state.now))
    p.text(INSTRUCTIONS, 1, 'Type options, press Enter.', E5250Attribute.BLUE, true)
    p.text(LEGEND, 3, SCHEDULE_LEGEND_1, E5250Attribute.BLUE, true)
    p.text(LEGEND + 1, 3, SCHEDULE_LEGEND_2, E5250Attribute.BLUE, true)

    const schedule = state.view !== EScheduleView.NAMES
    const namesCol = state.view === EScheduleView.WIDE ? NEXT_COL + 10 : STATUS_COL
    if (schedule) {
        p.text(HEADINGS - 1, DATE_COL, '-----Schedule------', E5250Attribute.WHITE, true)
        p.text(HEADINGS - 1, NEXT_COL, 'Next', E5250Attribute.WHITE, true)
        p.text(HEADINGS, 1, 'Opt  Job         Status  Date      Time      Frequency   Submit', E5250Attribute.WHITE, true)
    }
    else {
        p.text(HEADINGS, 1, 'Opt  Job', E5250Attribute.WHITE, true)
    }
    if (!schedule || state.view === EScheduleView.WIDE) p.text(HEADINGS, namesCol, `${'Subsystem'.padEnd(NAMESPACE_WIDTH)}  ${'Name'.padEnd(NAME_WIDTH)}  Cron`, E5250Attribute.WHITE, true)

    const fields: IScheduleEntriesFields = { options: [], command: -1 }
    const page = state.schedules.slice(state.top, state.top + schedulePageSizeOf(screen.rows))
    page.forEach((s, i) => {
        const r = FIRST + i
        fields.options.push({ start: p.input(r, OPT_COL, 2), schedule: s })
        p.text(r, JOB_COL, shortName(s.name), E5250Attribute.GREEN, true)
        if (schedule) p.text(r, STATUS_COL, scheduleText(s, state.now), E5250Attribute.GREEN, true)
        if (!schedule || state.view === EScheduleView.WIDE) p.text(r, namesCol, namesText(s, screen.cols - namesCol - 1), E5250Attribute.GREEN, true)
        // a held entry stands out, as a job in MSGW does
        if (schedule && s.held) p.text(r, STATUS_COL, EScheduleStatus.HELD, E5250Attribute.WHITE, true)
    })
    if (state.schedules.length === 0) p.text(FIRST, JOB_COL, '(No job schedule entries)', E5250Attribute.BLUE, true)
    paintRight(p, rows.more, state.top + schedulePageSizeOf(screen.rows) < state.schedules.length ? 'More...' : 'Bottom')

    fields.command = paintCommandLine(p, rows, 'Parameters or command', '')
    paintKeys(p, rows, ['F3=Exit', 'F5=Refresh', SCHEDULE_F11_LABEL[state.view], 'F12=Cancel'].filter(Boolean), [])
    paintMessage(p, rows, state.message)
    return fields
}

// ─── Display details (5) ─────────────────────────────────────────────────────────────────────────

const LABEL = 30

const RUN_STATUS: Record<EWrkRunStatus, string> = {
    [EWrkRunStatus.RUNNING]: 'ACTIVE',
    [EWrkRunStatus.SUCCEEDED]: 'COMPLETED',
    [EWrkRunStatus.FAILED]: 'FAILED'
}

const at = (iso: string): string => iso ? dateTimeOf(new Date(iso).getTime()) : ''

export const scheduleDetailsOf = (s: IWrkSchedule, now: number): IDisplayList => {
    const words = scheduleWordsOf(parseCron(s.schedule))
    const next = nextSubmitOf(s, now)
    const field = (label: string, value: string) => leader(label, LABEL) + value
    return {
        title: 'Display Job Schedule Entry Details',
        header: `Job:   ${shortName(s.name).padEnd(10)}   Subsystem:   ${s.namespace}`,
        headings: '',
        top: 0,
        lines: [
            field('Job schedule entry', s.name),
            field('Status', statusOf(s)),
            field('Schedule (cron)', s.schedule),
            field('Time zone', s.timeZone || '*SYS (the controller\'s, UTC)'),
            field('Frequency', words.frequency),
            ...(words.frequency === EScheduleFrequency.CRON ? [] : [field('Schedule days', words.days), field('Schedule time', words.time)]),
            field('Next submit date', next === undefined ? '*NONE' : dateTimeOf(next)),
            field('Concurrency', s.concurrencyPolicy),
            field('Program', s.program ? 'PGM-' + s.program : ''),
            field('User', s.user || 'DEFAULT'),
            field('Created', at(s.created)),
            field('Last submitted', at(s.lastScheduled) || '*NONE'),
            field('Last completed', at(s.lastSuccessful) || '*NONE'),
            '',
            'Submissions:',
            ...(s.runs.length === 0
                ? ['  *NONE']
                : s.runs.map(r => `  ${r.job.slice(0, 34).padEnd(34)}  ${at(r.started).padEnd(18)}  ${RUN_STATUS[r.status].padEnd(9)}${r.manual ? '  (submitted)' : ''}`))
        ]
    }
}
