import { AbyssPatrolGame } from './core/AbyssPatrolGame'

/**
 * Channel state. Kwirth keeps `channelObject.data` outside the React tree, so the game kept here
 * survives tab switches; the TabContent mounts and unmounts, this does not.
 */
export interface IAbyssPatrolData {
    game?: AbyssPatrolGame
    started: boolean
    paused: boolean
    /** Best score of the session. */
    best: number
}

export class AbyssPatrolData implements IAbyssPatrolData {
    game?: AbyssPatrolGame = undefined
    started = false
    paused = false
    best = 0
}
