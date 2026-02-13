import { ENotifyLevel } from "../../tools/Global"
import { IChannel } from "../IChannel"

interface IMagnifyConfig {
    notify: (channel:string|undefined, level:ENotifyLevel, msg:string) => void
}

class MagnifyConfig implements IMagnifyConfig {
    notify: (channel:string|undefined, level:ENotifyLevel, msg:string) => void = (channel:string|undefined, level:ENotifyLevel, msg:string) => {}
}

interface IMagnifyInstanceConfig {
}

class MagnifyInstanceConfig implements IMagnifyInstanceConfig{
}

export type { IMagnifyConfig, IMagnifyInstanceConfig }
export { MagnifyConfig, MagnifyInstanceConfig }
