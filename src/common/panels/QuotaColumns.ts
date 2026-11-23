import { ISdsfQuotaItem } from '../SdsfTypes'
import { E3270Color } from '@jfvilas/kwirth-dce-blockterm'
import { ageOf, IDaColumn } from './DaColumns'

/*
    The RES columns: one resource of a ResourceQuota per row, what is used of what it allows. %Used goes
    yellow from 75, red from 90, and says FULL at the limit: a namespace there cannot create one more.
*/

const IDENTITY = E3270Color.BLUE
const VALUE = E3270Color.GREEN

export const percentText = (q: ISdsfQuotaItem): string => q.percent >= 100 ? 'FULL' : q.percent.toFixed(1)

export const percentColor = (q: ISdsfQuotaItem): E3270Color => {
    if (q.percent >= 90) return E3270Color.RED
    if (q.percent >= 75) return E3270Color.YELLOW
    return VALUE
}

export const RES_QUOTA_COLUMN: IDaColumn<ISdsfQuotaItem> = {
    header: 'Quota', width: 8, right: false,
    text: q => q.name.toUpperCase().slice(0, 8), color: () => IDENTITY, sortKey: q => q.name
}

export const RES_COLUMNS: IDaColumn<ISdsfQuotaItem>[] = [
    { header: 'Resource', width: 26, right: false, text: q => q.resource, color: () => IDENTITY, sortKey: q => q.resource },
    { header: 'Used', width: 8, right: true, text: q => q.used, color: () => VALUE, sortKey: q => q.percent },
    { header: 'Hard', width: 8, right: true, text: q => q.hard, color: () => VALUE, sortKey: q => q.hard },
    { header: '%Used', width: 6, right: true, text: percentText, color: percentColor, sortKey: q => q.percent },
    { header: 'Namespace', width: 14, right: false, text: q => q.namespace, color: () => IDENTITY, sortKey: q => q.namespace },
    { header: 'QuotaName', width: 32, right: false, text: q => q.name, color: () => IDENTITY, sortKey: q => q.name },
    { header: 'Age', width: 5, right: false, text: (q, now) => ageOf(q.created, now), color: () => VALUE, sortKey: q => q.created ? -Date.parse(q.created) : 0 }
]
