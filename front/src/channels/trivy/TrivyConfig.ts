interface ITrivyConfig {
}

class TrivyConfig implements ITrivyConfig{
}

interface ITrivyInstanceConfig {
    ignoreCritical: boolean
    ignoreHigh: boolean
    ignoreMedium: boolean
    ignoreLow: boolean
}

class TrivyInstanceConfig implements ITrivyInstanceConfig{
    ignoreCritical = false
    ignoreHigh = false
    ignoreMedium = false
    ignoreLow = true
}

export type { ITrivyConfig, ITrivyInstanceConfig }
export { TrivyConfig, TrivyInstanceConfig }
