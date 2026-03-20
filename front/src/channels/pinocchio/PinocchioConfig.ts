interface IPinocchioConfig {
    maxLines: number
}

class PinocchioConfig implements IPinocchioConfig{
    maxLines = 3
}

interface IPinocchioInstanceConfig {
    interval: number
}

class PinocchioInstanceConfig implements IPinocchioInstanceConfig{
    interval = 5
}

export type { IPinocchioConfig, IPinocchioInstanceConfig }
export { PinocchioConfig, PinocchioInstanceConfig }
