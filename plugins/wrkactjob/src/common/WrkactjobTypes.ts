import { IInstanceMessage, IExtensionScope } from '@kwirthmagnify/kwirth-common'
// Types only: the back end imports this file, and the terminal DCE lives in the front end alone.
import type { EDisplay, I3270Geometry } from '@jfvilas/kwirth-dce-blockterm'

// ─── The terminal, chosen in the setup when the channel starts (PRD D10) ─────────────────────────
export enum EWrkModel {
    MODEL_24X80 = '24x80',     // 3179-2 / 3477: the default
    MODEL_27X132 = '27x132'    // 3477-FC in wide mode
}

export const WRK_MODEL_GEOMETRY: Record<EWrkModel, I3270Geometry> = {
    [EWrkModel.MODEL_24X80]: { rows: 24, cols: 80 },
    [EWrkModel.MODEL_27X132]: { rows: 27, cols: 132 }
}

export interface IWrkactjobInstanceConfig {
    model: EWrkModel
    display: EDisplay          // a colour 3477 or a monochrome 5251 (green screen)
}

// ─── Authorisation (the channel's own RBAC) ───────────────────────────────────────────────────────
// Namespaced with 'wrkactjob$', the project convention. READ opens the channel, lists jobs and reads their
// spooled files and job log; END ends them (deletes the pods).
export enum EWrkScope {
    READ = 'wrkactjob$read',
    END = 'wrkactjob$end',
    // Kwirth's own, on top of every ladder, so an administrator reaches WRKACTJOB without its own scopes.
    CLUSTER = 'cluster',
    ADMIN = 'admin'
}

export const WRK_SCOPE_LADDER: string[] = ['', EWrkScope.READ, EWrkScope.END, EWrkScope.CLUSTER, EWrkScope.ADMIN]

export const WRK_SCOPES: IExtensionScope[] = [
    { scope: EWrkScope.READ, label: 'WRKACTJOB · Read', description: 'Open WRKACTJOB: list the active jobs (pods), read their spooled files (logs) and job log (events)' },
    { scope: EWrkScope.END, label: 'WRKACTJOB · End', description: 'End jobs from WRKACTJOB (option 4 and ENDJOB delete pods)' }
]

// ─── Front ↔ back protocol ────────────────────────────────────────────────────────────────────────
// Block mode: the front asks only when the operator presses an AID key, so these are the only questions.
export enum EWrkCommand {
    LIST = 'list',             // every active pod the key can see, with its usage when the metrics provider has it
    LOG = 'log',               // a container's log, read once: a spooled file shown by DSPSPLF
    EVENTS = 'events',         // a pod's events, oldest first: its job log (DSPJOBLOG)
    END = 'end'                // ENDJOB: delete the pod, with the DELAY as grace period (*IMMED = 0)
}

export enum EWrkError {
    NOT_AUTHORIZED = 'notauthorized',
    NOT_FOUND = 'notfound',
    BAD_REQUEST = 'badrequest',
    FAILED = 'failed'
}

// What the metrics provider could give for this LIST.
export enum EWrkMetricsState {
    AVAILABLE = 'available',
    WARMING = 'warming',           // the provider is there but has not taken two readings yet (CPU needs a delta)
    UNAVAILABLE = 'unavailable'    // the 'metrics' provider is not installed
}

// The Type column (PRD D6). SBS is the subsystem's own row, a namespace, which the front draws.
export enum EWrkJobType {
    SBS = 'SBS',               // subsystem monitor: the namespace
    ASJ = 'ASJ',               // autostart job: a pod a Deployment or a StatefulSet keeps alive
    BCH = 'BCH',               // batch: a pod of a Job (or of a CronJob's Job)
    SYS = 'SYS',               // system job: a pod of a DaemonSet
    BCI = 'BCI'                // batch immediate: a bare pod, started by hand
}

// The Status column (PRD D7).
export enum EWrkJobStatus {
    RUN = 'RUN',               // running and using CPU
    DEQW = 'DEQW',             // running, waiting for work (no CPU in the last interval)
    SCDW = 'SCDW',             // pending: not scheduled or not started yet
    MSGW = 'MSGW',             // waiting for the operator: a container failing (CrashLoopBackOff, ImagePullBackOff, OOMKilled…)
    END = 'END'                // ending: being deleted
}

export interface IWrkContainer {
    name: string
    init: boolean
    image: string
    ready: boolean
    restarts: number
    state: string              // 'running', 'waiting', 'terminated' or '' when Kubernetes has not reported it yet
    reason: string             // CrashLoopBackOff, Completed, OOMKilled… '' when nothing
    message: string            // what Kubernetes says with that state, or of the last termination: for 7=Display message
    exitCode?: number          // of the last termination, when there was one
}

// One job of WRKACTJOB, already taken out of the V1Pod. Presentation (10-char names, the indent under its
// subsystem, the views of F11) is the front's business: this is the data.
export interface IWrkJob {
    name: string
    namespace: string          // its subsystem
    uid: string
    user: string               // service account
    type: EWrkJobType
    status: EWrkJobStatus
    program: string            // what the Function column shows after 'PGM-': the main container's image, short
    controllerKind: string     // kind of the first ownerReference, '' for a bare pod
    controllerName: string
    phase: string
    node: string               // its pool
    priorityClass: string
    priority: number
    restarts: number           // its auxiliary I/O
    created: string            // ISO
    message: string            // why it is in MSGW, '' otherwise: the first failing container and what it says
    containers: IWrkContainer[]
    cpu?: number               // % of the cluster's CPU over the last interval (metrics provider)
    cpuSeconds?: number        // CPU used since its containers started, seconds (metrics provider)
    memory?: number            // working set, bytes (metrics provider)
}

// One line of a job log: an event about the pod.
export interface IWrkEvent {
    time: string               // ISO: the last time it happened
    type: string               // Normal or Warning
    reason: string
    message: string
    count: number
    source: string             // the component that reported it
}

/*
    What the session asks for. The target is named targetNamespace/targetName/containerName and NOT
    namespace/pod/container on purpose: with those names the core reads them as an instance config and lists the
    valid namespaces and pods on every command — API calls for nothing, since the channel authorises by itself.
*/
export interface IWrkRequest {
    command: EWrkCommand
    targetNamespace?: string
    targetName?: string
    containerName?: string
    tailLines?: number         // LOG
    delay?: number             // END: seconds the job is given to end (*CNTRLD); ignored with immediate
    immediate?: boolean        // END: OPTION(*IMMED), grace period 0
}

export interface IWrkactjobMessage extends IInstanceMessage, IWrkRequest {
    msgtype: 'wrkactjobmessage'
    id: string
    accessKey: string          // the core refuses a COMMAND without one; the channel authorises with the START key
}

export interface IWrkactjobMessageResponse extends IInstanceMessage {
    msgtype: 'wrkactjobmessageresponse'
    id: string
    command: EWrkCommand
    ok: boolean
    error?: EWrkError
    detail?: string            // for the operator's message line, never to decide on
    jobs?: IWrkJob[]           // LIST
    metrics?: EWrkMetricsState // LIST
    clusterCpu?: number        // LIST: CPU used by every job, % of the cluster
    lines?: string[]           // LOG
    events?: IWrkEvent[]       // EVENTS
}
