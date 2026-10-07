import { AsteroidsGame } from './core'
import { IScoreEntry, IScoreStore } from './AsteroidsScores'

/**
 * Channel state.
 *
 * This is what makes the game survive tab switches:
 * Kwirth keeps `channelObject.data` in the ITabObject, which lives outside the
 * React render tree. The TabContent mounts and unmounts; this does not.
 *
 * That is why the AsteroidsGame instance is kept here and NOT in a useState
 * or a useRef of the component.
 */
export interface IAsteroidsData {
    /** The game. undefined until the channel is started. */
    game?: AsteroidsGame

    /** Channel started (Kwirth start/stop). */
    started: boolean

    /** Channel paused (Kwirth pause/continue). */
    paused: boolean

    /** Scoreboard of the game in progress, to paint it without touching the core. */
    score: number
    lives: number
    level: number

    /** Best score of the session. */
    highScore: number

    /** Score table, loaded when the channel starts. */
    scores: IScoreEntry[]

    /** Where the table is persisted. See AsteroidsScores.ts. */
    scoreStore?: IScoreStore

    /** The finished game has not been recorded in the table yet. */
    pendingScore: boolean

    /** Game finished: the TabContent shows the game over banner. */
    gameOver: boolean

    /** Incremented on every relevant event to force a React refresh. */
    revision: number
}

export class AsteroidsData implements IAsteroidsData {
    game?: AsteroidsGame = undefined
    started = false
    paused = false
    score = 0
    lives = 0
    level = 0
    highScore = 0
    scores: IScoreEntry[] = []
    scoreStore?: IScoreStore = undefined
    pendingScore = false
    gameOver = false
    revision = 0
}
