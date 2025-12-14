import { ISetupProps } from '../IChannel'
import { FolderCopyTwoTone } from '@mui/icons-material'
import { FilemanConfig, FilemanInstanceConfig, IFilemanConfig, IFilemanInstanceConfig } from './FilemanConfig'

const FilemanIcon = <FolderCopyTwoTone />

const FilemanSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let filemanInstanceConfig:IFilemanInstanceConfig = props.setupConfig?.channelInstanceConfig || new FilemanInstanceConfig()
    let filemanConfig:IFilemanConfig = props.setupConfig?.channelConfig || new FilemanConfig()

    return <></>
}

export { FilemanSetup, FilemanIcon }
