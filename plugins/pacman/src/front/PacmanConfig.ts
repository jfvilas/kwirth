import { IPacmanInstanceConfig } from '../common/PacmanTypes'

export interface IPacmanConfig {
    /** Pauses the game automatically when the tab loses the focus. */
    pauseOnBlur: boolean
}

export class PacmanConfig implements IPacmanConfig {
    pauseOnBlur = true
}

export class PacmanInstanceConfig implements IPacmanInstanceConfig {
    senderId?: string
    senderConfigName?: string
}
