import { Painter } from './Painter'
import { ELineCommand } from './LineCommand'
import { ESdsfObjectKind } from '../SdsfTypes'
import { E3270Color } from '../terminal/Terminal3270Types'

/*
    SDSF's CONFIRM ACTION window, over the table: what is about to be done and to which objects, and a
    one-character field to answer 1 (process) or 2 (cancel the action). It is always shown before a C or CA
    (R4): cancelling deletes for real — a pod, or a Job or CronJob with its pods.
*/
export interface ICancelTarget {
    kind: ESdsfObjectKind
    namespace: string
    name: string
    jobId: string
}

export interface IPendingCancel {
    command: ELineCommand.CANCEL | ELineCommand.CANCEL_FORCE
    target: ICancelTarget
}

// Row 8 when it fits (a 32x80 or a 27x132), higher on a 24x80; always centred across.
export const POPUP_TOP = 8
export const POPUP_WIDTH = 62
const SELECTION_COL_OFFSET = 3
const MAX_LISTED = 5

// What is shown before the namespace/name: a pod is just its name, as on the DA; the rest say what they are.
const objectOf = (t: ICancelTarget): string => (t.kind === ESdsfObjectKind.POD ? '' : t.kind.toLowerCase() + ' ') + `${t.namespace}/${t.name}`

// Paints the window; returns the attribute address of the selection field.
export const paintConfirm = (p: Painter, pending: IPendingCancel[]): number => {
    p.protectAll()
    const listed = pending.slice(0, MAX_LISTED).map(c => `   ${c.command.padEnd(2)}  ${c.target.jobId}  ${objectOf(c.target).slice(0, 44)}`)
    if (pending.length > MAX_LISTED) listed.push(`   ... and ${pending.length - MAX_LISTED} more`)
    const what = pending.every(c => c.command === ELineCommand.CANCEL_FORCE)
        ? 'Cancel (delete) immediately, with no grace period:'
        : pending.some(c => c.command === ELineCommand.CANCEL_FORCE)
            ? 'Cancel (delete); CA with no grace period:'
            : 'Cancel (delete), with the grace period:'
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
