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
// spooled files and job log; SCHEDULE holds, releases and submits job schedule entries (CronJobs: changes and
// starts, deletes nothing); END ends jobs (deletes the pods). PRD-fase3 D18: SCHEDULE sits between the two.
export enum EWrkScope {
    READ = 'wrkactjob$read',
    SCHEDULE = 'wrkactjob$schedule',
    END = 'wrkactjob$end',
    // Kwirth's own, on top of every ladder, so an administrator reaches WRKACTJOB without its own scopes.
    CLUSTER = 'cluster',
    ADMIN = 'admin'
}

export const WRK_SCOPE_LADDER: string[] = ['', EWrkScope.READ, EWrkScope.SCHEDULE, EWrkScope.END, EWrkScope.CLUSTER, EWrkScope.ADMIN]

export const WRK_SCOPES: IExtensionScope[] = [
    { scope: EWrkScope.READ, label: 'WRKACTJOB · Read', description: 'Open WRKACTJOB: list the active jobs (pods), read their spooled files (logs) and job log (events)' },
    { scope: EWrkScope.SCHEDULE, label: 'WRKACTJOB · Schedule', description: 'Hold, release and submit job schedule entries (CronJobs) from WRKJOBSCDE: suspends, resumes and runs them, deletes nothing' },
    { scope: EWrkScope.END, label: 'WRKACTJOB · End', description: 'End jobs from WRKACTJOB (option 4 and ENDJOB delete pods)' }
]

