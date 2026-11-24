import { test, expect, Page } from '@playwright/test'
import { openDepthcharge, tabMenu, toggleFullscreen } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.

    trace/screenshot/video 'off' and a goto('about:blank') at the end: the SPA leaves a WebSocket open and,
    with the trace on, the teardown hangs.
*/
const SHOTS = '../docs/screenshots'   // relative to plugins/depthcharge/e2e (Playwright's cwd)

// press() is down+up in ~10 ms and the game reads its input once per frame: held keys are seen.
const hold = async (page: Page, key: string, ms: number): Promise<void> => {
    await page.keyboard.down(key)
    await page.waitForTimeout(ms)
    await page.keyboard.up(key)
}

test('capture: depthcharge README images', async ({ page }) => {
    test.setTimeout(240_000)
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    await openDepthcharge(page)
    await expect(page.getByText('Depth Charge not started')).toBeVisible({ timeout: 20000 })

    // No setup: Start starts it.
    await tabMenu(page, 'Start')
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 20000 })

    // 1. The title screen.
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/title.png` })

    // 2. A game in play: start it, sail and drop charges on both sides.
    await canvas.click()
    await hold(page, 'Enter', 150)
    await page.waitForTimeout(4000)
    await hold(page, 'ArrowRight', 500)
    await hold(page, 'z', 80)
    await hold(page, 'x', 80)
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${SHOTS}/game.png` })

    // 3. Full screen.
    await canvas.click()
    await toggleFullscreen(page)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/fullscreen.png` })
    await canvas.click()
    await toggleFullscreen(page)

    await tabMenu(page, 'Stop')
    await page.waitForTimeout(1000)
    await page.goto('about:blank')
})
