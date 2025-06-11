interface ILogUiConfig {
    startDiagnostics: boolean

    // for general log viewing
    follow: boolean
    maxMessages: number

    // for start diagnostics
    maxPerPodMessages: number
    sortOrder: string
}

class LogUiConfig implements ILogUiConfig{
    startDiagnostics = false
    follow = true
    maxMessages = 5000
    maxPerPodMessages = 1000
    sortOrder = 'time' // +++ enum
}

interface ILogInstanceConfig {
    previous: boolean
    timestamp: boolean
    fromStart: boolean
}

class LogInstanceConfig implements ILogInstanceConfig{
    previous = false
    timestamp = true
    fromStart = false
}

export type { ILogUiConfig, ILogInstanceConfig }
export { LogUiConfig, LogInstanceConfig }
