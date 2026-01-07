import { IScopedObject } from "./OpsData"

enum ESwitchKeyEnum {
    DISABLED,
    NONE,
    ALT,
    CTRL,
    SHIFT
}

interface IOpsConfig {
    accessKey: ESwitchKeyEnum
    launchShell: boolean
    shell?: IScopedObject
}

class OpsConfig implements IOpsConfig{
    accessKey =  ESwitchKeyEnum.DISABLED
    launchShell = false
}

interface IOpsInstanceConfig {
    sessionKeepAlive: boolean
}

class OpsInstanceConfig implements IOpsInstanceConfig{
    sessionKeepAlive = true
}

export type { IOpsConfig, IOpsInstanceConfig }
export { OpsConfig, OpsInstanceConfig, ESwitchKeyEnum }
