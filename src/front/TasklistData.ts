import { TasklistSession } from './TasklistSession'
import { TasklistBackSource } from './TasklistBackSource'

/*
    The tab's state. It lives in channelObject.data, not in React: the TabContent is mounted and unmounted when
    the user switches tabs, and the session (tab, columns, selection, graphs) must survive that.
*/
export interface ITasklistData {
    started: boolean
    session?: TasklistSession
    source?: TasklistBackSource
}

export class TasklistData implements ITasklistData {
    started = false
    session?: TasklistSession
    source?: TasklistBackSource
}
