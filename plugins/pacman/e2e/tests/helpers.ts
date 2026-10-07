import { Page, expect } from '@playwright/test'

export const USER = process.env.PACMAN_E2E_USER ?? 'admin'
export const PASS = process.env.PACMAN_E2E_PASS ?? ''
export const CLUSTER = process.env.PACMAN_E2E_CLUSTER ?? 'inCluster'

/**
 * Login. Wait for the SPA to paint the login form or, if the session is still alive, the resource
 * selector, and only fill the form if it is present.
 */
export async function login(page: Page, user = USER, pass = PASS): Promise<void> {
    await page.goto('/')
    const userField = page.getByLabel('User')
    const combo = page.getByRole('combobox').first()
    await Promise.race([
        // the front's dev server recompiles and can take well over 30 s to paint
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
 * The CRA error overlay is painted in an iframe: if present, the front does NOT compile.
 */
export async function assertFrontCompiles(page: Page): Promise<void> {
    const overlay = page.locator('iframe#webpack-dev-server-client-overlay')
    if (await overlay.count() > 0) {
        throw new Error('The front does NOT compile: CRA overlay is present. Restart the dev server before running e2e.')
    }
}

/**
 * Open a Pac-Man channel tab: login → Cluster → View=none → Channel=pacman → ADD.
 * Pac-Man is an AUTONOMOUS channel (cluster:false + resourced:false), so its only view is 'none'.
 */
export async function openPacman(page: Page): Promise<void> {
    await login(page)
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: CLUSTER }).click()
    await page.waitForTimeout(800)
    await page.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'none', exact: true }).click()
    await page.waitForTimeout(800)
    const combos = page.getByRole('combobox')
    await combos.nth(await combos.count() - 1).click()
    await page.getByRole('option', { name: 'pacman', exact: true }).click()
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
}

/** Opens the active tab's menu (the gear icon) and picks an entry. */
export async function tabMenu(page: Page, entry: 'Start' | 'Stop' | 'Pause' | 'Resume'): Promise<void> {
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByText(entry, { exact: true }).click()
}

/**
 * Start the active tab. Pac-Man declares `setup: true`, so Start opens the config dialog and it must be
 * confirmed with OK. The sender is left on "Do not notify": an e2e never sends real notifications.
 */
export async function startChannel(page: Page): Promise<void> {
    await tabMenu(page, 'Start')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    await page.waitForTimeout(3000)   // START/RESPONSE → instanceId + the game boots
}

export async function stopChannel(page: Page): Promise<void> {
    await tabMenu(page, 'Stop')
    await page.waitForTimeout(1500)
}

/** Locate the Pac-Man game iframe inside the page. */
export function pacmanFrame(page: Page) {
    return page.frameLocator('iframe[title="Pac-Man"]')
}

/** The core toggles the started tab in and out of fullscreen with Ctrl+Alt+F11. */
export async function toggleFullscreen(page: Page): Promise<void> {
    await page.keyboard.press('Control+Alt+F11')
    await page.waitForTimeout(800)
}
