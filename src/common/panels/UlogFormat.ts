import { E3270Color } from '@jfvilas/kwirth-dce-blockterm'
import { timeOf } from './SyslogFormat'

/*
    SDSF's ULOG, the user session log: what THIS operator did in the session and what came of it, one line
    each, so that the answer fits in 79 columns:

      INCLUSTE 09:41:07.12  C   shop/api-1                     COMMAND ISSUED
      │        │            │   │                              └ the answer
      │        │            │   └ the object: namespace/name, or 'node <name>'
      │        │            └ the action (C, CA, S, Z, P) or the command (SET CONFIRM OFF)
      │        └ hh:mm:ss.th, UTC, as the SYSLOG (no date: a ULOG lasts one session)
      └ the system: the cluster

    It lives in the session (a new session, a new ULOG) and ULOG CLOSE empties it.
*/
export interface ISdsfUlogEntry {
    time: string               // ISO
    command: string
    target: string             // '' for a command that is not about an object
    response: string
    ok: boolean                // false: refused or failed, shown in red
}

const COMMAND_WIDTH = 3
const WHAT_WIDTH = 34

export const ulogLine = (entry: ISdsfUlogEntry, system: string): string => {
    const what = entry.target ? `${entry.command.padEnd(COMMAND_WIDTH)} ${entry.target}` : entry.command
    return `${system.toUpperCase().slice(0, 8).padEnd(8)} ${timeOf(entry.time)}  ${what.padEnd(WHAT_WIDTH)} ${entry.response}`
}

export const ulogColor = (entry: ISdsfUlogEntry): E3270Color => entry.ok ? E3270Color.GREEN : E3270Color.RED
