import { ENotifyLevel } from "../../tools/Global"

interface IFilemanUiConfig {
    notify: (level:ENotifyLevel, msg:string) => void
}

class FilemanUiConfig implements IFilemanUiConfig {
    notify: (level:ENotifyLevel, msg:string) => void = (level:ENotifyLevel, msg:string) => {}
}

interface IFilemanInstanceConfig {
}

class FilemanInstanceConfig implements IFilemanInstanceConfig{
}

export type { IFilemanUiConfig, IFilemanInstanceConfig }
export { FilemanUiConfig, FilemanInstanceConfig }
