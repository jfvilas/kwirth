import { test, expect, Page } from '@playwright/test'
import { openRallyx, rallyxFrame, toggleFullscreen } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.
    The setup is left on its defaults (no notification) and no score is saved.
*/
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const SHOTS = '../docs/screenshots'   // relative to plugins/rallyx/e2e (Playwright's cwd)

const hold = async (page: Page, key: string, ms: number): Promise<void> => {
    await page.keyboard.down(key)
    await page.waitForTimeout(ms)
    await page.keyboard.up(key)
}

test('capture: rallyx README images', async ({ page }) => {
    test.setTimeout(240_000)
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    await openRallyx(page)
    await expect(page.getByText('Rally-X not started')).toBeVisible({ timeout: 20000 })

    // 1. The setup dialog.
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByRole('menuitem', { name: 'Start', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(900)
    await dialog.screenshot({ path: `${SHOTS}/setup.png` })
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    const canvas = rallyxFrame(page).locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 20000 })

    // 2. The title screen.
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${SHOTS}/title.png` })

    // 3. A round in play: Space starts it, then a few seconds of driving.
    await canvas.click()
    await hold(page, 'Space', 150)
    await page.waitForTimeout(3500)
    for (const key of ['ArrowUp', 'ArrowRight', 'ArrowUp']) await hold(page, key, 900)
    await page.screenshot({ path: `${SHOTS}/game.png` })

    // 4. Full screen, with the focus inside the game.
    await canvas.click()
    await toggleFullscreen(page)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/fullscreen.png` })
    await canvas.click()
    await toggleFullscreen(page)

    await page.goto('about:blank')
})
