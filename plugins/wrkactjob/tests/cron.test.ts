import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EScheduleFrequency, isTimeZone, nextRunOf, parseCron, scheduleWordsOf } from '../src/common/Cron'

const utc = (s: string): number => new Date(s).getTime()
const next = (expression: string, from: string, timeZone = ''): string | undefined => {
    const cron = parseCron(expression)
    assert.ok(cron, `${expression} parses`)
    const t = nextRunOf(cron!, utc(from), timeZone)
    return t === undefined ? undefined : new Date(t).toISOString()
}

test('parseCron: fields, lists, ranges, steps, names, 7 as Sunday, macros; nonsense is undefined', () => {
    const c = parseCron('*/15 9-17 * JAN,jul mon-fri')!
    assert.deepEqual([...c.minutes], [0, 15, 30, 45])
    assert.deepEqual([...c.hours], [9, 10, 11, 12, 13, 14, 15, 16, 17])
    assert.deepEqual([...c.months], [1, 7])
    assert.deepEqual([...c.weekdays], [1, 2, 3, 4, 5])
    assert.equal(c.anyDay, true)
    assert.equal(c.anyWeekday, false)
    assert.deepEqual([...parseCron('0 0 * * 7')!.weekdays], [0])
    assert.deepEqual([...parseCron('5/20 * * * *')!.minutes], [5, 25, 45], "'n/step' runs to the end")
    assert.deepEqual([...parseCron('0 0 1-10/3 * ?')!.days], [1, 4, 7, 10])
    assert.equal(parseCron('0 0 * * ?')!.anyWeekday, true)
    assert.deepEqual([...parseCron('@hourly')!.minutes], [0])
    assert.equal(parseCron('@WEEKLY')!.weekdays.has(0), true)
    for (const bad of ['', '* * * *', '* * * * * *', '60 * * * *', '* 24 * * *', '* * 0 * *', '* * * 13 *', '*/0 * * * *', '5-1 * * * *', 'x * * * *', '* * * FOO *', '@reboot']) {
        assert.equal(parseCron(bad), undefined, bad)
    }
})

test('nextRunOf: the first minute after, in UTC when no zone is given', () => {
    assert.equal(next('* * * * *', '2026-11-24T10:00:30Z'), '2026-11-24T10:01:00.000Z')
    assert.equal(next('0 2 * * *', '2026-11-24T10:00:00Z'), '2026-11-25T02:00:00.000Z')
    assert.equal(next('0 2 * * *', '2026-11-24T01:59:00Z'), '2026-11-24T02:00:00.000Z')
    assert.equal(next('30 */6 * * *', '2026-11-24T06:31:00Z'), '2026-11-24T12:30:00.000Z')
    assert.equal(next('0 9 * * MON-FRI', '2026-11-27T10:00:00Z'), '2026-11-30T09:00:00.000Z', 'Friday after nine: Monday')
    assert.equal(next('0 0 1 * *', '2026-11-24T00:00:00Z'), '2026-12-01T00:00:00.000Z')
    assert.equal(next('0 0 29 2 *', '2026-11-24T00:00:00Z'), '2028-02-29T00:00:00.000Z', 'the next leap day')
    assert.equal(next('0 0 30 2 *', '2026-11-24T00:00:00Z'), undefined, 'never')
})

test('nextRunOf: both day fields restricted match either, as cron does', () => {
    // the 1st of the month or any Monday
    assert.equal(next('0 0 1 * MON', '2026-11-24T00:00:00Z'), '2026-11-30T00:00:00.000Z')
    assert.equal(next('0 0 1 * MON', '2026-11-30T00:00:00Z'), '2026-12-01T00:00:00.000Z')
})

test('nextRunOf: in the CronJob\'s time zone, through the summer time change; an unknown zone gives none', () => {
    assert.equal(next('0 2 * * *', '2026-11-24T10:00:00Z', 'Europe/Madrid'), '2026-11-25T01:00:00.000Z', 'CET is UTC+1')
    assert.equal(next('0 2 * * *', '2026-07-01T10:00:00Z', 'Europe/Madrid'), '2026-07-02T00:00:00.000Z', 'CEST is UTC+2')
    // 29 March 2026: 02:00 does not exist in Madrid, the next 02:00 is on the 30th
    assert.equal(next('0 2 * * *', '2026-03-28T12:00:00Z', 'Europe/Madrid'), '2026-03-30T00:00:00.000Z')
    assert.equal(next('30 9 * * *', '2026-11-24T00:00:00Z', 'America/New_York'), '2026-11-24T14:30:00.000Z')
    assert.equal(next('* * * * *', '2026-11-24T00:00:00Z', 'Mars/Olympus'), undefined)
    assert.equal(isTimeZone(''), true)
    assert.equal(isTimeZone('Europe/Madrid'), true)
    assert.equal(isTimeZone('Mars/Olympus'), false)
})

test('scheduleWordsOf, D16: *WEEKLY, *MONTHLY or *CRON', () => {
    const words = (e: string) => scheduleWordsOf(parseCron(e))
    assert.deepEqual(words('0 2 * * *'), { frequency: EScheduleFrequency.WEEKLY, date: '*ALL', time: '02:00:00', days: '*ALL' })
    assert.deepEqual(words('@daily'), { frequency: EScheduleFrequency.WEEKLY, date: '*ALL', time: '00:00:00', days: '*ALL' })
    assert.deepEqual(words('15 6 * * 1'), { frequency: EScheduleFrequency.WEEKLY, date: '*MON', time: '06:15:00', days: '*MON' })
    assert.deepEqual(words('15 6 * * 1-5'), { frequency: EScheduleFrequency.WEEKLY, date: '*SELECT', time: '06:15:00', days: '*MON *TUE *WED *THU *FRI' })
    assert.deepEqual(words('0 23 * * 0-6'), { frequency: EScheduleFrequency.WEEKLY, date: '*ALL', time: '23:00:00', days: '*ALL' })
    assert.deepEqual(words('0 0 15 * *'), { frequency: EScheduleFrequency.MONTHLY, date: '15', time: '00:00:00', days: 'Day 15 of the month' })
    for (const e of ['*/5 * * * *', '0 */2 * * *', '0 9,17 * * *', '0 0 1 1 *', '0 0 1,15 * *', '0 0 1 * MON']) {
        assert.equal(words(e).frequency, EScheduleFrequency.CRON, e)
    }
    assert.equal(scheduleWordsOf(undefined).frequency, EScheduleFrequency.CRON)
})
