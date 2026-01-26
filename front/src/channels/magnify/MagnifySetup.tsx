import { ISetupProps } from '../IChannel'
import { Search } from '@mui/icons-material'
//import { MagnifyConfig, MagnifyInstanceConfig, IMagnifyConfig, IMagnifyInstanceConfig } from './MagnifyConfig'

const MagnifyIcon = <Search />

const MagnifySetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    // let magnifyInstanceConfig:IMagnifyInstanceConfig = props.setupConfig?.channelInstanceConfig || new MagnifyInstanceConfig()
    // let magnifyConfig:IMagnifyConfig = props.setupConfig?.channelConfig || new MagnifyConfig()

    return <></>
}

export { MagnifySetup, MagnifyIcon }
