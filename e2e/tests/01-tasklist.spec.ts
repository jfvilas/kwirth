import { test, expect, Page } from '@playwright/test'
import { execFileSync } from 'child_process'
import {
    createFixture, deleteFixture, dialog, exists, headers, LOGOFF_NAMESPACE, menu, NAMESPACE, namespaceAlive, nodeNames, openTasklist, podsOf,
    root, row, rows, tab, waitForRow, win
} from './helpers'

/*
    E2E of the Task Manager, the PRD acceptance criteria against the running dev environment.

    ⛔ Non-destructive: it creates its own namespaces (tasklist-e2e, tasklist-e2e-logoff) and deletes them at the
    end. Everything it ends, creates or logs off is its own. Shut Down is only opened and cancelled: no node is
    ever cordoned or drained.

    One page for the whole run (serial + beforeAll): opening the SPA is the slow part.
*/
test.describe.configure({ mode: 'serial' })

const SHOTS = '../docs/screenshots'   // relative to plugins/tasklist/e2e (Playwright's cwd)

let page: Page

const processes = () => win(page).getByTestId('tl-processes')
const applications = () => win(page).getByTestId('tl-applications')

/*
    A README capture of the window. The dev cluster has other people's namespaces in it: for the Processes and Users
    captures the rows that are not the fixture's are taken out of the DOM first (they are only hidden from the
    picture; the next snapshot paints them back).
*/
const shot = async (name: string, onlyFixture = false): Promise<void> => {
    if (onlyFixture) {
        await page.evaluate((ns) => {
            const lists = ['tl-processes', 'tl-applications', 'tl-users'].map(id => `[data-testid="${id}"] tbody tr`).join(', ')
            for (const tr of Array.from(document.querySelectorAll(lists))) {
                if (!tr.textContent?.includes(ns)) (tr as HTMLElement).style.display = 'none'
            }
        }, NAMESPACE)
    }
    await page.waitForTimeout(300)
    await win(page).screenshot({ path: `${SHOTS}/${name}.png` })
}

test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    createFixture()
    page = await browser.newPage()
    await openTasklist(page)
})

test.afterAll(async () => {
    await page?.goto('about:blank').catch(() => { })
    await page?.close()
    deleteFixture()
})

test('stopped, it says so; Start opens the window on Processes, with no setup to answer', async () => {
    const notStarted = page.getByTestId('channel-not-started')
    await expect(notStarted).toContainText('Task Manager not started')
    await notStarted.getByRole('button', { name: 'Start' }).click()
    await expect(win(page)).toBeVisible({ timeout: 20000 })
    await expect(win(page).locator('.tl-title-text').first()).toHaveText('Task Manager')
    await expect(win(page).getByRole('tab', { name: 'Processes' })).toHaveAttribute('aria-selected', 'true')
    await expect(win(page).getByRole('menubar')).toContainText('FileOptionsViewShut DownHelp')
    await expect.poll(() => page.evaluate(() => document.fonts.check('11px KwirthTahoma')), { timeout: 20000 }).toBe(true)
})

test('Processes: the four XP columns, the fixture pods as processes of the user tasklist-e2e; the system users hidden', async () => {
    expect(await headers(processes())).toEqual(['Image Name', 'User Name', 'CPU', 'Mem Usage'])
    for (const name of podsOf('demo')) await waitForRow(processes(), name)
    await waitForRow(processes(), 'lonely')
    expect((await row(processes(), 'lonely').locator('td').allTextContents())[1]).toBe(NAMESPACE)
    expect((await rows(processes())).some(r => r[1].startsWith('kube-'))).toBe(false)
    await expect(win(page).getByTestId('tl-status')).toContainText(/Processes: \d+/)
    await expect(win(page).getByTestId('tl-status')).toContainText(/Commit Charge: \d+M \/ \d+M/)
})

test('Show processes from all users: the system users appear, and the System Idle Process once the CPU is known', async () => {
    await win(page).getByTestId('tl-all-users').click()
    await expect.poll(async () => (await rows(processes())).some(r => r[1].startsWith('kube-')), { timeout: 15000 }).toBe(true)
    await waitForRow(processes(), 'System Idle Process', 60000)
    expect((await row(processes(), 'System Idle Process').locator('td').allTextContents())[1]).toBe('SYSTEM')
    await win(page).getByTestId('tl-all-users').click()
    await expect.poll(async () => (await rows(processes())).some(r => r[1].startsWith('kube-')), { timeout: 15000 }).toBe(false)
})

