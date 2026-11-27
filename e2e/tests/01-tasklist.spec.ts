import { test, expect, Page } from '@playwright/test'
import { execFileSync } from 'child_process'
import {
    createFixture, deleteFixture, dialog, exists, headers, LOGOFF_NAMESPACE, menu, NAMESPACE, namespaceAlive, nodeNames, openTasklist, podsOf,
    historyLimitOf, root, row, rows, tab, uidOf, editorReplace, waitForRow, win
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
const shot = async (name: string, onlyFixture = false, wholeDesktop = false): Promise<void> => {
    if (onlyFixture) {
        await page.evaluate((ns) => {
            const lists = ['tl-processes', 'tl-applications', 'tl-users'].map(id => `[data-testid="${id}"] tbody tr`).join(', ')
            for (const tr of Array.from(document.querySelectorAll(lists))) {
                if (!tr.textContent?.includes(ns)) (tr as HTMLElement).style.display = 'none'
            }
        }, NAMESPACE)
    }
    await page.waitForTimeout(300)
    await (wholeDesktop ? root(page) : win(page)).screenshot({ path: `${SHOTS}/${name}.png` })
}

test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    createFixture()
    page = await browser.newPage()
    // an exception in the page (a handler that throws) fails the run, with what it said
    page.on('pageerror', err => { pageErrors.push(`${err.message}\n${err.stack ?? ''}`) })
    await openTasklist(page)
})

const pageErrors: string[] = []

test.afterEach(() => {
    const errors = pageErrors.splice(0)
    expect(errors, errors.join('\n---\n')).toEqual([])
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
    // the CPU needs two readings of the metrics provider: it may take one interval more than the memory
    await expect.poll(async () => (await row(processes(), 'lonely').locator('td').allTextContents())[2], { timeout: 60000 }).toMatch(/^\d\d$/)
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

test('View Log: the container\'s last lines in Notepad, read only, from the end; Word Wrap', async () => {
    await row(processes(), 'lonely').click({ button: 'right' })
    await root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'View Log' }).click()
    const n = dialog(page, 'tl-notepad')
    await expect(n).toBeVisible({ timeout: 15000 })
    await expect(n).toContainText('lonely-alone.log - Notepad')
    await expect(n.locator('.cm-content')).toContainText('tasklist-e2e lonely tick')
    await expect(n.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
    await n.getByRole('menuitem', { name: 'Format', exact: true }).dispatchEvent('mousedown')
    await n.getByRole('menu').getByRole('menuitem', { name: 'Word Wrap' }).click()
    await expect(n.locator('.cm-lineWrapping')).toHaveCount(1)
    await expect(n.getByRole('menuitem', { name: 'File', exact: true })).toBeVisible()
    await n.getByRole('menuitem', { name: 'File', exact: true }).dispatchEvent('mousedown')
    await expect(n.getByRole('menu').getByRole('menuitem', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true')
    await n.getByRole('menu').getByRole('menuitem', { name: 'Exit' }).click()
    await expect(n).toBeHidden()
    // a pod of several threads: the submenu names its containers
    await row(processes(), podsOf('demo')[0]).click({ button: 'right' })
    await root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'View Log' }).hover()
    await expect(root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'sidecar' })).toBeVisible()
    await page.mouse.click(5, 5)
})

test('Restart of a bare process: deleted and created again, the same name with another identity', async () => {
    const before = uidOf('lonely')
    await row(processes(), 'lonely').click({ button: 'right' })
    await root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'Restart' }).click()
    const w = dialog(page, 'tl-warning')
    await expect(w).toContainText('has no controller: it will be deleted and created again')
    await w.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => { try { return uidOf('lonely') } catch { return '' } }, { timeout: 60000 }).not.toMatch(new RegExp(`^(${before})?$`))
    execFileSync('kubectl', ['-n', NAMESPACE, 'wait', '--for=condition=Ready', 'pod/lonely', '--timeout=60s'])
})

