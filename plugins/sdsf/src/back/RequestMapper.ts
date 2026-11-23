import type { V1CertificateSigningRequest } from '@kubernetes/client-node'
import { ISdsfSystemRequest } from '../common/SdsfTypes'

/*
    The CertificateSigningRequests as the SR panel's system requests: on z/OS, SR lists the messages that wait
    for the operator's reply (WTORs); on Kubernetes, a CSR waits for somebody to approve or deny it. Only the
    pending ones: once a condition says Approved or Denied, nobody is waiting any more.
*/
export const isPending = (csr: V1CertificateSigningRequest): boolean =>
    !(csr.status?.conditions ?? []).some(c => c.type === 'Approved' || c.type === 'Denied')

const createdOf = (csr: V1CertificateSigningRequest): string => {
    const created = csr.metadata?.creationTimestamp
    return created ? new Date(created).toISOString() : ''
}

// The pending ones, oldest first, numbered as z/OS numbers its outstanding replies: 01, 02…
export const mapRequests = (csrs: V1CertificateSigningRequest[]): ISdsfSystemRequest[] =>
    csrs
        .filter(isPending)
        .sort((a, b) => createdOf(a).localeCompare(createdOf(b)) || (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? ''))
        .map((csr, i) => ({
            name: csr.metadata?.name ?? '',
            id: String(i + 1).padStart(2, '0'),
            signer: csr.spec.signerName,
            requestor: csr.spec.username ?? '',
            usages: csr.spec.usages ?? [],
            created: createdOf(csr)
        }))
