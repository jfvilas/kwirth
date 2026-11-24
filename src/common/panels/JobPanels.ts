import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { IWrkContainer, IWrkJob } from '../WrkactjobTypes'
import { jobNumberOf, leader, shortName } from './JobIdentity'
import { dateTimeOf, paintCommandLine, paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

// The line under the title of every job panel: 'Job:   NAME   User:   USER   Number:   123456'.
const paintJobLine = (p: Painter5250, job: IWrkJob, row = 2): void => {
    p.text(row, 1, `Job:   ${shortName(job.name).padEnd(10)}   User:   ${shortName(job.user).padEnd(10)}   Number:   ${jobNumberOf(job.uid)}`, E5250Attribute.GREEN, true)
}

// ─── WRKJOB: Work with Job ───────────────────────────────────────────────────────────────────────

// The WRKJOB menu entries this plugin has (the rest of IBM i's have no Kubernetes counterpart).
export enum EWorkWithJob {
    STATUS = '1',              // Display job status attributes
    DEFINITION = '2',          // Display job definition attributes
    SPOOLED_FILES = '4',       // Work with spooled files: the containers
    JOB_LOG = '10'             // Display job log: the pod's events
}

const WORK_WITH_JOB_ENTRIES: { option: EWorkWithJob; text: string }[] = [
    { option: EWorkWithJob.STATUS, text: 'Display job status attributes' },
    { option: EWorkWithJob.DEFINITION, text: 'Display job definition attributes' },
    { option: EWorkWithJob.SPOOLED_FILES, text: 'Work with spooled files' },
    { option: EWorkWithJob.JOB_LOG, text: 'Display job log' }
]

export const WORK_WITH_JOB_OPTIONS: string[] = WORK_WITH_JOB_ENTRIES.map(e => e.option)

// Returns the selection field.
export const paintWorkWithJob = (p: Painter5250, job: IWrkJob, system: string, message: string): number => {
    const rows = rowsOf(p.screen)
    paintTitle(p, 'Work with Job', '', 0)
    paintRight(p, 1, `System:   ${system.slice(0, 10)}`)
    paintJobLine(p, job)
    p.text(4, 1, 'Select one of the following:', E5250Attribute.BLUE, true)
    WORK_WITH_JOB_ENTRIES.forEach((e, i) => p.text(6 + i, 5, `${e.option.padStart(2)}. ${e.text}`, E5250Attribute.GREEN, true))
    const field = paintCommandLine(p, rows, 'Selection or command', '')
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
    paintMessage(p, rows, message)
    return field
}

// ─── Display job status / definition attributes ─────────────────────────────────────────────────

export enum EJobAttributes {
    STATUS = 'status',
    DEFINITION = 'definition'
}

const LABEL_WIDTH = 38

const dateOf = (iso: string): string => iso ? dateTimeOf(new Date(iso).getTime()) : ''

const containerLine = (c: IWrkContainer): string =>
    `${c.name}${c.init ? ' (init)' : ''}: ${c.image}`

// The attributes of each panel, as label and value: everything from the LIST, no question to the back.
export const attributesOf = (job: IWrkJob, kind: EJobAttributes): [string, string][] => {
    if (kind === EJobAttributes.DEFINITION) {
        return [
            ['User (service account)', job.user],
            ['Job type', job.type],
            ['Started by', job.controllerKind ? `${job.controllerKind} ${job.controllerName}` : 'Nobody: a bare pod'],
            ['Priority class', job.priorityClass || '*NONE'],
            ['Priority', String(job.priority)],
            ['Program', job.program ? 'PGM-' + job.program : ''],
            ...job.containers.map((c, i): [string, string] => [i === 0 ? 'Containers' : '', containerLine(c)])
        ]
    }
    return [
        ['Status of job', 'ACTIVE'],
        ['Current status', job.status],
        ['Kubernetes phase', job.phase],
        ['Entered system', dateOf(job.created)],
        ['Subsystem', job.namespace],
        ['Pool (node)', job.node],
        ['Restarts', String(job.restarts)],
        ['CPU used (seconds)', job.cpuSeconds === undefined ? '' : job.cpuSeconds.toFixed(1)],
        ['Memory (working set)', job.memory === undefined ? '' : `${Math.round(job.memory / 1048576)} MB`]
    ]
}

export const ATTRIBUTES_TITLE: Record<EJobAttributes, string> = {
    [EJobAttributes.STATUS]: 'Display Job Status Attributes',
    [EJobAttributes.DEFINITION]: 'Display Job Definition Attributes'
}

export const paintAttributes = (p: Painter5250, job: IWrkJob, kind: EJobAttributes, system: string): void => {
    const rows = rowsOf(p.screen)
    const room = p.screen.cols - LABEL_WIDTH - 4
    paintTitle(p, ATTRIBUTES_TITLE[kind], '', 0)
    paintRight(p, 1, `System:   ${system.slice(0, 10)}`)
    paintJobLine(p, job)
    attributesOf(job, kind).slice(0, rows.more - 4).forEach(([label, value], i) => {
        p.text(4 + i, 1, label ? leader(label, LABEL_WIDTH) : ''.padEnd(LABEL_WIDTH), E5250Attribute.GREEN)
        p.text(4 + i, LABEL_WIDTH + 2, value.slice(0, room), E5250Attribute.GREEN, true)
    })
    p.text(rows.commandLabel, 1, 'Press Enter to continue.', E5250Attribute.BLUE, true)
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
}

// ─── Display Messages (option 7) ────────────────────────────────────────────────────────────────

/*
    Text cut into lines of at most `width`, at blanks when it can. A word longer than a line (a pod name with its
    uid) cannot be kept whole anyway, so it fills what is left of the line it starts on and goes on in the next:
    starting it on a line of its own only moved the cut and could leave its last characters alone on a line.
*/
export const wrap = (text: string, width: number): string[] => {
    const lines: string[] = []
    let line = ''
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (!line && word.length <= width) {
            line = word
            continue
        }
        if (line && line.length + 1 + word.length <= width) {
            line += ' ' + word
            continue
        }
        if (word.length <= width) {
            lines.push(line)
            line = word
            continue
        }
        let rest = word
        if (line) {
            const room = width - line.length - 1
            if (room > 0) {
                line += ' ' + rest.slice(0, room)
                rest = rest.slice(room)
            }
            lines.push(line)
        }
        while (rest.length > width) {
            lines.push(rest.slice(0, width))
            rest = rest.slice(width)
        }
        line = rest
    }
    if (line) lines.push(line)
    return lines
}

