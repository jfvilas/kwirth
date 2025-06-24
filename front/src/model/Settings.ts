//import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

interface IChannelSettings {
    id:string
    uiSettings:any
    instanceSettings:any
}

class Settings {
    public channels: IChannelSettings[] = []
    public keepAliveInterval: number = 60
}

export type { IChannelSettings }
export { Settings }

