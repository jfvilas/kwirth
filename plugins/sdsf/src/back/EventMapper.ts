import type { CoreV1Event } from '@kubernetes/client-node'
import { ISdsfEvent } from '../common/SdsfTypes'

// The most the LOG panel gets in one read: the newest ones. A busy cluster keeps thousands.
export const MAX_EVENTS = 2000

// When it last happened: the field depends on which API version wrote the event.
const timeOf = (e: CoreV1Event): string => {
    const t = e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp ?? e.metadata?.creationTimestamp
    return t ? new Date(t).toISOString() : ''
}

export const mapEvent = (e: CoreV1Event): ISdsfEvent => ({
    time: timeOf(e),
    type: e.type ?? '',
    reason: e.reason ?? '',
    message: (e.message ?? '').replace(/\s+/g, ' ').trim(),
    namespace: e.involvedObject?.namespace ?? e.metadata?.namespace ?? '',
    kind: e.involvedObject?.kind ?? '',
    name: e.involvedObject?.name ?? '',
    uid: e.involvedObject?.uid ?? '',
    count: e.count ?? (e.series?.count ?? 1),
    source: e.source?.component ?? e.reportingComponent ?? ''
})

// Oldest first, as a log reads, and only the newest MAX_EVENTS of them.
export const sortEvents = (events: ISdsfEvent[]): ISdsfEvent[] =>
    [...events].sort((a, b) => a.time.localeCompare(b.time)).slice(-MAX_EVENTS)
