import { test, expect, Page } from '@playwright/test'

/*
    Provider v16, against a live Kwirth. It checks that the core loaded it, that its two read-only routes
    are behind the accessKey and answer what they promise, and that the provider manager shows it by its
    open source name.

    NON-destructive and offline-safe: it only READS. It never subscribes, so it never makes the provider
    poll the DGT feed, and nothing here depends on the DGT being reachable.
*/

const USER = process.env.V16_E2E_USER ?? 'admin'
const PASS = process.env.V16_E2E_PASS ?? ''
const CFG = '/core/providerconfig/v16'

test.describe.configure({ mode: 'serial' })

interface ISession { bearer: string, backend: string }
interface IResult { status: number, body: unknown }

let page: Page
const session: ISession = { bearer: '', backend: '' }

// The front talks to the back by absolute URL, so the request runs inside the page, with or without the key.
const get = (path: string, withKey = true): Promise<IResult> => page.evaluate(async ({ url, bearer }) => {
    const res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${bearer}`, 'X-Kwirth-App': 'true' } : {} })
    let body: unknown = null
    try { body = await res.json() } catch { /* not JSON */ }
    return { status: res.status, body }
}, { url: `${session.backend}${CFG}${path}`, bearer: withKey ? session.bearer : '' })

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    page.on('request', req => {
        const auth = req.headers()['authorization']
        if (!session.bearer && auth?.startsWith('Bearer ')) {
            session.bearer = auth.slice(7)
            session.backend = new URL(req.url()).origin
        }
    })
    await page.goto('/')
    const userField = page.getByLabel('User')
    const combo = page.getByRole('combobox').first()
    await Promise.race([
        userField.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { }),
        combo.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { })
    ])
    if (await userField.isVisible().catch(() => false)) {
        await userField.fill(USER)
        await page.getByLabel('Password').fill(PASS)
        await page.getByRole('button', { name: 'OK' }).click()
    }
    await expect(combo).toBeVisible({ timeout: 60000 })
    await expect.poll(() => session.bearer, { timeout: 15000 }).not.toBe('')
})

test.afterAll(async () => {
    await page?.goto('about:blank').catch(() => { })
    await page?.context().close().catch(() => { })
})

test('the routes need an accessKey', async () => {
    const res = await get('/state', false)
    expect([401, 403]).toContain(res.status)
})

test('GET /state answers the provider state, well formed', async () => {
    const res = await get('/state')
    expect(res.status).toBe(200)
    const state = res.body as Record<string, unknown>
    expect(typeof state.url).toBe('string')
    expect(state.url as string).toMatch(/^https?:\/\//)
    for (const key of ['intervalSeconds', 'lastPoll', 'situations', 'v16Situations', 'subscribers']) {
        expect(typeof state[key], `state.${key}`).toBe('number')
    }
    expect(typeof state.lastError).toBe('string')
    expect(state.v16Situations as number).toBeLessThanOrEqual(state.situations as number)
})

test('GET /situations answers a list, and v16Only never returns more than all of them', async () => {
    const all = await get('/situations')
    const v16 = await get('/situations?v16Only=true')
    expect(all.status).toBe(200)
    expect(v16.status).toBe(200)
    expect(Array.isArray(all.body)).toBe(true)
    expect(Array.isArray(v16.body)).toBe(true)
    expect((v16.body as unknown[]).length).toBeLessThanOrEqual((all.body as unknown[]).length)
})

test('the provider manager lists this version by its open source name', async () => {
    await page.locator('header button').first().click({ force: true })
    await page.getByRole('menuitem', { name: /Manage extensions/i }).click()
    await page.getByRole('menuitem', { name: 'Providers', exact: true }).click()
    const dialog = page.getByRole('dialog')
    /*
        The EXACT name: a marketplace this Kwirth has registered may still offer the old private 0.1.0,
        called "IRIA V16 Provider" — that is the environment, not this provider, and an exact match does not
        catch it.
    */
    await expect(dialog.getByText('V16 Provider', { exact: true }).first()).toBeVisible({ timeout: 15000 })
})
