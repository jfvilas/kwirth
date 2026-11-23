import type { CoreV1Event } from '@kubernetes/client-node'
import { IWrkEvent } from '../common/WrkactjobTypes'

// When it last happened: the field depends on which API version wrote the event.
const timeOf = (e: CoreV1Event): string => {
    const t = e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp ?? e.metadata?.creationTimestamp
    return t ? new Date(t).toISOString() : ''
}

// One event about a pod, as a line of its job log.
export const mapEvent = (e: CoreV1Event): IWrkEvent => ({
    time: timeOf(e),
    type: e.type ?? '',
    reason: e.reason ?? '',
    message: (e.message ?? '').replace(/\s+/g, ' ').trim(),
    count: e.count ?? (e.series?.count ?? 1),
    source: e.source?.component ?? e.reportingComponent ?? ''
})

// Oldest first, as a job log reads.
export const sortEvents = (events: IWrkEvent[]): IWrkEvent[] =>
    [...events].sort((a, b) => a.time.localeCompare(b.time))
