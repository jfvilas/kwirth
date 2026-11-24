/*
    A CL command as typed on an IBM i command line: a verb and keyword parameters, KEYWORD(value), in any order,
    separated by blanks. 'WRKACTJOB SBS(QBATCH) JOB(API*)'. Positional parameters only for the commands that an
    operator types that way ('DSPMSG QSYSOPR'): POSITIONAL says which keyword each position is. Everything is
    upper case already: the command line is monocase.
*/
export interface IClCommand {
    verb: string
    params: Record<string, string>
    error?: string             // why it cannot be read, as IBM i says it
}

const KEYWORD = /^([A-Z][A-Z0-9]*)\(([^()]*)\)$/

// The keyword of each positional parameter, by command.
export const POSITIONAL: Record<string, string[]> = {
    DSPMSG: ['MSGQ'],
    WRKMSG: ['MSGQ']
}

export const parseCl = (text: string): IClCommand => {
    const trimmed = text.trim().toUpperCase()
    const [verb = '', ...rest] = trimmed.split(/\s+/)
    const params: Record<string, string> = {}
    const positions = POSITIONAL[verb] ?? []
    let position = 0
    for (const token of rest) {
        const m = KEYWORD.exec(token)
        if (m) {
            params[m[1]] = m[2].trim()
            continue
        }
        // a positional value: only before any keyword, as CL takes them
        if (position < positions.length && Object.keys(params).length === position) {
            params[positions[position++]] = token
            continue
        }
        return { verb, params, error: `Parameter ${token} not valid for command ${verb}.` }
    }
    return { verb, params }
}

/*
    An IBM i generic name: an asterisk at the end means "starting with" (API*); *ALL or nothing means everything.
    Kubernetes names are lower case and the command line is upper case, so the match ignores case.
*/
export const genericMatches = (pattern: string, name: string): boolean => {
    const p = pattern.trim().toUpperCase()
    const n = name.toUpperCase()
    if (p === '' || p === '*ALL') return true
    return p.endsWith('*') ? n.startsWith(p.slice(0, -1)) : n === p
}
