import { EDisplay } from '@jfvilas/kwirth-dce-blockterm'
import { EWrkModel, IWrkactjobInstanceConfig } from '../common/WrkactjobTypes'

export interface IWrkactjobConfig {
}

export class WrkactjobConfig implements IWrkactjobConfig {
}

// The terminal WRKACTJOB runs on, chosen in the setup when the channel starts: a 24x80 in colour unless told otherwise.
export class WrkactjobInstanceConfig implements IWrkactjobInstanceConfig {
    model = EWrkModel.MODEL_24X80
    display = EDisplay.COLOR
}
