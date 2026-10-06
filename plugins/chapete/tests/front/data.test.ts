import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { abandonPending, completeAnswer, conversationOf, IChapeteEntry, isThinking } from '../../src/front/ChapeteData'
import { EChapeteRole } from '../../src/common/ChapeteTypes'

const user = (content: string): IChapeteEntry => ({ role: EChapeteRole.USER, content })
const assistant = (content: string): IChapeteEntry => ({ role: EChapeteRole.ASSISTANT, content })
const waiting = (id: string): IChapeteEntry => ({ role: EChapeteRole.ASSISTANT, content: '', pendingId: id })

describe('conversationOf', () => {
    test('sends user and assistant turns, in order and without the UI fields', () => {
        assert.deepEqual(conversationOf([user('a'), assistant('b'), user('c')]), [
            { role: 'user', content: 'a' },
            { role: 'assistant', content: 'b' },
            { role: 'user', content: 'c' }
        ])
    })

    test('errors are never sent back to the model', () => {
        const error: IChapeteEntry = { role: EChapeteRole.ASSISTANT, content: '401 bad key', error: true }
        assert.deepEqual(conversationOf([user('a'), error, user('again')]), [
            { role: 'user', content: 'a' },
            { role: 'user', content: 'again' }
        ])
    })

    test('the bubble still waiting is not sent', () => {
        assert.deepEqual(conversationOf([user('a'), waiting('q1')]), [{ role: 'user', content: 'a' }])
    })
})

describe('isThinking', () => {
    test('only while some answer is pending', () => {
        assert.equal(isThinking([]), false)
        assert.equal(isThinking([user('a'), assistant('b')]), false)
        assert.equal(isThinking([user('a'), waiting('q1')]), true)
    })
})

describe('completeAnswer', () => {
    test('the waiting bubble gets the text', () => {
        const entries = [user('a'), waiting('q1')]
        completeAnswer(entries, { id: 'q1', text: '**hi**', elapsed: 5 })
        assert.deepEqual(entries[1], { role: EChapeteRole.ASSISTANT, content: '**hi**' })
        assert.equal(isThinking(entries), false)
    })

    test('an error turns the bubble into an error', () => {
        const entries = [user('a'), waiting('q1')]
        completeAnswer(entries, { id: 'q1', error: 'boom', elapsed: 5 })
        assert.equal(entries[1].content, 'boom')
        assert.equal(entries[1].error, true)
        assert.equal(entries[1].usageLimit, undefined)
    })

    test('a usage limit is flagged on the bubble', () => {
        const entries = [user('a'), waiting('q1')]
        completeAnswer(entries, { id: 'q1', error: 'limit', usageLimit: true, elapsed: 5 })
        assert.equal(entries[1].usageLimit, true)
    })

    test('an answer nobody waits for (new chat meanwhile) changes nothing', () => {
        const entries = [user('b')]
        completeAnswer(entries, { id: 'q1', text: 'late', elapsed: 5 })
        assert.deepEqual(entries, [user('b')])
    })

    test('only the bubble with the same id is completed', () => {
        const entries = [waiting('q1'), waiting('q2')]
        completeAnswer(entries, { id: 'q2', text: 'two', elapsed: 1 })
        assert.equal(entries[0].pendingId, 'q1')
        assert.equal(entries[1].content, 'two')
    })
})

describe('abandonPending', () => {
    test('a stop turns what was in flight into an error, and leaves the rest alone', () => {
        const entries = [user('a'), assistant('b'), user('c'), waiting('q2')]
        abandonPending(entries)
        assert.equal(isThinking(entries), false)
        assert.equal(entries[3].error, true)
        assert.match(entries[3].content, /channel was stopped/)
        assert.deepEqual(entries[1], assistant('b'))
    })
})
