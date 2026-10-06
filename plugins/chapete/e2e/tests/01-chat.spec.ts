import { test, expect, Page } from '@playwright/test'
import { E2E_LLM, FakeLlm, ISession, captureSession, installFakeLlm, login, openChannelPicker, openTabMenu } from './helpers'

/**
 * Serial, and with ONE single page for the whole file: reloading the SPA against the dev server is the
 * dominant cost, so it is paid once. The tests share state and order matters — setup, then turns, then
 * the system prompt, and the new chat last.
 *
 * 🔴 NON DESTRUCTIVE: the fake provider and LLM are added to the dev's AI settings and removed at the end,
 * and the channel's system prompt is put back as it was. No real LLM is reached (see FakeLlm).
 */
test.describe.configure({ mode: 'serial' })

// Trace and video off: the SPA keeps the websocket alive and closing the page hangs finalising the trace.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

let page: Page
const fake = new FakeLlm()
const session: ISession = { auth: '', backend: '' }
let restoreAi: (() => Promise<void>) | undefined

test.beforeAll(async ({ browser }) => {
    await fake.start()
    page = await browser.newPage()
    captureSession(page, session)
    await login(page)
    await expect.poll(() => session.auth, { timeout: 15000 }).not.toBe('')
    restoreAi = await installFakeLlm(session, fake.endpoint)

    const option = await openChannelPicker(page)
    await expect(option).toBeVisible()
    await option.click()
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
})

test.afterAll(async () => {
    await restoreAi?.()
    // navigating away releases the websocket; closing the CONTEXT does not wait for an orderly page close
    await page?.goto('about:blank').catch(() => { })
    await page?.context().close().catch(() => { })
    await fake.stop()
})

test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus && page) {
        await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' })
    }
})

const setupDialog = () => page.getByRole('dialog').filter({ hasText: 'Configure Chapete channel' })
const messageBox = () => page.getByRole('textbox', { name: 'Message', exact: true })
const sendButton = () => page.getByRole('button', { name: 'SEND', exact: true })
const assistantBubbles = () => page.getByTestId('chapete-assistant')
const userBubbles = () => page.getByTestId('chapete-user')
const lastCall = () => fake.calls[fake.calls.length - 1]

const openSetup = async (): Promise<void> => {
    await openTabMenu(page)
    await page.getByText('Start', { exact: true }).click()
    await expect(setupDialog()).toBeVisible()
}

/** Types a question, sends it with Enter and waits for its answer (or its error) to replace 'Thinking...'. */
const ask = async (text: string): Promise<void> => {
    const answered = await assistantBubbles().count()
    await messageBox().fill(text)
    await messageBox().press('Enter')
    await expect(assistantBubbles()).toHaveCount(answered + 1)
    await expect(page.getByText('Thinking...')).toBeHidden({ timeout: 30000 })
}

