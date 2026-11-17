import { expect, test, type Page } from '@playwright/test'

const PRODUCTS_PRIMARY = 'rgb(22, 163, 74)'
const PRODUCTS_PRIMARY_DARK = 'rgb(74, 222, 128)'
const DEFAULT_PRIMARY = 'rgb(37, 99, 235)'

async function loginToProducts(page: Page) {
  await page.goto('/products')
  await page.locator('[data-test=username]').fill('admin')
  await page.locator('[data-test=password]').fill('admin')
  await page.locator('[data-test=submit]').click()
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3)
}

const bg = (loc: ReturnType<Page['locator']>) => loc.evaluate((el) => getComputedStyle(el).backgroundColor)

test('products button uses scoped primary', async ({ page }) => {
  await loginToProducts(page)
  const btn = page.locator('[data-test=product-detail]').first()
  await expect(btn).toBeVisible()
  expect(await bg(btn)).toBe(PRODUCTS_PRIMARY)
})

test('dialog keeps scoped token', async ({ page }) => {
  await loginToProducts(page)
  await page.locator('[data-test=product-detail]').first().click()
  const dialog = page.locator('[data-test=product-dialog]')
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((el) => !!el.closest('[data-mf-remote="products"]'))).toBe(true)
  expect(await bg(dialog.locator('[data-test=dialog-confirm]'))).toBe(PRODUCTS_PRIMARY)
})

test('dark mode switches host and remote', async ({ page }) => {
  await loginToProducts(page)
  const header = page.locator('[data-test=shell-header]')
  const btn = page.locator('[data-test=product-detail]').first()
  const headerLight = await bg(header)
  expect(await bg(btn)).toBe(PRODUCTS_PRIMARY)
  await page.locator('[data-test=theme-toggle]').click()
  await expect.poll(() => bg(header)).not.toBe(headerLight)
  await expect.poll(() => bg(btn)).toBe(PRODUCTS_PRIMARY_DARK)
})

test('scoped override does not leak', async ({ page }) => {
  await loginToProducts(page)
  expect(await bg(page.locator('[data-test=logout]'))).toBe(DEFAULT_PRIMARY)
})

test('dialog content in dark mode uses dark scoped primary', async ({ page }) => {
  await loginToProducts(page)
  await page.locator('[data-test=theme-toggle]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.locator('[data-test=product-detail]').first().click()
  await expect(page.locator('[data-test=product-dialog]')).toBeVisible()
  await expect.poll(() => bg(page.locator('[data-test=dialog-confirm]'))).toBe(PRODUCTS_PRIMARY_DARK)
})

test('Escape closes the dialog and focus returns to the trigger', async ({ page }) => {
  await loginToProducts(page)
  const trigger = page.locator('[data-test=product-detail]').first()
  await trigger.click()
  await expect(page.locator('[data-test=product-dialog]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-test=product-dialog]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('shell dropdown opens in shell scope with default primary', async ({ page }) => {
  await loginToProducts(page)
  await page.locator('[data-test=user-menu]').click()
  const item = page.locator('[data-test=user-menu-home]')
  await expect(item).toBeVisible()
  expect(await item.evaluate((el) => !!el.closest('[data-mf-remote]'))).toBe(false)
  await item.hover()
  const primary = await item.evaluate((el) => getComputedStyle(el).getPropertyValue('--mf-color-primary').trim())
  expect(primary.toLowerCase()).not.toBe('#16a34a')
  await page.keyboard.press('Escape')
  expect(await bg(page.locator('[data-test=logout]'))).toBe(DEFAULT_PRIMARY)
})

test('products standalone has scoped green primary and preflight', async ({ page }) => {
  await page.goto('http://localhost:5002/products')
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3)
  expect(await page.evaluate(() => getComputedStyle(document.body).margin)).toBe('0px')
  expect(await page.locator('[data-test=product-detail]').first().evaluate((el) => !!el.closest('[data-mf-remote="products"]'))).toBe(true)
  expect(await bg(page.locator('[data-test=product-detail]').first())).toBe(PRODUCTS_PRIMARY)
})

test('products -> home -> products does not duplicate remote CSS', async ({ page }) => {
  await loginToProducts(page)
  const count = () => page.evaluate(() => document.styleSheets.length)
  const first = await count()
  for (let i = 0; i < 3; i++) {
    await page.locator('a[href="/"]').first().click()
    await expect(page.locator('[data-test=product-row]')).toHaveCount(0)
    await page.locator('[data-test=menu-products]').click()
    await expect(page.locator('[data-test=product-row]')).toHaveCount(3)
  }
  expect(await count()).toBe(first)
})

test('dark theme persists across reload and remote follows', async ({ page }) => {
  await loginToProducts(page)
  await page.locator('[data-test=theme-toggle]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('mf-theme'))).toBe('dark')
  await page.reload()
  await expect(page.locator('[data-test=product-row]')).toHaveCount(3)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => bg(page.locator('[data-test=product-detail]').first())).toBe(PRODUCTS_PRIMARY_DARK)
})

const display = (loc: ReturnType<Page['locator']>) => loc.evaluate((el) => getComputedStyle(el).display)

test("remote css cannot override host utilities: shell 'hidden md:flex' stays visible", async ({ page }) => {
  await page.goto('/')
  const tagline = page.locator('[data-test=shell-tagline]')
  expect(await display(tagline)).toBe('flex')
  await loginToProducts(page)
  // the products stylesheet (with its own `.hidden{display:none}`) is loaded now
  expect(await display(tagline)).toBe('flex')
  await expect(tagline).toBeVisible()
  // ...and it is @scope'd (cross-origin sheet: cssRules is not readable, so fetch its text)
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')]
      .map((l) => l.href)
      .filter((h) => h.startsWith('http://localhost:5002/')),
  )
  expect(hrefs.length).toBeGreaterThan(0)
  const texts = await Promise.all(hrefs.map(async (h) => (await page.request.get(h)).text()))
  expect(texts.some((t) => t.includes('@scope([data-mf-remote=products]) to ([data-mf-remote])'))).toBe(true)
  await page.setViewportSize({ width: 500, height: 800 })
  await expect(tagline).toBeHidden()
})

test('remote-only responsive class works inside the host', async ({ page }) => {
  await loginToProducts(page)
  const hint = page.locator('[data-test=products-hint]')
  expect(await display(hint)).toBe('block')
  await page.setViewportSize({ width: 500, height: 800 })
  await expect.poll(() => display(hint)).toBe('none')
})
