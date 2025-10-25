interface IEchoConfig {
    maxLines: number
}

class EchoConfig implements IEchoConfig{
    maxLines = 3
}

interface IEchoInstanceConfig {
    interval: number
}

class EchoInstanceConfig implements IEchoInstanceConfig{
    interval = 5
}

export type { IEchoConfig, IEchoInstanceConfig }
export { EchoConfig, EchoInstanceConfig }
