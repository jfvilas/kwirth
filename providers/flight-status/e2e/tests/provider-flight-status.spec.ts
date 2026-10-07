import { test, expect, Page, Locator } from '@playwright/test'
import { login, clickExtensionMenuItem, dismissOpenDialogs } from '../helpers'

/*
    Provider flight-status (PAID). Validates the "provider owns its configuration" model end to end:

      - the provider renders ITS OWN dialog from the gear icon, not the generic schema form;
      - reads and writes of its configRouter need a Kwirth accessKey;
      - credentials travel like any other field: GET returns them real, the dialog pre-fills them masked
        with an eye toggle, and what is saved is what gets stored — an emptied key is emptied;
      - validation in the dialog blocks an enabled source without a key;
      - the quota section shows every configured source.

    NON-destructive: it snapshots the configuration before touching anything and restores it in a
    'finally'. Every value it writes carries the prefix 'e2e-fs-'. It never subscribes, so no upstream
    API (OpenSky, AviationStack, AeroAPI) is ever called.
*/

const PREFIX = 'e2e-fs-'
const CFG = '/core/providerconfig/flight-status'
// Not the title: the provider manager card carries the same display name, so it would match the manager too.
const DIALOG_MARK = 'OpenSky Network (live positions)'

interface ISession {
    bearer: string
    backend: string
}

interface IApiResult {
    status: number
    text: string
}

// The accessKey lives in React state: it is captured from the front's own requests.
const watchSession = (page: Page): ISession => {
    const session: ISession = { bearer: '', backend: '' }
    page.on('request', req => {
        const auth = req.headers()['authorization']
        if (!session.bearer && auth?.startsWith('Bearer ')) {
            session.bearer = auth.slice(7)
            session.backend = new URL(req.url()).origin
        }
    })
    return session
}