test('a click on a header sorts by it, a second turns it round; CPU and memory figures are XP\'s', async () => {
    await processes().locator('thead th', { hasText: 'Image Name' }).click()
    const names = (await rows(processes())).map(r => r[0])
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })))
    await processes().locator('thead th', { hasText: 'Image Name' }).click()
    const reversed = (await rows(processes())).map(r => r[0])
    expect(reversed[0].localeCompare(reversed[reversed.length - 1], undefined, { sensitivity: 'base' })).toBeGreaterThanOrEqual(0)
    await expect.poll(async () => (await row(processes(), 'lonely').locator('td').allTextContents())[3], { timeout: 60000 }).toMatch(/^[\d,]+ K$/)
    expect((await row(processes(), 'lonely').locator('td').allTextContents())[2]).toMatch(/^\d\d$/)
})

test('View → Select Columns adds PID and Threads; a pod of demo has two threads', async () => {
    await menu(page, 'View', 'Select Columns...')
    const d = dialog(page, 'tl-select-columns')
    await expect(d).toBeVisible()
    await expect(d.getByRole('checkbox', { name: 'Image Name' })).toHaveAttribute('aria-disabled', 'true')
    await d.getByRole('checkbox', { name: 'PID (Process Identifier)' }).click()
    await d.getByRole('checkbox', { name: 'Thread Count' }).click()
    await d.getByRole('button', { name: 'OK' }).click()
    expect(await headers(processes())).toEqual(['Image Name', 'PID', 'User Name', 'CPU', 'Mem Usage', 'Threads'])
    const demo = (await row(processes(), podsOf('demo')[0]).locator('td').allTextContents())
    expect(Number(demo[1]) % 4).toBe(0)
    expect(demo[5]).toBe('2')
    await shot('processes', true)
})

test('Properties of a process: its user, computer and parent; its containers on their own tab', async () => {
    const name = podsOf('demo')[0]
    await row(processes(), name).click({ button: 'right' })
    await root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'Properties' }).click()
    const d = dialog(page, 'tl-properties')
    await expect(d).toBeVisible()
    await expect(d).toContainText(`${name} Properties`)
    await expect(d).toContainText(NAMESPACE)
    await expect(d).toContainText('Deployment demo')
    await d.getByRole('tab', { name: 'Containers' }).dispatchEvent('mousedown')
    const containers = await rows(d.getByTestId('tl-containers'))
    expect(containers.map(c => c[0]).sort()).toEqual(['app', 'sidecar'])
    expect(containers.every(c => c[2] === 'Running')).toBe(true)
    await shot('properties', true)
    await d.getByRole('button', { name: 'OK' }).click()
    await expect(d).toBeHidden()
})

test('End Process on the System Idle Process: Unable to Terminate Process, Access is denied', async () => {
    await win(page).getByTestId('tl-all-users').click()
    await waitForRow(processes(), 'System Idle Process', 60000)
    await row(processes(), 'System Idle Process').click()
    await win(page).getByTestId('tl-end-process').click()
    const e = dialog(page, 'tl-error')
    await expect(e).toContainText('Unable to Terminate Process')
    await expect(e).toContainText('Access is denied.')
    await e.getByRole('button', { name: 'OK' }).click()
    await win(page).getByTestId('tl-all-users').click()
})

test('End Process: the XP warning, No keeps it, Yes deletes the pod', async () => {
    await row(processes(), 'lonely').click()
    await win(page).getByTestId('tl-end-process').click()
    const w = dialog(page, 'tl-warning')
    await expect(w).toContainText('WARNING: Terminating a process can cause undesired results')
    await expect(w).toContainText(`The pod ${NAMESPACE}/lonely will be deleted`)
    await shot('end-process', true)
    await w.getByRole('button', { name: 'No' }).click()
    await expect(w).toBeHidden()
    expect(exists('pod', 'lonely')).toBe(true)
    await row(processes(), 'lonely').click()
    await processes().press('Delete')
    await dialog(page, 'tl-warning').getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => exists('pod', 'lonely'), { timeout: 30000 }).toBe(false)
    await expect(row(processes(), 'lonely')).toHaveCount(0, { timeout: 30000 })
})

