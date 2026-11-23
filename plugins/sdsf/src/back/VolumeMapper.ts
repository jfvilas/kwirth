import type { V1PersistentVolume, V1PersistentVolumeClaim } from '@kubernetes/client-node'
import { ESdsfObjectKind, ESdsfVolumeStatus, ISdsfVolume } from '../common/SdsfTypes'
import { quantityOf } from './NodeMapper'

/*
    The PersistentVolumes as the SP panel's spool volumes, and the claims still waiting for a volume (the ones
    that hold a pod back) as PENDING rows of their own.
*/

const STATUS: Record<string, ESdsfVolumeStatus> = {
    Bound: ESdsfVolumeStatus.BOUND,
    Available: ESdsfVolumeStatus.AVAILABLE,
    Released: ESdsfVolumeStatus.RELEASED,
    Failed: ESdsfVolumeStatus.FAILED,
    Pending: ESdsfVolumeStatus.PENDING
}

const isoOf = (date: Date | undefined): string => date ? new Date(date).toISOString() : ''

export const mapVolume = (pv: V1PersistentVolume): ISdsfVolume => ({
    name: pv.metadata?.name ?? '',
    kind: ESdsfObjectKind.PERSISTENT_VOLUME,
    status: STATUS[pv.status?.phase ?? ''] ?? ESdsfVolumeStatus.PENDING,
    capacity: quantityOf(pv.spec?.capacity?.storage),
    storageClass: pv.spec?.storageClassName ?? '',
    claimNamespace: pv.spec?.claimRef?.namespace ?? '',
    claimName: pv.spec?.claimRef?.name ?? '',
    accessModes: pv.spec?.accessModes ?? [],
    reclaim: pv.spec?.persistentVolumeReclaimPolicy ?? '',
    created: isoOf(pv.metadata?.creationTimestamp)
})

// A claim with no volume yet: Pending, and not bound to any volume name.
export const isWaitingClaim = (pvc: V1PersistentVolumeClaim): boolean => pvc.status?.phase === 'Pending' && !pvc.spec?.volumeName

export const mapWaitingClaim = (pvc: V1PersistentVolumeClaim): ISdsfVolume => ({
    name: pvc.metadata?.name ?? '',
    kind: ESdsfObjectKind.PVC,
    status: ESdsfVolumeStatus.PENDING,
    capacity: quantityOf(pvc.spec?.resources?.requests?.storage),
    storageClass: pvc.spec?.storageClassName ?? '',
    claimNamespace: pvc.metadata?.namespace ?? '',
    claimName: pvc.metadata?.name ?? '',
    accessModes: pvc.spec?.accessModes ?? [],
    reclaim: '',
    created: isoOf(pvc.metadata?.creationTimestamp)
})
