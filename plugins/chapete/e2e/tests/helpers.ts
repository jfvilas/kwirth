import { Page, Locator, expect } from '@playwright/test'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import { AddressInfo } from 'net'

export const USER = process.env.CHAPETE_E2E_USER ?? 'admin'
export const PASS = process.env.CHAPETE_E2E_PASS ?? ''
export const CLUSTER = process.env.CHAPETE_E2E_CLUSTER ?? 'inCluster'
export const CHANNEL = 'chapete'

/** What this e2e adds to the core's AI settings, and removes when it ends. */
export const E2E_PROVIDER = 'chapete-e2e-fake'
export const E2E_LLM = 'chapete-e2e-llm'

/**
 * Login. The front end's dev server recompiles and can take a while to draw, so it waits generously
 * for either the form or the resource selector to appear, and after submitting it waits for the
 * selector rather than a fixed timeout.
 */
export async function login(page: Page, user = USER, pass = PASS): Promise<void> {
    await page.goto('/')
    const userField = page.getByLabel('User')
    const combo = page.getByRole('combobox').first()
    await Promise.race([
        userField.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { }),
        combo.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { })
    ])
    if (await userField.isVisible().catch(() => false)) {
        await userField.fill(user)
        await page.getByLabel('Password').fill(pass)
        await page.getByRole('button', { name: 'OK' }).click()
    }
    await expect(combo).toBeVisible({ timeout: 60000 })
}

/** Cluster → View=cluster → leaves the channel combo open and returns the chapete option. */
export async function openChannelPicker(page: Page): Promise<Locator> {
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: CLUSTER }).click()
    await page.waitForTimeout(800)
    await page.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'cluster', exact: true }).click()
    await page.waitForTimeout(800)
    const combos = page.getByRole('combobox')
    await combos.nth(await combos.count() - 1).click()
    return page.getByRole('option', { name: CHANNEL, exact: true })
}

/** Opens the active tab's menu (the gear icon of the tab, not the one inside the chat). */
export async function openTabMenu(page: Page): Promise<void> {
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.waitForTimeout(500)
}

// ---- the fake LLM ----------------------------------------------------------------------------------

interface IFakeMessage { role: string, content: string }

/** What the fake received, so a test can check what Chapete really sent to the model. */
export interface IFakeCall {
    model: string
    temperature?: number
    messages: IFakeMessage[]
}

/**
 * An OpenAI-compatible server on localhost, which is where the core's back runs in dev. It answers
 * /v1/chat/completions with Markdown that says what it received, so the page itself shows it:
 *   - a last message containing 'FAIL' gets a 400 (not retried by the SDK, so the error shows at once);
 *   - every answer waits a bit, so 'Thinking...' can be seen.
 * No real LLM is ever reached: slow, flaky and paid, and none of that is what is being tested.
 */
export class FakeLlm {
    calls: IFakeCall[] = []
    private server?: Server
    port = 0

    get endpoint(): string { return `http://127.0.0.1:${this.port}/v1` }

    start = async (): Promise<void> => {
        this.server = createServer((req, res) => this.handle(req, res))
        await new Promise<void>(resolve => this.server!.listen(0, '127.0.0.1', resolve))
        this.port = (this.server.address() as AddressInfo).port
    }

    stop = async (): Promise<void> => {
        await new Promise<void>(resolve => this.server ? this.server.close(() => resolve()) : resolve())
    }

    private handle = (req: IncomingMessage, res: ServerResponse): void => {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', async () => {
            if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
                res.writeHead(404).end()
                return
            }
            const parsed = JSON.parse(body) as { model: string, temperature?: number, messages: IFakeMessage[] }
            this.calls.push({ model: parsed.model, temperature: parsed.temperature, messages: parsed.messages })
            await new Promise(r => setTimeout(r, 1500))

            const last = parsed.messages[parsed.messages.length - 1]?.content ?? ''
            if (last.includes('FAIL')) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: { message: 'fake provider rejected the request', type: 'invalid_request_error' } }))
                return
            }
            const system = parsed.messages.find(m => m.role === 'system')?.content ?? '(none)'
            const turns = parsed.messages.filter(m => m.role !== 'system').length
            const content = `## Fake answer\n\n**Turns received:** ${turns}\n\n**System:** ${system}\n\n\`\`\`text\n${last}\n\`\`\``
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                id: `chatcmpl-${this.calls.length}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: parsed.model,
                choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
            }))
        })
    }
}

// ---- the core's AI settings, touched without destroying them ---------------------------------------

export interface ISession { auth: string, backend: string }

/**
 * Captures the Authorization header of a call the app already makes, instead of handling credentials
 * here. Must be called BEFORE login.
 */
export const captureSession = (page: Page, session: ISession): void => {
    page.on('request', req => {
        const h = req.headers()['authorization']
        if (h && !session.auth && req.url().includes('/config/')) {
            session.auth = h
            session.backend = new URL(req.url()).origin
        }
    })
}

const aiConfig = async (session: ISession, what: 'providers' | 'llms', body?: unknown): Promise<unknown[]> => {
    const r = await fetch(`${session.backend}/core/aiconfig/${what}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Authorization': session.auth, 'X-Kwirth-App': 'true', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    expect(r.ok, `aiconfig ${what}: HTTP ${r.status}`).toBe(true)
    return body === undefined ? await r.json() as unknown[] : []
}

/**
 * 🔴 NON DESTRUCTIVE. The fake provider and LLM are ADDED to whatever the dev has, and 'restore' writes
 * back exactly what was read — keys included, since the core returns them real. A leftover of a previous
 * run that died before restoring is dropped, rather than piling up.
 */
export const installFakeLlm = async (session: ISession, endpoint: string) => {
    const isOurs = (x: unknown, key: 'name' | 'id', value: string) => (x as Record<string, unknown>)[key] === value
    const providers = (await aiConfig(session, 'providers')).filter(p => !isOurs(p, 'name', E2E_PROVIDER))
    const llms = (await aiConfig(session, 'llms')).filter(l => !isOurs(l, 'id', E2E_LLM))

    await aiConfig(session, 'providers', [...providers, { name: E2E_PROVIDER, type: 'openai-compat', key: 'sk-e2e-fake', models: [], endpoint }])
    await aiConfig(session, 'llms', [...llms, { id: E2E_LLM, provider: E2E_PROVIDER, model: 'fake-model', temperature: 0.4, useProviderKey: true, key: '' }])

    return async (): Promise<void> => {
        await aiConfig(session, 'providers', providers)
        await aiConfig(session, 'llms', llms)
        // read back: what is there now is what was there before, and nothing of ours is left
        expect((await aiConfig(session, 'providers')).map(p => (p as Record<string, unknown>).name)).toEqual(providers.map(p => (p as Record<string, unknown>).name))
        expect((await aiConfig(session, 'llms')).map(l => (l as Record<string, unknown>).id)).toEqual(llms.map(l => (l as Record<string, unknown>).id))
    }
}
