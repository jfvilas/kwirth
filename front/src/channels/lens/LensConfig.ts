import { ENotifyLevel } from "../../tools/Global"

interface ILensConfig {
    notify: (level:ENotifyLevel, msg:string) => void
}

class LensConfig implements ILensConfig {
    notify: (level:ENotifyLevel, msg:string) => void = (level:ENotifyLevel, msg:string) => {}
}

interface ILensInstanceConfig {
}

class LensInstanceConfig implements ILensInstanceConfig{
}

export type { ILensConfig, ILensInstanceConfig }
export { LensConfig, LensInstanceConfig }
