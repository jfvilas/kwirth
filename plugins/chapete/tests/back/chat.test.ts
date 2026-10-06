import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { EUsagePeriod, EUsageUnit } from '@kwirthmagnify/kwirth-common-ai'
import { EUsageScope, UsageLimitError } from '@kwirthmagnify/kwirth-common-ai/back'
import { invalidConversation, IChapeteTurn, runTurn } from '../../src/back/ChapeteChat'
import { EChapeteRole, IChapeteMessage } from '../../src/common/ChapeteTypes'
import { FAKE_MODEL, fakeDeps, llm, provider } from '../helpers'

const user = (content: string): IChapeteMessage => ({ role: EChapeteRole.USER, content })
const assistant = (content: string): IChapeteMessage => ({ role: EChapeteRole.ASSISTANT, content })

const turn = (over: Partial<IChapeteTurn> = {}): IChapeteTurn => ({
    config: { llmId: 'fake-llm', temperature: 0.9 },
    llms: [llm()],
    providers: [provider()],
    system: 'Be brief.',
    request: { id: 'q1', messages: [user('hello')] },
    ...over
})

describe('runTurn: what reaches the model', () => {
    test('the system prompt goes as system, not as a message', async () => {
        const { deps, calls } = fakeDeps()
        await runTurn(turn(), deps)
        assert.equal(calls.length, 1)
        assert.equal(calls[0].system, 'Be brief.')
        assert.deepEqual(calls[0].messages, [{ role: 'user', content: 'hello' }])
    })

    test('the whole conversation goes, in order, with the SDK roles', async () => {
        const { deps, calls } = fakeDeps()
        const messages = [user('write a loop in Go'), assistant('for i := 0; i < 3; i++ {}'), user('and in Python?')]
        await runTurn(turn({ request: { id: 'q2', messages } }), deps)
        assert.deepEqual(calls[0].messages, [
            { role: 'user', content: 'write a loop in Go' },
            { role: 'assistant', content: 'for i := 0; i < 3; i++ {}' },
            { role: 'user', content: 'and in Python?' }
        ])
    })

    test('the temperature is the instance one, not the LLM one', async () => {
        const { deps, calls } = fakeDeps()
        await runTurn(turn({ config: { llmId: 'fake-llm', temperature: 1.4 }, llms: [llm({ temperature: 0.1 })] }), deps)
        assert.equal(calls[0].temperature, 1.4)
    })

    test('a temperature of 0 is kept, not replaced by a default', async () => {
        const { deps, calls } = fakeDeps()
        await runTurn(turn({ config: { llmId: 'fake-llm', temperature: 0 } }), deps)
        assert.equal(calls[0].temperature, 0)
    })

    test('the model built from the chosen LLM and the providers is the one used', async () => {
        const { calls } = fakeDeps()
        const built: Array<{ llmId: string, providers: string[] }> = []
        const second = llm({ id: 'second', model: 'other' })
        await runTurn(turn({ config: { llmId: 'second', temperature: 0.5 }, llms: [llm(), second] }), {
            buildModel: (l, p) => { built.push({ llmId: l.id, providers: p.map(x => x.name) }); return FAKE_MODEL },
            generateText: async (o) => { calls.push(o); return { text: 'x' } }
        })
        assert.deepEqual(built, [{ llmId: 'second', providers: ['fake-provider'] }])
        assert.equal(calls[0].model, FAKE_MODEL)
    })
})

