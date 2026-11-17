import { expect, test, type Page } from '@playwright/test'

const TOKEN_STORE = 'playground-mocks/tokens'
const REFRESH_KEY = 'mf-refresh-token'

async function login(page: Page, username = 'admin', password = username) {
  await page.locator('[data-test=username]').fill(username)
  await page.locator('[data-test=password]').fill(password)
  await page.locator('[data-test=submit]').click()
}

const path = (page: Page) => new URL(page.url()).pathname
const rows = (page: Page) => page.locator('[data-test=product-row]')
const refreshToken = (page: Page) => page.evaluate((k) => localStorage.getItem(k), REFRESH_KEY)
const detailBg = (page: Page) =>
  page.locator('[data-test=product-detail]').first().evaluate((el) => getComputedStyle(el).backgroundColor)

/** Simulates server-side expiry in the mock: drop the issued access (and optionally refresh) tokens. */
const expireTokens = (page: Page, opts: { refresh: boolean }) =>
  page.evaluate(
    ([key, refresh]) => {
      const s = JSON.parse(localStorage.getItem(key as string)!)
      s.access = []
      if (refresh) s.refresh = []
      localStorage.setItem(key as string, JSON.stringify(s))
    },
    [TOKEN_STORE, opts.refresh] as const,
  )

test.describe('session', () => {
  test('logout clears the session, the refresh token, and protected routes redirect again', async ({ page }) => {
    await page.goto('/products')
    await login(page, 'admin')
    await expect(rows(page)).toHaveCount(3)
    expect(await refreshToken(page)).toBeTruthy()

    await page.locator('[data-test=logout]').click()
    await expect(page.locator('[data-test=login-link]')).toBeVisible()
    await expect(page.locator('[data-test=user-name]')).toHaveCount(0)
    expect(path(page)).toBe('/')
    expect(await refreshToken(page)).toBeNull()

    await page.goto('/products')
    await expect.poll(() => path(page)).toBe('/auth/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/products')
    // a reload does not resurrect the session either
    await page.goto('/')
    await expect(page.locator('[data-test=login-link]')).toBeVisible()
  })

  test('deep link keeps its query string through the login redirect', async ({ page }) => {
    await page.goto('/products?sort=name&page=2')
    await expect.poll(() => path(page)).toBe('/auth/login')
    await login(page)
    await expect(rows(page)).toHaveCount(3)
    expect(path(page)).toBe('/products')
    expect(new URL(page.url()).search).toBe('?sort=name&page=2')
  })

  test('expired access token: 401 -> refresh (rotates the refresh token) -> request is retried', async ({ page }) => {
    await page.goto('/products')
    await login(page)
    await expect(rows(page)).toHaveCount(3)
    const before = await refreshToken(page)

    await expireTokens(page, { refresh: false })
    await page.locator('a[href="/"]').first().click()
    await expect(rows(page)).toHaveCount(0)
    await page.locator('[data-test=menu-products]').click() // remounts the list -> fetches with the stale token
    await expect(rows(page)).toHaveCount(3)
    expect(path(page)).toBe('/products')
    const after = await refreshToken(page)
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
    await expect(page.locator('[data-test=user-name]')).toHaveText('Admin')
  })

  test('refresh failure logs the user out and sends them to login', async ({ page }) => {
    await page.goto('/products')
    await login(page)
    await expect(rows(page)).toHaveCount(3)

    await expireTokens(page, { refresh: true })
    await page.locator('a[href="/"]').first().click()
    await page.locator('[data-test=menu-products]').click()
    await expect.poll(() => path(page)).toBe('/auth/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/products')
    await expect(page.locator('[data-test=login-link]')).toBeVisible()
    expect(await refreshToken(page)).toBeNull()
  })

  test('user without products.read is sent to /403 and the shell stays usable', async ({ page }) => {
    await page.goto('/auth/login')
    await login(page, 'viewer')
    await expect(page.locator('[data-test=user-name]')).toHaveText('Viewer')
    await page.locator('[data-test=menu-products]').click()
    await expect(page.locator('[data-test=forbidden]')).toBeVisible()
    expect(path(page)).toBe('/403')
    await expect(rows(page)).toHaveCount(0)
    // the restored session is still the viewer (not the admin) after a reload
    await page.reload()
    await expect(page.locator('[data-test=user-name]')).toHaveText('Viewer')
    await page.goto('/products')
    await expect(page.locator('[data-test=forbidden]')).toBeVisible()
  })

  test('keyboard-only login: Tab order and Enter submit', async ({ page }) => {
    await page.goto('/auth/login')
    await page.locator('[data-test=username]').focus()
    await page.keyboard.type('admin')
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-test=password]')).toBeFocused()
    await page.keyboard.type('admin')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-test=welcome]')).toHaveText(/Admin/)
    expect(path(page)).toBe('/')
  })
})

