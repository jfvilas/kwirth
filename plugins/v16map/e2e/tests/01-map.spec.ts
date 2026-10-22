import { test, expect, Page } from '@playwright/test'
import { addChannel, blockTiles, login, openTabMenu, SocketTap } from './helpers'

/**
 * Serial, and with ONE single page for the whole file: reloading the SPA is the dominant cost, so it is
 * paid once. The tests share state and order matters — added, setup, the map with known data, changes,
 * the real feed, and stop last.
 *
 * The map is fed by INJECTED messages (SocketTap), so what it shows is known in advance; what the real
 * v16 provider sends is held back from the page and only checked by one test, which can be skipped
 * with V16MAP_E2E_SKIP_LIVE=1 when the DGT is not reachable from the cluster.
 *
 * Read-only: the channel writes nothing, and the v16 provider's configuration is not touched.
 */
test.describe.configure({ mode: 'serial' })

// Trace and video off: the SPA keeps the websocket alive and closing the page hangs finalising the trace.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

let page: Page
const tap = new SocketTap()

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    await blockTiles(page)
    await tap.install(page)
    await login(page)
    await addChannel(page)
})

test.afterAll(async () => {
    // navigating away releases the websocket; closing the CONTEXT does not wait for an orderly page close
    await page?.goto('about:blank').catch(() => { })
    await page?.context().close().catch(() => { })
})

test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus && page) {
        await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' })
    }
})

const setupDialog = () => page.getByRole('dialog').filter({ hasText: 'Configure V16 Map channel' })
const markers = () => page.locator('svg [data-marker-id]')
const marker = (id: string) => page.locator(`svg [data-marker-id="${id}"]`)

const beacon = { id: 'e2e-1', lat: 37.85428, lon: -4.779133, v16: true, road: 'A-4', km: '404.821', cause: 'vehicleObstruction', detail: 'vehicleStuck', municipality: 'Córdoba', province: 'Córdoba', community: 'Andalucía', start: '2026-09-26T07:56:22.000+02:00' }
const beacon2 = { id: 'e2e-2', lat: 40.4, lon: -3.7, v16: true, road: 'M-30', km: '5', cause: 'vehicleObstruction', municipality: 'Madrid', province: 'Madrid', start: '2026-09-26T08:00:00.000+02:00' }
const works = { id: 'e2e-3', lat: 39.994446, lon: -3.6054852, v16: false, road: 'N-400', km: '37.3', cause: 'roadMaintenance', detail: 'roadworks', municipality: 'Ontígola', province: 'Toledo', start: '2025-12-12T08:05:19.000+01:00' }
const nowhere = { id: 'e2e-4', v16: false, cause: 'abnormalTraffic', start: '2025-01-01T00:00:00.000+01:00' }

test('the tab is named after the channel, not CLUSTER', async () => {
    await expect(page.getByText(/^V16MAP-\d+$/).first()).toBeVisible()
    await expect(page.getByText(/^CLUSTER-\d+$/)).toHaveCount(0)
})

test('when stopped, it says how to start it', async () => {
    await expect(page.getByText('V16 Map not started')).toBeVisible()
})

test('start opens the setup, with the V16 filter off by default', async () => {
    await openTabMenu(page)
    await page.getByText('Start', { exact: true }).click()
    await expect(setupDialog()).toBeVisible()
    await expect(setupDialog().getByRole('checkbox', { name: 'Only V16 emergency beacons' })).not.toBeChecked()
    await setupDialog().getByRole('button', { name: 'OK', exact: true }).click()
    await expect(setupDialog()).toBeHidden()
    await tap.waitForInstance()
    await expect(page.getByText('All incidents')).toBeVisible()
})

test('a snapshot draws every situation with a location, and lists them all', async () => {
    tap.push({ msgtype: 'v16mapmessageresponse', payloadType: 'snapshot', added: [beacon, beacon2, works, nowhere], updated: [], removed: [], at: Date.now() })
    await expect(page.getByText('4 situations')).toBeVisible()
    await expect(page.getByText('2 V16', { exact: true })).toBeVisible()
    // the one without coordinates is listed but not drawn
    await expect(markers()).toHaveCount(3)
    await expect(page.getByText('No location')).toBeVisible()
})

test('clicking a beacon on the map selects it and shows its details', async () => {
    await marker('e2e-1').click()
    await expect(page.getByText('Vehicle obstruction · V16 beacon')).toBeVisible()
    await expect(page.getByText('A-4 km 404.8 · Córdoba · Córdoba').first()).toBeVisible()
    await expect(page.getByText('Andalucía')).toBeVisible()
})

test('clicking the empty map clears the selection', async () => {
    const box = (await page.locator('svg').filter({ has: markers() }).boundingBox())!
    await page.mouse.click(box.x + box.width - 30, box.y + 30)
    await expect(page.getByText('Vehicle obstruction · V16 beacon')).toBeHidden()
})

test('clicking a situation in the list selects it', async () => {
    await page.getByText('N-400 km 37.3 · Ontígola · Toledo').click()
    await expect(page.getByText('Road maintenance', { exact: true })).toBeVisible()
    await expect(page.getByText('Roadworks', { exact: true })).toBeVisible()
})

test('changes update the map, the list and the header', async () => {
    tap.push({ msgtype: 'v16mapmessageresponse', payloadType: 'changes', added: [], updated: [{ ...beacon2, road: 'M-40' }], removed: ['e2e-3'], at: Date.now() })
    await expect(page.getByText('3 situations')).toBeVisible()
    await expect(markers()).toHaveCount(2)
    await expect(page.getByText(/last change \+0 ~1 −1/)).toBeVisible()
    await expect(page.getByText(/M-40 km 5\.0/)).toBeVisible()
    // the selected situation was removed, and its details went with it
    await expect(page.getByText('Roadworks', { exact: true })).toBeHidden()
})

test('the real v16 provider answers with its own snapshot', async () => {
    test.skip(Boolean(process.env.V16MAP_E2E_SKIP_LIVE), 'V16MAP_E2E_SKIP_LIVE is set')
    // the provider sends every new subscriber its snapshot as soon as it has polled the feed once
    await expect.poll(() => tap.received.some(m => m.msgtype === 'v16mapmessageresponse' && m.payloadType === 'snapshot'), { timeout: 120000 }).toBe(true)
    const real = tap.received.find(m => m.payloadType === 'snapshot') as { added: Array<{ id: string, lat?: number }> }
    expect(real.added.length).toBeGreaterThan(0)
    expect(real.added.some(p => typeof p.lat === 'number')).toBe(true)
})

test('stop leaves the map and says how to start it again', async () => {
    await openTabMenu(page)
    await page.getByText('Stop', { exact: true }).click()
    await expect(page.getByText('V16 Map not started')).toBeVisible()
})
