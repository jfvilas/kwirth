interface ITrivyUiConfig {
}

class TrivyUiConfig implements ITrivyUiConfig{
}

interface ITrivyInstanceConfig {
    maxCritical:number
    maxHigh:number
    maxMedium:number
    maxLow:number
}

class TrivyInstanceConfig implements ITrivyInstanceConfig{
    maxCritical = 1
    maxHigh = 2
    maxMedium = 5
    maxLow = -1
}

export type { ITrivyUiConfig, ITrivyInstanceConfig }
export { TrivyUiConfig, TrivyInstanceConfig }