test('End Process Tree: the pod\'s Deployment goes, with its pods', async () => {
    const leaf = podsOf('tree')[0]
    await row(processes(), leaf).click({ button: 'right' })
    await root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'End Process Tree' }).click()
    const w = dialog(page, 'tl-warning')
    await expect(w).toContainText(`The Deployment ${NAMESPACE}/tree will be deleted`)
    await w.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => exists('deployment', 'tree'), { timeout: 30000 }).toBe(false)
})

test('Applications: the Deployments, Running or Not Responding; Go To Process selects its processes', async () => {
    await tab(page, 'Applications')
    await waitForRow(applications(), `demo - ${NAMESPACE}`)
    await expect.poll(async () => (await row(applications(), `demo - ${NAMESPACE}`).locator('td').allTextContents())[1], { timeout: 30000 }).toBe('Running')
    await expect.poll(async () => (await row(applications(), `broken - ${NAMESPACE}`).locator('td').allTextContents())[1], { timeout: 30000 }).toBe('Not Responding')
    await expect(win(page).getByRole('menubar')).toContainText('Windows')
    await shot('applications', true)
    await row(applications(), `demo - ${NAMESPACE}`).click({ button: 'right' })
    await root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'Go To Process' }).click()
    await expect(win(page).getByRole('tab', { name: 'Processes' })).toHaveAttribute('aria-selected', 'true')
    const selected = await processes().locator('tbody tr[aria-selected="true"] td:first-child').allTextContents()
    expect(selected.sort()).toEqual(podsOf('demo').sort())
})

test('End Task: the warning, and the Deployment is deleted', async () => {
    await tab(page, 'Applications')
    await row(applications(), `broken - ${NAMESPACE}`).click()
    await win(page).getByTestId('tl-end-task').click()
    const w = dialog(page, 'tl-warning')
    await expect(w).toContainText(`The Deployment ${NAMESPACE}/broken will be deleted`)
    await w.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => exists('deployment', 'broken'), { timeout: 30000 }).toBe(false)
    await expect(row(applications(), `broken - ${NAMESPACE}`)).toHaveCount(0, { timeout: 30000 })
})

test('New Task: Create New Task runs an image as a pod of the chosen user', async () => {
    await win(page).getByTestId('tl-new-task-button').click()
    const d = dialog(page, 'tl-new-task')
    await expect(d).toBeVisible()
    await expect(d.getByRole('button', { name: 'Browse...' })).toBeDisabled()
    await d.getByLabel('Open').fill('busybox:1.36')
    await d.getByLabel('Name').fill('e2e-task')
    await d.getByLabel('User').selectOption(NAMESPACE)
    await shot('new-task', true)
    await d.getByRole('button', { name: 'OK' }).click()
    await expect.poll(() => exists('pod', 'e2e-task'), { timeout: 30000 }).toBe(true)
    // a bad name is refused with the API's reason, in an error box
    await menu(page, 'File', 'New Task (Run...)')
    await dialog(page, 'tl-new-task').getByLabel('Open').fill('busybox:1.36')
    await dialog(page, 'tl-new-task').getByLabel('Name').fill('Bad_Name')
    await dialog(page, 'tl-new-task').getByLabel('User').selectOption(NAMESPACE)
    await dialog(page, 'tl-new-task').getByRole('button', { name: 'OK' }).click()
    await expect(dialog(page, 'tl-error')).toContainText('is not a valid name')
    await dialog(page, 'tl-error').getByRole('button', { name: 'OK' }).click()
})

test('Performance: the meters, the histories, the four boxes; One Graph Per CPU draws one per node', async () => {
    await tab(page, 'Performance')
    await expect(win(page).getByTestId('tl-cpu-meter')).toBeVisible()
    await expect(win(page).getByTestId('tl-pf-history')).toBeVisible()
    await expect(win(page).getByTestId('tl-processes-total')).toContainText(/Processes\d+/)
    await expect(win(page).getByTestId('tl-physical-total')).toContainText(/Total[\d,]+/)
    await expect.poll(() => win(page).getByTestId('tl-cpu-meter').textContent(), { timeout: 60000 }).toMatch(/^\d+%$/)
    await page.waitForTimeout(6000)
    await shot('performance')
    await menu(page, 'View', 'CPU History', 'One Graph Per CPU')
    await expect(win(page).getByTestId('tl-cpu-graphs').locator('canvas')).toHaveCount(nodeNames().length)
    await menu(page, 'View', 'CPU History', 'One Graph, All CPUs')
    await expect(win(page).getByTestId('tl-cpu-history')).toBeVisible()
})

