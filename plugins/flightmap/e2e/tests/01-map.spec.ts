import { test, expect, Page } from '@playwright/test'
import { addChannel, blockTiles, login, openTabMenu, SocketTap } from './helpers'

/**
 * Serial, and with ONE single page for the whole file: reloading the SPA is the dominant cost, so it is
 * paid once. The tests share state and order matters — added, setup, positions, selection, errors, and
 * stop last.
 *
 * The map is fed by INJECTED messages (SocketTap): what the real flight-status provider sends is held
 * back from the page. There is no test against OpenSky on purpose: with anonymous access a run would
 * spend a good share of the day's 400 credits, and the answer changes from one minute to the next.
 *
 * Read-only: the channel writes nothing, and the provider's configuration and quotas are not touched.
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

const setupDialog = () => page.getByRole('dialog').filter({ hasText: 'Configure Flight Map channel' })
const interval = () => setupDialog().getByLabel('Seconds between updates')
const markers = () => page.locator('svg [data-marker-id]')

const iberia = {
    icao24: '34718e', callsign: 'IBE3171 ', originCountry: 'Spain', lat: 40.47, lon: -3.56, baroAltitudeM: 3000, onGround: false,
    velocityMs: 150, trackDeg: 310, lastContact: 1700000001, source: 'opensky',
    details: {
        callsign: 'IBE3171', flightIata: 'IB3171', origin: { icao: 'LEMD', iata: 'MAD', name: 'Madrid' }, destination: { icao: 'LEVX', iata: 'VGO', name: 'Vigo' },
        status: 'active', departureDelayMin: 12, source: 'aviationstack', fetchedAt: '2026-09-26T09:58:00.000Z'
    }
}
const ryanair = { icao24: '4ca7b5', callsign: 'RYR12AB', originCountry: 'Ireland', lat: 40.2, lon: -3.9, baroAltitudeM: 11000, onGround: false, velocityMs: 230, trackDeg: 45, lastContact: 1700000002, source: 'opensky' }
const parked = { icao24: '3451c2', callsign: 'AEA051', originCountry: 'Spain', lat: 40.49, lon: -3.57, onGround: true, lastContact: 1700000003, source: 'opensky' }

const positions = (aircraft: unknown[]) =>
    tap.push({ msgtype: 'flightmapmessageresponse', payloadType: 'positions', timestamp: new Date().toISOString(), aircraft })

test('the tab is named after the channel, not CLUSTER', async () => {
    await expect(page.getByText(/^FLIGHTMAP-\d+$/).first()).toBeVisible()
    await expect(page.getByText(/^CLUSTER-\d+$/)).toHaveCount(0)
})

test('when stopped, it says how to start it', async () => {
    await expect(page.getByText('Flight Map not started')).toBeVisible()
})

test('the setup starts on the peninsula, sized for the anonymous quota', async () => {
    await openTabMenu(page)
    await page.getByText('Start', { exact: true }).click()
    await expect(setupDialog()).toBeVisible()
    await expect(setupDialog().getByText('Iberian peninsula')).toBeVisible()
    await expect(interval()).toHaveValue('720')
    // 3 credits every 12 minutes: 120 calls, 360 credits a day
    await expect(setupDialog().getByText(/3 OpenSky credit\(s\) per call · about 360 a day/)).toBeVisible()
})

test('a smaller area costs less, and too short an interval is refused', async () => {
    await setupDialog().getByLabel('Area').click()
    await page.getByRole('option', { name: 'Madrid', exact: true }).click()
    await expect(setupDialog().getByLabel('Lat min')).toHaveValue('39.8')
    await interval().fill('5')
    await expect(setupDialog().getByText('At least 10 seconds')).toBeVisible()
    await expect(setupDialog().getByRole('button', { name: 'OK', exact: true })).toBeDisabled()
    await interval().fill('60')
    await expect(setupDialog().getByText(/1 OpenSky credit\(s\) per call · about 1440 a day/)).toBeVisible()
})

test('editing a corner switches the area to custom', async () => {
    await setupDialog().getByLabel('Lat max').fill('41.1')
    await expect(setupDialog().getByText('Custom')).toBeVisible()
    await setupDialog().getByLabel('Lat max').fill('41')
})

test('the followed flights are normalised and the channel starts', async () => {
    await setupDialog().getByLabel('Flights to follow (ICAO callsigns)').fill('ibe3171, vlg1001')
    await setupDialog().getByRole('button', { name: 'OK', exact: true }).click()
    await expect(setupDialog()).toBeHidden()
    await tap.waitForInstance()
    await expect(page.getByText('Every 60 s')).toBeVisible()
    await expect(page.getByText('0/2 followed')).toBeVisible()
    await expect(page.getByText(/Waiting for the first positions/)).toBeVisible()
})

test('positions draw every aircraft, followed ones first in the list', async () => {
    positions([iberia, ryanair, parked])
    await expect(page.getByText('3 aircraft')).toBeVisible()
    await expect(markers()).toHaveCount(3)
    await expect(page.getByText('1/2 followed')).toBeVisible()
    await expect(page.getByText('MAD → VGO')).toBeVisible()
    await expect(page.getByText('Not in the area right now')).toBeVisible()
    await expect(page.getByText('On ground · Spain')).toBeVisible()
})

test('clicking a plane on the map shows its flight', async () => {
    await page.locator('svg [data-marker-id="34718e"]').click()
    await expect(page.getByText('IBE3171 · IB3171')).toBeVisible()
    await expect(page.getByText('Madrid → Vigo')).toBeVisible()
    await expect(page.getByText(/\(\+12 min\)/)).toBeVisible()
    await expect(page.getByText('Details from aviationstack')).toBeVisible()
})

test('clicking an aircraft in the list selects it', async () => {
    await page.getByText('RYR12AB', { exact: true }).click()
    await expect(page.getByText('Ireland', { exact: true })).toBeVisible()
    await expect(page.getByText(`${(36089).toLocaleString('en-US')} ft`)).toBeVisible()
})

test('a provider error is shown, and the last positions stay on the map', async () => {
    tap.push({ msgtype: 'flightmapmessageresponse', payloadType: 'error', timestamp: new Date().toISOString(), error: 'opensky: no budget left' })
    await expect(page.getByText('Provider: opensky: no budget left')).toBeVisible()
    await expect(markers()).toHaveCount(3)
})

test('the next positions clear the error and drop the aircraft that left', async () => {
    positions([iberia])
    await expect(page.getByText('Provider: opensky: no budget left')).toBeHidden()
    await expect(page.getByText('1 aircraft')).toBeVisible()
    await expect(markers()).toHaveCount(1)
})

test('stop leaves the map and says how to start it again', async () => {
    await openTabMenu(page)
    await page.getByText('Stop', { exact: true }).click()
    await expect(page.getByText('Flight Map not started')).toBeVisible()
})
