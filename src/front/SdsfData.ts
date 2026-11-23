import { SdsfSession } from '../common/SdsfSession'
import { SdsfBackSource } from './SdsfBackSource'
import { EDisplay } from '@jfvilas/kwirth-dce-blockterm'

/*
    The tab's state. It lives in channelObject.data, not in React: the TabContent is mounted and unmounted
    when the operator switches tabs, and the session (screen, panel, filters, the half-typed command) must
    survive that.
*/
export interface ISdsfData {
    started: boolean
    display: EDisplay          // how the session's screen is painted; set from the setup when it starts
    session?: SdsfSession
    source?: SdsfBackSource
}

export class SdsfData implements ISdsfData {
    started = false
    display = EDisplay.COLOR
    session?: SdsfSession
    source?: SdsfBackSource
}
