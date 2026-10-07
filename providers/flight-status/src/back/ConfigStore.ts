import { IProviderStorage } from '@kwirthmagnify/kwirth-common-back'
import { EFlightStatusStorageKey, IFlightStatusConfig } from '../common/FlightStatus'
import { normalizeConfig } from '../common/Validation'

/*
    Persistence of the configuration (not of the quota, which lives in memory only), split by sensitivity —
    the same criterion http-pull-push follows:
      - EFlightStatusStorageKey.CONFIG (secret=false) -> ConfigMap: ids, limits, TTLs, flags. Auditable with kubectl.
      - EFlightStatusStorageKey.CREDS  (secret=true)  -> Secret: OpenSky clientSecret, AviationStack and AeroAPI keys.
    On read both halves are put back together, so the provider always holds the real credentials.
    With no storage injected (older core) the configuration comes from environment variables.
*/

interface IStoredCreds {
    openskyClientSecret?: string
    aviationstackAccessKey?: string
    aeroapiApiKey?: string
}

const withCreds = (c: IFlightStatusConfig, creds: IStoredCreds): IFlightStatusConfig => ({
    ...c,
    opensky: { ...c.opensky, clientSecret: creds.openskyClientSecret ?? '' },
    aviationstack: { ...c.aviationstack, accessKey: creds.aviationstackAccessKey ?? '' },
    aeroapi: { ...c.aeroapi, apiKey: creds.aeroapiApiKey ?? '' },
})

export const configFromEnv = (env: NodeJS.ProcessEnv = process.env): IFlightStatusConfig => {
    const cfg = withCreds(normalizeConfig(undefined), {
        openskyClientSecret: env.OPENSKY_CLIENT_SECRET,
        aviationstackAccessKey: env.AVIATIONSTACK_KEY,
        aeroapiApiKey: env.AEROAPI_KEY,
    })
    cfg.opensky.clientId = env.OPENSKY_CLIENT_ID ?? ''
    cfg.aviationstack.enabled = Boolean(env.AVIATIONSTACK_KEY)
    cfg.aeroapi.enabled = Boolean(env.AEROAPI_KEY)
    return cfg
}

export class ConfigStore {
    constructor(private readonly storage: IProviderStorage | undefined) {}

    get available(): boolean {
        return this.storage !== undefined
    }

    load = async (): Promise<IFlightStatusConfig> => {
        if (!this.storage) return configFromEnv()
        const pub: unknown = await this.storage.readStorage(EFlightStatusStorageKey.CONFIG, false)
        const creds: IStoredCreds = (await this.storage.readStorage(EFlightStatusStorageKey.CREDS, true)) ?? {}
        return withCreds(normalizeConfig(pub), creds)
    }

    save = async (c: IFlightStatusConfig): Promise<void> => {
        if (!this.storage) throw new Error('no storage available: configure this provider with environment variables')
        const creds: IStoredCreds = {}
        if (c.opensky.clientSecret) creds.openskyClientSecret = c.opensky.clientSecret
        if (c.aviationstack.accessKey) creds.aviationstackAccessKey = c.aviationstack.accessKey
        if (c.aeroapi.apiKey) creds.aeroapiApiKey = c.aeroapi.apiKey
        // The ConfigMap half carries every field but the credentials, which only live in the Secret
        await this.storage.writeStorage(EFlightStatusStorageKey.CONFIG, false, withCreds(c, {}))
        await this.storage.writeStorage(EFlightStatusStorageKey.CREDS, true, creds)
    }
}