test.describe('routing', () => {
  test('unknown route renders the 404 page inside the shell', async ({ page }) => {
    await page.goto('/definitely/not/here')
    await expect(page.locator('[data-test=not-found]')).toBeVisible()
    await expect(page.locator('[data-test=shell-header]')).toBeVisible()
  })

  test('back/forward across host and remote pages', async ({ page }) => {
    await page.goto('/products')
    await login(page)
    await expect(rows(page)).toHaveCount(3)
    await page.locator('a[href="/"]').first().click()
    await expect(page.locator('[data-test=welcome]')).toBeVisible()
    await page.goBack()
    await expect(rows(page)).toHaveCount(3)
    expect(path(page)).toBe('/products')
    await page.goForward()
    await expect(page.locator('[data-test=welcome]')).toBeVisible()
    expect(path(page)).toBe('/')
  })

  test('menu is built from remotes.json: label and order', async ({ page, context }) => {
    // context.route, not page.route: the MSW service worker answers page fetches, which page.route cannot see
    await context.route('**/remotes.json', async (route) => {
      const res = await route.fetch()
      const json = await res.json()
      for (const r of json.remotes) {
        if (r.name === 'auth') r.menu = { label: 'Tài khoản', order: 0 }
        if (r.name === 'products') r.menu = { label: 'Hàng hóa', order: 5 }
      }
      await route.fulfill({ response: res, json })
    })
    await page.goto('/')
    const links = page.locator('[data-test=shell-header] nav a')
    await expect(links).toHaveText(['Tài khoản', 'Hàng hóa'])
    await expect(links.nth(1)).toHaveAttribute('href', '/products')
  })
})

test.describe('remote failures', () => {
  test.setTimeout(90_000)

  test('slow remote: loader timeout frame, then Retry succeeds once the remote answers', async ({ page, context }) => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    await context.route('http://localhost:5002/**', async (route) => {
      await gate
      await route.continue().catch(() => {})
    })
    // boot waits for the loader timeout (10s), then the shell comes up without the remote
    await page.goto('/auth/login')
    await login(page)
    await expect(page.locator('[data-test=user-name]')).toHaveText('Admin', { timeout: 20_000 })
    await page.locator('[data-test=menu-products]').click()
    const frame = page.locator('.mf-remote-error')
    await expect(frame).toBeVisible()
    await expect(frame).toContainText(/timeout|did not load/i)
    await expect(page.locator('[data-test=shell-header]')).toBeVisible()

    release()
    await page.locator('[data-test=mf-retry]').click()
    await expect(rows(page)).toHaveCount(3)
    await expect(frame).toHaveCount(0)
  })

  test('remote mf-manifest 500: shell and login still work, products route does not crash the app', async ({ page, context }) => {
    await context.route('http://localhost:5002/mf-manifest.json', (r) => r.fulfill({ status: 500, body: 'boom' }))
    await page.goto('/auth/login')
    await login(page)
    await expect(page.locator('[data-test=user-name]')).toHaveText('Admin')
    await page.locator('[data-test=menu-products]').click()
    await expect(page.locator('.mf-remote-error')).toBeVisible()
    await expect(page.locator('[data-test=shell-header]')).toBeVisible()
    await page.locator('[data-test=logout]').click()
    await expect(page.locator('[data-test=login-link]')).toBeVisible()
  })
})

test.describe('theme and layout', () => {
  test('dark mode survives client-side navigation host -> remote -> host', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-test=theme-toggle]').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.locator('[data-test=login-link]').click()
    await login(page)
    await page.locator('[data-test=menu-products]').click()
    await expect(rows(page)).toHaveCount(3)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => detailBg(page)).toBe('rgb(74, 222, 128)')
    await page.locator('a[href="/"]').first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('standalone remote honours a stored dark theme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mf-theme', 'dark'))
    await page.goto('http://localhost:5002/products')
    await expect(rows(page)).toHaveCount(3)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => detailBg(page)).toBe('rgb(74, 222, 128)')
  })

  test('mobile 390px: header fits, desktop-only tagline hidden, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/products')
    await login(page)
    await expect(rows(page)).toHaveCount(3)
    await expect(page.locator('[data-test=shell-tagline]')).toBeHidden()
    await expect(page.locator('[data-test=products-hint]')).toBeHidden()
    for (const sel of ['theme-toggle', 'user-menu', 'logout', 'menu-products']) {
      const box = await page.locator(`[data-test=${sel}]`).boundingBox()
      expect(box, sel).not.toBeNull()
      expect(box!.x, sel).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, sel).toBeLessThanOrEqual(390)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
