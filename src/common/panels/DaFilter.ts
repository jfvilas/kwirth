import { ISdsfPod } from '../SdsfTypes'

/*
    The parameters of the DA command, as z/OS SDSF takes them (IBM, "Display Active Users panel (DA)"):

        Position  IN OUT TRANS READY          include those positions
        Type      JOB STC TSU INIT            include those types
        Only      OJOB OSTC OTSU OINIT
                  OIN OOUT OTRANS OREADY      only that one; one parameter of this column at most
        No        NOJOB NOSTC NOTSU NOINIT
                  NOIN NOOUT NOTRANS NOREADY  exclude it
        All       ALL ALLT ALLP               everything, all the types, all the positions; alone

    At most four parameters, and when two conflict the last one wins. DA with no parameters shows the
    DADFLT of the user's group; this SDSF uses (IN,OUT,TRANS,READY,STC,TSU,JOB): every active pod but the
    initiators. READY is in because a pod starting on its node must not vanish from the DA.

    On Kubernetes:
        JOB    a pod of a Job               IN     Running and Ready
        STC    a pod with any other owner   OUT    Pending with no node yet
        TSU    a bare pod                   READY  Pending on a node, its containers on the way
        INIT   a pod of a DaemonSet         TRANS  Running not Ready, or Terminating
    A pod that ended (Succeeded or Failed) is in no position: the DA is the active address spaces, and
    only ALL or ALLP bring the ended ones in.
*/
export enum EDaType {
    JOB = 'JOB',
    STC = 'STC',
    TSU = 'TSU',
    INIT = 'INIT'
}

export enum EDaPosition {
    IN = 'IN',
    OUT = 'OUT',
    TRANS = 'TRANS',
    READY = 'READY'
}

export interface IDaFilter {
    types: EDaType[]
    positions: EDaPosition[]
    ended: boolean             // the pods that ended, which only ALL and ALLP show
}

export const MAX_DA_PARAMETERS = 4

const ALL_TYPES = Object.values(EDaType)
const ALL_POSITIONS = Object.values(EDaPosition)

export const DEFAULT_DA_FILTER: IDaFilter = {
    types: [EDaType.STC, EDaType.TSU, EDaType.JOB],
    positions: [EDaPosition.IN, EDaPosition.OUT, EDaPosition.TRANS, EDaPosition.READY],
    ended: false
}

export const daTypeOf = (pod: ISdsfPod): EDaType => {
    switch (pod.controllerKind) {
        case 'Job':
            return EDaType.JOB
        case 'DaemonSet':
            return EDaType.INIT
        case '':
            return EDaType.TSU
        default:
            return EDaType.STC
    }
}

// undefined when the pod ended: it is in no position.
export const daPositionOf = (pod: ISdsfPod): EDaPosition | undefined => {
    if (pod.deleting) return EDaPosition.TRANS
    switch (pod.phase) {
        case 'Running':
            return pod.ready ? EDaPosition.IN : EDaPosition.TRANS
        case 'Pending':
            return pod.node ? EDaPosition.READY : EDaPosition.OUT
        case 'Succeeded':
        case 'Failed':
            return undefined
        default:
            return EDaPosition.TRANS
    }
}

export const daFilterMatches = (filter: IDaFilter, pod: ISdsfPod): boolean => {
    if (!filter.types.includes(daTypeOf(pod))) return false
    const position = daPositionOf(pod)
    return position === undefined ? filter.ended : filter.positions.includes(position)
}

const asType = (word: string): EDaType | undefined => ALL_TYPES.find(t => t === word)
const asPosition = (word: string): EDaPosition | undefined => ALL_POSITIONS.find(p => p === word)

const add = <T>(list: T[], value: T): T[] => list.includes(value) ? list : [...list, value]

// The filter the parameters give, or undefined when they are not valid DA parameters.
export const parseDaParameters = (args: string[]): IDaFilter | undefined => {
    if (args.length > MAX_DA_PARAMETERS) return undefined
    const words = args.map(a => a.toUpperCase())
    if (words.some(w => w === 'ALL' || w === 'ALLT' || w === 'ALLP') && words.length > 1) return undefined
    if (words.filter(w => w.startsWith('O') && w !== 'OUT' && (asType(w.slice(1)) || asPosition(w.slice(1)))).length > 1) return undefined

    let filter: IDaFilter = { ...DEFAULT_DA_FILTER }
    for (const word of words) {
        switch (word) {
            case 'ALL':
                filter = { types: ALL_TYPES, positions: ALL_POSITIONS, ended: true }
                continue
            case 'ALLT':
                filter = { ...filter, types: ALL_TYPES }
                continue
            case 'ALLP':
                filter = { ...filter, positions: ALL_POSITIONS, ended: true }
                continue
        }
        const type = asType(word)
        const position = asPosition(word)
        if (type) {
            filter = { ...filter, types: add(filter.types, type) }
            continue
        }
        if (position) {
            filter = { ...filter, positions: add(filter.positions, position) }
            continue
        }
        if (word.startsWith('NO')) {
            const noType = asType(word.slice(2))
            const noPosition = asPosition(word.slice(2))
            if (noType) {
                filter = { ...filter, types: filter.types.filter(t => t !== noType) }
                continue
            }
            if (noPosition) {
                filter = { ...filter, positions: filter.positions.filter(p => p !== noPosition) }
                continue
            }
        }
        if (word.startsWith('O')) {
            const onlyType = asType(word.slice(1))
            const onlyPosition = asPosition(word.slice(1))
            if (onlyType) {
                filter = { ...filter, types: [onlyType] }
                continue
            }
            if (onlyPosition) {
                filter = { ...filter, positions: [onlyPosition], ended: false }
                continue
            }
        }
        return undefined
    }
    return filter
}
