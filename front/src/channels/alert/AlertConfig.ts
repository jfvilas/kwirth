interface IAlertUiConfig {
    maxAlerts: number
}

class AlertUiConfig implements IAlertUiConfig{
    maxAlerts:number = 25
}

interface IAlertInstanceConfig {
    regexInfo: string[],
    regexWarning: string[],
    regexError: string[],
}

class AlertInstanceConfig implements IAlertInstanceConfig{
    regexInfo:string[] = []
    regexWarning:string[] = []
    regexError:string[] = []
}

export type { IAlertUiConfig, IAlertInstanceConfig }
export { AlertUiConfig, AlertInstanceConfig }
