import type { V1Pod, V1Container, V1ContainerStatus, CoreV1Event, V1Job, V1CronJob, V1PodTemplateSpec, V1Node, V1PriorityClass, V1CertificateSigningRequest } from '@kubernetes/client-node'

/*
    A pod as text, close to what `kubectl describe pod` prints: it is what the D line command browses.

    Nothing in Kwirth produced this (ops and magnify hand the raw object to the front), and a 3270 browse
    shows lines, not objects, so it is written here. Pure, like the mapper: the tests feed it pods and
    events written by hand.
*/

const LABEL_WIDTH = 18

const field = (label: string, value: string | number | undefined, indent = 0): string =>
    // At least one blank after the colon, however long the label and deep the indent.
    ' '.repeat(indent) + (label + ':').padEnd(Math.max(LABEL_WIDTH - indent, label.length + 2)) + (value === undefined || value === '' ? '<none>' : String(value))

const isoOf = (date: Date | string | undefined): string => date ? new Date(date).toISOString() : ''

// key=value pairs, the first on the label's line and the rest aligned under it.
const mapLines = (label: string, map: Record<string, string> | undefined, indent = 0): string[] => {
    const entries = Object.entries(map ?? {})
    if (entries.length === 0) return [field(label, undefined, indent)]
    return entries.map(([k, v], i) => i === 0 ? field(label, `${k}=${v}`, indent) : ' '.repeat(LABEL_WIDTH) + `${k}=${v}`)
}

const stateLines = (status: V1ContainerStatus | undefined): string[] => {
    const state = status?.state
    if (state?.running) return [field('State', 'Running', 4), field('Started', isoOf(state.running.startedAt), 6)]
    if (state?.waiting) return [field('State', 'Waiting', 4), field('Reason', state.waiting.reason, 6)]
    if (state?.terminated) return [
        field('State', 'Terminated', 4),
        field('Reason', state.terminated.reason, 6),
        field('Exit Code', state.terminated.exitCode, 6),
        field('Finished', isoOf(state.terminated.finishedAt), 6)
    ]
    return [field('State', undefined, 4)]
}

const containerLines = (c: V1Container, status: V1ContainerStatus | undefined): string[] => {
    const resources = (kind: 'limits' | 'requests'): string => {
        const r = c.resources?.[kind]
        return r ? Object.entries(r).map(([k, v]) => `${k}=${v}`).join(', ') : ''
    }
    return [
        `  ${c.name}:`,
        field('Image', c.image, 4),
        field('Ports', (c.ports ?? []).map(p => `${p.containerPort}/${p.protocol ?? 'TCP'}`).join(', '), 4),
        ...stateLines(status),
        field('Ready', status ? (status.ready ? 'True' : 'False') : undefined, 4),
        field('Restart Count', status?.restartCount ?? 0, 4),
        field('Limits', resources('limits'), 4),
        field('Requests', resources('requests'), 4)
    ]
}

// "5m", "3h", "2d" — the age column of the events.
export const ageOf = (date: Date | string | undefined, now: number): string => {
    if (!date) return '<unknown>'
    const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000))
    if (seconds < 120) return `${seconds}s`
    if (seconds < 7200) return `${Math.round(seconds / 60)}m`
    if (seconds < 172800) return `${Math.round(seconds / 3600)}h`
    return `${Math.round(seconds / 86400)}d`
}

const eventLines = (events: CoreV1Event[], now: number): string[] => {
    if (events.length === 0) return ['Events:           <none>']
    const sorted = [...events].sort((a, b) =>
        new Date(a.lastTimestamp ?? a.eventTime ?? 0).getTime() - new Date(b.lastTimestamp ?? b.eventTime ?? 0).getTime())
    return [
        'Events:',
        '  Type     Reason              Age     From                Message',
        '  ----     ------              ----    ----                -------',
        ...sorted.map(e => '  ' +
            (e.type ?? '').padEnd(9) +
            (e.reason ?? '').padEnd(20) +
            ageOf(e.lastTimestamp ?? e.eventTime, now).padEnd(8) +
            (e.source?.component ?? e.reportingComponent ?? '').padEnd(20) +
            (e.message ?? '').replace(/\s+/g, ' ').trim())
    ]
}

