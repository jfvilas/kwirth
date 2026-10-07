import { IInstanceMessage } from '@kwirthmagnify/kwirth-common'

/**
 * The Pac-Man channel consumes no cluster data: the game runs entirely in the
 * front end (iframe). The back end exists only to fulfil Kwirth's channel contract
 * and to persist the high scores.
 */
export interface IPacmanMessage extends IInstanceMessage {
    msgtype: 'pacmanmessage'
    text: string
}

export interface IPacmanInstanceConfig {
    /*
        Sender to notify when someone beats the record. Optional: without them
        nothing is notified. They travel to the back end inside `instanceConfig.data`.
    */
    senderId?: string
    senderConfigName?: string
}

/**
 * What the game inside the iframe reports, read from its own state by the bridge the machine adds to it.
 * Without it the plugin had no way to know the score: the game keeps everything inside its closure.
 */
export interface IPacmanGameState {
    score: number
    /** -1 in practice mode, where lives are infinite */
    lives: number
    level: number
    /** the game-over screen is showing */
    over: boolean
}
