enum LogSortOrderEnum {
    TIME = 'time',
    POD = 'pod'
}

interface ILogUiConfig {
    startDiagnostics: boolean

    // for general log viewing
    follow: boolean
    maxMessages: number

    // for start diagnostics
    maxPerPodMessages: number
    sortOrder: LogSortOrderEnum
}

class LogUiConfig implements ILogUiConfig{
    startDiagnostics = false
    follow = true
    maxMessages = 5000
    maxPerPodMessages = 1000
    sortOrder = LogSortOrderEnum.TIME
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
export { LogUiConfig, LogInstanceConfig, LogSortOrderEnum }
