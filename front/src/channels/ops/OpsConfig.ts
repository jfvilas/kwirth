import { ColorModeEnum } from "./terminal/Terminal"

interface IOpsUiConfig {
    colorMode: ColorModeEnum
}

class OpsUiConfig implements IOpsUiConfig{
    colorMode = ColorModeEnum.Light
}

interface IOpsInstanceConfig {
    sessionKeepAlive: boolean
}

class OpsInstanceConfig implements IOpsInstanceConfig{
    sessionKeepAlive = true
}

export type { IOpsUiConfig, IOpsInstanceConfig }
export { OpsUiConfig, OpsInstanceConfig }
