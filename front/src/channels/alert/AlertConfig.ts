interface IAlertConfig {
    maxAlerts: number
}

class AlertConfig implements IAlertConfig{
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

export type { IAlertConfig, IAlertInstanceConfig }
export { AlertConfig, AlertInstanceConfig }
