interface IFilemanUiConfig {
    nofify: (msg:string, level:string) => void
}

class FilemanUiConfig implements IFilemanUiConfig {
    nofify: (msg:string, level:string) => void = () => {}
}

interface IFilemanInstanceConfig {
}

class FilemanInstanceConfig implements IFilemanInstanceConfig{
}

export type { IFilemanUiConfig, IFilemanInstanceConfig }
export { FilemanUiConfig, FilemanInstanceConfig }
