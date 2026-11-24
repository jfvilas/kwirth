import { test, expect } from '@playwright/test'
import { openPacman, pacmanFrame, tabMenu, toggleFullscreen } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.

    ⛔ It never presses SAVE in the high-score panel and leaves the setup on its defaults ("Do not notify"):
    saving writes the cluster's table and, with a sender, notifies real people.
*/
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const SHOTS = '../docs/screenshots'   // relative to plugins/pacman/e2e (Playwright's cwd)

test('capture: pacman README images', async ({ page }) => {
    test.setTimeout(240_000)
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    await openPacman(page)
    await expect(page.getByText('Pac-Man not started')).toBeVisible({ timeout: 20000 })

    // 1. The setup dialog.
    await tabMenu(page, 'Start')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(900)
    await dialog.screenshot({ path: `${SHOTS}/setup.png` })
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    const game = pacmanFrame(page).locator('canvas#canvas')
    await expect(game).toBeVisible({ timeout: 20000 })

    // 2. The game's own menu, with the focus in the game (without it, the tab shows 'paused').
    await game.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/menu.png` })

    // 3. A game in play: CHOOSE A GAME → PAC-MAN, then PLAY, and a few seconds of moving.
    for (const key of ['ArrowDown', 'Enter', 'ArrowDown', 'Enter']) {
        await game.press(key)
        await page.waitForTimeout(700)
    }
    await page.waitForTimeout(4500)
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight']) {
        await page.keyboard.down(key)
        await page.waitForTimeout(900)
        await page.keyboard.up(key)
    }
    await page.screenshot({ path: `${SHOTS}/game.png` })

    // 4. Full screen, with the focus inside the game.
    await game.click()
    await toggleFullscreen(page)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/fullscreen.png` })
    await game.click()
    await toggleFullscreen(page)

    await page.goto('about:blank')
})
