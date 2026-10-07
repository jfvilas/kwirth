import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AsteroidsGame, GameStatus } from '../src/front/core'
import { LIVES, EXTRA_LIFE_AT_SCORE, MAX_ASPECT_RATIO, MIN_ASPECT_RATIO } from '../src/front/core/constants'

/*
    The engine is vendored from wuspy/asteroids and is not tested in full: it is third-party code already
    tested at its origin. What IS pinned down here is the contract the plugin UI depends on —
    initial lives, states and reset — because it is what the HUD reads and what decides whether the game
    gets into the table.
*/

test('a game starts with 3 lives', () => {
    assert.equal(LIVES, 3, 'the original arcade starts with 3; if this changes, the game changes')
    const game = new AsteroidsGame()
    assert.equal(game.state.lives, LIVES)
})

test('LIVES is also the CAP on lives that can be accumulated with extra lives', () => {
    // Documents the double use of the constant: lowering LIVES also lowers the reachable maximum.
    assert.equal(EXTRA_LIFE_AT_SCORE > 0, true, 'extra lives are enabled')
    const game = new AsteroidsGame()
    assert.equal(game.state.lives, LIVES, 'the game already starts at the cap')
})

test('a freshly created game is in Init, not running', () => {
    const game = new AsteroidsGame()
    assert.equal(game.state.status, GameStatus.Init)
    assert.equal(game.state.score, 0)
    assert.equal(game.state.level, 1)
})

test('start sets the game running', () => {
    const game = new AsteroidsGame()
    game.aspectRatio = 1.6
    game.start()
    assert.equal(game.state.status, GameStatus.Running)
})

test('starting spawns asteroids: without them there is no game', () => {
    const game = new AsteroidsGame()
    game.aspectRatio = 1.6
    game.start()
    assert.equal(game.state.asteroids.length > 0, true)
})

test('reset returns the game to the complete initial state', () => {
    const game = new AsteroidsGame()
    game.aspectRatio = 1.6
    game.start()
    game.state.score = 12345
    game.state.level = 7
    game.state.lives = 1
    game.reset()
    assert.equal(game.state.score, 0)
    assert.equal(game.state.level, 1)
    assert.equal(game.state.lives, LIVES)
    assert.equal(game.state.status, GameStatus.Init)
})

test('the score starts at zero in every new game', () => {
    const game = new AsteroidsGame()
    game.aspectRatio = 1.6
    game.start()
    assert.equal(game.state.score, 0)
})

test('the world is sized by aspectRatio, not in screen pixels', () => {
    // worldSize is readonly and derived: the world area is constant and the ratio only distributes it.
    // That is why the channel does `game.aspectRatio = ...` and NEVER touches worldSize.
    const game = new AsteroidsGame()
    const square = game.worldSize.width * game.worldSize.height
    game.aspectRatio = 1.6
    assert.equal(game.worldSize.width > game.worldSize.height, true, 'a wide ratio gives a wide world')
    const wide = game.worldSize.width * game.worldSize.height
    assert.equal(Math.abs(wide - square) / square < 0.01, true, 'the world area does not change with the ratio')
})

test('an out-of-range aspectRatio is rejected instead of distorting the world', () => {
    const game = new AsteroidsGame()
    assert.throws(() => { game.aspectRatio = MAX_ASPECT_RATIO + 0.1 })
    assert.throws(() => { game.aspectRatio = MIN_ASPECT_RATIO - 0.1 })
})

test('the channel default aspectRatio (1.6) is valid', () => {
    assert.equal(1.6 >= MIN_ASPECT_RATIO && 1.6 <= MAX_ASPECT_RATIO, true)
    const game = new AsteroidsGame()
    assert.doesNotThrow(() => { game.aspectRatio = 1.6 })
})
