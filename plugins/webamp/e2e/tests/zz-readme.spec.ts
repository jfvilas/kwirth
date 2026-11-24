import { test, expect } from '@playwright/test'
import { openWebamp, toggleFullscreen, webampFrame } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.
    It does not press Play: the screenshots show the player with the playlist loaded, and nothing is streamed.
*/
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const SHOTS = '../docs/screenshots'   // relative to plugins/webamp/e2e (Playwright's cwd)

test('capture: webamp README images', async ({ page }) => {
    test.setTimeout(240_000)
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    await openWebamp(page)
    await expect(page.getByText('Webamp not started')).toBeVisible({ timeout: 20000 })

    // 1. The setup dialog, with the playlist picker.
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByRole('menuitem', { name: 'Start', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2500)   // the playlist list is fetched from GitHub
    await dialog.screenshot({ path: `${SHOTS}/setup.png` })
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()

    // 2. The player, with the playlist loaded as its tracks.
    const frame = webampFrame(page)
    await expect(frame.getByText('Drag here')).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(5000)
    await page.screenshot({ path: `${SHOTS}/player.png` })

    // 3. Full screen, with the focus inside the player.
    await frame.getByText('Drag here').click()
    await toggleFullscreen(page)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/fullscreen.png` })
    await frame.getByText('Drag here').click()
    await toggleFullscreen(page)

    await page.goto('about:blank')
})
