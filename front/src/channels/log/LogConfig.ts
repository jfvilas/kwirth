export enum ELogSortOrder {
    NONE = 'none',
    TIME = 'time',
    POD = 'pod'
}

interface ILogConfig {
    startDiagnostics: boolean

    // for general log viewing
    follow: boolean
    maxMessages: number

    // for start diagnostics
    maxPerPodMessages: number
    sortOrder: ELogSortOrder
}

class LogConfig implements ILogConfig{
    startDiagnostics = false
    follow = true
    maxMessages = 5000
    maxPerPodMessages = 1000
    sortOrder = ELogSortOrder.TIME
}

interface ILogInstanceConfig {
    previous: boolean
    timestamp: boolean
    fromStart: boolean
    startTime?: number
}

class LogInstanceConfig implements ILogInstanceConfig{
    previous = false
    timestamp = true
    fromStart = false
    startTime? = 0
}

export type { ILogConfig, ILogInstanceConfig }
export { LogConfig, LogInstanceConfig }
