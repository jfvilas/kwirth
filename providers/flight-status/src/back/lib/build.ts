import { IFlightStatusConfig } from '../../common/FlightStatus'
import { FlightProvider } from './flightProvider'
import { IQuotaManager } from './quota'
import { AeroApiSource } from './sources/aeroapi'
import { AviationStackSource } from './sources/aviationstack'
import { OpenSkySource } from './sources/opensky'
import { IFlightSource } from './types'

/*
    Builds the FlightProvider from the configuration. The quota comes from outside so that it survives
    configuration changes: reconfiguring must not hand out quota for free.
*/
export const buildFlightProvider = (cfg: IFlightStatusConfig, quota: IQuotaManager): FlightProvider => {
    const sources: IFlightSource[] = [
        new OpenSkySource({
            clientId: cfg.opensky.clientId || undefined,
            clientSecret: cfg.opensky.clientSecret || undefined,
            dailyCredits: cfg.opensky.dailyCredits > 0 ? cfg.opensky.dailyCredits : undefined,
        }),
    ]
    if (cfg.aviationstack.enabled && cfg.aviationstack.accessKey) {
        sources.push(new AviationStackSource({ accessKey: cfg.aviationstack.accessKey, monthlyRequests: cfg.aviationstack.monthlyRequests }))
    }
    if (cfg.aeroapi.enabled && cfg.aeroapi.apiKey) {
        sources.push(new AeroApiSource({
            apiKey: cfg.aeroapi.apiKey,
            monthlyBudgetUsd: cfg.aeroapi.monthlyBudgetUsd,
            costPerCallUsd: cfg.aeroapi.costPerCallUsd,
        }))
    }
    return new FlightProvider({
        sources,
        quota,
        positionTtlMs: cfg.positionTtlSec * 1000,
        detailsTtlMs: cfg.detailsTtlHours * 3600_000,
    })
}
