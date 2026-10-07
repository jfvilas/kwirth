import { IInstanceMessage } from '@kwirthmagnify/kwirth-common'

/**
 * The Asteroids channel does not consume cluster data: the game runs entirely in the
 * front end. The back end exists only to fulfil the Kwirth channel contract and
 * to leave room for a persisted scoreboard later on.
 */
export interface IAsteroidsMessage extends IInstanceMessage {
    msgtype: 'asteroidsmessage'
    text: string
}

export type TAsteroidsTheme = 'classic' | 'color'

export interface IAsteroidsInstanceConfig {
    /** Aspect ratio of the game world. Between 0.75 and 2.25. */
    aspectRatio: number
    /*
        Sender to notify when someone beats the record. Optional: without them nothing is notified,
        which is the default behaviour. They travel to the back end inside `instanceConfig.data`.
    */
    senderId?: string
    senderConfigName?: string
}
