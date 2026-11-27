import { IInstanceMessage, IExtensionScope } from '@kwirthmagnify/kwirth-common'

// ─── Authorisation (the channel's own RBAC) ───────────────────────────────────────────────────────
// Namespaced with 'tasklist$', the project convention. READ opens the window and lists everything the key
// reaches; END ends processes, process trees and tasks (deletes pods, their controllers and Deployments) and
// creates new tasks (pods). Log Off (deleting a namespace) and Shut Down (a node) are for 'admin' alone.
export enum ETasklistScope {
    READ = 'tasklist$read',
    END = 'tasklist$end',
    // Kwirth's own, on top of every ladder, so an administrator reaches the Task Manager without its own scopes.
    CLUSTER = 'cluster',
    ADMIN = 'admin'
}

export const TASKLIST_SCOPE_LADDER: string[] = ['', ETasklistScope.READ, ETasklistScope.END, ETasklistScope.CLUSTER, ETasklistScope.ADMIN]

export const TASKLIST_SCOPES: IExtensionScope[] = [
    { scope: ETasklistScope.READ, label: 'Task Manager · Read', description: 'Open the Task Manager: see the processes (pods), applications (Deployments), performance, networking and users (namespaces), and read the processes\' logs' },
    { scope: ETasklistScope.END, label: 'Task Manager · End', description: 'End, restart and edit processes (delete, replace or change pods), end process trees (delete their controllers), end and edit tasks (Deployments, StatefulSets, DaemonSets) and run new tasks (create pods)' }
]

// ─── Front ↔ back protocol ────────────────────────────────────────────────────────────────────────
export enum ETasklistCommand {
    SNAPSHOT = 'snapshot',                 // everything the window shows, at the Update Speed
    END_PROCESS = 'endprocess',            // delete a pod
    END_PROCESS_TREE = 'endprocesstree',   // delete the pod's controller (its Deployment, StatefulSet, DaemonSet or Job)
    END_TASK = 'endtask',                  // delete an application: a Deployment, StatefulSet or DaemonSet
    NEW_TASK = 'newtask',                  // create a pod from an image (Create New Task)
    LOG_OFF = 'logoff',                    // delete a namespace (Users)
    SHUT_DOWN = 'shutdown',                // cordon, drain or uncordon a node
    LOG = 'log',                           // a container's log, read once (View Log)
    RESTART_PROCESS = 'restartprocess',    // replace a pod: its controller makes another, or a bare one is recreated
    GET_YAML = 'getyaml',                  // a pod or an application as YAML, to edit (Edit)
    APPLY_YAML = 'applyyaml'               // the edited YAML, replacing the object
}

// What Edit and End Task act on besides a pod: the controllers an application can be.
export const APPLICATION_KINDS = ['Deployment', 'StatefulSet', 'DaemonSet']

export enum ETasklistError {
    ACCESS_DENIED = 'accessdenied',
    NOT_FOUND = 'notfound',
    FAILED = 'failed'
}

// The Shut Down menu, on a node (PRD D6).
export enum EShutDownAction {
    STAND_BY = 'standby',      // cordon
    TURN_OFF = 'turnoff',      // drain: cordon and evict every pod that is not a DaemonSet's
    RESTART = 'restart'        // uncordon
}

export interface ITasklistContainer {
    name: string
    image: string
    state: string              // Running, Waiting (reason) or Terminated (reason)
    ready: boolean
    restarts: number
    cpu?: number               // % of the cluster
    memory?: number            // working set, bytes
}

export interface ITasklistOwner {
    kind: string               // the controller that owns the pod — a ReplicaSet already resolved to its Deployment
    name: string
}

export interface ITasklistProcess {
    uid: string
    pid: number                // stable while the channel lives: a multiple of 4, as Windows gives them
    name: string
    namespace: string
    node: string
    phase: string
    startTime?: string
    owner?: ITasklistOwner
    cpu?: number               // % of the cluster's CPU over the provider's last interval
    cpuTime?: number           // seconds of CPU its containers have used
    memory?: number            // working set, bytes
    peakMemory?: number        // the highest working set seen while the channel lives
    ioRead?: number            // bytes read from disk by its containers
    ioWrite?: number           // bytes written
    containers: ITasklistContainer[]
}

export interface ITasklistNode {
    name: string
    ready: boolean
    unschedulable: boolean
    cpuCapacity: number            // cores
    cpuAllocatable: number
    memoryCapacity: number         // bytes
    memoryAllocatable: number
    cpu?: number                   // % of the node's own CPU
    memory?: number                // working set of the node, bytes
    rxBytesPerSecond?: number      // its default interface
    txBytesPerSecond?: number
}

export interface ITasklistApplication {
    kind: string                   // its controller: Deployment, StatefulSet or DaemonSet
    namespace: string
    name: string
    replicas: number
    readyReplicas: number
}

export interface ITasklistUser {
    id: number                     // stable while the channel lives
    name: string
    phase: string                  // Active or Terminating
    pods: number
}

export interface ITasklistRequests {
    cpu: number                    // cores requested by every pod
    memory: number                 // bytes
}

export interface ITasklistMetrics {
    cpu: number                    // % of the cluster's CPU in use
    memory: number                 // bytes in use (working set) in the whole cluster
    interval: number               // seconds between the provider's readings
}

export interface ITasklistSnapshot {
    processes: ITasklistProcess[]
    nodes: ITasklistNode[]
    users: ITasklistUser[]
    applications: ITasklistApplication[]
    requests: ITasklistRequests
    metrics?: ITasklistMetrics     // absent while the 'metrics' provider is missing or warming up
}

export interface ITasklistRequest {
    command: ETasklistCommand
    targetNamespace?: string       // END_PROCESS, END_PROCESS_TREE, END_TASK, NEW_TASK
    targetName?: string            // the pod, the application, the new pod's name, the namespace (LOG_OFF) or the node (SHUT_DOWN)
    targetKind?: string            // END_TASK, GET_YAML, APPLY_YAML: Pod, or the application's controller
    yaml?: string                  // APPLY_YAML
    image?: string                 // NEW_TASK
    shutDown?: EShutDownAction     // SHUT_DOWN
    containerName?: string         // LOG
    tailLines?: number             // LOG: how many of the last lines
}

/*
    'Show processes from all users' unchecked hides what XP hides: the system's own accounts (SYSTEM, LOCAL
    SERVICE, NETWORK SERVICE). Here, Kubernetes' own namespaces.
*/
export const isSystemUser = (namespace: string): boolean => namespace.startsWith('kube-')

export interface ITasklistMessage extends IInstanceMessage, ITasklistRequest {
    msgtype: 'tasklistmessage'
    id: string
    accessKey: string              // the core refuses a COMMAND without one; the channel authorises with the START key
}

export interface ITasklistMessageResponse extends IInstanceMessage {
    msgtype: 'tasklistmessageresponse'
    id: string
    command: ETasklistCommand
    ok: boolean
    error?: ETasklistError
    detail?: string                // for the dialog, never to decide on
    snapshot?: ITasklistSnapshot   // SNAPSHOT
    canEnd?: boolean               // SNAPSHOT: the key may end and create (greys the buttons out when not)
    isAdmin?: boolean              // SNAPSHOT: Log Off and Shut Down
    lines?: string[]               // LOG
    yaml?: string                  // GET_YAML
}
