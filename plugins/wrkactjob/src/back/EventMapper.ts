import type { CoreV1Event } from '@kubernetes/client-node'
import { IWrkEvent, IWrkMessage } from '../common/WrkactjobTypes'

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

// A Warning event as a message of QSYSOPR (PRD-fase3 §2.3), with what it is about.
export const mapMessage = (e: CoreV1Event): IWrkMessage => {
    const first = e.firstTimestamp ?? e.eventTime ?? e.metadata?.creationTimestamp
    return {
        ...mapEvent(e),
        namespace: e.involvedObject?.namespace ?? e.metadata?.namespace ?? '',
        kind: e.involvedObject?.kind ?? '',
        object: e.involvedObject?.name ?? '',
        firstTime: first ? new Date(first).toISOString() : ''
    }
}

// Newest first, as DSPMSG shows a message queue.
export const sortMessages = (messages: IWrkMessage[]): IWrkMessage[] =>
    [...messages].sort((a, b) => b.time.localeCompare(a.time))