describe('runTurn: what comes back', () => {
    test('the answer carries the text and the id of the question', async () => {
        const { deps } = fakeDeps(async () => ({ text: '# Title\n\n```go\nfmt.Println("hi")\n```' }))
        const answer = await runTurn(turn(), deps)
        assert.equal(answer.id, 'q1')
        assert.equal(answer.text, '# Title\n\n```go\nfmt.Println("hi")\n```')
        assert.equal(answer.error, undefined)
        assert.ok(answer.elapsed >= 0)
    })

    test('an empty answer of the model is an answer, not an error', async () => {
        const { deps } = fakeDeps(async () => ({ text: '' }))
        const answer = await runTurn(turn(), deps)
        assert.equal(answer.text, '')
        assert.equal(answer.error, undefined)
    })

    test('a provider failure comes back as an error with its text', async () => {
        const { deps } = fakeDeps(async () => { throw new Error('401 Incorrect API key provided') })
        const answer = await runTurn(turn(), deps)
        assert.equal(answer.id, 'q1')
        assert.equal(answer.error, '401 Incorrect API key provided')
        assert.equal(answer.usageLimit, undefined)
        assert.equal(answer.text, undefined)
    })

    test('something thrown that is not an Error still comes back as text', async () => {
        const { deps } = fakeDeps(async () => { throw 'socket hang up' })
        const answer = await runTurn(turn(), deps)
        assert.equal(answer.error, 'socket hang up')
    })

    test('a usage limit is flagged as such, with its reason', async () => {
        const limit = new UsageLimitError({ scope: EUsageScope.LLM_KEY, unit: EUsageUnit.CALLS, period: EUsagePeriod.DAY, limit: 10, current: 10 })
        const { deps } = fakeDeps(async () => { throw limit })
        const answer = await runTurn(turn(), deps)
        assert.equal(answer.usageLimit, true)
        assert.equal(answer.error, limit.message)
        assert.match(answer.error!, /10 of 10/)
    })
})

describe('runTurn: what is not even tried', () => {
    test('no LLM chosen', async () => {
        const { deps, calls } = fakeDeps()
        const answer = await runTurn(turn({ config: { llmId: '', temperature: 0.5 } }), deps)
        assert.match(answer.error!, /No LLM selected/)
        assert.equal(calls.length, 0)
    })

    test('an LLM that is no longer configured', async () => {
        const { deps, calls } = fakeDeps()
        const answer = await runTurn(turn({ config: { llmId: 'gone', temperature: 0.5 } }), deps)
        assert.match(answer.error!, /'gone' is no longer configured/)
        assert.equal(calls.length, 0)
    })

    test('an LLM whose model cannot be built (no key, no provider)', async () => {
        const { calls } = fakeDeps()
        const answer = await runTurn(turn(), { buildModel: () => null, generateText: async (o) => { calls.push(o); return { text: '' } } })
        assert.match(answer.error!, /could not be built/)
        assert.match(answer.error!, /'fake-provider'/)
        assert.equal(calls.length, 0)
    })

    test('a broken conversation keeps the id, so the waiting bubble is completed', async () => {
        const { deps, calls } = fakeDeps()
        const answer = await runTurn(turn({ request: { id: 'q9', messages: [] } }), deps)
        assert.equal(answer.id, 'q9')
        assert.match(answer.error!, /empty/)
        assert.equal(calls.length, 0)
    })
})

describe('invalidConversation', () => {
    test('a conversation ending with the user is valid', () => {
        assert.equal(invalidConversation([user('a')]), undefined)
        assert.equal(invalidConversation([user('a'), assistant('b'), user('c')]), undefined)
    })

    test('empty or missing', () => {
        assert.match(invalidConversation([])!, /empty/)
        assert.match(invalidConversation(undefined)!, /empty/)
    })

    test('the last message must be the user one', () => {
        assert.match(invalidConversation([user('a'), assistant('b')])!, /last message/)
    })

    test('an unknown role is rejected', () => {
        const odd = { role: 'system', content: 'x' } as unknown as IChapeteMessage
        assert.match(invalidConversation([odd, user('a')])!, /Unknown role 'system'/)
    })

    test('a message without text is rejected', () => {
        const odd = { role: EChapeteRole.USER } as unknown as IChapeteMessage
        assert.match(invalidConversation([odd])!, /no text/)
    })
})
