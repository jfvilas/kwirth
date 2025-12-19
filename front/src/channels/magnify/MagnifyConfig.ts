import { ENotifyLevel } from "../../tools/Global"

interface IMagnifyConfig {
    notify: (level:ENotifyLevel, msg:string) => void
}

class MagnifyConfig implements IMagnifyConfig {
    notify: (level:ENotifyLevel, msg:string) => void = (level:ENotifyLevel, msg:string) => {}
}

interface IMagnifyInstanceConfig {
}

class MagnifyInstanceConfig implements IMagnifyInstanceConfig{
}

export type { IMagnifyConfig, IMagnifyInstanceConfig }
export { MagnifyConfig, MagnifyInstanceConfig }
