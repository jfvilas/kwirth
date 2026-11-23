import { ISdsfEvent } from '../SdsfTypes'
import { E3270Color } from '@jfvilas/kwirth-dce-blockterm'

/*
    A cluster event written as a line of the z/OS SYSLOG (reference capture SDSF.LOG):

      N INCLUSTE 26326 11:32:32.44 STC01025 00000003  Scheduled pod/shop/api-1: Successfully assigned…
      │ │        │     │           │        │         └ the reason first (it is what fits in 79 columns),
      │ │        │     │           │        │           then the object and the message
      │ │        │     │           │        └ how many times it happened (where z/OS has the message flags)
      │ │        │     │           └ the JobID of the pod it is about, blank for anything else
      │ │        │     └ time, hh:mm:ss.th, UTC (the cluster's clock, the same for every operator)
      │ │        └ date, yyddd, as JES writes it
      │ └ the system: the cluster
      └ N for Normal, W for Warning
*/

export const yydddOf = (iso: string): string => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '     '
    const start = Date.UTC(d.getUTCFullYear(), 0, 1)
    const day = Math.floor((d.getTime() - start) / 86400000) + 1
    return String(d.getUTCFullYear() % 100).padStart(2, '0') + String(day).padStart(3, '0')
}

export const timeOf = (iso: string): string => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '           '
    const two = (n: number) => String(n).padStart(2, '0')
    return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}.${two(Math.floor(d.getUTCMilliseconds() / 10))}`
}

// The reasons that mean something went wrong, whatever the event's type says.
const FAILURE = /fail|backoff|error|kill|unhealthy|evict|oom|invalid|forbidden|err/i

export const isFailure = (e: ISdsfEvent): boolean => e.type === 'Warning' && FAILURE.test(e.reason)

// Normal in green, a warning in yellow, a failure in red.
export const eventColor = (e: ISdsfEvent): E3270Color =>
    isFailure(e) ? E3270Color.RED : e.type === 'Warning' ? E3270Color.YELLOW : E3270Color.GREEN

export const syslogLine = (e: ISdsfEvent, system: string, jobId: string): string => {
    const object = `${e.kind.toLowerCase()}/${e.namespace ? e.namespace + '/' : ''}${e.name}`
    return [
        e.type === 'Warning' ? 'W' : 'N',
        system.toUpperCase().slice(0, 8).padEnd(8),
        yydddOf(e.time),
        timeOf(e.time),
        jobId.padEnd(8),
        String(e.count).padStart(8, '0'),
        ` ${e.reason} ${object}: ${e.message}`
    ].join(' ')
}
