import { IScopedObject } from "./OpsData"

export enum ESwitchKey {
    DISABLED,
    NONE,
    ALT,
    CTRL,
    SHIFT
}

interface IOpsConfig {
    accessKey: ESwitchKey
    launchShell: boolean
    shell?: IScopedObject
}

class OpsConfig implements IOpsConfig{
    accessKey =  ESwitchKey.DISABLED
    launchShell = false
}

interface IOpsInstanceConfig {
    sessionKeepAlive: boolean
}

class OpsInstanceConfig implements IOpsInstanceConfig{
    sessionKeepAlive = true
}

export type { IOpsConfig, IOpsInstanceConfig }
export { OpsConfig, OpsInstanceConfig }
