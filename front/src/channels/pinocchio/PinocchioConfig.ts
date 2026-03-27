interface IPinocchioConfig {
}

class PinocchioConfig implements IPinocchioConfig{
}

interface IPinocchioInstanceConfig {
    interval: number
    name: string
}

class PinocchioInstanceConfig implements IPinocchioInstanceConfig{
    interval = 5
    name = 'Borja'
}

export type { IPinocchioConfig, IPinocchioInstanceConfig }
export { PinocchioConfig, PinocchioInstanceConfig }
