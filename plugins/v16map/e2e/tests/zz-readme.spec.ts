import { test, expect } from '@playwright/test'
import { addChannel, login, openTabMenu } from './helpers'

/*
    README captures (docs/screenshots/*.png). Not an assertion test: it drives the app and takes screenshots.

    Unlike the e2e, it shows REAL data: the tiles come from OpenStreetMap and the incidents from the v16
    provider, which reads the DGT's public feed. The channel is stopped at the end.
*/
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const SHOTS = '../docs/screenshots'   // relative to plugins/v16map/e2e (Playwright's cwd)

test('capture: v16map README images', async ({ page }) => {
    test.setTimeout(240_000)
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })
    await login(page)
    await addChannel(page)
    await expect(page.getByText('V16 Map not started')).toBeVisible({ timeout: 20000 })

    // 1. The setup.
    await openTabMenu(page)
    await page.getByRole('menuitem', { name: 'Start', exact: true }).click()
    const setup = page.getByRole('dialog').filter({ hasText: 'Configure V16 Map channel' })
    await expect(setup).toBeVisible()
    await page.waitForTimeout(900)
    await setup.screenshot({ path: `${SHOTS}/setup.png` })
    await setup.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(setup).toBeHidden()

    // 2. Every incident in the country, once the provider's snapshot arrives.
    await expect(page.getByText(/^\d+ situations$/)).toBeVisible({ timeout: 150000 })
    await page.waitForTimeout(4000)   // the tiles
    await page.screenshot({ path: `${SHOTS}/map.png` })

    // 3. A V16 beacon selected from the list (markers can overlap on the map): its details.
    await page.getByText(/^V16 · /).first().click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/selected.png` })

    await openTabMenu(page)
    await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
    await page.waitForTimeout(1000)
    await page.goto('about:blank')
})