/*
    The message a job in MSGW waits on, as IBM i's Display Messages shows it, in white. There is no reply: a
    Kubernetes container does not take one — the operator ends it (4) or fixes what it says.
*/
export const paintMessages = (p: Painter5250, job: IWrkJob, system: string): void => {
    const rows = rowsOf(p.screen)
    paintTitle(p, 'Display Messages', '', 0)
    paintRight(p, 1, `System:   ${system.slice(0, 10)}`)
    p.text(2, 1, `Job . . :   ${shortName(job.name).padEnd(10)}   Subsystem . . :   ${job.namespace}`, E5250Attribute.GREEN, true)
    p.text(4, 1, 'Messages needing a reply: none can be given here. End the job (4) or correct the cause.', E5250Attribute.BLUE, true)
    wrap(job.message, p.screen.cols - 6).slice(0, rows.more - 6).forEach((line, i) => p.text(6 + i, 3, line, E5250Attribute.WHITE, true))
    p.text(rows.commandLabel, 1, 'Press Enter to continue.', E5250Attribute.BLUE, true)
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
}

// ─── Work with Job Spooled Files (option 8, WRKJOB 4) ───────────────────────────────────────────

// A container's file as WRKSPLF shows its status: OPN while it is still being written, RDY when it is complete.
export const fileStatusOf = (c: IWrkContainer): string => c.state === 'running' ? 'OPN' : 'RDY'

export const SPOOLED_FILE_OPTIONS = ['5']

export interface ISpooledFileField {
    start: number
    container: IWrkContainer
}

export const paintSpooledFiles = (p: Painter5250, job: IWrkJob, message: string): ISpooledFileField[] => {
    const rows = rowsOf(p.screen)
    paintTitle(p, 'Work with Job Spooled Files', '', 0)
    paintJobLine(p, job)
    p.text(4, 1, 'Type options, press Enter.', E5250Attribute.BLUE, true)
    p.text(5, 3, '5=Display', E5250Attribute.BLUE, true)
    p.text(7, 1, 'Opt  File        Nbr  Status  Restarts  Image', E5250Attribute.WHITE, true)
    const fields: ISpooledFileField[] = []
    const room = p.screen.cols - 47
    job.containers.slice(0, rows.lastData - 7).forEach((c, i) => {
        const r = 8 + i
        fields.push({ start: p.input(r, 2, 2), container: c })
        p.text(r, 6, `${shortName(c.name).padEnd(10)}  ${String(i + 1).padStart(3)}  ${fileStatusOf(c).padEnd(6)}  ${String(c.restarts).padStart(8)}  ${c.image.slice(0, room)}`, E5250Attribute.GREEN, true)
    })
    paintRight(p, rows.more, 'Bottom')
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
    paintMessage(p, rows, message)
    return fields
}
