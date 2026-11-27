import { Page, Locator, expect } from '@playwright/test'
import { execFileSync } from 'child_process'

export const USER = process.env.TL_E2E_USER ?? 'admin'
export const PASS = process.env.TL_E2E_PASS ?? ''
export const CLUSTER = process.env.TL_E2E_CLUSTER ?? 'inCluster'
export const CHANNEL = 'tasklist'

// The namespaces this e2e owns: created at the start, deleted at the end. Nothing else in the cluster is touched.
export const NAMESPACE = 'tasklist-e2e'
// A second one, only to be logged off (deleted) from the Users tab.
export const LOGOFF_NAMESPACE = 'tasklist-e2e-logoff'

const FIXTURE = `
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
---
apiVersion: v1
kind: Namespace
metadata:
  name: ${LOGOFF_NAMESPACE}
---
# An application that answers: two processes of two threads (containers) each.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo
  namespace: ${NAMESPACE}
spec:
  replicas: 2
  selector:
    matchLabels: { app: demo }
  template:
    metadata:
      labels: { app: demo }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: app
          image: busybox:1.36
          command: ['sh', '-c', 'while true; do sleep 2; done']
          resources:
            requests: { cpu: 5m, memory: 8Mi }
        - name: sidecar
          image: busybox:1.36
          command: ['sh', '-c', 'while true; do sleep 5; done']
          resources:
            requests: { cpu: 5m, memory: 8Mi }
---
# An application that does not answer: its only pod never gets ready. End Task ends it.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken
  namespace: ${NAMESPACE}
spec:
  replicas: 1
  selector:
    matchLabels: { app: broken }
  template:
    metadata:
      labels: { app: broken }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: worker
          image: busybox:1.36
          command: ['sh', '-c', 'exit 1']
---
# A tree: End Process Tree on one of its pods ends the Deployment.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tree
  namespace: ${NAMESPACE}
spec:
  replicas: 1
  selector:
    matchLabels: { app: tree }
  template:
    metadata:
      labels: { app: tree }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: leaf
          image: busybox:1.36
          command: ['sh', '-c', 'while true; do sleep 2; done']
---
# A process with no parent: End Process ends it for good.
apiVersion: v1
kind: Pod
metadata:
  name: lonely
  namespace: ${NAMESPACE}
spec:
  terminationGracePeriodSeconds: 1
  containers:
    - name: alone
      image: busybox:1.36
      command: ['sh', '-c', 'i=0; while true; do i=$((i+1)); echo "tasklist-e2e lonely tick $i"; sleep 1; done']
---
# An application of another kind: the Controller column says StatefulSet.
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: store
  namespace: ${NAMESPACE}
spec:
  serviceName: ''
  replicas: 1
  selector:
    matchLabels: { app: store }
  template:
    metadata:
      labels: { app: store }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: keeper
          image: busybox:1.36
          command: ['sh', '-c', 'while true; do sleep 2; done']
`

const kubectl = (args: string[], input?: string): string =>
    execFileSync('kubectl', args, { input, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })

// A read of the cluster, to check what the Task Manager shows against it (never to change anything).
export const cluster = (...args: string[]): string => kubectl(args)

export const createFixture = (): void => {
    kubectl(['delete', 'namespace', NAMESPACE, LOGOFF_NAMESPACE, '--ignore-not-found', '--wait=true', '--timeout=90s'])
    kubectl(['apply', '-f', '-'], FIXTURE)
    kubectl(['-n', NAMESPACE, 'rollout', 'status', 'deployment/demo', '--timeout=90s'])
    kubectl(['-n', NAMESPACE, 'rollout', 'status', 'deployment/tree', '--timeout=90s'])
    kubectl(['-n', NAMESPACE, 'wait', '--for=condition=Ready', 'pod/lonely', '--timeout=90s'])
    kubectl(['-n', NAMESPACE, 'rollout', 'status', 'statefulset/store', '--timeout=90s'])
}

// A pod's uid: a restarted bare pod keeps its name and gets a new one.
export const uidOf = (pod: string): string => kubectl(['-n', NAMESPACE, 'get', 'pod', pod, '-o', 'jsonpath={.metadata.uid}'])

// A field Edit changes without touching the pods the later tests count.
export const historyLimitOf = (deployment: string): string => kubectl(['-n', NAMESPACE, 'get', 'deployment', deployment, '-o', 'jsonpath={.spec.revisionHistoryLimit}'])

/*
    Replaces text in the open CodeMirror (Notepad's editor) as a user's edit would: through the editor's own view,
    which the content element carries.
*/
export async function editorReplace(page: Page, from: string, to: string): Promise<void> {
    await page.evaluate(([a, b]) => {
        const content = document.querySelector('[data-testid="tl-notepad"] .cm-content') as unknown as { cmView: { view: { state: { doc: { toString(): string } }; dispatch(t: unknown): void } } }
        const view = content.cmView.view
        const text = view.state.doc.toString()
        const at = text.indexOf(a)
        if (at < 0) throw new Error(`'${a}' is not in the editor`)
        view.dispatch({ changes: { from: at, to: at + a.length, insert: b } })
    }, [from, to])
}

