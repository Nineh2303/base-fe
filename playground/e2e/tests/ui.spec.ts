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
  expect(await bg(dialog.locator('button[data-variant=default], [data-test=dialog-confirm]').first())).toBe(PRODUCTS_PRIMARY)
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
