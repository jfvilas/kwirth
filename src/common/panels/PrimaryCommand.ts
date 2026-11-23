/*
    What the operator typed on COMMAND INPUT, taken apart. Pure: the session decides what each one does.
*/
export enum EPrimaryCommand {
    NONE = 'none',             // nothing typed
    DA = 'da',
    ST = 'st',
    INPUT = 'input',           // I: the input queue, what waits to run
    OUTPUT = 'output',         // O: the output queue, Jobs that ended
    HELD = 'held',             // H: the held output, CronJobs suspended
    LOG = 'log',
    ULOG = 'ulog',             // the user session log: what this operator did; ULOG CLOSE empties it
    INIT = 'init',
    END = 'end',
    RETURN = 'return',
    PREFIX = 'prefix',
    DEST = 'dest',
    OWNER = 'owner',
    SORT = 'sort',
    FIND = 'find',
    RFIND = 'rfind',
    TOP = 'top',
    BOTTOM = 'bottom',
    UP = 'up',
    DOWN = 'down',
    LEFT = 'left',
    RIGHT = 'right',
    AUTO = 'auto',             // &nn starts the automatic update, & alone stops it
    RETRIEVE = 'retrieve',
    SET = 'set',               // SET CONFIRM ON|OFF: whether the Confirm Action window is shown
    AMOUNT = 'amount',         // a bare number or M/MAX: a scroll amount for the PF key pressed with it
    INVALID = 'invalid'
}

export interface IPrimaryCommand {
    verb: EPrimaryCommand
    args: string[]
    text: string               // as typed, trimmed: what RETRIEVE brings back
}

// The names and abbreviations SDSF and ISPF accept.
const VERBS: Record<string, EPrimaryCommand> = {
    DA: EPrimaryCommand.DA,
    ST: EPrimaryCommand.ST,
    I: EPrimaryCommand.INPUT,
    O: EPrimaryCommand.OUTPUT,
    H: EPrimaryCommand.HELD,
    LOG: EPrimaryCommand.LOG,
    ULOG: EPrimaryCommand.ULOG,
    INIT: EPrimaryCommand.INIT,
    END: EPrimaryCommand.END,
    RETURN: EPrimaryCommand.RETURN,
    PREFIX: EPrimaryCommand.PREFIX, PRE: EPrimaryCommand.PREFIX,
    DEST: EPrimaryCommand.DEST,
    OWNER: EPrimaryCommand.OWNER, OWN: EPrimaryCommand.OWNER,
    SORT: EPrimaryCommand.SORT,
    FIND: EPrimaryCommand.FIND, F: EPrimaryCommand.FIND,
    RFIND: EPrimaryCommand.RFIND,
    TOP: EPrimaryCommand.TOP,
    BOTTOM: EPrimaryCommand.BOTTOM, BOT: EPrimaryCommand.BOTTOM,
    UP: EPrimaryCommand.UP,
    DOWN: EPrimaryCommand.DOWN,
    LEFT: EPrimaryCommand.LEFT,
    RIGHT: EPrimaryCommand.RIGHT,
    RETRIEVE: EPrimaryCommand.RETRIEVE, RETRIEV: EPrimaryCommand.RETRIEVE, RETR: EPrimaryCommand.RETRIEVE,
    SET: EPrimaryCommand.SET
}

// Words, keeping a quoted string ('two words' or "two words") as one.
const words = (text: string): string[] => {
    const result: string[] = []
    const re = /'([^']*)'|"([^"]*)"|(\S+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) result.push(m[1] ?? m[2] ?? m[3])
    return result
}

export const parsePrimaryCommand = (typed: string): IPrimaryCommand => {
    const text = typed.trim()
    if (!text) return { verb: EPrimaryCommand.NONE, args: [], text }
    if (text.startsWith('&')) {
        const seconds = text.slice(1).trim()
        return /^\d*$/.test(seconds) ? { verb: EPrimaryCommand.AUTO, args: seconds ? [seconds] : [], text } : { verb: EPrimaryCommand.INVALID, args: [], text }
    }
    const [first, ...args] = words(text)
    const upper = first.toUpperCase()
    if (/^\d+$/.test(upper) || upper === 'M' || upper === 'MAX') return { verb: EPrimaryCommand.AMOUNT, args: [upper], text }
    return { verb: VERBS[upper] ?? EPrimaryCommand.INVALID, args, text }
}
