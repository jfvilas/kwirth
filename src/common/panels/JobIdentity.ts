import { IWrkJob } from '../WrkactjobTypes'

/*
    An IBM i job is number/user/name: 123456/PAYROLL/API-7D9F8B. The number comes from the pod's uid, so it is the
    same on every refresh for the life of the pod — an operator reads it as an identity.
*/
export const jobNumberOf = (uid: string): string => {
    const hex = uid.replace(/-/g, '').slice(-8)
    const n = hex ? parseInt(hex, 16) % 1000000 : 0
    return String(Number.isNaN(n) ? 0 : n).padStart(6, '0')
}

// The name as IBM i panels show it: ten characters, upper case.
export const shortName = (name: string): string => name.toUpperCase().slice(0, 10)

export const qualifiedName = (job: IWrkJob): string =>
    `${jobNumberOf(job.uid)}/${shortName(job.user || 'DEFAULT')}/${shortName(job.name)}`

/*
    A label with its dot leader, as IBM i lays out display and prompt panels: 'Job name . . . . . . . :'.
    The dots sit on the odd columns of the label area, so they line up from one row to the next whatever the
    label (which is why some labels get two blanks after them, as on IBM i); there is always a blank before the
    colon. `colon` closes a display field; a prompt has none.
*/
export const leader = (label: string, width: number, colon = true): string => {
    let text = label + ' '
    for (let i = text.length; i < width - 3; i++) text += i % 2 === 1 ? '.' : ' '
    text = text.padEnd(width - 2, ' ')
    return colon ? text + ': ' : text + '  '
}
