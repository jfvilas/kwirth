import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { IWrkSubsystem, IWrkSubsystemDescription } from '../WrkactjobTypes'
import { leader, shortName } from './JobIdentity'
import { IDisplayList } from './DisplayList'
import { dateTimeOf, paintCommandLine, paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

/*
    WRKSBS, Work with Subsystems, and DSPSBSD, Display Subsystem Description (PRD-fase3 §2.2). A subsystem is a
    namespace; its pools are the system pools (nodes) its jobs run on, numbered as WRKSYSSTS numbers them (D13).
*/

// ─── WRKSBS ──────────────────────────────────────────────────────────────────────────────────────

// The options WRKSBS takes. 4=End subsystem is not one of them (D14): it is not in the legend, and it is not valid.
export enum ESubsystemOption {
    DESCRIPTION = '5',         // Display subsystem description
    JOBS = '8'                 // Work with subsystem jobs: WRKACTJOB SBS(it)
}

export const SUBSYSTEM_OPTIONS: string[] = [ESubsystemOption.DESCRIPTION, ESubsystemOption.JOBS]

export const SUBSYSTEMS_LEGEND = '5=Display subsystem description   8=Work with subsystem jobs'

export enum ESubsystemsView {
    POOLS = 'pools',           // total storage and the subsystem pools 1-10
    STATUS = 'status',         // status, active jobs and the namespace's full name
    WIDE = 'wide'              // 132 columns: everything at once
}

export const subsystemsViewsFor = (cols: number): ESubsystemsView[] =>
    cols >= 132 ? [ESubsystemsView.WIDE] : [ESubsystemsView.POOLS, ESubsystemsView.STATUS]

export const SUBSYSTEMS_F11_LABEL: Record<ESubsystemsView, string> = {
    [ESubsystemsView.POOLS]: 'F11=Display status',
    [ESubsystemsView.STATUS]: 'F11=Display pools',
    [ESubsystemsView.WIDE]: ''
}

// How many subsystem pools a row shows, as on IBM i.
export const SUBSYSTEM_POOLS = 10

// A subsystem's pools as system pool numbers, in order; a node the numbering does not know is left out.
export const poolNumbersOf = (pools: string[], poolNames: string[]): number[] =>
    pools.map(p => poolNames.indexOf(p) + 1).filter(n => n > 0).sort((a, b) => a - b)

// The total storage as IBM i writes it: two decimals, no leading zero ('.00', '512.00').
export const storageOf = (bytes: number): string => (bytes / 1024 ** 2).toFixed(2).replace(/^0\./, '.')

export interface ISubsystemsState {
    system: string
    now: number
    subsystems: IWrkSubsystem[]
    poolNames: string[]
    top: number
    view: ESubsystemsView
    message: string
}

export interface ISubsystemsFields {
    options: { start: number; subsystem: IWrkSubsystem }[]
    command: number
}

const OPT_COL = 2
const NAME_COL = 6
const NAME_WIDTH = 10
const STORAGE_WIDTH = 11
const POOL_WIDTH = 4

export const subsystemsPageSizeOf = (screenRows: number): number => {
    const rows = rowsOf({ rows: screenRows })
    return rows.lastData - rows.firstData + 1
}

const poolsText = (s: IWrkSubsystem, poolNames: string[]): string =>
    poolNumbersOf(s.pools, poolNames).slice(0, SUBSYSTEM_POOLS).map(n => String(n).padStart(POOL_WIDTH)).join('')

const statusText = (s: IWrkSubsystem, nameWidth: number): string =>
    `${s.status.padEnd(8)}  ${String(s.jobs).padStart(6)}  ${s.name.slice(0, nameWidth)}`

// Returns the option fields and the command line.
export const paintSubsystems = (p: Painter5250, state: ISubsystemsState): ISubsystemsFields => {
    const screen = p.screen
    const rows = rowsOf(screen)
    paintTitle(p, 'Work with Subsystems', state.system, rows.title)
    paintRight(p, rows.date, dateTimeOf(state.now))
    p.text(rows.instructions, 1, 'Type options, press Enter.', E5250Attribute.BLUE, true)
    p.text(rows.legend, 3, SUBSYSTEMS_LEGEND, E5250Attribute.BLUE, true)

    const afterName = NAME_COL + NAME_WIDTH + 2
    const poolsCol = afterName + STORAGE_WIDTH
    const poolsWidth = SUBSYSTEM_POOLS * POOL_WIDTH
    const showPools = state.view !== ESubsystemsView.STATUS
    const statusCol = state.view === ESubsystemsView.WIDE ? poolsCol + poolsWidth + 3 : afterName
    const nameRoom = screen.cols - statusCol - 20

    if (showPools) {
        const title = 'Subsystem Pools'
        const dashes = poolsWidth - 1 - title.length
        p.text(rows.headings - 1, afterName, 'Total'.padStart(STORAGE_WIDTH), E5250Attribute.WHITE, true)
        p.text(rows.headings - 1, poolsCol + 1, '-'.repeat(Math.floor(dashes / 2)) + title + '-'.repeat(Math.ceil(dashes / 2)), E5250Attribute.WHITE, true)
        let numbers = ''
        for (let i = 1; i <= SUBSYSTEM_POOLS; i++) numbers += String(i).padStart(POOL_WIDTH)
        p.text(rows.headings, 1, 'Opt  Subsystem   ' + 'Storage (M)'.padStart(STORAGE_WIDTH) + numbers, E5250Attribute.WHITE, true)
    }
    else {
        p.text(rows.headings, 1, 'Opt  Subsystem   ', E5250Attribute.WHITE, true)
    }
    if (!showPools || state.view === ESubsystemsView.WIDE) {
        p.text(rows.headings, statusCol, `${'Status'.padEnd(8)}  ${'Jobs'.padStart(6)}  Namespace`, E5250Attribute.WHITE, true)
    }

    const fields: ISubsystemsFields = { options: [], command: -1 }
    const page = state.subsystems.slice(state.top, state.top + subsystemsPageSizeOf(screen.rows))
    page.forEach((s, i) => {
        const r = rows.firstData + i
        fields.options.push({ start: p.input(r, OPT_COL, 2), subsystem: s })
        p.text(r, NAME_COL, shortName(s.name), E5250Attribute.GREEN, true)
        if (showPools) p.text(r, afterName, storageOf(s.storage).padStart(STORAGE_WIDTH) + poolsText(s, state.poolNames), E5250Attribute.GREEN, true)
        if (!showPools || state.view === ESubsystemsView.WIDE) p.text(r, statusCol, statusText(s, nameRoom), E5250Attribute.GREEN, true)
    })
    if (state.subsystems.length === 0) p.text(rows.firstData, NAME_COL, '(No subsystems to display)', E5250Attribute.BLUE, true)
    paintRight(p, rows.more, state.top + subsystemsPageSizeOf(screen.rows) < state.subsystems.length ? 'More...' : 'Bottom')

    fields.command = paintCommandLine(p, rows, 'Parameters or command', '')
    paintKeys(p, rows, ['F3=Exit', 'F5=Refresh', SUBSYSTEMS_F11_LABEL[state.view], 'F12=Cancel'].filter(Boolean), ['F14=Work with system status'])
    paintMessage(p, rows, state.message)
    return fields
}

// ─── DSPSBSD ─────────────────────────────────────────────────────────────────────────────────────

/*
    The entries of Display Subsystem Description. 1 and 2 are IBM i's own; IBM i's 3-10 (autostart, work station,
    job queue, routing… entries) have no Kubernetes counterpart, so 3 and 4 are the namespace's own limits.
*/
export enum ESubsystemDescription {
    ATTRIBUTES = '1',          // Operational attributes: status, creation, labels, annotations
    POOLS = '2',               // Pool definitions: the system pools (nodes) its jobs run on
    QUOTAS = '3',              // Resource quota entries
    LIMITS = '4'               // Limit range entries
}

const DESCRIPTION_ENTRIES: { option: ESubsystemDescription; text: string }[] = [
    { option: ESubsystemDescription.ATTRIBUTES, text: 'Operational attributes' },
    { option: ESubsystemDescription.POOLS, text: 'Pool definitions' },
    { option: ESubsystemDescription.QUOTAS, text: 'Resource quota entries' },
    { option: ESubsystemDescription.LIMITS, text: 'Limit range entries' }
]

export const SUBSYSTEM_DESCRIPTION_OPTIONS: string[] = DESCRIPTION_ENTRIES.map(e => e.option)

// The line under the title of DSPSBSD and each of its entries.
const subsystemHeaderOf = (d: IWrkSubsystemDescription): string =>
    `Subsystem description:   ${shortName(d.name).padEnd(10)}   Status:   ${d.status}`

// Returns the selection field.
export const paintSubsystemDescription = (p: Painter5250, d: IWrkSubsystemDescription, system: string, message: string): number => {
    const rows = rowsOf(p.screen)
    paintTitle(p, 'Display Subsystem Description', '', 0)
    paintRight(p, 1, `System:   ${system.slice(0, 10)}`)
    p.text(2, 1, subsystemHeaderOf(d), E5250Attribute.GREEN, true)
    p.text(4, 1, 'Select one of the following:', E5250Attribute.BLUE, true)
    DESCRIPTION_ENTRIES.forEach((e, i) => p.text(6 + i, 5, `${e.option.padStart(2)}. ${e.text}`, E5250Attribute.GREEN, true))
    const field = paintCommandLine(p, rows, 'Selection or command', '')
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
    paintMessage(p, rows, message)
    return field
}

const ATTRIBUTE_LABEL = 30

const keyValues = (title: string, values: Record<string, string>): string[] => {
    const keys = Object.keys(values).sort()
    if (keys.length === 0) return [leader(title, ATTRIBUTE_LABEL) + '*NONE']
    return keys.map((k, i) => (i === 0 ? leader(title, ATTRIBUTE_LABEL) : ''.padEnd(ATTRIBUTE_LABEL)) + `${k}=${values[k]}`)
}

const pad = (text: string, width: number): string => text.slice(0, width).padEnd(width)

// What each entry of DSPSBSD lists, as a title, headings and lines.
export const descriptionListOf = (d: IWrkSubsystemDescription, poolNames: string[], entry: ESubsystemDescription): IDisplayList => {
    switch (entry) {
        case ESubsystemDescription.POOLS:
            return {
                title: 'Display Pool Definitions', header: subsystemHeaderOf(d), top: 0,
                headings: 'Pool ID   System Pool   Pool Name',
                lines: d.pools.map((node, i) => `${String(i + 1).padStart(7)}   ${String(poolNames.indexOf(node) + 1 || '').padStart(11)}   ${node}`)
            }
        case ESubsystemDescription.QUOTAS:
            return {
                title: 'Display Resource Quota Entries', header: subsystemHeaderOf(d), top: 0,
                headings: `${pad('Quota', 20)}  ${pad('Resource', 24)}  ${'Used'.padStart(12)}  ${'Limit'.padStart(12)}`,
                lines: d.quotas.map(q => `${pad(q.quota, 20)}  ${pad(q.resource, 24)}  ${q.used.padStart(12)}  ${q.hard.padStart(12)}`)
            }
        case ESubsystemDescription.LIMITS:
            return {
                title: 'Display Limit Range Entries', header: subsystemHeaderOf(d), top: 0,
                headings: `${pad('Limit range', 12)}  ${pad('Type', 10)}  ${pad('Resource', 10)}  ${'Min'.padStart(8)}  ${'Max'.padStart(8)}  ${'Default'.padStart(8)}  ${'Request'.padStart(8)}`,
                lines: d.limits.map(l => `${pad(l.limitRange, 12)}  ${pad(l.type, 10)}  ${pad(l.resource, 10)}  ${l.min.padStart(8)}  ${l.max.padStart(8)}  ${l.defaultLimit.padStart(8)}  ${l.defaultRequest.padStart(8)}`)
            }
        default:
            return {
                title: 'Display Operational Attributes', header: subsystemHeaderOf(d), top: 0, headings: '',
                lines: [
                    leader('Subsystem description', ATTRIBUTE_LABEL) + d.name,
                    leader('Status', ATTRIBUTE_LABEL) + d.status,
                    leader('Created', ATTRIBUTE_LABEL) + (d.created ? dateTimeOf(new Date(d.created).getTime()) : ''),
                    leader('Pools', ATTRIBUTE_LABEL) + String(d.pools.length),
                    ...keyValues('Labels', d.labels),
                    ...keyValues('Annotations', d.annotations)
                ]
            }
    }
}
