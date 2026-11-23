import { IInstanceMessage, IExtensionScope } from '@kwirthmagnify/kwirth-common'
import { I3270Geometry } from './terminal/Terminal3270Types'

// ─── The terminal, chosen in the setup when the channel starts ────────────────────────────────────
export enum ESdsfModel {
    MODEL2 = 'model2',         // 3278-2, 24x80
    MODEL3 = 'model3',         // 3278-3, 32x80: the default
    MODEL5 = 'model5'          // 3278-5, 27x132
}

export enum ESdsfDisplay {
    COLOR = 'color',           // a 3279: the seven colours
    GREEN = 'green'            // a monochrome 3278: green phosphor, normal and intensified
}

export const SDSF_MODEL_GEOMETRY: Record<ESdsfModel, I3270Geometry> = {
    [ESdsfModel.MODEL2]: { rows: 24, cols: 80 },
    [ESdsfModel.MODEL3]: { rows: 32, cols: 80 },
    [ESdsfModel.MODEL5]: { rows: 27, cols: 132 }
}

export interface ISdsfInstanceConfig {
    model: ESdsfModel
    display: ESdsfDisplay
}

// ─── Authorisation (SDSF's own RBAC) ──────────────────────────────────────────────────────────────
// Namespaced with 'sdsf$', the project convention. READ opens the channel and lists pods; CANCEL deletes them.
export enum ESdsfScope {
    READ = 'sdsf$read',
    CANCEL = 'sdsf$cancel',
    // Kwirth's own, on top of every ladder. ADMIN is what starts, halts and drains a node (INIT's S, Z and P).
    CLUSTER = 'cluster',
    ADMIN = 'admin'
}

// The ladder a key is measured against. 'cluster' and 'admin' sit on top, as in every plugin, so an
// administrator reaches SDSF without being granted its own scopes.
export const SDSF_SCOPE_LADDER: string[] = ['', ESdsfScope.READ, ESdsfScope.CANCEL, ESdsfScope.CLUSTER, ESdsfScope.ADMIN]

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
    CANCEL = 'cancel',         // delete the target (force = grace period 0, the CA line command)
    EVENTS = 'events',         // the cluster's events, oldest first: what the LOG panel shows as the SYSLOG
    JOBS = 'jobs',             // every Job and CronJob the key reaches: the ST, O and H panels
    NODES = 'nodes',           // every node, as the INIT panel's initiators
    NODE = 'node'              // start, halt or drain a node (nodeAction); admin only
}

// What a request's target is. LOG is for pods only; CANCEL for pods, Jobs and CronJobs; DESCRIBE for all four.
export enum ESdsfObjectKind {
    POD = 'Pod',
    JOB = 'Job',
    CRONJOB = 'CronJob',
    NODE = 'Node'              // cluster-scoped: no targetNamespace
}

/*
    A node as an initiator of the INIT panel, with SDSF's own status words:
      ACTIVE    Ready and taking pods              DRAINED    cordoned and empty (DaemonSet and static pods aside)
      HALTED    cordoned, still running pods       INACTIVE   not Ready
*/
export enum ESdsfNodeStatus {
    ACTIVE = 'ACTIVE',
    HALTED = 'HALTED',
    DRAINED = 'DRAINED',
    INACTIVE = 'INACTIVE'
}

// The INIT line commands that change a node: S starts it (uncordon), Z halts it (cordon), P drains it.
export enum ESdsfNodeAction {
    START = 'start',
    HALT = 'halt',
    DRAIN = 'drain'
}

// Where a Job or a CronJob stands, as the ST panel's Queue and Status columns say it.
export enum ESdsfJobState {
    WAITING = 'waiting',       // a Job not started yet (no start time): INPUT
    RUNNING = 'running',       // a Job not finished yet: EXECUTION
    COMPLETE = 'complete',     // a Job that ended well: PRINT
    FAILED = 'failed',         // a Job that gave up: PRINT, in red
    SCHEDULED = 'scheduled',   // a CronJob waiting for its next run: INPUT
    SUSPENDED = 'suspended'    // a CronJob with suspend: true: HOLD
}

// One row of the INIT panel: a node, already taken out of the API object.
export interface ISdsfNode {
    name: string
    id: string                 // the initiator's ID: short and unique, the name without what every node shares
    status: ESdsfNodeStatus
    roles: string[]            // node-role.kubernetes.io/<role>: the classes the initiator serves
    pods: number               // its non-terminated pods THE KEY REACHES (the rest are not counted, not shown)
    cpus: number               // allocatable CPU, in cores
    memory: number             // allocatable memory, bytes
    cpu?: number               // % of its allocatable CPU its pods used over the last interval (metrics provider)
    memoryUsed?: number        // working set of its pods, bytes (metrics provider)
    version: string            // kubelet
    internalIp: string
    created: string            // ISO
}

// One row of the ST, O and H panels: a Job or a CronJob, already taken out of the API object.
export interface ISdsfJob {
    kind: ESdsfObjectKind.JOB | ESdsfObjectKind.CRONJOB
    name: string
    namespace: string
    uid: string
    jobId: string              // 'JOB12345', stable for the life of the object
    owner: string              // the service account its pods run as
    cronJob: string            // the CronJob a Job was created by, '' when none
    schedule: string           // a CronJob's schedule
    state: ESdsfJobState
    parallelism: number
    completions: number        // 0 when the Job does not set it
    active: number
    succeeded: number
    failed: number
    start: string              // ISO; for a CronJob, its last schedule
    end: string                // ISO; when a Job completed, '' otherwise
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

// One cluster event, as the LOG panel prints it. Already filtered by the key and mapped by the back.
export interface ISdsfEvent {
    time: string               // ISO: the last time it happened
    type: string               // Normal or Warning
    reason: string
    message: string
    namespace: string
    kind: string               // of the object it is about: Pod, Deployment, Node…
    name: string
    uid: string                // of that object: for a pod, what finds its JobID
    count: number
    source: string             // the component that reported it
}

/*
    What the session asks for. The target is named targetNamespace/targetName/containerName and NOT namespace/pod/
    container on purpose: with those names the core reads them as an instance config and lists the valid
    namespaces and pods on every command — API calls for nothing, since the channel authorises by itself.
*/
export interface ISdsfRequest {
    command: ESdsfCommand
    objectKind?: ESdsfObjectKind  // the target's kind; a pod when absent
    targetNamespace?: string
    targetName?: string
    containerName?: string
    tailLines?: number         // LOG
    force?: boolean            // CANCEL
    nodeAction?: ESdsfNodeAction  // NODE
}

export interface ISdsfMessage extends IInstanceMessage, ISdsfRequest {
    msgtype: 'sdsfmessage'
    id: string
    accessKey: string          // the core refuses a COMMAND without one; the channel authorises with the START key
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
    events?: ISdsfEvent[]      // EVENTS
    jobs?: ISdsfJob[]          // JOBS
    nodes?: ISdsfNode[]        // NODES
    evicted?: number           // NODE drain: the evictions the API server accepted
}
