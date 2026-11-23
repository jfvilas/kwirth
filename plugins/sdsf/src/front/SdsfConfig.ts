import { ESdsfDisplay, ESdsfModel, ISdsfInstanceConfig } from '../common/SdsfTypes'

export interface ISdsfConfig {
}

export class SdsfConfig implements ISdsfConfig {
}

// The terminal SDSF runs on, chosen in the setup when the channel starts: a 3278-3 in colour unless told otherwise.
export class SdsfInstanceConfig implements ISdsfInstanceConfig {
    model = ESdsfModel.MODEL3
    display = ESdsfDisplay.COLOR
}
