import { EV16MapPayload, IV16MapInstanceConfig, IV16MapMessageResponse, IV16Point } from '../common/V16MapTypes'

export interface IV16MapData {
    /** situations in force, by id. It lives in the channel object so a tab switch does not lose it */
    points: Record<string, IV16Point>
    /** epoch ms of the last message, 0 until the first snapshot arrives */
    lastUpdate: number
    /** what the last CHANGES message brought, for the header */
    lastChanges: { added: number, updated: number, removed: number }
    signals: string[]
    started: boolean
    selectedId?: string
}

export class V16MapData implements IV16MapData {
    points: Record<string, IV16Point> = {}
    lastUpdate = 0
    lastChanges = { added: 0, updated: 0, removed: 0 }
    signals: string[] = []
    started = false
    selectedId?: string
}

export class V16MapInstanceConfig implements IV16MapInstanceConfig {
    v16Only = false
}

/** Folds one message from the back end into the tab's picture. */
export const applyMessage = (data: IV16MapData, msg: IV16MapMessageResponse): void => {
    if (msg.payloadType === EV16MapPayload.SNAPSHOT) data.points = {}
    for (const p of [...msg.added, ...msg.updated]) data.points[p.id] = p
    for (const id of msg.removed) delete data.points[id]
    if (data.selectedId && !data.points[data.selectedId]) data.selectedId = undefined
    data.lastUpdate = msg.at
    if (msg.payloadType === EV16MapPayload.CHANGES) {
        data.lastChanges = { added: msg.added.length, updated: msg.updated.length, removed: msg.removed.length }
    }
}

/** 'vehicleObstruction' → 'Vehicle obstruction' */
export const humanize = (text?: string): string => {
    if (!text) return ''
    const spaced = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const placeOf = (p: IV16Point): string =>
    [p.road && `${p.road}${p.km ? ` km ${Number(p.km).toFixed(1)}` : ''}`, p.municipality, p.province].filter(Boolean).join(' · ')
