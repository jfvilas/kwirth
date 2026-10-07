import { Page } from '@playwright/test'

export const USER = process.env.ASTEROIDS_E2E_USER ?? 'admin'
export const PASS = process.env.ASTEROIDS_E2E_PASS ?? ''
export const CLUSTER = process.env.ASTEROIDS_E2E_CLUSTER ?? 'inCluster'

/**
 * Login. Waits for the SPA to really paint —the form or, if the session was still alive, the resource
 * selector— and only fills in the form if it is present.
 */
export async function login(page: Page, user = USER, pass = PASS): Promise<void> {
    await page.goto('/')
    const userField = page.getByLabel('User')
    const combo = page.getByRole('combobox').first()
    await Promise.race([
        userField.waitFor({ state: 'visible', timeout: 30000 }).catch(() => { }),
        combo.waitFor({ state: 'visible', timeout: 30000 }).catch(() => { })
    ])
    if (await userField.isVisible().catch(() => false)) {
        await userField.fill(user)
        await page.getByLabel('Password').fill(pass)
        await page.getByRole('button', { name: 'OK' }).click()
        await page.waitForTimeout(2500)
    }
}

/**
 * The CRA error overlay is painted in an iframe: if it is there, the front end does NOT compile and any later red
 * is noise. It is checked, not dismissed.
 */
export async function assertFrontCompiles(page: Page): Promise<void> {
    const overlay = page.locator('iframe#webpack-dev-server-client-overlay')
    if (await overlay.count() > 0) {
        throw new Error('The front end does NOT compile: there is a CRA overlay. Restart the dev server before running the e2e.')
    }
}

/**
 * Opens a tab of the Asteroids channel: login → Cluster → View=none → Channel=asteroids → ADD.
 * Asteroids is a STANDALONE channel (cluster:false + resourced:false), so its only view is 'none'.
 * It leaves it added but NOT started.
 */
export async function openAsteroids(page: Page): Promise<void> {
    await login(page)
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: CLUSTER }).click()
    await page.waitForTimeout(800)
    await page.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'none', exact: true }).click()
    await page.waitForTimeout(800)
    const combos = page.getByRole('combobox')
    await combos.nth(await combos.count() - 1).click()
    await page.getByRole('option', { name: 'asteroids', exact: true }).click()
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
}

/**
 * Starts the active tab through its menu (gear icon → Start).
 *
 * The channel declares `setup: true`, so Start does NOT start it directly: it first opens the
 * configuration dialog (aspect ratio, theme, controls, pause) and it has to be confirmed with OK. Without that OK the
 * channel stays stopped and the canvas does not appear.
 */
export async function startChannel(page: Page): Promise<void> {
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByText('Start', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    }
    await page.waitForTimeout(2500)   // START/RESPONSE → instanceId + table load
}

/** Stops the active tab through its menu. */
export async function stopChannel(page: Page): Promise<void> {
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByText('Stop', { exact: true }).click()
    await page.waitForTimeout(1500)
}
