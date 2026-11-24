import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

/*
    A read-only list: a title, a line under it saying what it is about, optional headings and lines that roll,
    and 'Press Enter to continue.' Each entry of DSPSBSD and WRKJOBSCDE's details are one.
*/
export interface IDisplayList {
    title: string
    header: string             // the line under the title: what the list is about
    headings: string
    lines: string[]
    top: number
}

const LIST_FIRST = 6

export const displayPageSizeOf = (screenRows: number): number => rowsOf({ rows: screenRows }).more - LIST_FIRST

export const paintDisplayList = (p: Painter5250, list: IDisplayList, system: string, message: string): void => {
    const rows = rowsOf(p.screen)
    const width = p.screen.cols - 3
    paintTitle(p, list.title, '', 0)
    paintRight(p, 1, `System:   ${system.slice(0, 10)}`)
    p.text(2, 1, list.header.slice(0, width), E5250Attribute.GREEN, true)
    if (list.headings) p.text(LIST_FIRST - 1, 1, list.headings.slice(0, width), E5250Attribute.WHITE, true)
    const lines = list.lines.length ? list.lines : ['(No entries)']
    lines.slice(list.top, list.top + displayPageSizeOf(p.screen.rows)).forEach((line, i) =>
        p.text(LIST_FIRST + i, 1, line.slice(0, width), list.lines.length ? E5250Attribute.GREEN : E5250Attribute.BLUE, true))
    paintRight(p, rows.more, list.top + displayPageSizeOf(p.screen.rows) < list.lines.length ? 'More...' : 'Bottom')
    p.text(rows.commandLabel, 1, 'Press Enter to continue.', E5250Attribute.BLUE, true)
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
    paintMessage(p, rows, message)
}
