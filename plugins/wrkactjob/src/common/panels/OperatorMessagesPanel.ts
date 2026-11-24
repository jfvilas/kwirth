import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { IWrkMessage } from '../WrkactjobTypes'
import { leader } from './JobIdentity'
import { wrap } from './JobPanels'
import { dateTimeOf, paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

/*
    DSPMSG QSYSOPR, the system operator's messages (PRD-fase3 §2.3): the Warning events the key reaches, newest
    first, each as a message that needs no reply — a Kubernetes event cannot be answered (D15). F1 on one shows its
    second level, Additional Message Information.
*/

// The message queues that mean QSYSOPR here: there is no queue per user (D15).
export const OPERATOR_QUEUES = ['', 'QSYSOPR', '*SYSOPR', '*WRKUSR', '*USRPRF']

export const NO_MESSAGES = 'No messages available.'

// What the first level of a message says: its reason and its text, about what object.
export const firstLevelOf = (m: IWrkMessage): string => {
    const about = m.kind ? `${m.kind} ${m.object}${m.namespace ? ` in subsystem ${m.namespace}` : ''}: ` : ''
    return `${about}${m.reason}${m.message ? ` - ${m.message}` : ''}`
}

// A message's lines: the first one at column 3, the rest two further in, as IBM i indents a long message.
export const messageLinesOf = (m: IWrkMessage, cols: number): string[] => {
    // the rest is what follows the first line in the text itself, never the first wrap's pieces joined again:
    // a word longer than a line was cut there, and joining its halves with a blank would cut it a second time
    const text = firstLevelOf(m).replace(/\s+/g, ' ').trim()
    const first = wrap(text, cols - 6)[0] ?? ''
    const rest = text.slice(first.length).trim()
    return rest ? [first, ...wrap(rest, cols - 8).map(l => '  ' + l)] : [first]
}

const FIRST_ROW = 6

// The rows the list has: from the first message row up to 'More...'/'Bottom'.
export const messageRowsOf = (screenRows: number): number => rowsOf({ rows: screenRows }).more - FIRST_ROW

/*
    The messages that fit from `top` on, whole: a message never splits across pages (it is read as one). One too
    long for a page is cut. Returns each message shown with the screen row it starts at.
*/
export const pageOf = (messages: IWrkMessage[], top: number, screenRows: number, cols: number): { index: number; row: number; lines: string[] }[] => {
    const room = messageRowsOf(screenRows)
    const page: { index: number; row: number; lines: string[] }[] = []
    let used = 0
    for (let i = top; i < messages.length; i++) {
        const lines = messageLinesOf(messages[i], cols)
        if (used > 0 && used + lines.length > room) break
        page.push({ index: i, row: FIRST_ROW + used, lines: lines.slice(0, room) })
        used += lines.length
        if (used >= room) break
    }
    return page
}

// Where the page before `top` starts: as many whole messages back as fit.
export const previousTopOf = (messages: IWrkMessage[], top: number, screenRows: number, cols: number): number => {
    const room = messageRowsOf(screenRows)
    let used = 0
    let start = top
    for (let i = top - 1; i >= 0; i--) {
        const n = messageLinesOf(messages[i], cols).length
        if (used > 0 && used + n > room) break
        used += n
        start = i
    }
    return start
}

export interface IOperatorMessagesState {
    system: string
    messages: IWrkMessage[]
    top: number
    message: string
}

// Returns, for each message shown, the rows it takes: what F1 needs to know which one the cursor is on.
export const paintOperatorMessages = (p: Painter5250, state: IOperatorMessagesState): { index: number; first: number; last: number }[] => {
    const rows = rowsOf(p.screen)
    paintTitle(p, 'Display Messages', '', 0)
    paintRight(p, 1, `System:   ${state.system.slice(0, 10)}`)
    p.text(2, 1, leader('Queue', 18) + 'QSYSOPR', E5250Attribute.GREEN, true)
    p.text(3, 3, leader('Library', 16) + 'QSYS', E5250Attribute.GREEN, true)
    const right = Math.floor(p.screen.cols / 2)
    p.text(2, right, leader('Program', 18) + '*DSPMSG', E5250Attribute.GREEN, true)
    p.text(4, 1, 'Position the cursor on a message and press F1 for more information.', E5250Attribute.BLUE, true)

    const page = pageOf(state.messages, state.top, p.screen.rows, p.screen.cols)
    for (const m of page) m.lines.forEach((line, i) => p.text(m.row + i, 3, line, E5250Attribute.GREEN, true))
    const last = page[page.length - 1]
    const more = last !== undefined && last.index < state.messages.length - 1
    paintRight(p, rows.more, more ? 'More...' : 'Bottom')
    paintKeys(p, rows, ['F1=Help', 'F3=Exit', 'F5=Refresh', 'F12=Cancel'], [])
    paintMessage(p, rows, state.message || (state.messages.length === 0 ? NO_MESSAGES : ''))
    return page.map(m => ({ index: m.index, first: m.row, last: m.row + m.lines.length - 1 }))
}

// ─── Additional Message Information (F1) ─────────────────────────────────────────────────────────

const LABEL = 25

const when = (iso: string): string => iso ? dateTimeOf(new Date(iso).getTime()) : ''

export const paintMessageDetails = (p: Painter5250, m: IWrkMessage, system: string): void => {
    const rows = rowsOf(p.screen)
    const cols = p.screen.cols
    paintTitle(p, 'Additional Message Information', '', 0)
    paintRight(p, 1, `System:   ${system.slice(0, 10)}`)
    const fields: [string, string][] = [
        ['Message ID', m.reason],
        ['Message type', m.type],
        ['Date sent', when(m.time)],
        ['First sent', when(m.firstTime)],
        ['Occurrences', String(m.count)],
        ['From object', m.kind ? `${m.kind} ${m.object}` : m.object],
        ['Subsystem', m.namespace || '*NONE'],
        ['From program', m.source]
    ]
    fields.forEach(([label, value], i) => {
        p.text(2 + i, 1, leader(label, LABEL), E5250Attribute.GREEN, true)
        p.text(2 + i, LABEL + 1, value.slice(0, cols - LABEL - 3), E5250Attribute.WHITE, true)
    })
    const top = 3 + fields.length
    p.text(top, 1, 'Message . . . . :', E5250Attribute.GREEN, true)
    wrap(m.message || m.reason, cols - 22).slice(0, rows.commandLabel - top - 1).forEach((line, i) =>
        p.text(top + i, 20, line, E5250Attribute.WHITE, true))
    p.text(rows.commandLabel, 1, 'Press Enter to continue.', E5250Attribute.BLUE, true)
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
}
