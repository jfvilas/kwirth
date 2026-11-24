import { test, expect, Page } from '@playwright/test'
import { openAsteroids } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.
    zz- so it runs last: it plays a game to the end. The high-score panel is left as it is, never saved.

    trace/screenshot/video 'off' and a goto('about:blank') at the end: the SPA leaves a WebSocket open and,
    with the trace on, the teardown hangs.
*/
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const SHOTS = '../docs/screenshots'   // relative to plugins/asteroids/e2e (Playwright's cwd)

const settle = (page: Page): Promise<void> => page.waitForTimeout(900)

// press() is down+up in ~10 ms and the game reads its input once per frame: held keys are seen.
const hold = async (page: Page, key: string, ms = 150): Promise<void> => {
    await page.keyboard.down(key)
    await page.waitForTimeout(ms)
    await page.keyboard.up(key)
}

test('capture: asteroids README images', async ({ page }) => {
    test.setTimeout(300_000)
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    await openAsteroids(page)
    await expect(page.getByText('Asteroids not started')).toBeVisible({ timeout: 20000 })

    // 1. The setup dialog.
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByRole('menuitem', { name: 'Start', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await settle(page)
    await dialog.screenshot({ path: `${SHOTS}/setup.png` })
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 20000 })

    // 2. A game in play: a few shots fired while turning, so there is something going on.
    await page.locator('canvas').click()
    await hold(page, 'Enter')
    await page.waitForTimeout(2000)
    for (let i = 0; i < 6; i++) {
        await hold(page, 'ArrowLeft', 120)
        await hold(page, 'Space', 60)
        await page.waitForTimeout(150)
    }
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/game.png` })

    // 3. Full screen, with the channel's own bar.
    await page.keyboard.press('Control+Shift+Enter')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${SHOTS}/fullscreen.png` })
    await page.keyboard.press('Control+Shift+Enter')
    await page.waitForTimeout(1200)

    // 4. The high-score table: lose the three lives by thrusting across the field and jumping to hyperspace.
    const panel = page.getByText('High scores')
    await page.locator('canvas').click()
    await page.keyboard.down('ArrowUp')
    const deadline = Date.now() + 150000
    while (Date.now() < deadline) {
        if (await panel.isVisible().catch(() => false)) break
        await hold(page, 'ShiftLeft', 120)
        await page.waitForTimeout(600)
    }
    await page.keyboard.up('ArrowUp')
    await expect(panel).toBeVisible({ timeout: 30000 })
    await settle(page)
    await page.screenshot({ path: `${SHOTS}/high-scores.png` })

    await page.goto('about:blank')
})