test('Edit: an application\'s YAML in Notepad; Save applies it, and what Kubernetes refuses is said', async () => {
    await tab(page, 'Applications')
    await waitForRow(applications(), `store - ${NAMESPACE}`)
    expect((await row(applications(), `store - ${NAMESPACE}`).locator('td').allTextContents())[1]).toBe('StatefulSet')
    expect((await row(applications(), `demo - ${NAMESPACE}`).locator('td').allTextContents())[1]).toBe('Deployment')

    await row(applications(), `demo - ${NAMESPACE}`).click({ button: 'right' })
    await root(page).getByTestId('tl-context-menu').getByRole('menuitem', { name: 'Edit...' }).click()
    const n = dialog(page, 'tl-notepad')
    await expect(n).toContainText('demo.yaml - Notepad', { timeout: 15000 })
    await expect(n.locator('.cm-content')).toContainText('kind: Deployment')
    await expect(n.locator('.cm-content')).not.toContainText('managedFields')
    await editorReplace(page, 'revisionHistoryLimit: 10', 'revisionHistoryLimit: 5')
    await shot('edit', true, true)
    await n.locator('.cm-content').press('Control+s')
    await expect.poll(() => historyLimitOf('demo'), { timeout: 15000 }).toBe('5')

    // another object under the same window is refused, and the text stays to be put right
    await editorReplace(page, 'name: demo\n', 'name: other\n')
    await n.getByRole('menuitem', { name: 'File', exact: true }).dispatchEvent('mousedown')
    await n.getByRole('menu').getByRole('menuitem', { name: 'Save' }).click()
    const e = dialog(page, 'tl-notepad-error')
    await expect(e).toContainText(`must still be the Deployment ${NAMESPACE}/demo`)
    await e.getByRole('button', { name: 'OK' }).click()
    // leaving with changes asks; No leaves them unsaved
    await n.getByRole('button', { name: 'Close' }).click()
    await expect(dialog(page, 'tl-notepad-ask')).toContainText('Do you want to save the changes?')
    await dialog(page, 'tl-notepad-ask').getByRole('button', { name: 'No' }).click()
    await expect(n).toBeHidden()
    await tab(page, 'Processes')
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
    await expect.poll(async () => (await row(applications(), `demo - ${NAMESPACE}`).locator('td').allTextContents())[2], { timeout: 30000 }).toBe('Running')
    await expect.poll(async () => (await row(applications(), `broken - ${NAMESPACE}`).locator('td').allTextContents())[2], { timeout: 30000 }).toBe('Not Responding')
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

test('menus are readable: items in black, disabled ones in grey, in submenus too', async () => {
    const colourOf = (name: string) => root(page).getByRole('menu').getByRole('menuitem', { name, exact: true }).evaluate(el => getComputedStyle(el).color)
    const BLACK = 'rgb(0, 0, 0)'
    const GREY = 'rgb(172, 168, 153)'
    // the pointer away from where the menus open: a hovered item is white on blue, as it should
    await page.mouse.move(5, 5)
    await win(page).getByRole('menubar').getByRole('menuitem', { name: 'View', exact: true }).dispatchEvent('mousedown')
    expect(await colourOf('Refresh Now')).toBe(BLACK)
    expect(await colourOf('Update Speed')).toBe(BLACK)
    await root(page).getByRole('menu').getByRole('menuitem', { name: 'Update Speed', exact: true }).hover()
    expect(await colourOf('Low')).toBe(BLACK)
    await win(page).getByRole('menubar').getByRole('menuitem', { name: 'View', exact: true }).dispatchEvent('mousedown')
    await win(page).getByRole('menubar').getByRole('menuitem', { name: 'Options', exact: true }).dispatchEvent('mousedown')
    expect(await colourOf('Hide When Minimized')).toBe(GREY)
    await win(page).getByRole('menubar').getByRole('menuitem', { name: 'Options', exact: true }).dispatchEvent('mousedown')
    await expect(root(page).getByRole('menu')).toHaveCount(0)
})

test('Kwirth\'s full screen and the window\'s Maximize are independent', async () => {
    const normal = (await win(page).boundingBox())!
    await win(page).click({ position: { x: 100, y: 15 } })
    await page.keyboard.press('Control+Shift+Enter')
    await expect.poll(async () => (await root(page).boundingBox())!.height, { timeout: 5000 }).toBeGreaterThan(normal.height + 100)
    // the tab is full screen, the window is not maximised: still the normal window, and Maximize still offered
    expect((await win(page).boundingBox())!.width).toBeCloseTo(normal.width, 0)
    await expect(win(page).getByRole('button', { name: 'Maximize' })).toBeVisible()
    await win(page).getByRole('button', { name: 'Maximize' }).click()
    expect((await win(page).boundingBox())!.width).toBeGreaterThan(normal.width)
    await win(page).getByRole('button', { name: 'Restore' }).click()
    await page.keyboard.press('Control+Shift+Enter')
    await expect.poll(async () => (await root(page).boundingBox())!.height, { timeout: 5000 }).toBeLessThan((await page.viewportSize())!.height - 50)
})

test('the window moves by its title bar and resizes by its edges, inside the tab; the close button is disabled', async () => {
    const box = async () => (await win(page).boundingBox())!
    const desk = (await page.getByTestId('tl-desktop').boundingBox())!
    const start = await box()

    // dragged by the title bar
    await page.mouse.move(start.x + 150, start.y + 12)
    await page.mouse.down()
    await page.mouse.move(start.x + 50, start.y - 40, { steps: 8 })
    await page.mouse.up()
    let now = await box()
    expect(now.x).toBeCloseTo(start.x - 100, 0)
    expect(now.y).toBeCloseTo(Math.max(desk.y, start.y - 52), 0)
    expect(now.width).toBeCloseTo(start.width, 0)

    // never out of the desktop
    await page.mouse.move(now.x + 150, now.y + 12)
    await page.mouse.down()
    await page.mouse.move(now.x - 3000, now.y - 3000, { steps: 8 })
    await page.mouse.up()
    now = await box()
    expect(now.x).toBeCloseTo(desk.x, 0)
    expect(now.y).toBeCloseTo(desk.y, 0)

    // the bottom-right corner makes it bigger
    const se = (await win(page).getByTestId('tl-resize-se').boundingBox())!
    await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2)
    await page.mouse.down()
    await page.mouse.move(se.x + se.width / 2 + 120, se.y + se.height / 2 + 60, { steps: 8 })
    await page.mouse.up()
    const bigger = await box()
    expect(bigger.width).toBeCloseTo(now.width + 120, -1)
    expect(bigger.height).toBeCloseTo(now.height + 60, -1)
    expect(bigger.x).toBeCloseTo(now.x, 0)

    // the left edge keeps the right one where it is
    await page.mouse.move(bigger.x + 300, bigger.y + 12)
    await page.mouse.down()
    await page.mouse.move(bigger.x + 500, bigger.y + 112, { steps: 8 })
    await page.mouse.up()
    const moved = await box()
    const w = (await win(page).getByTestId('tl-resize-w').boundingBox())!
    await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2)
    await page.mouse.down()
    await page.mouse.move(w.x + w.width / 2 - 80, w.y + w.height / 2, { steps: 8 })
    await page.mouse.up()
    const wider = await box()
    expect(wider.width).toBeCloseTo(moved.width + 80, -1)
    expect(wider.x + wider.width).toBeCloseTo(moved.x + moved.width, -1)

    // where it was left survives a switch of the window's tabs
    await tab(page, 'Performance')
    await tab(page, 'Processes')
    expect((await box()).x).toBeCloseTo(wider.x, 0)

    // maximised: no edges to resize by, and the title bar does not drag it
    await win(page).getByRole('button', { name: 'Maximize' }).click()
    await expect(win(page).getByTestId('tl-resize-se')).toHaveCount(0)
    await win(page).getByRole('button', { name: 'Restore' }).click()
    await expect(win(page).getByTestId('tl-resize-se')).toHaveCount(1)
    expect((await box()).x).toBeCloseTo(wider.x, 0)

    // the close button: there, and disabled
    await expect(win(page).getByLabel('Close')).toHaveAttribute('aria-disabled', 'true')
    await win(page).getByLabel('Close').click()
    await expect(win(page)).toBeVisible()
})

