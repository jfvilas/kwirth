import { Page, expect } from '@playwright/test'

export const USER = process.env.FLIGHT_STATUS_E2E_USER ?? 'admin'
export const PASS = process.env.FLIGHT_STATUS_E2E_PASS ?? ''

/** The CRA error overlay is painted in an iframe: if present, the front does NOT compile. */
export async function assertFrontCompiles(page: Page): Promise<void> {
    const overlay = page.locator('iframe#webpack-dev-server-client-overlay')
    if (await overlay.count() > 0) {
        throw new Error('The front does NOT compile: CRA overlay present. Restart the dev server before running e2e.')
    }
}

/**
 * Login. Waits for the SPA to paint the form or, if the session was still alive, the resource selector,
 * and only fills the form if it is present.
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
    await assertFrontCompiles(page)
    if (await userField.isVisible().catch(() => false)) {
        await userField.fill(user)
        await page.getByLabel('Password').fill(pass)
        await page.getByRole('button', { name: 'OK' }).click()
    }
    await expect(combo).toBeVisible({ timeout: 60000 })
}

/** Closes any open dialog (from auto-start or other causes). */
export async function dismissOpenDialogs(page: Page): Promise<void> {
    for (const name of ['CANCEL', 'OK', 'Close']) {
        const btn = page.getByRole('button', { name })
        if (await btn.count() > 0) {
            await btn.first().click({ timeout: 1000 }).catch(() => { })
            await page.waitForTimeout(400)
        }
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => { })
}

/** Opens the drawer, expands "Manage extensions" and clicks a sub-item. */
export async function clickExtensionMenuItem(page: Page, label: string): Promise<void> {
    await dismissOpenDialogs(page)
    // the hamburger: a CSS locator, so a MUI backdrop's aria-hidden does not hide it
    await page.locator('header button').first().click({ force: true })
    await page.waitForTimeout(300)
    await page.getByRole('menuitem', { name: /Manage extensions/i }).click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    await page.waitForTimeout(400)
}