test('without LLMs, the setup says where to configure them and does not let start', async () => {
    await page.route('**/core/aiconfig/llms', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    try {
        await openSetup()
        await expect(setupDialog().getByText('No LLMs configured', { exact: false })).toBeVisible()
        await expect(setupDialog().getByRole('button', { name: 'OK', exact: true })).toBeDisabled()
        await setupDialog().getByRole('button', { name: 'CANCEL', exact: true }).click()
        await expect(setupDialog()).toBeHidden()
    }
    finally {
        await page.unroute('**/core/aiconfig/llms')
    }
})

test('the setup offers the core LLMs, proposes their temperature and starts the channel', async () => {
    await openSetup()
    await setupDialog().getByRole('combobox').click()
    await page.locator(`li[data-value="${E2E_LLM}"]`).click()
    const temperature = setupDialog().getByLabel('Temperature', { exact: true })
    await expect(temperature).toHaveValue('0.4')
    await temperature.fill('1.1')
    await setupDialog().getByRole('button', { name: 'OK', exact: true }).click()
    await expect(setupDialog()).toBeHidden()

    await expect(page.getByText(`LLM: ${E2E_LLM}`, { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Temperature: 1.1', { exact: true })).toBeVisible()
    await expect(page.getByText('Ask anything.', { exact: false })).toBeVisible()
})

test('a question shows Thinking... and then the answer rendered as Markdown', async () => {
    await messageBox().fill('Hello Chapete')
    await messageBox().press('Enter')
    await expect(userBubbles().last()).toHaveText('Hello Chapete')
    await expect(page.getByText('Thinking...')).toBeVisible()
    await expect(sendButton()).toBeDisabled()

    await expect(page.getByText('Thinking...')).toBeHidden({ timeout: 30000 })
    const answer = assistantBubbles().last()
    await expect(answer.getByRole('heading', { name: 'Fake answer', level: 2 })).toBeVisible()
    await expect(answer.locator('pre code')).toHaveText('Hello Chapete')
    await expect(answer.getByRole('button', { name: 'Copy answer', exact: true })).toBeVisible()

    // what reached the model: the instance temperature, the chosen model, the system prompt and the turn
    expect(lastCall().model).toBe('fake-model')
    expect(lastCall().temperature).toBe(1.1)
    expect(lastCall().messages[0].role).toBe('system')
    expect(lastCall().messages.slice(1)).toEqual([{ role: 'user', content: 'Hello Chapete' }])
})

test('a second turn carries the whole conversation', async () => {
    await ask('and in Python?')
    await expect(assistantBubbles().last()).toContainText('Turns received: 3')
    expect(lastCall().messages.slice(1).map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(lastCall().messages[3].content).toBe('and in Python?')
})

test('Shift+Enter adds a new line and does not send', async () => {
    const calls = fake.calls.length
    await messageBox().fill('line one')
    await messageBox().press('Shift+Enter')
    await messageBox().pressSequentially('line two')
    await expect(messageBox()).toHaveValue('line one\nline two')
    await page.waitForTimeout(500)
    expect(fake.calls.length).toBe(calls)
    await messageBox().fill('')
    await expect(sendButton()).toBeDisabled()
})

test('a provider error shows in the conversation and is not sent back to the model', async () => {
    await ask('please FAIL now')
    const bubble = assistantBubbles().last()
    await expect(bubble).toContainText('fake provider rejected the request')

    await ask('after the error')
    await expect(assistantBubbles().last().getByRole('heading', { name: 'Fake answer' })).toBeVisible()
    const sent = lastCall().messages.map(m => m.content)
    expect(sent.some(c => c.includes('fake provider rejected'))).toBe(false)
    expect(sent[sent.length - 1]).toBe('after the error')
})

test('the system prompt is saved for the channel and used from the next question on', async () => {
    await page.getByRole('button', { name: 'System prompt', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Chapete system prompt' })
    await expect(dialog).toBeVisible()
    const field = dialog.getByRole('textbox', { name: 'System prompt' })
    const original = await field.inputValue()

    try {
        await field.fill('You are the e2e pirate.')
        await dialog.getByRole('button', { name: 'SAVE', exact: true }).click()
        await expect(dialog).toBeHidden()

        await ask('who are you?')
        await expect(assistantBubbles().last()).toContainText('You are the e2e pirate.')
        expect(lastCall().messages[0]).toEqual({ role: 'system', content: 'You are the e2e pirate.' })
    }
    finally {
        // put it back as it was: the system prompt is shared by everyone using the channel
        await page.getByRole('button', { name: 'System prompt', exact: true }).click()
        await expect(dialog).toBeVisible()
        await expect(field).toHaveValue('You are the e2e pirate.')
        await field.fill(original)
        await dialog.getByRole('button', { name: 'SAVE', exact: true }).click()
        await expect(dialog).toBeHidden()
    }
})

test('the system prompt dialog closes on CANCEL without saving', async () => {
    await page.getByRole('button', { name: 'System prompt', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Chapete system prompt' })
    const field = dialog.getByRole('textbox', { name: 'System prompt' })
    const before = await field.inputValue()
    await field.fill('not saved')
    await dialog.getByRole('button', { name: 'CANCEL', exact: true }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'System prompt', exact: true }).click()
    await expect(field).toHaveValue(before)
    await dialog.getByRole('button', { name: 'CANCEL', exact: true }).click()
})

test('New chat empties the conversation and the next question starts from scratch', async () => {
    await page.getByRole('button', { name: 'New chat', exact: true }).click()
    await expect(userBubbles()).toHaveCount(0)
    await expect(assistantBubbles()).toHaveCount(0)
    await expect(page.getByText('Ask anything.', { exact: false })).toBeVisible()

    await ask('fresh start')
    expect(lastCall().messages.slice(1)).toEqual([{ role: 'user', content: 'fresh start' }])
    await expect(assistantBubbles().last()).toContainText('Turns received: 1')
})

test('the message box is disabled while an answer is pending, and enabled again after it', async () => {
    await messageBox().fill('slow one')
    await messageBox().press('Enter')
    await expect(messageBox()).toBeDisabled()
    await expect(page.getByText('Thinking...')).toBeHidden({ timeout: 30000 })
    await expect(messageBox()).toBeEnabled()
})
