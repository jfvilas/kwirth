import { ISdsfInstanceConfig } from '../common/SdsfTypes'

export interface ISdsfConfig {
}

export class SdsfConfig implements ISdsfConfig {
}

// SDSF has nothing to configure per instance: it opens on the cluster picked in the cluster list.
export class SdsfInstanceConfig implements ISdsfInstanceConfig {
}