test('the taskbar: Start with its menu, the window\'s button minimises and restores it, the tray; Maximize leaves the taskbar visible', async () => {
    const bar = page.getByTestId('tl-taskbar')
    await expect(bar.getByTestId('tl-start')).toContainText('start')
    await expect(bar.getByTestId('tl-task-taskmanager')).toHaveAttribute('aria-pressed', 'true')
    await expect(bar.locator('.tl-clock')).toHaveText(/\d{1,2}:\d\d/)

    // the minimise button hides it; its taskbar button brings it back; a second click minimises it again
    await win(page).getByRole('button', { name: 'Minimize' }).click()
    await expect(win(page)).toBeHidden()
    await expect(bar.getByTestId('tl-task-taskmanager')).toHaveAttribute('aria-pressed', 'false')
    await bar.getByTestId('tl-task-taskmanager').click()
    await expect(win(page)).toBeVisible()
    await bar.getByTestId('tl-task-taskmanager').click()
    await expect(win(page)).toBeHidden()

    // Start → Task Manager brings it back too
    await bar.getByTestId('tl-start').dispatchEvent('mousedown')
    const menu = root(page).getByTestId('tl-start-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Turn Off Computer...' })).toHaveAttribute('aria-disabled', 'true')
    await menu.getByRole('menuitem', { name: 'Task Manager', exact: true }).click()
    await expect(win(page)).toBeVisible()
    await expect(menu).toBeHidden()

    // the whole desktop, the window and the taskbar under it, for the README
    await tab(page, 'Performance')
    await shot('desktop', true, true)
    await tab(page, 'Processes')

    // maximised, the window fills the desktop and stops at the taskbar
    await win(page).getByRole('button', { name: 'Maximize' }).click()
    const max = (await win(page).boundingBox())!
    const taskbar = (await bar.boundingBox())!
    expect(max.y + max.height).toBeCloseTo(taskbar.y, 0)
    await win(page).getByRole('button', { name: 'Restore' }).click()
})

