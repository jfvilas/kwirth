import { EDisplay } from '@jfvilas/kwirth-dce-blockterm'
import { WrkSession } from '../common/WrkSession'
import { WrkBackSource } from './WrkBackSource'

/*
    The tab's state. It lives in channelObject.data, not in React: the TabContent is mounted and unmounted when
    the operator switches tabs, and the session (screen, panel, filter, what is half typed) must survive that.
*/
export interface IWrkactjobData {
    started: boolean
    display: EDisplay          // how the session's screen is painted; set from the setup when it starts
    session?: WrkSession
    source?: WrkBackSource
}

export class WrkactjobData implements IWrkactjobData {
    started = false
    display = EDisplay.COLOR
    session?: WrkSession
    source?: WrkBackSource
}
