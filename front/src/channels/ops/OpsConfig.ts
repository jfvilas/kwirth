import { ColorModeEnum } from "./terminal/Terminal"

interface IOpsConfig {
    colorMode: ColorModeEnum
}

class OpsConfig implements IOpsConfig{
    colorMode = ColorModeEnum.Light
}

interface IOpsInstanceConfig {
    sessionKeepAlive: boolean
}

class OpsInstanceConfig implements IOpsInstanceConfig{
    sessionKeepAlive = true
}

export type { IOpsConfig, IOpsInstanceConfig }
export { OpsConfig, OpsInstanceConfig }
