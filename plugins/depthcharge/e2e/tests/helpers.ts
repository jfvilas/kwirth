import { Page, expect } from '@playwright/test'

export const USER = process.env.DEPTHCHARGE_E2E_USER ?? 'admin'
export const PASS = process.env.DEPTHCHARGE_E2E_PASS ?? ''
export const CLUSTER = process.env.DEPTHCHARGE_E2E_CLUSTER ?? 'inCluster'

/**
 * Login. Waits for the SPA to paint the form or, if the session is still alive, the resource selector, and
 * only fills the form if it is there.
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
 * Cluster → Channel=depthcharge → ADD, leaving the channel added but NOT started. Depth Charge is a
 * standalone channel, so picking it switches the view to 'none' on its own.
 */
export async function openDepthcharge(page: Page): Promise<void> {
    await login(page)
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: CLUSTER }).click()
    await page.waitForTimeout(800)
    const combos = page.getByRole('combobox')
    await combos.nth(await combos.count() - 1).click()
    await page.getByRole('option', { name: 'depthcharge', exact: true }).click()
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
}

/** Opens the active tab's menu (its gear icon) and picks an entry. */
export async function tabMenu(page: Page, entry: 'Start' | 'Stop' | 'Pause' | 'Resume'): Promise<void> {
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByRole('menuitem', { name: entry, exact: true }).click()
}

/** The core toggles the started tab in and out of fullscreen with Ctrl+Shift+Enter. */
export async function toggleFullscreen(page: Page): Promise<void> {
    await page.keyboard.press('Control+Shift+Enter')
    await page.waitForTimeout(800)
}