test('every edge and corner resizes, the title bar\'s double click maximises and restores, minimised while maximised comes back maximised', async () => {
    const box = async () => (await win(page).boundingBox())!
    // first smaller, and in the middle: room to grow in every direction
    const se0 = (await win(page).getByTestId('tl-resize-se').boundingBox())!
    await page.mouse.move(se0.x + se0.width / 2, se0.y + se0.height / 2)
    await page.mouse.down()
    await page.mouse.move(se0.x - 300, se0.y - 300, { steps: 5 })
    await page.mouse.up()
    const small = await box()
    await page.mouse.move(small.x + 150, small.y + 12)
    await page.mouse.down()
    await page.mouse.move(small.x + 350, small.y + 112, { steps: 5 })
    await page.mouse.up()
    for (const handle of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        const before = await box()
        const h = (await win(page).getByTestId(`tl-resize-${handle}`).boundingBox())!
        const dx = handle.includes('e') ? 30 : handle.includes('w') ? -30 : 0
        const dy = handle.includes('s') ? 30 : handle.includes('n') ? -30 : 0
        await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
        await page.mouse.down()
        await page.mouse.move(h.x + h.width / 2 + dx, h.y + h.height / 2 + dy, { steps: 5 })
        await page.mouse.up()
        const after = await box()
        if (dx !== 0) expect(after.width, `width after ${handle}`).toBeGreaterThan(before.width)
        if (dy !== 0) expect(after.height, `height after ${handle}`).toBeGreaterThan(before.height)
    }
    const normal = await box()
    await win(page).locator('.tl-title-text').dblclick()
    expect((await box()).width).toBeGreaterThan(normal.width)
    await win(page).getByRole('button', { name: 'Minimize' }).click()
    await expect(win(page)).toBeHidden()
    await page.getByTestId('tl-task-taskmanager').click()
    expect((await box()).width).toBeGreaterThan(normal.width)
    await win(page).locator('.tl-title-text').dblclick()
    expect((await box()).width).toBeCloseTo(normal.width, 0)
    // Start → About Task Manager
    await page.getByTestId('tl-start').dispatchEvent('mousedown')
    await root(page).getByTestId('tl-start-menu').getByRole('menuitem', { name: 'About Task Manager' }).click()
    await dialog(page, 'tl-about').getByRole('button', { name: 'OK' }).click()
})

