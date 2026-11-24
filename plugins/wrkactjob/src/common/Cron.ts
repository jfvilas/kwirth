/*
    A CronJob's schedule, read the way the Kubernetes CronJob controller reads it (robfig/cron, standard parser):
    five fields — minute, hour, day of month, month, day of week — each '*', a number, a range 'a-b', a step '/n'
    on either, or a list of those; month and day names (JAN, MON); 7 is Sunday as well as 0; and the macros
    @yearly, @annually, @monthly, @weekly, @daily, @midnight and @hourly. When both day fields are restricted a
    day matches either of them, as cron has always done.

    No library: the plugin stays light, and this is all WRKJOBSCDE needs — the next run, and the words IBM i
    uses for a schedule (PRD-fase3 D16).
*/

export interface ICron {
    minutes: Set<number>
    hours: Set<number>
    days: Set<number>          // of the month, 1-31
    months: Set<number>        // 1-12
    weekdays: Set<number>      // 0-6, Sunday 0
    anyDay: boolean            // the day of month is '*' (or '?')
    anyWeekday: boolean        // the day of week is '*' (or '?')
}

const MACROS: Record<string, string> = {
    '@YEARLY': '0 0 1 1 *',
    '@ANNUALLY': '0 0 1 1 *',
    '@MONTHLY': '0 0 1 * *',
    '@WEEKLY': '0 0 * * 0',
    '@DAILY': '0 0 * * *',
    '@MIDNIGHT': '0 0 * * *',
    '@HOURLY': '0 * * * *'
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

interface IFieldSpec {
    min: number
    max: number
    names?: string[]           // index 0 is `min`
}

const FIELDS: IFieldSpec[] = [
    { min: 0, max: 59 },
    { min: 0, max: 23 },
    { min: 1, max: 31 },
    { min: 1, max: 12, names: MONTH_NAMES },
    { min: 0, max: 7, names: DAY_NAMES }
]

const valueOf = (text: string, spec: IFieldSpec): number => {
    const named = spec.names?.indexOf(text.toUpperCase()) ?? -1
    if (named >= 0) return named + spec.min
    if (!/^\d+$/.test(text)) return NaN
    return Number(text)
}

// One field as the set of values it takes; undefined when it cannot be read.
const parseField = (text: string, spec: IFieldSpec): Set<number> | undefined => {
    const values = new Set<number>()
    for (const part of text.split(',')) {
        const [range, stepText] = part.split('/')
        const step = stepText === undefined ? 1 : Number(stepText)
        if (!(Number.isInteger(step) && step > 0)) return undefined
        let from: number
        let to: number
        if (range === '*' || range === '?') {
            from = spec.min
            to = spec.max
        }
        else if (range.includes('-')) {
            const [a, b] = range.split('-')
            from = valueOf(a, spec)
            to = valueOf(b, spec)
        }
        else {
            from = valueOf(range, spec)
            // 'n/step' runs from n to the end of the field
            to = stepText === undefined ? from : spec.max
        }
        if (!(from >= spec.min && to <= spec.max && from <= to)) return undefined
        for (let v = from; v <= to; v += step) values.add(v)
    }
    return values
}

export const parseCron = (expression: string): ICron | undefined => {
    const trimmed = expression.trim()
    const expanded = MACROS[trimmed.toUpperCase()] ?? trimmed
    const parts = expanded.split(/\s+/)
    if (parts.length !== 5) return undefined
    const sets = parts.map((p, i) => parseField(p, FIELDS[i]))
    if (sets.some(s => s === undefined)) return undefined
    const [minutes, hours, days, months, weekdays] = sets as Set<number>[]
    // 7 is Sunday too
    if (weekdays.delete(7)) weekdays.add(0)
    const any = (p: string) => p === '*' || p === '?'
    return { minutes, hours, days, months, weekdays, anyDay: any(parts[2]), anyWeekday: any(parts[4]) }
}

// ─── The next run ────────────────────────────────────────────────────────────────────────────────

interface ILocal {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    weekday: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

// The wall clock of an instant in a time zone ('' is UTC, the controller's when the CronJob names none).
const localOf = (ms: number, timeZone: string): ILocal => {
    const zone = timeZone || 'UTC'
    let f = formatters.get(zone)
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' })
        formatters.set(zone, f)
    }
    const parts: Record<string, string> = {}
    for (const p of f.formatToParts(new Date(ms))) parts[p.type] = p.value
    return {
        year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
        hour: Number(parts.hour), minute: Number(parts.minute), weekday: DAY_NAMES.indexOf(parts.weekday.toUpperCase())
    }
}

export const isTimeZone = (timeZone: string): boolean => {
    if (!timeZone) return true
    try {
        new Intl.DateTimeFormat('en-US', { timeZone })
        return true
    }
    catch {
        return false
    }
}

const dayMatches = (cron: ICron, l: ILocal): boolean => {
    const byDay = cron.days.has(l.day)
    const byWeekday = cron.weekdays.has(l.weekday)
    if (cron.anyDay && cron.anyWeekday) return true
    if (cron.anyDay) return byWeekday
    if (cron.anyWeekday) return byDay
    return byDay || byWeekday
}

const MINUTE = 60_000
// Past this, no run: a schedule that never fires (31 February) gives up instead of looping.
const HORIZON_MINUTES = 5 * 366 * 24 * 60

/*
    The first minute after `from` the schedule fires, in its time zone; undefined when it never does (within five
    years) or the zone is unknown. It walks the wall clock, jumping a whole day or hour when that cannot match, and
    reads the clock again after every jump, so a change of summer time is taken as it comes.
*/
export const nextRunOf = (cron: ICron, from: number, timeZone = ''): number | undefined => {
    if (!isTimeZone(timeZone)) return undefined
    let t = Math.floor(from / MINUTE) * MINUTE + MINUTE
    const end = t + HORIZON_MINUTES * MINUTE
    while (t < end) {
        const l = localOf(t, timeZone)
        if (!cron.months.has(l.month) || !dayMatches(cron, l)) {
            t += ((23 - l.hour) * 60 + (60 - l.minute)) * MINUTE
            continue
        }
        if (!cron.hours.has(l.hour)) {
            t += (60 - l.minute) * MINUTE
            continue
        }
        if (!cron.minutes.has(l.minute)) {
            t += MINUTE
            continue
        }
        return t
    }
    return undefined
}

// ─── In IBM i's words ────────────────────────────────────────────────────────────────────────────

export enum EScheduleFrequency {
    WEEKLY = '*WEEKLY',        // on the days given (*ALL: every day), at one time
    MONTHLY = '*MONTHLY',      // on one day of the month, at one time
    CRON = '*CRON'             // anything IBM i has no words for: the expression itself (D16)
}

export interface IScheduleWords {
    frequency: EScheduleFrequency
    date: string               // *ALL, *MON, *SELECT (several days), the day of the month, or '' for *CRON
    time: string               // HH:MM:SS, or '' for *CRON
    days: string               // the days, spelt out: '*MON *WED *FRI', '*ALL' — for the details
}

const single = (s: Set<number>): number | undefined => s.size === 1 ? [...s][0] : undefined
const two = (n: number): string => String(n).padStart(2, '0')

/*
    The schedule as WRKJOBSCDE says it, when it can: one time a day (one minute, one hour), every month, and
    either every day, some days of the week (*WEEKLY), or one day of the month (*MONTHLY). Anything else is
    *CRON, shown as the expression.
*/
export const scheduleWordsOf = (cron: ICron | undefined): IScheduleWords => {
    const cronWords: IScheduleWords = { frequency: EScheduleFrequency.CRON, date: '', time: '', days: '' }
    if (!cron) return cronWords
    const minute = single(cron.minutes)
    const hour = single(cron.hours)
    if (minute === undefined || hour === undefined || cron.months.size !== 12) return cronWords
    const time = `${two(hour)}:${two(minute)}:00`
    if (cron.anyDay && cron.anyWeekday) return { frequency: EScheduleFrequency.WEEKLY, date: '*ALL', time, days: '*ALL' }
    if (cron.anyDay) {
        const days = [...cron.weekdays].sort((a, b) => a - b).map(d => '*' + DAY_NAMES[d])
        if (days.length === 7) return { frequency: EScheduleFrequency.WEEKLY, date: '*ALL', time, days: '*ALL' }
        return { frequency: EScheduleFrequency.WEEKLY, date: days.length === 1 ? days[0] : '*SELECT', time, days: days.join(' ') }
    }
    const day = single(cron.days)
    if (cron.anyWeekday && day !== undefined) return { frequency: EScheduleFrequency.MONTHLY, date: String(day), time, days: `Day ${day} of the month` }
    return cronWords
}