export const describePod = (pod: V1Pod, events: CoreV1Event[], now: number = Date.now()): string[] => {
    const statuses = pod.status?.containerStatuses ?? []
    const initStatuses = pod.status?.initContainerStatuses ?? []
    const controller = pod.metadata?.ownerReferences?.find(o => o.controller) ?? pod.metadata?.ownerReferences?.[0]
    const lines: string[] = [
        field('Name', pod.metadata?.name),
        field('Namespace', pod.metadata?.namespace),
        field('Priority', pod.spec?.priority ?? 0),
        field('Priority Class', pod.spec?.priorityClassName),
        field('Service Account', pod.spec?.serviceAccountName),
        field('Node', pod.spec?.nodeName ? pod.spec.nodeName + (pod.status?.hostIP ? `/${pod.status.hostIP}` : '') : undefined),
        field('Start Time', isoOf(pod.status?.startTime)),
        ...mapLines('Labels', pod.metadata?.labels),
        ...mapLines('Annotations', pod.metadata?.annotations),
        field('Status', pod.metadata?.deletionTimestamp ? 'Terminating' : pod.status?.phase),
        ...(pod.status?.reason ? [field('Reason', pod.status.reason)] : []),
        ...(pod.status?.message ? [field('Message', pod.status.message)] : []),
        field('IP', pod.status?.podIP),
        field('Controlled By', controller ? `${controller.kind}/${controller.name}` : undefined)
    ]
    const initContainers = pod.spec?.initContainers ?? []
    if (initContainers.length > 0) {
        lines.push('Init Containers:')
        for (const c of initContainers) lines.push(...containerLines(c, initStatuses.find(s => s.name === c.name)))
    }
    lines.push('Containers:')
    for (const c of pod.spec?.containers ?? []) lines.push(...containerLines(c, statuses.find(s => s.name === c.name)))
    const conditions = pod.status?.conditions ?? []
    lines.push('Conditions:')
    lines.push('  Type                        Status')
    for (const c of conditions) lines.push('  ' + c.type.padEnd(28) + c.status)
    lines.push(field('QoS Class', pod.status?.qosClass))
    lines.push(...mapLines('Node-Selectors', pod.spec?.nodeSelector))
    const tolerations = (pod.spec?.tolerations ?? []).map(t =>
        `${t.key ?? ''}${t.operator === 'Exists' ? '' : '=' + (t.value ?? '')}${t.effect ? ':' + t.effect : ''}${t.tolerationSeconds !== undefined ? ` for ${t.tolerationSeconds}s` : ''}`)
    lines.push(...(tolerations.length === 0
        ? [field('Tolerations', undefined)]
        : tolerations.map((t, i) => i === 0 ? field('Tolerations', t) : ' '.repeat(LABEL_WIDTH) + t)))
    lines.push(...eventLines(events, now))
    return lines
}

// The pod template a Job or a CronJob runs: its containers, as `kubectl describe` shows them.
const templateLines = (template: V1PodTemplateSpec | undefined): string[] => {
    const lines = ['Pod Template:']
    lines.push(...mapLines('  Labels', template?.metadata?.labels, 2))
    lines.push(field('Service Account', template?.spec?.serviceAccountName, 2))
    lines.push('  Containers:')
    for (const c of template?.spec?.containers ?? []) {
        lines.push(`   ${c.name}:`)
        lines.push(field('Image', c.image, 4))
        lines.push(field('Command', (c.command ?? []).join(' '), 4))
        lines.push(field('Args', (c.args ?? []).join(' '), 4))
    }
    lines.push(field('Restart Policy', template?.spec?.restartPolicy, 2))
    return lines
}

export const describeJob = (job: V1Job, events: CoreV1Event[], now: number = Date.now()): string[] => {
    const controller = job.metadata?.ownerReferences?.find(o => o.controller) ?? job.metadata?.ownerReferences?.[0]
    const conditions = job.status?.conditions ?? []
    return [
        field('Name', job.metadata?.name),
        field('Namespace', job.metadata?.namespace),
        ...mapLines('Labels', job.metadata?.labels),
        ...mapLines('Annotations', job.metadata?.annotations),
        field('Controlled By', controller ? `${controller.kind}/${controller.name}` : undefined),
        field('Parallelism', job.spec?.parallelism ?? 1),
        field('Completions', job.spec?.completions),
        field('Backoff Limit', job.spec?.backoffLimit),
        field('Start Time', isoOf(job.status?.startTime)),
        field('Completed At', isoOf(job.status?.completionTime)),
        field('Pods Statuses', `${job.status?.active ?? 0} Active / ${job.status?.succeeded ?? 0} Succeeded / ${job.status?.failed ?? 0} Failed`),
        'Conditions:',
        '  Type                        Status  Reason',
        ...conditions.map(c => '  ' + c.type.padEnd(28) + c.status.padEnd(8) + (c.reason ?? '')),
        ...templateLines(job.spec?.template),
        ...eventLines(events, now)
    ]
}

export const describeCronJob = (cron: V1CronJob, events: CoreV1Event[], now: number = Date.now()): string[] => [
    field('Name', cron.metadata?.name),
    field('Namespace', cron.metadata?.namespace),
    ...mapLines('Labels', cron.metadata?.labels),
    ...mapLines('Annotations', cron.metadata?.annotations),
    field('Schedule', cron.spec?.schedule),
    field('Time Zone', cron.spec?.timeZone),
    field('Concurrency Policy', cron.spec?.concurrencyPolicy),
    field('Suspend', cron.spec?.suspend ? 'True' : 'False'),
    field('Successful Job History Limit', cron.spec?.successfulJobsHistoryLimit),
    field('Failed Job History Limit', cron.spec?.failedJobsHistoryLimit),
    field('Last Schedule Time', isoOf(cron.status?.lastScheduleTime)),
    field('Active Jobs', (cron.status?.active ?? []).map(a => a.name).join(', ')),
    ...templateLines(cron.spec?.jobTemplate?.spec?.template),
    ...eventLines(events, now)
]

