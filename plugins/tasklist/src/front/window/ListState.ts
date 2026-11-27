import { TasklistSession } from '../TasklistSession'
import { IListSort } from '../luna/LunaControls'

/*
    A list's column widths and sort order, kept in the session under the list's name (RF11): every list of the
    window is wired the same way.
*/
export const listState = (session: TasklistSession, list: string, defaultSort?: IListSort) => ({
    widths: Object.fromEntries(Object.entries(session.state.widths)
        .filter(([k]) => k.startsWith(list + '/'))
        .map(([k, v]) => [k.slice(list.length + 1), v])),
    onWidth: (column: string, width: number) => session.setState({ widths: { ...session.state.widths, [`${list}/${column}`]: width } }),
    sort: session.state.sort[list] ?? defaultSort,
    onSort: (sort: IListSort) => session.setState({ sort: { ...session.state.sort, [list]: sort } })
})
