interface IEchoUiConfig {
    maxLines: number
}

class EchoUiConfig implements IEchoUiConfig{
    maxLines = 3
}

interface IEchoInstanceConfig {
    interval: number
}

class EchoInstanceConfig implements IEchoInstanceConfig{
    interval = 5
}

export type { IEchoUiConfig, IEchoInstanceConfig }
export { EchoUiConfig, EchoInstanceConfig }
