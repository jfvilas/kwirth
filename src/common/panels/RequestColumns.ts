import { ISdsfSystemRequest } from '../SdsfTypes'
import { E3270Color } from '../terminal/Terminal3270Types'
import { ageOf, IDaColumn } from './DaColumns'

/*
    The SR columns: a pending CertificateSigningRequest as an outstanding reply of SDSF's SYSTEM REQUESTS. The
    reply ID numbers them in order of arrival; Type is always CSR (z/OS has WTORs and action messages, this
    cluster only has these). PF11 brings the signer and the usages.
*/

const IDENTITY = E3270Color.BLUE
const VALUE = E3270Color.GREEN

export const SR_REPLY_COLUMN: IDaColumn<ISdsfSystemRequest> = {
    header: 'ReplyId', width: 8, right: false,
    text: r => r.id, color: () => E3270Color.WHITE, sortKey: r => r.id
}

export const SR_COLUMNS: IDaColumn<ISdsfSystemRequest>[] = [
    { header: 'Type', width: 4, right: false, text: () => 'CSR', color: () => E3270Color.YELLOW, sortKey: () => 'CSR' },
    { header: 'Age', width: 5, right: false, text: (r, now) => ageOf(r.created, now), color: () => VALUE, sortKey: r => r.created ? -Date.parse(r.created) : 0 },
    { header: 'Name', width: 24, right: false, text: r => r.name, color: () => IDENTITY, sortKey: r => r.name },
    { header: 'Requestor', width: 28, right: false, text: r => r.requestor, color: () => IDENTITY, sortKey: r => r.requestor },
    { header: 'Signer', width: 36, right: false, text: r => r.signer, color: () => IDENTITY, sortKey: r => r.signer },
    { header: 'Usages', width: 29, right: false, text: r => r.usages.join(','), color: () => VALUE, sortKey: r => r.usages.join(',') }
]