test('Notepad from Start: a window of its own — in front, on the taskbar, resizable, maximised and minimised, closed without asking', async () => {
    const bar = page.getByTestId('tl-taskbar')
    await bar.getByTestId('tl-start').dispatchEvent('mousedown')
    await root(page).getByTestId('tl-start-menu').getByRole('menuitem', { name: 'Notepad', exact: true }).click()
    const n = root(page).getByTestId('tl-notepad')
    await expect(n).toBeVisible()
    await expect(n.locator('.tl-title-text')).toHaveText('Untitled - Notepad')
    // in front: its title bright, the Task Manager's pale; its button on the taskbar, pressed
    await expect(n).not.toHaveClass(/tl-inactive/)
    await expect(win(page)).toHaveClass(/tl-inactive/)
    const task = bar.locator('[data-testid^="tl-task-notepad-"]')
    await expect(task).toHaveAttribute('aria-pressed', 'true')
    // typed into; nowhere to save a blank page to
    await n.locator('.cm-content').click()
    await page.keyboard.type('a note on the cluster')
    await expect(n.locator('.cm-content')).toContainText('a note on the cluster')
    await n.getByRole('menuitem', { name: 'File', exact: true }).dispatchEvent('mousedown')
    await expect(n.getByRole('menu').getByRole('menuitem', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true')
    await n.getByRole('menuitem', { name: 'File', exact: true }).dispatchEvent('mousedown')
    // resized by its corner
    const before = (await n.boundingBox())!
    const se = (await n.getByTestId('tl-resize-se').boundingBox())!
    await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2)
    await page.mouse.down()
    await page.mouse.move(se.x + se.width / 2 + 60, se.y + se.height / 2 + 40, { steps: 5 })
    await page.mouse.up()
    expect((await n.boundingBox())!.width).toBeGreaterThan(before.width)
    // a click on the Task Manager (on the part of its title the Notepad leaves uncovered) brings it in front
    const tm = (await win(page).locator('.tl-title').boundingBox())!
    await page.mouse.click(tm.x + tm.width - 110, tm.y + 12)
    await expect(win(page)).not.toHaveClass(/tl-inactive/)
    await expect(n).toHaveClass(/tl-inactive/)
    await task.click()
    await expect(n).not.toHaveClass(/tl-inactive/)
    // maximised, minimised from its own buttons, back from the taskbar
    await n.getByRole('button', { name: 'Maximize' }).click()
    const desk = (await page.getByTestId('tl-desktop').boundingBox())!
    expect((await n.boundingBox())!.width).toBeCloseTo(desk.width, 0)
    await n.getByRole('button', { name: 'Restore' }).click()
    // the desktop with both windows, for the README
    await shot('notepad', true, true)
    await n.getByRole('button', { name: 'Minimize' }).click()
    await expect(n).toBeHidden()
    await task.click()
    await expect(n).toBeVisible()
    // closed: no question (there is nothing to save to), off the taskbar
    await n.getByRole('button', { name: 'Close' }).click()
    await expect(n).toHaveCount(0)
    await expect(task).toHaveCount(0)
})

test('tiny footprint: a double click on the graphs leaves only them; another brings the window back', async () => {
    await tab(page, 'Performance')
    await win(page).getByTestId('tl-cpu-history').dblclick()
    await expect(win(page)).toHaveClass(/tl-compact/)
    await expect(win(page).locator('.tl-title')).toBeHidden()
    await expect(win(page).getByRole('menubar')).toBeHidden()
    await expect(win(page).getByTestId('tl-status')).toBeHidden()
    await expect(win(page).getByTestId('tl-cpu-history')).toBeVisible()
    await shot('tiny-footprint')
    await win(page).getByTestId('tl-cpu-history').dblclick()
    await expect(win(page).locator('.tl-title')).toBeVisible()
    // on Processes, a double click on a row is the row's (Properties), not the tiny footprint
    await tab(page, 'Processes')
    await row(processes(), podsOf('demo')[0]).dblclick()
    await expect(dialog(page, 'tl-properties')).toBeVisible()
    await expect(win(page)).not.toHaveClass(/tl-compact/)
    await dialog(page, 'tl-properties').getByRole('button', { name: 'OK' }).click()
})

test('a dialog is dragged by its title bar and stays on the desktop', async () => {
    await menu(page, 'File', 'New Task (Run...)')
    const d = dialog(page, 'tl-new-task')
    const start = (await d.boundingBox())!
    await page.mouse.move(start.x + 60, start.y + 12)
    await page.mouse.down()
    await page.mouse.move(start.x + 160, start.y + 62, { steps: 8 })
    await page.mouse.up()
    const moved = (await d.boundingBox())!
    expect(moved.x).toBeCloseTo(start.x + 100, 0)
    expect(moved.y).toBeCloseTo(start.y + 50, 0)
    // dragged far away it stops at the desktop's corner, above the taskbar
    await page.mouse.move(moved.x + 60, moved.y + 12)
    await page.mouse.down()
    await page.mouse.move(moved.x + 5000, moved.y + 5000, { steps: 8 })
    await page.mouse.up()
    const corner = (await d.boundingBox())!
    const desk = (await page.getByTestId('tl-desktop').boundingBox())!
    expect(corner.x + corner.width).toBeCloseTo(desk.x + desk.width, 0)
    expect(corner.y + corner.height).toBeCloseTo(desk.y + desk.height, 0)
    // still works where it is
    await d.getByLabel('Open').fill('x')
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(d).toBeHidden()
})

test('the browser window growing (F11) takes the taskbar down to the new bottom', async () => {
    const bottom = async () => { const b = (await page.getByTestId('tl-taskbar').boundingBox())!; return b.y + b.height }
    const size = page.viewportSize()!
    expect(await bottom()).toBeGreaterThan(size.height - 10)
    await page.setViewportSize({ width: size.width, height: size.height + 150 })
    await expect.poll(bottom, { timeout: 5000 }).toBeGreaterThan(size.height + 150 - 10)
    await page.setViewportSize(size)
    await expect.poll(bottom, { timeout: 5000 }).toBeLessThanOrEqual(size.height)
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