// ─── Front ↔ back protocol ────────────────────────────────────────────────────────────────────────
// Block mode: the front asks only when the operator presses an AID key, so these are the only questions.
export enum EWrkCommand {
    LIST = 'list',             // every active pod the key can see, with its usage when the metrics provider has it
    LOG = 'log',               // a container's log, read once: a spooled file shown by DSPSPLF
    EVENTS = 'events',         // a pod's events, oldest first: its job log (DSPJOBLOG)
    END = 'end',               // ENDJOB: delete the pod, with the DELAY as grace period (*IMMED = 0)
    // PRD-fase3
    SYSTEM = 'system',         // WRKSYSSTS: the jobs in the system, the pools (nodes) and the system ASP (volumes)
    SUBSYSTEMS = 'subsystems', // WRKSBS: the namespaces the key reaches
    SUBSYSTEM_DESCRIPTION = 'subsystemdescription', // DSPSBSD: a namespace's labels, quotas and limit ranges
    MESSAGES = 'messages',     // DSPMSG QSYSOPR: the Warning events the key reaches, newest first
    SCHEDULES = 'schedules',   // WRKJOBSCDE: the CronJobs the key reaches, with their last runs
    HOLD = 'hold',             // HLDJOBSCDE: suspend a CronJob
    RELEASE = 'release',       // RLSJOBSCDE: resume it
    SUBMIT = 'submit'          // SBMJOB: run it now, a Job from its template
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

// ─── PRD-fase3: WRKSYSSTS, WRKSBS, DSPMSG QSYSOPR, WRKJOBSCDE ─────────────────────────────────────

// A main storage pool of WRKSYSSTS: a node (PRD-fase3 D13). Numbering the pools is the front's business.
export interface IWrkPool {
    name: string               // the node
    cpus: number               // allocatable CPUs
    memory: number             // pool size: allocatable memory, bytes
    reserved: number           // reserved size: memory requested by the active pods on it, bytes
    maxActive: number          // allocatable pods
    jobs: number               // active pods on it
    failing: number            // of them, in MSGW
    restarts: number           // of their containers
    cpu?: number               // CPU used by its pods, % of the cluster (metrics provider)
    memoryUsed?: number        // working set of its pods, bytes (metrics provider)
}

// The system ASP: the PersistentVolumes.
export interface IWrkStorage {
    capacity: number           // bytes, every volume
    bound: number              // bytes, the bound ones: '% system ASP used'
    volumes: number
}

export interface IWrkSystem {
    /*
        PRD-fase3 D17: a key below 'cluster' has no node or volume figures (pools empty, no storage) and every
        other figure counts only what it reaches.
    */
    restricted: boolean
    jobs: number               // jobs in system: the active pods the key reaches
    cpu?: number               // % CPU used: of the whole cluster, or of what the key reaches when restricted
    metrics: EWrkMetricsState
    pools: IWrkPool[]
    storage?: IWrkStorage
}

export enum EWrkSubsystemStatus {
    ACTIVE = 'ACTIVE',
    ENDING = 'ENDING'          // the namespace is Terminating
}

// A subsystem of WRKSBS: a namespace.
export interface IWrkSubsystem {
    name: string
    status: EWrkSubsystemStatus
    storage: number            // total storage: memory requested by its active pods, bytes
    pools: string[]            // the nodes its active pods run on, sorted
    jobs: number               // its active pods (those the key reaches)
}

// One resource of a ResourceQuota: DSPSBSD's pool entries.
export interface IWrkQuotaItem {
    quota: string
    resource: string
    hard: string
    used: string
}

// One limit of a LimitRange: DSPSBSD's limits.
export interface IWrkLimitItem {
    limitRange: string
    type: string               // Container, Pod, PersistentVolumeClaim
    resource: string
    min: string
    max: string
    defaultLimit: string
    defaultRequest: string
}

export interface IWrkSubsystemDescription {
    name: string
    status: EWrkSubsystemStatus
    created: string            // ISO
    labels: Record<string, string>
    annotations: Record<string, string>
    pools: string[]            // the nodes its active pods run on (those the key reaches), sorted
    quotas: IWrkQuotaItem[]
    limits: IWrkLimitItem[]
}

// A message of QSYSOPR: a Warning event, with what it is about.
export interface IWrkMessage extends IWrkEvent {
    namespace: string          // '' for a cluster object (a node)
    kind: string               // of the object: Pod, Node, Deployment…
    object: string             // its name
    firstTime: string          // ISO: the first time it happened
}

export enum EWrkRunStatus {
    RUNNING = 'running',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed'
}

// One Job a CronJob started.
export interface IWrkScheduleRun {
    job: string
    started: string            // ISO
    completed: string          // ISO, '' while it runs
    status: EWrkRunStatus
    manual: boolean            // submitted by hand (SBMJOB, kubectl create job --from)
}

// A job schedule entry of WRKJOBSCDE: a CronJob. Translating the schedule to IBM i words is the front's.
export interface IWrkSchedule {
    name: string
    namespace: string
    schedule: string           // the cron expression
    timeZone: string           // '' = the controller's
    held: boolean              // spec.suspend
    concurrencyPolicy: string
    program: string            // the image of its first container, as WRKACTJOB's Function
    user: string               // its service account
    created: string            // ISO
    lastScheduled: string      // ISO, '' when never
    lastSuccessful: string     // ISO, '' when never
    runs: IWrkScheduleRun[]    // newest first
}

/*
    What the session asks for. The target is named targetNamespace/targetName/containerName and NOT
    namespace/pod/container on purpose: with those names the core reads them as an instance config and lists the
    valid namespaces and pods on every command — API calls for nothing, since the channel authorises by itself.
*/
export interface IWrkRequest {
    command: EWrkCommand
    targetNamespace?: string   // the job's subsystem; SUBSYSTEM_DESCRIPTION: the subsystem alone
    targetName?: string        // the job (pod); HOLD, RELEASE, SUBMIT: the job schedule entry (CronJob)
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
    system?: IWrkSystem        // SYSTEM
    subsystems?: IWrkSubsystem[]                // SUBSYSTEMS
    /*
        SUBSYSTEMS, SUBSYSTEM_DESCRIPTION: the system pools in their numbering (PRD-fase3 D13), pool n being
        poolNames[n-1] — every node at 'cluster' level (as WRKSYSSTS numbers them), below it the nodes of the jobs
        the key reaches.
    */
    poolNames?: string[]
    description?: IWrkSubsystemDescription      // SUBSYSTEM_DESCRIPTION
    messages?: IWrkMessage[]   // MESSAGES
    schedules?: IWrkSchedule[] // SCHEDULES
    submitted?: string         // SUBMIT: the Job created
}
