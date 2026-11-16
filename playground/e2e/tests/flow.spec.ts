import { expect, test, type Page } from '@playwright/test'

async function login(page: Page, password = 'admin') {
  await page.locator('[data-test=username]').fill('admin')
  await page.locator('[data-test=password]').fill(password)
  await page.locator('[data-test=submit]').click()
}

test.beforeAll(async ({ request }) => {
  // webServer only waits for :5000; make sure the remotes are up too.
  await expect
    .poll(async () => (await request.get('http://localhost:5001/mf-manifest.json')).ok(), { timeout: 60_000 })
    .toBe(true)
  await expect
    .poll(async () => (await request.get('http://localhost:5002/mf-manifest.json')).ok(), { timeout: 60_000 })
    .toBe(true)
})

test('unauthenticated /products redirects to /auth/login?redirect=/products', async ({ page }) => {
  await page.goto('/products')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/auth/login')
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/products')
  await expect(page.locator('[data-test=username]')).toBeVisible()
})

test('login admin/admin lands on /products with 3 rows', async ({ page }) => {
  await page.goto('/products')
  await login(page)
  await expect(page).toHaveURL(/\/products$/)
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3)
  await expect(page.locator('[data-test=user-name]')).toHaveText('Admin')
})

test('wrong password shows login-error', async ({ page }) => {
  await page.goto('/auth/login')
  await login(page, 'wrong')
  await expect(page.locator('[data-test=login-error]')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/auth/login')
})

test('reload /products after login restores the session', async ({ page }) => {
  await page.goto('/products')
  await login(page)
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3)
  await page.reload()
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3)
  expect(new URL(page.url()).pathname).toBe('/products')
})

test('remote CSS is applied: products title uses --mf-color-primary', async ({ page }) => {
  await page.goto('/products')
  await login(page)
  const title = page.locator('.products-title')
  await expect(title).toBeVisible()
  const { actual, expected } = await page.evaluate(() => {
    const probe = document.createElement('span')
    const token = getComputedStyle(document.documentElement).getPropertyValue('--mf-color-primary').trim()
    probe.style.color = token
    document.body.appendChild(probe)
    const expected = getComputedStyle(probe).color // resolve token to rgb()
    probe.remove()
    const actual = getComputedStyle(document.querySelector('.products-title')!).color
    return { actual, expected }
  })
  expect(expected).not.toBe('')
  expect(actual).toBe(expected)
})

test('blocking :5002 shows mf-remote-error while shell header and login still work', async ({ page, context }) => {
  await context.route('http://localhost:5002/**', (r) => r.abort())
  await page.goto('/auth/login')
  await login(page)
  await expect(page.locator('[data-test=user-name]')).toHaveText('Admin')
  await page.locator('[data-test=menu-products]').click()
  await expect(page.locator('.mf-remote-error')).toBeVisible()
  await expect(page.locator('[data-test=shell-header]')).toBeVisible()
  await expect(page.locator('[data-test=user-name]')).toHaveText('Admin')
  await page.goto('/auth/login')
  await expect(page.locator('[data-test=username]')).toBeVisible()
})

test('blocking :5001 shows mf-critical-error', async ({ page, context }) => {
  await context.route('http://localhost:5001/**', (r) => r.abort())
  await page.goto('/products')
  await expect(page.locator('.mf-critical-error')).toBeVisible()
})

test('single Vue instance: __SHARE__ has one vue version; header and remote see the same user', async ({ page }) => {
  await page.goto('/products')
  await login(page)
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3)

  // Federation share scope: exactly one registered vue version, and it is not loaded from a remote.
  const vue = await page.evaluate(() => {
    const share = (window as any).__FEDERATION__?.__SHARE__ ?? {}
    const out: { instance: string; version: string; from: string; useIn: string[] }[] = []
    for (const [instance, scopes] of Object.entries<any>(share)) {
      for (const versions of Object.values<any>(scopes ?? {})) {
        for (const [version, s] of Object.entries<any>(versions?.vue ?? {})) {
          out.push({ instance, version, from: s.from, useIn: [...(s.useIn ?? [])] })
        }
      }
    }
    return out
  })
  expect(vue.length).toBeGreaterThan(0)
  expect(new Set(vue.map((v) => v.version)).size).toBe(1)
  // every registration is provided by the shell and consumed only by the shell
  for (const v of vue) {
    expect(v.from).toBe('shell')
    expect(v.useIn).toEqual(['shell'])
  }

  // Complementary check: header (host) and products page (remote) share one auth store.
  await expect(page.locator('[data-test=user-name]')).toHaveText('Admin')
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3) // remote fetched with host's token
})
