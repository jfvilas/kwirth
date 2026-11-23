/*
    The commands typed in the NP column of a row. Values are what the operator types. What each one means
    depends on the panel, as in SDSF: on INIT, S starts the initiator instead of selecting its output.
*/
export enum ELineCommand {
    SELECT = 'S',              // browse the output (log of the main container); on INIT, start the node (uncordon)
    QUERY = '?',               // the job's data sets: the pod's containers; on INIT, the DA of its pods
    DISPLAY = 'D',             // the object described, in a browse
    CANCEL = 'C',              // delete the pod, Job or CronJob, after confirming
    CANCEL_FORCE = 'CA',       // the same with grace period 0
    HALT = 'Z',                // INIT: halt the node (cordon)
    PURGE = 'P'                // INIT: drain the node (cordon and evict its pods)
}

// What each kind of panel takes.
export const TABLE_LINE_COMMANDS: ELineCommand[] = [ELineCommand.SELECT, ELineCommand.QUERY, ELineCommand.DISPLAY, ELineCommand.CANCEL, ELineCommand.CANCEL_FORCE]
export const INIT_LINE_COMMANDS: ELineCommand[] = [ELineCommand.SELECT, ELineCommand.QUERY, ELineCommand.DISPLAY, ELineCommand.HALT, ELineCommand.PURGE]

// What was typed in NP, or undefined when it is not a line command of this panel (and '' when nothing was typed).
export const parseLineCommand = (typed: string, allowed: ELineCommand[] = TABLE_LINE_COMMANDS): ELineCommand | undefined | '' => {
    const text = typed.trim().toUpperCase()
    if (!text) return ''
    return allowed.find(c => c === text)
}

export const isCancel = (command: ELineCommand): boolean => command === ELineCommand.CANCEL || command === ELineCommand.CANCEL_FORCE