test('Networking: one adapter per node, Operational, at a nominal gigabit', async () => {
    await tab(page, 'Networking')
    const adapters = await rows(win(page).getByTestId('tl-adapters'))
    expect(adapters.map(a => a[0]).sort()).toEqual(nodeNames())
    for (const a of adapters) {
        expect(a[1]).toMatch(/ %$/)
        expect(a[2]).toBe('1 Gbps')
        expect(a[3]).toBe('Operational')
    }
    await expect(win(page).getByTestId('tl-network-graphs').locator('canvas')).toHaveCount(nodeNames().length)
    await page.waitForTimeout(4000)
    await shot('networking')
})

test('Users: the namespaces; Log Off deletes one after the warning', async () => {
    await tab(page, 'Users')
    const users = win(page).getByTestId('tl-users')
    await waitForRow(users, NAMESPACE)
    await waitForRow(users, LOGOFF_NAMESPACE)
    expect((await row(users, new RegExp(`^${NAMESPACE}$`)).locator('td').allTextContents())[2]).toBe('Active')
    await shot('users', true)
    await row(users, LOGOFF_NAMESPACE).click()
    await win(page).getByTestId('tl-logoff').click()
    const w = dialog(page, 'tl-warning')
    await expect(w).toContainText(`Logging off ${LOGOFF_NAMESPACE} deletes the namespace`)
    await w.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => namespaceAlive(LOGOFF_NAMESPACE), { timeout: 30000 }).toBe(false)
})

test('Shut Down: Stand By asks which computer (node), and Cancel leaves it alone', async () => {
    await menu(page, 'Shut Down', 'Stand By')
    const d = dialog(page, 'tl-shut-down')
    await expect(d).toContainText('will be cordoned')
    const options = (await d.getByLabel('Computer').locator('option').allTextContents()).map(o => o.replace(' (cordoned)', '')).sort()
    expect(options).toEqual(nodeNames())
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(d).toBeHidden()
    await expect(root(page).getByRole('menu')).toHaveCount(0)
})

test('View → Update Speed → Paused freezes the window; Refresh Now and Normal bring it back', async () => {
    await tab(page, 'Processes')
    await menu(page, 'View', 'Update Speed', 'Paused')
    await page.waitForTimeout(2500)
    // while paused, a process that appears in the cluster does not appear in the window
    const before = (await rows(processes())).map(r => r[0])
    execFileSync('kubectl', ['-n', NAMESPACE, 'run', 'paused-probe', '--image=busybox:1.36', '--restart=Never', '--', 'sleep', '600'])
    await page.waitForTimeout(5000)
    expect((await rows(processes())).map(r => r[0])).toEqual(before)
    await menu(page, 'View', 'Refresh Now')
    await waitForRow(processes(), 'paused-probe', 10000)
    await menu(page, 'View', 'Update Speed', 'Normal')
    const view = win(page).getByRole('menubar').getByRole('menuitem', { name: 'View', exact: true })
    await view.dispatchEvent('mousedown')
    await root(page).getByRole('menu').getByRole('menuitem', { name: 'Update Speed', exact: true }).hover()
    await expect(root(page).getByRole('menu').getByRole('menuitem', { name: 'Normal', exact: true })).toHaveAttribute('aria-checked', 'true')
    await view.dispatchEvent('mousedown')
    await expect(root(page).getByRole('menu')).toHaveCount(0)
})

test('Maximize fills the tab, Restore brings the window back; Help → About names the cluster', async () => {
    const normal = (await win(page).boundingBox())!
    await win(page).getByRole('button', { name: 'Maximize' }).click()
    const max = (await win(page).boundingBox())!
    expect(max.width).toBeGreaterThan(normal.width)
    await win(page).getByRole('button', { name: 'Restore' }).click()
    expect((await win(page).boundingBox())!.width).toBeCloseTo(normal.width, 0)
    await menu(page, 'Help', 'About Task Manager')
    await expect(dialog(page, 'tl-about')).toContainText('Not affiliated with Microsoft')
    await dialog(page, 'tl-about').getByRole('button', { name: 'OK' }).click()
})
