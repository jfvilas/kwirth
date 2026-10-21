// Common mocks for v16map's unit tests.
// No infrastructure is brought up and the DGT is never reached: the v16 provider is a fake that records
// its subscribers, and the WebSocket traffic is captured with MockWs.
import { readFileSync } from 'fs'
import { join } from 'path'
import { XMLParser } from 'fast-xml-parser'
import { EInstanceMessageType } from '@kwirthmagnify/kwirth-common'
import { IProviderSubscriber } from '@kwirthmagnify/kwirth-common-back'
import { IV16MapInstanceConfig, IV16MapMessageResponse } from '../src/common/V16MapTypes'

// Fake WebSocket: it keeps every send() and offers typed views of the traffic.
export class MockWs {
    readyState = 1
    sent: string[] = []
    failing = false
    send(s: string): void {
        if (this.failing) throw new Error('socket closed')
        this.sent.push(s)
    }
    close(): void {}
    parsed(): Array<Record<string, unknown>> { return this.sent.map(s => JSON.parse(s) as Record<string, unknown>) }
    clear(): void { this.sent = [] }

    data(): IV16MapMessageResponse[] {
        return this.parsed().filter(m => m.type === EInstanceMessageType.DATA) as unknown as IV16MapMessageResponse[]
    }

    signals(): Array<Record<string, unknown>> {
        return this.parsed().filter(m => m.type === EInstanceMessageType.SIGNAL)
    }
}

/** The v16 provider as a consumer sees it: subscribe and unsubscribe, and a way to fire events. */
export class FakeV16Provider {
    subscriptions = new Map<IProviderSubscriber, unknown>()
    unsubscribed: IProviderSubscriber[] = []
    failSubscribe = false

    subscribe = async (subscriber: IProviderSubscriber, data: unknown): Promise<boolean> => {
        if (this.failSubscribe) throw new Error('feed unreachable')
        this.subscriptions.set(subscriber, data)
        return true
    }

    unsubscribe = async (subscriber: IProviderSubscriber): Promise<boolean> => {
        this.unsubscribed.push(subscriber)
        return this.subscriptions.delete(subscriber)
    }

    /** sends the event to every current subscriber, the way the provider dispatches */
    emit = (event: unknown): void => {
        for (const subscriber of this.subscriptions.keys()) subscriber.processProviderEvent('v16', event)
    }
}

/** clusterInfo with a getProvider that hands out the fake, or nothing when the provider is not installed */
export const clusterInfoWith = (provider?: FakeV16Provider) => {
    const asked: string[] = []
    return {
        asked,
        clusterInfo: {
            getProvider: (id: string, _consumer: unknown) => {
                asked.push(id)
                return id === 'v16' ? provider : undefined
            }
        }
    }
}

export const makeBackObj = () => {
    const warnings: string[] = []
    const obj = {
        logInfo: () => {},
        logWarning: (text: unknown) => { warnings.push(String(text)) },
        logError: () => {}
    }
    return { obj, warnings }
}

export const instanceConfigFor = (instance: string, data: IV16MapInstanceConfig = { v16Only: false }) => ({
    instance,
    accessKey: 'tester|permanent|cluster::::',
    data
})

/** The fixture parsed with the same options the v16 provider uses (providers/v16/src/back/Datex2.ts). */
export const fixtureSituations = (): Record<string, unknown>[] => {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true,
        parseTagValue: false,
        parseAttributeValue: false,
        trimValues: true,
        isArray: (name) => name === 'situation' || name === 'situationRecord'
    })
    const doc = parser.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'datex2-v3.xml'), 'utf-8'))
    const find = (node: unknown): Record<string, unknown>[] => {
        if (!node || typeof node !== 'object') return []
        const obj = node as Record<string, unknown>
        if (Array.isArray(obj.situation)) return obj.situation as Record<string, unknown>[]
        for (const value of Object.values(obj)) {
            const found = find(value)
            if (found.length) return found
        }
        return []
    }
    return find(doc)
}
