interface IChannelSettings {
    channelId: string
    channelConfig: any
    channelInstanceConfig: any
}

class Settings {
    public channelSettings: IChannelSettings[] = []
    public keepAliveInterval: number = 60
    public channelUserPreferences: {channelId: string, data:any}[] = []
}

export type { IChannelSettings }
export { Settings }