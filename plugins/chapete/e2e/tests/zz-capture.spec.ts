import { test, expect, Page } from '@playwright/test'
import { FakeLlm, IFakeMessage, ISession, captureSession, installFakeLlm, login, openChannelPicker, openTabMenu } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.

    🔴 NON DESTRUCTIVE, like the e2e: the fake provider and LLM are added to the dev's AI settings and removed
    at the end, and no real LLM is reached. The fake answers with canned Markdown, so the screenshots show a
    believable conversation instead of the test's echo.
*/
test.describe.configure({ mode: 'serial' })
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const SHOTS = '../docs/screenshots'   // relative to plugins/chapete/e2e (Playwright's cwd)
const LLM = 'my-llm'

const ANSWERS: Record<string, string> = {
    restart: [
        'Use `kubectl rollout restart`: it replaces the pods one by one, so the Deployment keeps serving.',
        '',
        '```bash',
        'kubectl rollout restart deployment/web -n shop',
        'kubectl rollout status deployment/web -n shop',
        '```',
        '',
        '| step | what happens |',
        '|---|---|',
        '| 1 | the pod template gets a new `restartedAt` annotation |',
        '| 2 | a new ReplicaSet is created |',
        '| 3 | old pods are replaced following the rollout strategy |'
    ].join('\n'),
    undo: [
        'Yes. Every rollout keeps a revision, so you can go back to the previous one:',
        '',
        '```bash',
        'kubectl rollout undo deployment/web -n shop',
        '```',
        '',
        'Add `--to-revision=N` to pick a specific one; `kubectl rollout history` lists them.'
    ].join('\n')
}

const answer = (messages: IFakeMessage[]): string => {
    const last = messages[messages.length - 1]?.content ?? ''
    return /undo|back/i.test(last) ? ANSWERS.undo : ANSWERS.restart
}

let page: Page
const fake = new FakeLlm(answer)
const session: ISession = { auth: '', backend: '' }
let restoreAi: (() => Promise<void>) | undefined

test.beforeAll(async ({ browser }) => {
    await fake.start()
    page = await browser.newPage()
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    captureSession(page, session)
    await login(page)
    await expect.poll(() => session.auth, { timeout: 15000 }).not.toBe('')
    restoreAi = await installFakeLlm(session, fake.endpoint, LLM, 'my-provider', 'my-model')
    const option = await openChannelPicker(page)
    await option.click()
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
})

test.afterAll(async () => {
    await restoreAi?.()
    await page?.goto('about:blank').catch(() => { })
    await page?.context().close().catch(() => { })
    await fake.stop()
})

const settle = (): Promise<void> => page.waitForTimeout(900)
const messageBox = () => page.getByRole('textbox', { name: 'Message', exact: true })

test('capture: chapete README images', async () => {
    // 1. The setup: LLM and temperature.
    await openTabMenu(page)
    await page.getByRole('menuitem', { name: 'Start', exact: true }).click()
    const setup = page.getByRole('dialog').filter({ hasText: 'Configure Chapete channel' })
    await expect(setup).toBeVisible()
    await setup.getByRole('combobox').click()
    await page.locator(`li[data-value="${LLM}"]`).click()
    await settle()
    await setup.screenshot({ path: `${SHOTS}/setup.png` })
    await setup.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(setup).toBeHidden()
    await expect(page.getByText(`LLM: ${LLM}`, { exact: true })).toBeVisible({ timeout: 15000 })

    // 2. Thinking... while the model works.
    await messageBox().fill('How do I restart a Deployment without downtime?')
    await messageBox().press('Enter')
    await expect(page.getByText('Thinking...')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/thinking.png` })
    await expect(page.getByText('Thinking...')).toBeHidden({ timeout: 30000 })

    // 3. A two-turn conversation, rendered as Markdown.
    await messageBox().fill('And if the new version is broken, can I go back?')
    await messageBox().press('Enter')
    await expect(page.getByText('Thinking...')).toBeHidden({ timeout: 30000 })
    await settle()
    await page.screenshot({ path: `${SHOTS}/chat.png` })

    // 4. The channel's system prompt, opened and closed without saving.
    await page.getByRole('button', { name: 'System prompt', exact: true }).click()
    const prompt = page.getByRole('dialog').filter({ hasText: 'Chapete system prompt' })
    await expect(prompt).toBeVisible()
    await settle()
    await prompt.screenshot({ path: `${SHOTS}/system-prompt.png` })
    await prompt.getByRole('button', { name: 'CANCEL', exact: true }).click()
    await expect(prompt).toBeHidden()
})
