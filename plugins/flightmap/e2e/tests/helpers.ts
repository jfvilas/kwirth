import { Page, WebSocketRoute, expect } from '@playwright/test'

export const USER = process.env.FLIGHTMAP_E2E_USER ?? 'admin'
export const PASS = process.env.FLIGHTMAP_E2E_PASS ?? ''
export const CLUSTER = process.env.FLIGHTMAP_E2E_CLUSTER ?? 'inCluster'
export const CHANNEL = 'flightmap'

/** 1×1 transparent PNG: what the map gets instead of OpenStreetMap tiles. */
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/**
 * The tiles are not fetched from OpenStreetMap: a run would load hundreds of them from a volunteer-run
 * service, and whether they draw is not what is being tested.
 */
export async function blockTiles(page: Page): Promise<void> {
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: BLANK_PNG }))
}

/**
 * Login. Waits for the SPA to really paint —the form or, if the session was still alive, the resource
 * selector— and only fills in the form if it is present. './' and not '/': Kwirth may be served under
 * a path, like /kwirth/ in a cluster.
 */
export async function login(page: Page, user = USER, pass = PASS): Promise<void> {
    await page.goto('./')
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

/**
 * Cluster → View → Channel → ADD, leaving the channel added but NOT started. The view is NOT chosen
 * here: picking a standalone channel switches it to 'none' on its own, and that is part of what is
 * tested (the tab is then named after the channel).
 */
export async function addChannel(page: Page): Promise<void> {
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: CLUSTER }).click()
    await page.waitForTimeout(800)
    const combos = page.getByRole('combobox')
    await combos.nth(await combos.count() - 1).click()
    await page.getByRole('option', { name: CHANNEL, exact: true }).click()
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
}

/** Opens the active tab's menu (its gear icon). */
export async function openTabMenu(page: Page): Promise<void> {
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.waitForTimeout(500)
}

/**
 * Sits in the middle of the front end's websockets: every frame goes through, except the DATA of this
 * channel, which is kept in 'received' instead of reaching the page. On top of that the test pushes
 * messages to the page as if the back end had sent them. That is what makes the map testable with
 * known data: the real provider's snapshot would otherwise replace it whenever it arrived.
 */
export class SocketTap {
    private routes: WebSocketRoute[] = []
    /** instance id of the channel, taken from the core's answer to START */
    instance = ''
    /** every message of this channel the real back end sent, parsed */
    received: Array<Record<string, unknown>> = []

    install = async (page: Page): Promise<void> => {
        await page.routeWebSocket(/.*/, ws => {
            const server = ws.connectToServer()
            this.routes.push(ws)
            ws.onMessage(message => server.send(message))
            server.onMessage(message => {
                if (!this.isChannelData(message)) ws.send(message)
            })
        })
    }

    /** records what is this channel's, and says whether it is DATA to hold back */
    private isChannelData = (message: string | Buffer): boolean => {
        try {
            const msg = JSON.parse(message.toString()) as Record<string, unknown>
            if (msg.channel !== CHANNEL) return false
            this.received.push(msg)
            if (msg.action === 'start' && msg.flow === 'response' && typeof msg.instance === 'string') this.instance = msg.instance
            return msg.type === 'data'
        }
        catch { return false /* not JSON: not ours */ }
    }

    /** waits for START to be answered, so there is an instance to address */
    waitForInstance = async (): Promise<string> => {
        await expect.poll(() => this.instance, { timeout: 20000 }).not.toBe('')
        return this.instance
    }

    /** pushes a message of this channel to every open socket of the page */
    push = (payload: Record<string, unknown>): void => {
        const msg = { channel: CHANNEL, instance: this.instance, type: 'data', action: 'none', flow: 'unsolicited', ...payload }
        for (const ws of this.routes) ws.send(JSON.stringify(msg))
    }
}