/*
    A node, as `kubectl describe node` prints it. The pods listed are those the KEY reaches (the caller
    filters them): a node is cluster-wide, but what runs on it belongs to namespaces.
*/
export const describeNode = (node: V1Node, pods: V1Pod[], events: CoreV1Event[], now: number = Date.now()): string[] => {
    const info = node.status?.nodeInfo
    const resources = (r: Record<string, string> | undefined): string[] =>
        Object.entries(r ?? {}).map(([k, v]) => '  ' + (k + ':').padEnd(LABEL_WIDTH) + v)
    const taints = (node.spec?.taints ?? []).map(t => `${t.key}${t.value ? '=' + t.value : ''}:${t.effect}`)
    return [
        field('Name', node.metadata?.name),
        ...mapLines('Labels', node.metadata?.labels),
        ...mapLines('Annotations', node.metadata?.annotations),
        field('CreationTimestamp', isoOf(node.metadata?.creationTimestamp)),
        ...(taints.length === 0 ? [field('Taints', undefined)] : taints.map((t, i) => i === 0 ? field('Taints', t) : ' '.repeat(LABEL_WIDTH) + t)),
        field('Unschedulable', node.spec?.unschedulable ? 'true' : 'false'),
        'Conditions:',
        '  Type                Status  Reason                       Message',
        ...(node.status?.conditions ?? []).map(c => '  ' + c.type.padEnd(20) + c.status.padEnd(8) + (c.reason ?? '').padEnd(29) + (c.message ?? '')),
        'Addresses:',
        ...(node.status?.addresses ?? []).map(a => '  ' + (a.type + ':').padEnd(LABEL_WIDTH) + a.address),
        'Capacity:',
        ...resources(node.status?.capacity),
        'Allocatable:',
        ...resources(node.status?.allocatable),
        'System Info:',
        field('OS Image', info?.osImage, 2),
        field('Kernel Version', info?.kernelVersion, 2),
        field('Container Runtime', info?.containerRuntimeVersion, 2),
        field('Kubelet Version', info?.kubeletVersion, 2),
        field('Architecture', info?.architecture, 2),
        field('PodCIDR', node.spec?.podCIDR),
        field('ProviderID', node.spec?.providerID),
        `Non-terminated Pods:  (${pods.length} in total)`,
        '  Namespace                 Name                                        Age',
        '  ---------                 ----                                        ---',
        ...pods.map(p => '  ' + (p.metadata?.namespace ?? '').padEnd(26) + (p.metadata?.name ?? '').padEnd(44) + ageOf(p.metadata?.creationTimestamp, now)),
        ...eventLines(events, now)
    ]
}

// A PriorityClass, as `kubectl describe priorityclass` prints it, with the pods of the class the key reaches.
export const describePriorityClass = (pc: V1PriorityClass, pods: V1Pod[], now: number = Date.now()): string[] => [
    field('Name', pc.metadata?.name),
    field('Value', pc.value),
    field('GlobalDefault', pc.globalDefault ? 'true' : 'false'),
    field('PreemptionPolicy', pc.preemptionPolicy ?? 'PreemptLowerPriority'),
    field('Description', pc.description),
    ...mapLines('Labels', pc.metadata?.labels),
    ...mapLines('Annotations', pc.metadata?.annotations),
    field('CreationTimestamp', isoOf(pc.metadata?.creationTimestamp)),
    `Non-terminated Pods:  (${pods.length} in total)`,
    '  Namespace                 Name                                        Age',
    '  ---------                 ----                                        ---',
    ...pods.map(p => '  ' + (p.metadata?.namespace ?? '').padEnd(26) + (p.metadata?.name ?? '').padEnd(44) + ageOf(p.metadata?.creationTimestamp, now))
]

/*
    A CertificateSigningRequest, close to `kubectl describe csr`. The request itself goes as its PEM: it holds a
    public key and the subject asked for, nothing secret (the private key never leaves whoever asked).
*/
export const describeCsr = (csr: V1CertificateSigningRequest): string[] => {
    const conditions = csr.status?.conditions ?? []
    const pem = csr.spec.request ? Buffer.from(csr.spec.request, 'base64').toString('utf8').split('\n').filter(l => l !== '') : []
    return [
        field('Name', csr.metadata?.name),
        ...mapLines('Labels', csr.metadata?.labels),
        ...mapLines('Annotations', csr.metadata?.annotations),
        field('CreationTimestamp', isoOf(csr.metadata?.creationTimestamp)),
        field('Requesting User', csr.spec.username),
        field('Groups', (csr.spec.groups ?? []).join(', ')),
        field('Signer', csr.spec.signerName),
        field('Usages', (csr.spec.usages ?? []).join(', ')),
        field('Expiration', csr.spec.expirationSeconds === undefined ? undefined : `${csr.spec.expirationSeconds}s`),
        field('Status', conditions.length ? conditions.map(c => c.type).join(',') : 'Pending'),
        'Request:',
        ...pem.map(l => '  ' + l)
    ]
}