const api = async (page: Page, session: ISession, method: string, path: string, body?: unknown): Promise<IApiResult> => {
    return await page.evaluate(async ({ method, body, url, bearer }) => {
        const res = await fetch(url, {
            method,
            headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', 'X-Kwirth-App': 'true' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        })
        return { status: res.status, text: await res.text() }
    }, { method, body, url: `${session.backend}${CFG}${path}`, bearer: session.bearer })
}

const getConfig = async (page: Page, session: ISession) => {
    const res = await api(page, session, 'GET', '/config')
    expect(res.status, 'GET /config with an accessKey').toBe(200)
    return JSON.parse(res.text)
}

const openDialog = async (page: Page): Promise<Locator> => {
    await dismissOpenDialogs(page)
    await clickExtensionMenuItem(page, 'Providers')
    const manager = page.getByRole('dialog').filter({ hasText: /Manage providers/i })
    await manager.waitFor({ timeout: 10000 })
    await manager.getByPlaceholder('Filter…').first().fill('flight-status')
    await page.waitForTimeout(500)
    // By role: the tooltip wrapper carries aria-label="Configure" too, so an attribute locator finds two per card
    const gear = manager.getByRole('button', { name: 'Configure', exact: true })
    // The manager reloads its list every time a configuration dialog closes: give it time to repaint
    await expect(gear, 'only the flight-status card should be left').toHaveCount(1, { timeout: 15000 })
    await gear.click()
    // Its own dialog, not the generic schema form. The OpenSky section is only painted once GET /config answered.
    const dialog = page.getByRole('dialog').filter({ hasText: DIALOG_MARK })
    await expect(dialog, 'the provider must render its own dialog, loaded').toBeVisible({ timeout: 15000 })
    await expect(dialog.getByRole('heading', { name: 'Flight Status Provider', exact: true })).toBeVisible()
    return dialog
}

// Cancel must really close it: the manager stays open behind, and the next test reopens from there.
const closeDialog = async (dialog: Locator) => {
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog, 'Cancel closes the dialog').toBeHidden()
}

test.describe.configure({ mode: 'serial' })

test.describe('flight-status provider', () => {
    let page: Page
    let session: ISession
    let original: unknown

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage()
        session = watchSession(page)
        await login(page)
        await clickExtensionMenuItem(page, 'Providers')
        await page.getByRole('dialog').filter({ hasText: /Manage providers/i }).waitFor({ timeout: 10000 })
        expect(session.bearer, 'an authenticated request should have been captured by now').not.toBe('')
        original = await getConfig(page, session)
    })

    test.afterAll(async () => {
        const restore = await api(page, session, 'PUT', '/config', original)
        expect(restore.status, 'the original configuration must be restored').toBe(200)
        await page.close()
    })

    test('configRouter: reads and writes need an accessKey', async () => {
        const anonymous = await page.evaluate(async ({ backend, cfg }) => ({
            get: (await fetch(`${backend}${cfg}/config`)).status,
            put: (await fetch(`${backend}${cfg}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status,
            status: (await fetch(`${backend}${cfg}/status`)).status,
        }), { backend: session.backend, cfg: CFG })
        expect(anonymous, 'the core must reject every call with no accessKey').toEqual({ get: 403, put: 403, status: 403 })
        expect((await api(page, session, 'GET', '/status')).status).toBe(200)
    })

    test('GET /config returns the REAL credentials, and the dialog pre-fills them masked with an eye', async () => {
        const cfg = await getConfig(page, session)
        cfg.aviationstack = { enabled: false, accessKey: `${PREFIX}as-key`, monthlyRequests: 100 }
        cfg.aeroapi = { ...cfg.aeroapi, enabled: false, apiKey: `${PREFIX}fa-key` }
        expect((await api(page, session, 'PUT', '/config', cfg)).status).toBe(200)

        const back = await getConfig(page, session)
        expect(back.aviationstack.accessKey, 'the key comes back real, not redacted').toBe(`${PREFIX}as-key`)
        expect(back.aeroapi.apiKey).toBe(`${PREFIX}fa-key`)
        expect('secretsSet' in back, 'no has-secret flags instead of the value').toBe(false)

        const dialog = await openDialog(page)
        const field = dialog.getByLabel('Access key', { exact: true })
        await expect(field).toHaveValue(`${PREFIX}as-key`)
        await expect(field, 'masked by default').toHaveAttribute('type', 'password')
        await field.locator('xpath=ancestor::div[contains(@class,"MuiInputBase-root")][1]').getByRole('button').click()
        await expect(field, 'the eye reveals it').toHaveAttribute('type', 'text')
        await expect(dialog.getByLabel('API key', { exact: true })).toHaveValue(`${PREFIX}fa-key`)

        // The browser must never fill in the saved Kwirth login: it would be stored as the OpenSky credentials
        for (const label of ['Client secret', 'Access key', 'API key']) {
            await expect(dialog.getByLabel(label, { exact: true }), `${label} opts out of password autofill`).toHaveAttribute('autocomplete', 'new-password')
        }
        await expect(dialog.getByLabel('Client ID', { exact: true }), 'and Client ID out of username autofill').toHaveAttribute('autocomplete', 'off')
        await closeDialog(dialog)
    })

    test('Save stores what is on screen and closes: an emptied key is emptied', async () => {
        const dialog = await openDialog(page)
        await dialog.getByLabel('Access key', { exact: true }).fill('')
        const cache = dialog.getByLabel('Positions cache (s)', { exact: true })
        await cache.fill('23')
        await dialog.getByRole('button', { name: 'Save' }).click()
        await expect(dialog, 'a successful Save closes the dialog: there is nothing left to cancel').toBeHidden()

        const back = await getConfig(page, session)
        expect(back.positionTtlSec).toBe(23)
        expect(back.aviationstack.accessKey, 'an empty field is NOT "keep the previous one"').toBe('')
        expect(back.aeroapi.apiKey, 'untouched fields keep their value').toBe(`${PREFIX}fa-key`)
    })

    test('validation blocks an enabled source with no key, and nothing is stored', async () => {
        const before = await getConfig(page, session)
        const dialog = await openDialog(page)
        await dialog.getByLabel('API key', { exact: true }).fill('')
        await dialog.getByText('FlightAware AeroAPI (enrichment)').click() // toggles the switch through its label
        await dialog.getByRole('button', { name: 'Save' }).click()
        await expect(dialog.getByText('aeroapi is enabled but has no API key')).toBeVisible()
        // Visible is not enough: it must be on screen without scrolling, next to the Save that caused it
        await expect(dialog.getByText('aeroapi is enabled but has no API key'), 'the error is not hidden below the scroll').toBeInViewport()
        await expect(dialog, 'a rejected Save keeps the dialog open to fix it').toBeVisible()
        expect(await getConfig(page, session), 'a rejected save leaves the stored configuration untouched').toEqual(before)
        await closeDialog(dialog)
    })

    test('quota section lists every configured source; the dialog has a fixed size and Cancel on the right', async () => {
        const cfg = await getConfig(page, session)
        cfg.opensky = { clientId: '', clientSecret: '', dailyCredits: 0 }
        cfg.aeroapi = { enabled: true, apiKey: `${PREFIX}fa-key`, monthlyBudgetUsd: 7, costPerCallUsd: 0.005 }
        expect((await api(page, session, 'PUT', '/config', cfg)).status).toBe(200)

        const dialog = await openDialog(page)
        await expect(dialog.getByText('opensky', { exact: true }), 'OpenSky is always a source').toBeVisible()
        await expect(dialog.getByText(/\/ 400 \(paced up to/), 'anonymous OpenSky has 400 credits a day').toBeVisible()
        await expect(dialog.getByText('aeroapi', { exact: true })).toBeVisible()
        await expect(dialog.getByText(/\/ 7 \(paced up to/), 'the AeroAPI budget is the configured one').toBeVisible()

        const paper = page.locator('.MuiDialog-paper').filter({ hasText: DIALOG_MARK })
        const box = await paper.boundingBox()
        expect(Math.round(box?.width ?? 0)).toBe(640)
        expect(Math.round(box?.height ?? 0)).toBe(640)
        // textContent, not innerText: MUI uppercases buttons through CSS
        const buttons = await dialog.locator('.MuiDialogActions-root button').allTextContents()
        expect(buttons.at(-1), 'Cancel is the right-most action').toBe('Cancel')
        await closeDialog(dialog)
    })
})
