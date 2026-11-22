import { IInstanceMessage, IExtensionScope } from '@kwirthmagnify/kwirth-common'

export interface ISdsfInstanceConfig {
}

// ─── Authorisation (SDSF's own RBAC) ──────────────────────────────────────────────────────────────
// Namespaced with 'sdsf$', the project convention. READ opens the channel and lists pods; CANCEL deletes them.
export enum ESdsfScope {
    READ = 'sdsf$read',
    CANCEL = 'sdsf$cancel'
}

// The ladder a key is measured against. 'cluster' and 'admin' sit on top, as in every plugin, so an
// administrator reaches SDSF without being granted its own scopes.
export const SDSF_SCOPE_LADDER: string[] = ['', ESdsfScope.READ, ESdsfScope.CANCEL, 'cluster', 'admin']

export const SDSF_SCOPES: IExtensionScope[] = [
    { scope: ESdsfScope.READ,   label: 'SDSF · Read',   description: 'Open SDSF: list pods, browse their logs and describe them' },
    { scope: ESdsfScope.CANCEL, label: 'SDSF · Cancel', description: 'Cancel pods from SDSF (the C and CA line commands delete them)' }
]

// ─── Front ↔ back protocol ────────────────────────────────────────────────────────────────────────
// Block mode: the front asks only when the operator presses an AID key, so these are the only questions.
export enum ESdsfCommand {
    LIST = 'list',             // every pod the key can see, with its metrics when the provider has them
    LOG = 'log',               // a container's log, read once (it is a browse, not a tail)
    DESCRIBE = 'describe',     // a pod described as text lines, events included
    CANCEL = 'cancel'          // delete a pod (force = grace period 0, the CA line command)
}

// Why a command failed. The front decides on THIS, never on the text that travels with it.
export enum ESdsfError {
    NOT_AUTHORIZED = 'notauthorized',
    NOT_FOUND = 'notfound',
    BAD_REQUEST = 'badrequest',
    FAILED = 'failed'
}

// What the metrics provider could give for this LIST.
export enum ESdsfMetricsState {
    AVAILABLE = 'available',       // values are there
    WARMING = 'warming',           // the provider is there but has not taken two readings yet (CPU needs a delta)
    UNAVAILABLE = 'unavailable'    // the 'metrics' provider is not installed: the panel says so
}

export enum ESdsfQos {
    GUARANTEED = 'Guaranteed',
    BURSTABLE = 'Burstable',
    BESTEFFORT = 'BestEffort',
    UNKNOWN = ''
}

export interface ISdsfContainer {
    name: string
    init: boolean
    image: string
    ready: boolean
    restarts: number
    // 'running', 'waiting', 'terminated' or '' when Kubernetes has not reported it yet
    state: string
    // what Kubernetes gives with the state: CrashLoopBackOff, Completed, OOMKilled… '' when nothing
    reason: string
}

// One row of the DA panel, already taken out of the V1Pod. Presentation (8-char JOBNAME, Pos codes, DP in
// hex) is the front's business: this is the data.
export interface ISdsfPod {
    name: string
    namespace: string
    uid: string
    jobId: string              // 'STC12345', 'JOB12345' or 'TSU12345', stable for the life of the pod
    owner: string              // service account
    controllerKind: string     // kind of the first ownerReference, '' for a bare pod
    controllerName: string
    qos: ESdsfQos
    phase: string
    ready: boolean             // every regular container ready
    deleting: boolean          // has a deletionTimestamp
    reason: string             // the most telling waiting/terminated reason, '' when there is none
    priorityClass: string
    priority: number
    restarts: number
    node: string
    created: string            // ISO timestamp
    containers: ISdsfContainer[]
    cpu?: number               // % of the cluster's CPU, when the metrics provider has it
    memory?: number            // working set, bytes
}

export interface ISdsfMessage extends IInstanceMessage {
    msgtype: 'sdsfmessage'
    id: string
    command: ESdsfCommand
    namespace: string
    pod: string
    container: string
    tailLines?: number         // LOG
    force?: boolean            // CANCEL
}

export interface ISdsfMessageResponse extends IInstanceMessage {
    msgtype: 'sdsfmessageresponse'
    id: string
    command: ESdsfCommand
    ok: boolean
    error?: ESdsfError
    detail?: string            // for the long message (PF1), never to decide on
    pods?: ISdsfPod[]          // LIST
    metrics?: ESdsfMetricsState
    clusterCpu?: number        // LIST: CPU used by every pod, % of the cluster
    lines?: string[]           // LOG and DESCRIBE
}
