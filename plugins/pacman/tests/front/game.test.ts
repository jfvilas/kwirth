import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { applyGameState, PacmanData } from '../../src/front/PacmanData'
import { withBridge } from '../../src/front/PacmanMachine'
import { qualifies, sanitizeEntries, IScoreEntry } from '../../src/front/PacmanScores'
import pacmanGame from '../../src/front/pacman-game.txt'

const entry = (score: number): IScoreEntry => ({ name: 'p', score, level: 1, date: '' })
const playing = (score: number, lives = 3, level = 1) => ({ score, lives, level, over: false })
const over = (score: number) => ({ score, lives: 0, level: 2, over: true })

describe('applyGameState: what the game reports reaches the HUD', () => {
    test('score, lives and level are copied, and the best score follows', () => {
        const data = new PacmanData()
        applyGameState(data, playing(1200, 2, 3))
        assert.equal(data.score, 1200)
        assert.equal(data.lives, 2)
        assert.equal(data.level, 3)
        assert.equal(data.highScore, 1200)
        applyGameState(data, playing(300))
        assert.equal(data.highScore, 1200)
    })

    test('every report bumps the revision, so React repaints', () => {
        const data = new PacmanData()
        applyGameState(data, playing(1))
        applyGameState(data, playing(2))
        assert.equal(data.revision, 2)
    })
})

describe('applyGameState: the end of a game', () => {
    test('a game that makes the table is offered to it, once', () => {
        const data = new PacmanData()
        applyGameState(data, playing(500))
        applyGameState(data, over(500))
        assert.equal(data.gameOver, true)
        assert.equal(data.pendingScore, true)
        // the user saves it: the offer is gone and the next report of the same screen must not bring it back
        data.pendingScore = false
        applyGameState(data, over(500))
        assert.equal(data.pendingScore, false)
    })

    test('a game that does not make a full table is not offered', () => {
        const data = new PacmanData()
        data.scores = Array.from({ length: 10 }, (_v, i) => entry(1000 + i))
        applyGameState(data, over(999))
        assert.equal(data.gameOver, true)
        assert.equal(data.pendingScore, false)
    })

    test('a new game clears the game over and the offer', () => {
        const data = new PacmanData()
        applyGameState(data, over(500))
        applyGameState(data, playing(0))
        assert.equal(data.gameOver, false)
        assert.equal(data.pendingScore, false)
    })
})

describe('qualifies and sanitizeEntries', () => {
    test('a score enters when there is room or it beats the last one, never when it is zero', () => {
        assert.equal(qualifies([], 0), false)
        assert.equal(qualifies([], 1), true)
        const full = Array.from({ length: 10 }, (_v, i) => entry(100 * (10 - i)))
        assert.equal(qualifies(full, 100), false)
        assert.equal(qualifies(full, 101), true)
    })

    test('what comes from the back end is filtered, sorted and trimmed', () => {
        const raw = [entry(5), { name: 'x' }, null, entry(50), { name: 'y'.repeat(40), score: 7 }]
        const clean = sanitizeEntries(raw)
        assert.deepEqual(clean.map(e => e.score), [50, 7, 5])
        assert.equal(clean[1].name.length, 24)
        assert.deepEqual(sanitizeEntries('nope'), [])
    })
})

describe('withBridge', () => {
    test('the bridge goes inside the game closure, right before it closes', () => {
        const game = '(function(){ var level = 1; })();'
        const bridged = withBridge(game)
        assert.ok(bridged.startsWith('(function(){ var level = 1; '))
        assert.ok(bridged.endsWith('})();'))
        assert.ok(bridged.includes('pacman-state'))
        assert.ok(bridged.indexOf('pacman-state') < bridged.lastIndexOf('})();'))
    })

    test('a game with no closure end is served untouched', () => {
        assert.equal(withBridge('var x = 1;'), 'var x = 1;')
    })

    test('on the real game, the bridge lands inside its closure, after everything it reads is declared', () => {
        const bridged = withBridge(pacmanGame)
        const at = bridged.indexOf('pacman-state')
        assert.ok(at > 0)
        // the game's own tail, from its closure end on, is left exactly as it was
        assert.ok(bridged.endsWith(pacmanGame.slice(pacmanGame.lastIndexOf('})();'))))
        for (const declared of ['var getScore', 'var extraLives', 'var level', 'var state;', 'var overState', 'var executive']) {
            const where = bridged.indexOf(declared)
            assert.ok(where >= 0 && where < at, `${declared} must be declared before the bridge`)
        }
    })
})
