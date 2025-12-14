import { ISetupProps } from '../IChannel'
import { Search } from '@mui/icons-material'
import { LensConfig, LensInstanceConfig, ILensConfig, ILensInstanceConfig } from './LensConfig'

const LensIcon = <Search />

const LensSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let lensInstanceConfig:ILensInstanceConfig = props.setupConfig?.channelInstanceConfig || new LensInstanceConfig()
    let lensgConfig:ILensConfig = props.setupConfig?.channelConfig || new LensConfig()

    return <></>
}

export { LensSetup, LensIcon }
