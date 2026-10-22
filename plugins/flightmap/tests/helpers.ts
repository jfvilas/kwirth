// Common mocks for flightmap's unit tests.
// No infrastructure is brought up and OpenSky is never reached: the flight-status provider is a fake
// that records its subscribers, and the WebSocket traffic is captured with MockWs.
import { EInstanceMessageType } from '@kwirthmagnify/kwirth-common'
import { IProviderSubscriber } from '@kwirthmagnify/kwirth-common-back'
import { IAircraft, IFlightMapInstanceConfig, IFlightMapMessageResponse } from '../src/common/FlightMapTypes'

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

    data(): IFlightMapMessageResponse[] {
        return this.parsed().filter(m => m.type === EInstanceMessageType.DATA) as unknown as IFlightMapMessageResponse[]
    }

    signals(): Array<Record<string, unknown>> {
        return this.parsed().filter(m => m.type === EInstanceMessageType.SIGNAL)
    }
}

/** The flight-status provider as a consumer sees it: subscribe and unsubscribe, and a way to fire events. */
export class FakeFlightStatusProvider {
    subscriptions = new Map<IProviderSubscriber, unknown>()
    unsubscribed: IProviderSubscriber[] = []
    failSubscribe = false

    subscribe = async (subscriber: IProviderSubscriber, data: unknown): Promise<boolean> => {
        if (this.failSubscribe) throw new Error('invalid bbox')
        this.subscriptions.set(subscriber, data)
        return true
    }

    unsubscribe = async (subscriber: IProviderSubscriber): Promise<boolean> => {
        this.unsubscribed.push(subscriber)
        return this.subscriptions.delete(subscriber)
    }

    emit = (event: unknown): void => {
        for (const subscriber of this.subscriptions.keys()) subscriber.processProviderEvent('flight-status', event)
    }
}

/** clusterInfo with a getProvider that hands out the fake, or nothing when the provider is not installed */
export const clusterInfoWith = (provider?: FakeFlightStatusProvider) => {
    const asked: string[] = []
    return {
        asked,
        clusterInfo: {
            getProvider: (id: string, _consumer: unknown) => {
                asked.push(id)
                return id === 'flight-status' ? provider : undefined
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

export const MADRID: IFlightMapInstanceConfig = {
    bbox: { lamin: 39.8, lomin: -4.4, lamax: 41.0, lomax: -3.0 },
    intervalSec: 60,
    watch: ['IBE3171']
}

export const instanceConfigFor = (instance: string, data: IFlightMapInstanceConfig = MADRID) => ({
    instance,
    accessKey: 'tester|permanent|cluster::::',
    data
})

export const aircraft = (icao24: string, over: Partial<IAircraft> = {}): IAircraft => ({
    icao24,
    callsign: icao24.toUpperCase(),
    lat: 40.4,
    lon: -3.7,
    onGround: false,
    lastContact: 1700000000,
    source: 'opensky',
    ...over
})

/** A positions event the way flight-status sends it, from its README. */
export const positions = (list: IAircraft[], timestamp = '2026-09-26T10:00:00.000Z') =>
    ({ type: 'positions', timestamp, bbox: MADRID.bbox, aircraft: list })
