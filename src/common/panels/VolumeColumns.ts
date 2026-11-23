import { ESdsfVolumeStatus, ISdsfVolume } from '../SdsfTypes'
import { E3270Color } from '../terminal/Terminal3270Types'
import { ageOf, IDaColumn } from './DaColumns'

/*
    The SP columns: a PersistentVolume as a spool volume, its name cut to 8 as a VOLSER (VolumeName has it
    whole), or a claim still waiting for one (PENDING). No %Used: the API does not know how full a volume is.
*/

const IDENTITY = E3270Color.BLUE
const VALUE = E3270Color.GREEN
const GIB = 1024 ** 3

const STATUS_COLOR: Record<ESdsfVolumeStatus, E3270Color> = {
    [ESdsfVolumeStatus.BOUND]: VALUE,
    [ESdsfVolumeStatus.AVAILABLE]: VALUE,
    [ESdsfVolumeStatus.RELEASED]: E3270Color.YELLOW,
    [ESdsfVolumeStatus.FAILED]: E3270Color.RED,
    [ESdsfVolumeStatus.PENDING]: E3270Color.TURQUOISE
}

const ACCESS: Record<string, string> = {
    ReadWriteOnce: 'RWO',
    ReadOnlyMany: 'ROX',
    ReadWriteMany: 'RWX',
    ReadWriteOncePod: 'RWOP'
}

export const accessOf = (v: ISdsfVolume): string => v.accessModes.map(m => ACCESS[m] ?? m).join(',')
export const claimOf = (v: ISdsfVolume): string => v.claimName ? `${v.claimNamespace}/${v.claimName}` : ''
const capacityOf = (v: ISdsfVolume): string => v.capacity > 0 ? (v.capacity / GIB).toFixed(1) : '-'

export const SP_VOLUME_COLUMN: IDaColumn<ISdsfVolume> = {
    header: 'Volume', width: 8, right: false,
    text: v => v.name.toUpperCase().slice(0, 8), color: () => IDENTITY, sortKey: v => v.name
}

export const SP_COLUMNS: IDaColumn<ISdsfVolume>[] = [
    { header: 'Status', width: 9, right: false, text: v => v.status, color: v => STATUS_COLOR[v.status], sortKey: v => v.status },
    { header: 'CapGB', width: 6, right: true, text: capacityOf, color: () => VALUE, sortKey: v => v.capacity },
    { header: 'Class', width: 12, right: false, text: v => v.storageClass, color: () => IDENTITY, sortKey: v => v.storageClass },
    { header: 'Claim', width: 24, right: false, text: claimOf, color: () => IDENTITY, sortKey: claimOf },
    { header: 'Access', width: 6, right: false, text: accessOf, color: () => VALUE, sortKey: accessOf },
    { header: 'Reclaim', width: 7, right: false, text: v => v.reclaim.toUpperCase(), color: v => v.reclaim === 'Retain' ? E3270Color.YELLOW : VALUE, sortKey: v => v.reclaim },
    { header: 'Age', width: 5, right: false, text: (v, now) => ageOf(v.created, now), color: () => VALUE, sortKey: v => v.created ? -Date.parse(v.created) : 0 },
    { header: 'VolumeName', width: 44, right: false, text: v => v.name, color: () => IDENTITY, sortKey: v => v.name }
]