export const deleteFixture = (): void => {
    kubectl(['delete', 'namespace', NAMESPACE, LOGOFF_NAMESPACE, '--ignore-not-found', '--wait=false'])
}

// Whether an object exists (and is not being deleted).
export const exists = (kind: string, name: string, namespace = NAMESPACE): boolean => {
    const out = kubectl(['-n', namespace, 'get', kind, '--ignore-not-found', '-o', 'jsonpath={range .items[*]}{.metadata.name}|{.metadata.deletionTimestamp}{"\\n"}{end}'])
    return out.split('\n').some(l => l.startsWith(name + '|') && l.endsWith('|'))
}

export const namespaceAlive = (name: string): boolean => {
    const out = kubectl(['get', 'namespace', name, '--ignore-not-found', '-o', 'jsonpath={.status.phase}'])
    return out === 'Active'
}

export const podsOf = (app: string): string[] =>
    kubectl(['-n', NAMESPACE, 'get', 'pods', '-l', `app=${app}`, '--field-selector=status.phase=Running', '-o', 'jsonpath={.items[*].metadata.name}'])
        .split(/\s+/).filter(Boolean)

export const nodeNames = (): string[] => kubectl(['get', 'nodes', '-o', 'jsonpath={.items[*].metadata.name}']).split(/\s+/).filter(Boolean).sort()

export async function login(page: Page): Promise<void> {
    await page.goto('/')
    const userField = page.getByLabel('User')
    const combo = page.getByRole('combobox').first()
    await Promise.race([
        userField.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { }),
        combo.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { })
    ])
    if (await userField.isVisible().catch(() => false)) {
        await userField.fill(USER)
        await page.getByLabel('Password').fill(PASS)
        await page.getByRole('button', { name: 'OK' }).click()
    }
    await expect(combo).toBeVisible({ timeout: 60000 })
    // the plugins' front bundles load after the login: wait for this one before looking for it in the list
    await page.waitForFunction((id) => Boolean((window as unknown as { __kwirth_plugins__?: Record<string, unknown> }).__kwirth_plugins__?.[id]), CHANNEL, { timeout: 60000 })
    await page.waitForTimeout(1000)
}

async function pickCombo(page: Page, index: number, option: string): Promise<void> {
    await page.getByRole('combobox').nth(index).click()
    await page.getByRole('listbox').waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('option', { name: option, exact: true }).click()
    await page.waitForTimeout(600)
}

/** Cluster → View=cluster → channel tasklist → ADD. Left added and NOT started. */
export async function openTasklist(page: Page): Promise<void> {
    await login(page)
    await pickCombo(page, 0, CLUSTER)
    await pickCombo(page, 1, 'cluster')
    const count = await page.getByRole('combobox').count()
    await page.getByRole('combobox').nth(count - 1).click()
    await page.getByRole('listbox').waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('option').filter({ hasText: new RegExp(`^${CHANNEL}$`) }).first().click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
}

// ── The window ─────────────────────────────────────────────────────────────────────────────────────

export const win = (page: Page): Locator => page.getByTestId('tasklist-window')
export const root = (page: Page): Locator => page.getByTestId('tasklist-window-root')

export async function tab(page: Page, name: string): Promise<void> {
    await win(page).getByRole('tab', { name, exact: true }).dispatchEvent('mousedown')
    await expect(win(page).getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
}

// A menu of the menu bar, then an item of it (and of its submenu, if given).
export async function menu(page: Page, bar: string, item: string, sub?: string): Promise<void> {
    await win(page).getByRole('menubar').getByRole('menuitem', { name: bar, exact: true }).dispatchEvent('mousedown')
    const entry = root(page).getByRole('menu').getByRole('menuitem', { name: item, exact: true })
    if (sub) {
        await entry.hover()
        await root(page).getByRole('menu').getByRole('menuitem', { name: sub, exact: true }).click()
    }
    else await entry.click()
}

// The rows of a list, each as its cells' texts.
export async function rows(list: Locator): Promise<string[][]> {
    const all = list.locator('tbody tr')
    const count = await all.count()
    const result: string[][] = []
    for (let i = 0; i < count; i++) result.push(await all.nth(i).locator('td').allTextContents())
    return result
}

export async function headers(list: Locator): Promise<string[]> {
    return (await list.locator('thead th').allTextContents()).map(t => t.trim())
}

// The row whose first cell is `text` (or starts with it).
export const row = (list: Locator, text: string | RegExp): Locator =>
    list.locator('tbody tr').filter({ has: list.page().locator('td:first-child', { hasText: text }) })

export async function waitForRow(list: Locator, text: string | RegExp, timeout = 30000): Promise<void> {
    await expect(row(list, text).first()).toBeVisible({ timeout })
}

export const dialog = (page: Page, testId: string): Locator => root(page).getByTestId(testId)
