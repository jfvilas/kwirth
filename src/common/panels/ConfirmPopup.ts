import { Painter } from './Painter'
import { ELineCommand, isCancel } from './LineCommand'
import { ESdsfObjectKind } from '../SdsfTypes'
import { E3270Color } from '../terminal/Terminal3270Types'

/*
    SDSF's CONFIRM ACTION window, over the table: what is about to be done and to which objects, and a
    one-character field to answer 1 (process) or 2 (cancel the action). It is always shown before what
    changes the cluster: C and CA (R4), which delete a pod, or a Job or CronJob with its pods; and S, Z and P
    on INIT, which start, halt or drain a node.
*/
export interface IActionTarget {
    kind: ESdsfObjectKind
    namespace: string          // '' for a node
    name: string
    jobId: string              // '' for a node
}

export interface IPendingAction {
    command: ELineCommand
    target: IActionTarget
}

// What the window says is about to happen, when every pending action is the same.
const WHAT: Partial<Record<ELineCommand, string>> = {
    [ELineCommand.CANCEL]: 'Cancel (delete), with the grace period:',
    [ELineCommand.CANCEL_FORCE]: 'Cancel (delete) immediately, with no grace period:',
    [ELineCommand.SELECT]: 'Start (uncordon): the node takes pods again:',
    [ELineCommand.HALT]: 'Halt (cordon): no new pods, the running ones stay:',
    [ELineCommand.PURGE]: 'Drain: halt and evict its pods (not DaemonSet ones):'
}

// Row 8 when it fits (a 32x80 or a 27x132), higher on a 24x80; always centred across.
export const POPUP_TOP = 8
export const POPUP_WIDTH = 62
const SELECTION_COL_OFFSET = 3
const MAX_LISTED = 5

// What is shown before the namespace/name: a pod is just its name, as on the DA; the rest say what they are.
const objectOf = (t: IActionTarget): string => t.kind === ESdsfObjectKind.NODE
    ? `node ${t.name}`
    : (t.kind === ESdsfObjectKind.POD ? '' : t.kind.toLowerCase() + ' ') + `${t.namespace}/${t.name}`

const whatOf = (pending: IPendingAction[]): string => {
    const first = pending[0]?.command
    if (first && pending.every(c => c.command === first)) return WHAT[first] ?? ''
    if (pending.every(c => isCancel(c.command))) return 'Cancel (delete); CA with no grace period:'
    return 'The actions listed:'
}

// Paints the window; returns the attribute address of the selection field.
export const paintConfirm = (p: Painter, pending: IPendingAction[]): number => {
    p.protectAll()
    const listed = pending.slice(0, MAX_LISTED).map(c => `   ${c.command.padEnd(2)}  ${c.target.jobId ? c.target.jobId + '  ' : ''}${objectOf(c.target).slice(0, 44)}`)
    if (pending.length > MAX_LISTED) listed.push(`   ... and ${pending.length - MAX_LISTED} more`)
    const what = whatOf(pending)
    const lines = [
        '',
        ' Pending action:',
        `   ${what}`,
        '',
        ...listed,
        '',
        ' Select one of the following and press Enter:',
        '',
        '     1. Process the action',
        '     2. Cancel the action',
        ''
    ]
    const top = Math.max(1, Math.min(POPUP_TOP, p.screen.rows - (lines.length + 2) - 1))
    const left = Math.floor((p.screen.cols - POPUP_WIDTH) / 2)
    p.window(top, left, POPUP_WIDTH, 'Confirm Action', lines, { color: E3270Color.WHITE })
    // The selection field sits on the line of option 1, before it; what follows it keeps the window's colour.
    const row = top + 1 + lines.indexOf('     1. Process the action')
    const col = left + 1 + SELECTION_COL_OFFSET
    const field = p.input(row, col, 1)
    p.screen.startField(p.screen.address(row, col + 1), { protected: true, color: E3270Color.WHITE })
    p.cursor(row, col)
    return field
}
