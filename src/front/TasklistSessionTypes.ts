// The front's own state: which tab, how fast, which columns. It lives in the session, in channelObject.data (RF11).

export enum ETasklistTab {
    APPLICATIONS = 'applications',
    PROCESSES = 'processes',
    PERFORMANCE = 'performance',
    NETWORKING = 'networking',
    USERS = 'users'
}

// View → Update Speed, as XP has it. PAUSED asks for nothing until Refresh Now.
export enum EUpdateSpeed {
    HIGH = 'high',
    NORMAL = 'normal',
    LOW = 'low',
    PAUSED = 'paused'
}

export const UPDATE_SPEED_MS: Record<EUpdateSpeed, number> = {
    [EUpdateSpeed.HIGH]: 1000,
    [EUpdateSpeed.NORMAL]: 2000,
    [EUpdateSpeed.LOW]: 4000,
    [EUpdateSpeed.PAUSED]: 0
}

// View → Select Columns, on the Processes tab: the ones with an equivalent (PLAN §2).
export enum EProcessColumn {
    IMAGE_NAME = 'imagename',
    PID = 'pid',
    USER_NAME = 'username',
    CPU = 'cpu',
    CPU_TIME = 'cputime',
    MEM_USAGE = 'memusage',
    PEAK_MEM_USAGE = 'peakmemusage',
    THREADS = 'threads',
    IO_READ_BYTES = 'ioreadbytes',
    IO_WRITE_BYTES = 'iowritebytes'
}

// ─── the desktop's windows ────────────────────────────────────────────────────────────────────────

export const TASK_MANAGER_WINDOW = 'taskmanager'

// Where a window sits on the tab's desktop. Unset x/y/width/height: its first size, centred.
export interface IWindowFrame {
    x?: number
    y?: number
    width?: number
    height?: number
    maximized: boolean
    minimized: boolean
}

// A Notepad on the desktop: a log (read only), an object's YAML (Save applies it) or a blank one from Start.
export interface INotepadWindow {
    id: string
    title: string                                          // the file's name, as Notepad's title says it
    text: string                                           // what it holds now
    saved: string                                          // what it held when last saved (or opened)
    readOnly: boolean
    yaml: boolean                                          // highlighted as YAML
    save?: (text: string) => Promise<string | undefined>  // none: File → Save is off; undefined back: saved; a text: why not
    frame: IWindowFrame
}

export interface ITasklistSession {
    tab: ETasklistTab
    updateSpeed: EUpdateSpeed
    allUsers: boolean                          // 'Show processes from all users'
    columns: EProcessColumn[]                  // the Processes tab's, in order
    widths: Record<string, number>             // every list's column widths, keyed 'list/column'
    sort: Record<string, { column: string; descending: boolean }>   // keyed by list
    graphPerCpu: boolean                       // View → CPU History: One Graph Per CPU (one per node)
}
