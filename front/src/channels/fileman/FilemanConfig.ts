import { ENotifyLevel } from "../../tools/Global"

interface IFilemanConfig {
    notify: (level:ENotifyLevel, msg:string) => void
}

class FilemanConfig implements IFilemanConfig {
    notify: (level:ENotifyLevel, msg:string) => void = (level:ENotifyLevel, msg:string) => {}
}

interface IFilemanInstanceConfig {
}

class FilemanInstanceConfig implements IFilemanInstanceConfig{
}

export type { IFilemanConfig, IFilemanInstanceConfig }
export { FilemanConfig, FilemanInstanceConfig }
