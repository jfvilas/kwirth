import { ESdsfNodeStatus, ISdsfNode } from '../SdsfTypes'
import { E3270Color } from '@jfvilas/kwirth-dce-blockterm'
import { ageOf, IDaColumn } from './DaColumns'

/*
    The INIT columns: a node as an initiator of SDSF's INITIATOR DISPLAY. Its status words are an initiator's:

      ACTIVE    Ready and taking pods                 DRAINED    cordoned and empty (DaemonSet pods aside)
      HALTED    cordoned, still running pods          INACTIVE   not Ready

    Classes are the node's roles (the classes an initiator serves). Page 1 is the initiator; PF11 brings the
    address, the age and the full name.
*/

const IDENTITY = E3270Color.BLUE
const VALUE = E3270Color.GREEN
const GIB = 1024 ** 3
const MIB = 1024 ** 2

const STATUS_COLOR: Record<ESdsfNodeStatus, E3270Color> = {
    [ESdsfNodeStatus.ACTIVE]: E3270Color.GREEN,
    [ESdsfNodeStatus.HALTED]: E3270Color.YELLOW,
    [ESdsfNodeStatus.DRAINED]: E3270Color.PINK,
    [ESdsfNodeStatus.INACTIVE]: E3270Color.RED
}

export const classesOf = (node: ISdsfNode): string => node.roles.length ? node.roles.join(',').toUpperCase() : 'WORKER'

const cpuOf = (node: ISdsfNode): string => node.cpu === undefined ? '-' : node.cpu.toFixed(2)
const realOf = (node: ISdsfNode): string => node.memoryUsed === undefined ? '-' : String(Math.round(node.memoryUsed / MIB))
const cpusOf = (node: ISdsfNode): string => String(Math.round(node.cpus * 100) / 100)
const memOf = (node: ISdsfNode): string => (node.memory / GIB).toFixed(1)

export const INIT_ID_COLUMN: IDaColumn<ISdsfNode> = {
    header: 'ID', width: 8, right: false,
    text: n => n.id.toUpperCase().slice(0, 8), color: () => IDENTITY, sortKey: n => n.name
}

export const INIT_COLUMNS: IDaColumn<ISdsfNode>[] = [
    { header: 'Status', width: 8, right: false, text: n => n.status, color: n => STATUS_COLOR[n.status], sortKey: n => n.status },
    { header: 'Classes', width: 12, right: false, text: classesOf, color: () => IDENTITY, sortKey: classesOf },
    { header: 'Pods', width: 4, right: true, text: n => String(n.pods), color: () => VALUE, sortKey: n => n.pods },
    { header: 'CPU%', width: 6, right: true, text: cpuOf, color: () => VALUE, sortKey: n => n.cpu ?? -1 },
    { header: 'Real', width: 6, right: true, text: realOf, color: () => VALUE, sortKey: n => n.memoryUsed ?? -1 },
    { header: 'CPUs', width: 4, right: true, text: cpusOf, color: () => VALUE, sortKey: n => n.cpus },
    { header: 'MemGB', width: 6, right: true, text: memOf, color: () => VALUE, sortKey: n => n.memory },
    { header: 'Version', width: 12, right: false, text: n => n.version, color: () => IDENTITY, sortKey: n => n.version },
    { header: 'IP', width: 15, right: false, text: n => n.internalIp, color: () => IDENTITY, sortKey: n => n.internalIp },
    { header: 'Age', width: 5, right: false, text: (n, now) => ageOf(n.created, now), color: () => VALUE, sortKey: n => n.created ? -Date.parse(n.created) : 0 },
    { header: 'NodeName', width: 44, right: false, text: n => n.name, color: () => IDENTITY, sortKey: n => n.name }
]
