import { PacmanMachine } from './PacmanMachine'
import { IScoreEntry, IScoreStore, qualifies } from './PacmanScores'
import { IPacmanGameState } from '../common/PacmanTypes'

/**
 * Channel state.
 *
 * This is what lets the game survive tab switches: Kwirth keeps
 * `channelObject.data` in the ITabObject, which lives outside React's render
 * tree. The TabContent mounts and unmounts; this does not.
 *
 * That is why the PacmanMachine instance is kept here and NOT in a useState
 * nor in a useRef of the component.
 */
export interface IPacmanData {
    /** The game machine (iframe). undefined until the channel is started. */
    machine?: PacmanMachine

    /** Channel started (Kwirth's start/stop). */
    started: boolean

    /** Channel paused (Kwirth's pause/continue). */
    paused: boolean

    /**
     * The pause was put by pauseOnBlur, not asked from the channel menu, so pauseOnBlur may lift it. Here and
     * not in the component, because the component unmounts on every tab switch and would forget it.
     */
    autoPaused: boolean

    /** Score of the game in progress. */
    score: number
    lives: number
    level: number

    /** Best score of the session. */
    highScore: number

    /** High-score table, loaded when the channel starts. */
    scores: IScoreEntry[]

    /** Where the table is persisted. */
    scoreStore?: IScoreStore

    /** The finished game has not been recorded in the table yet. */
    pendingScore: boolean

    /** Game over. */
    gameOver: boolean

    /** Bumped on every relevant event to force a React refresh. */
    revision: number
}

export class PacmanData implements IPacmanData {
    machine?: PacmanMachine = undefined
    started = false
    paused = false
    autoPaused = false
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

/**
 * Applies what the game reported. The game-over transition is the moment that matters: it is when the
 * score is offered to the table, once, and only if it makes it in. A new game clears the offer.
 */
export const applyGameState = (data: IPacmanData, state: IPacmanGameState): void => {
    data.score = state.score
    data.lives = state.lives
    data.level = state.level
    if (state.score > data.highScore) data.highScore = state.score

    if (state.over && !data.gameOver) {
        data.gameOver = true
        data.pendingScore = qualifies(data.scores, state.score)
    }
    else if (!state.over && data.gameOver) {
        data.gameOver = false
        data.pendingScore = false
    }
    data.revision++
}
