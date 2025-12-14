interface IOpsConfig {
    accessKey: AccessKeyEnum
}

class OpsConfig implements IOpsConfig{
    accessKey =  AccessKeyEnum.DISABLED
}

enum AccessKeyEnum {
    DISABLED,
    NONE,
    ALT,
    CTRL,
    SHIFT
}

interface IOpsInstanceConfig {
    sessionKeepAlive: boolean
}

class OpsInstanceConfig implements IOpsInstanceConfig{
    sessionKeepAlive = true
}

export type { IOpsConfig, IOpsInstanceConfig }
export { OpsConfig, OpsInstanceConfig, AccessKeyEnum }
