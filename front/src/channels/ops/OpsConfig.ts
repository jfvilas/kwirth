interface IOpsUiConfig {
}

class OpsUiConfig implements IOpsUiConfig{
}

interface IOpsInstanceConfig {
    sessionKeepAlive: boolean
}

class OpsInstanceConfig implements IOpsInstanceConfig{
    sessionKeepAlive = true
}

export type { IOpsUiConfig, IOpsInstanceConfig }
export { OpsUiConfig, OpsInstanceConfig }
