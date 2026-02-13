import { ENotifyLevel } from "../../tools/Global"
import { IChannel } from "../IChannel"

interface IFilemanConfig {
    notify: (channel:string|undefined, level:ENotifyLevel, msg:string) => void
}

class FilemanConfig implements IFilemanConfig {
    notify: (channel:string|undefined, level:ENotifyLevel, msg:string) => void = (channel:string|undefined, level:ENotifyLevel, msg:string) => {}
}

interface IFilemanInstanceConfig {
}

class FilemanInstanceConfig implements IFilemanInstanceConfig{
}

export type { IFilemanConfig, IFilemanInstanceConfig }
export { FilemanConfig, FilemanInstanceConfig }
