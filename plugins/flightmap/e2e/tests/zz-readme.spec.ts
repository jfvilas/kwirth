import { test, expect } from '@playwright/test'
import { addChannel, login, openTabMenu } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.

    Unlike the e2e, it shows REAL data: the tiles come from OpenStreetMap and the positions from the
    flight-status provider. It asks for the Madrid area once (1 OpenSky credit) and stops the channel at the end.
*/
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const SHOTS = '../docs/screenshots'   // relative to plugins/flightmap/e2e (Playwright's cwd)

test('capture: flightmap README images', async ({ page }) => {
    test.setTimeout(240_000)
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    await login(page)
    await addChannel(page)
    await expect(page.getByText('Flight Map not started')).toBeVisible({ timeout: 20000 })

    // 1. The setup: the Madrid area, its cost per day, and a flight to follow.
    await openTabMenu(page)
    await page.getByRole('menuitem', { name: 'Start', exact: true }).click()
    const setup = page.getByRole('dialog').filter({ hasText: 'Configure Flight Map channel' })
    await expect(setup).toBeVisible()
    await setup.getByLabel('Area').click()
    await page.getByRole('option', { name: 'Madrid', exact: true }).click()
    await setup.getByLabel('Seconds between updates').fill('600')
    await page.waitForTimeout(900)
    await setup.screenshot({ path: `${SHOTS}/setup.png` })
    await setup.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(setup).toBeHidden()

    // 2. The aircraft over Madrid, once the first positions arrive.
    await expect(page.getByText(/^\d+ aircraft$/)).toBeVisible({ timeout: 120000 })
    await page.waitForTimeout(4000)   // the tiles
    await page.screenshot({ path: `${SHOTS}/map.png` })

    // 3. One aircraft in flight selected from the list (markers can overlap on the map): its details.
    await page.getByText(/^[\d,]+ ft · /).first().click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/selected.png` })

    await openTabMenu(page)
    await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
    await page.waitForTimeout(1000)
    await page.goto('about:blank')
})
