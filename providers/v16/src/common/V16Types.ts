/**
 * Types shared by the provider and whoever consumes it. Keep this file free of node and browser imports.
 */

/** Storage keys used by the provider. String unions live as enums so producer and consumer cannot drift. */
export enum EV16StorageKey {
    CONFIG = 'v16-config'
}

/** What an event carries: the whole current picture, or only what changed since the last one. */
export enum EV16EventType {
    /** First delivery to a subscriber: every situation in force, 'updated' and 'removed' empty. */
    INITIAL = 'initial',
    /** Only what changed between two polls of the feed. Never sent when nothing changed. */
    UPDATE = 'update'
}

/**
 * One DATEX2 'situation' exactly as the parser leaves it: namespace prefixes stripped, attributes
 * prefixed with '@_' (so the situation id arrives as '@_id') and every value kept as a raw string.
 * The DGT profile is large and changes between versions, so it is not modelled field by field.
 */
export type TV16Situation = Record<string, unknown>

/** An event this provider dispatches to its subscribers through processProviderEvent('v16', event). */
export interface IV16Event {
    type: EV16EventType
    /** New situations (full DATEX2 objects). On INITIAL, every situation in force. */
    added: TV16Situation[]
    /** Situations already known whose content changed. */
    updated: TV16Situation[]
    /** Ids of situations that are no longer in the feed. */
    removed: string[]
}

/** Payload a consumer passes to addSubscriber. Documented in getSubscriptionHelp. */
export interface IV16Subscription {
    /** Only V16 beacon situations. Absent or false means every situation in the feed. */
    v16Only?: boolean
}

/** Provider-wide configuration. */
export interface IV16Config {
    /** DATEX2 SituationPublication feed. */
    url: string
    /** Seconds between two polls of the feed. */
    intervalSeconds: number
}

/** A situation as the provider remembers it between polls, to be able to compute the next diff. */
export interface IV16KnownSituation {
    id: string
    /** Content hash: a change here is what makes a situation 'updated'. */
    hash: string
    /** True when the situation comes from a V16 beacon. */
    v16: boolean
    data: TV16Situation
}

/** Result of comparing one poll of the feed against the previous one. */
export interface IV16Diff {
    added: IV16KnownSituation[]
    updated: IV16KnownSituation[]
    removed: IV16KnownSituation[]
}

/** What the read-only management route reports about the provider. */
export interface IV16State {
    url: string
    intervalSeconds: number
    /** Epoch ms of the last poll that reached the feed, 0 if none yet. */
    lastPoll: number
    /** Last error while polling, empty when the last poll went fine. */
    lastError: string
    situations: number
    v16Situations: number
    subscribers: number
}

/**
 * The DGT marks a situation raised by a V16 beacon through the 'situationRecordCreationReference' of its
 * records, e.g. 'V16_8FqVfoM8bnqm-1790402082286_1'. There is no dedicated cause type for it.
 */
export const V16_REFERENCE_PREFIX = 'V16_'

/** The v36 URL answers with a permanent redirect to this one. */
export const V16_DEFAULT_URL = 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml'

export const V16_MIN_INTERVAL_SECONDS = 5

/** The feed is a few MB: a poll that has not finished by then is considered hung. */
export const V16_FETCH_TIMEOUT_MS = 30000

export const V16_DEFAULT_CONFIG: IV16Config = {
    url: V16_DEFAULT_URL,
    intervalSeconds: 60
}
