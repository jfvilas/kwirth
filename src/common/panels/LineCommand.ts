/*
    The commands typed in the NP column of a row. Values are what the operator types.
*/
export enum ELineCommand {
    SELECT = 'S',              // browse the output: the log of the main container (of THAT container on the ? panel)
    QUERY = '?',               // the job's data sets: the pod's containers
    DISPLAY = 'D',             // the pod described, in a browse
    CANCEL = 'C',              // delete the pod, after confirming
    CANCEL_FORCE = 'CA'        // the same with grace period 0
}

const ALL: string[] = Object.values(ELineCommand)

// What was typed in NP, or undefined when it is not a line command (and '' when nothing was typed).
export const parseLineCommand = (typed: string): ELineCommand | undefined | '' => {
    const text = typed.trim().toUpperCase()
    if (!text) return ''
    return ALL.includes(text) ? text as ELineCommand : undefined
}

export const isCancel = (command: ELineCommand): boolean => command === ELineCommand.CANCEL || command === ELineCommand.CANCEL_FORCE
