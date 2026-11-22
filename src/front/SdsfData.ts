import { SdsfSession } from '../common/SdsfSession'
import { SdsfBackSource } from './SdsfBackSource'

/*
    The tab's state. It lives in channelObject.data, not in React: the TabContent is mounted and unmounted
    when the operator switches tabs, and the session (screen, panel, filters, the half-typed command) must
    survive that.
*/
export interface ISdsfData {
    started: boolean
    session?: SdsfSession
    source?: SdsfBackSource
}

export class SdsfData implements ISdsfData {
    started = false
    session?: SdsfSession
    source?: SdsfBackSource
}
