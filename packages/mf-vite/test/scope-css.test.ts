import { describe, expect, test } from 'vitest'
import { scopeCss, remoteCssScopePlugin } from '../src/scope-css'

const S = '@scope ([data-mf-remote="products"]) to ([data-mf-remote])'

/** Strip whitespace so assertions don't depend on postcss formatting. */
function flat(css: string): string {
  return css.replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1').trim()
}

function run(css: string): string {
  return flat(scopeCss(css, 'products').code)
}

describe('scopeCss', () => {
  test('unlayered style rules are wrapped in @scope', () => {
    expect(run('.hidden{display:none}')).toBe(`${S}{.hidden{display:none}}`)
  })

  test('contents of base/components/utilities layers are wrapped inside the layer', () => {
    const out = run(
      '@layer base{button{cursor:pointer}}@layer components{.card{padding:1px}}@layer utilities{.flex{display:flex}}',
    )
    expect(out).toBe(
      `@layer base{${S}{button{cursor:pointer}}}` +
        `@layer components{${S}{.card{padding:1px}}}` +
        `@layer utilities{${S}{.flex{display:flex}}}`,
    )
  })

  test('theme layer, @layer statements, @property, @keyframes, @font-face, @import stay global', () => {
    const src =
      '@import "x.css";' +
      '@layer theme, base, components, utilities;' +
      '@layer theme{:root,:host{--spacing:.25rem}}' +
      '@property --tw-x{syntax:"*";inherits:false}' +
      '@keyframes pulse{50%{opacity:.5}}' +
      '@font-face{font-family:A;src:url(a.woff2)}'
    expect(run(src)).toBe(flat(src))
  })

  test('@keyframes/@property inside a scoped layer are hoisted out of the @scope run, order kept', () => {
    const out = run('@layer utilities{.a{color:red}@keyframes spin{to{rotate:1turn}}.b{color:blue}}')
    expect(out).toBe(
      `@layer utilities{${S}{.a{color:red}}@keyframes spin{to{rotate:1turn}}${S}{.b{color:blue}}}`,
    )
  })

  test('@media/@supports are recursed into, their rules scoped inside', () => {
    expect(run('@layer utilities{@media (width>=48rem){.md\\:flex{display:flex}}}')).toBe(
      `@layer utilities{@media (width>=48rem){${S}{.md\\:flex{display:flex}}}}`,
    )
    expect(run('@supports (color:red){.a{color:red}}')).toBe(`@supports (color:red){${S}{.a{color:red}}}`)
  })

  test('rules targeting the scope element itself ([data-mf-remote…] subject) stay global', () => {
    const src =
      "[data-mf-remote='products']{--mf-color-primary:#16a34a}" +
      "[data-theme='dark'] [data-mf-remote='products']{--mf-color-primary:#4ade80}" +
      '[data-mf-remote=products]{--x:1}' +
      '@media (prefers-color-scheme:dark){[data-mf-remote="products"]{--y:1}}'
    expect(run(src)).toBe(flat(src))
  })

  test('a selector list is global only when every subject targets [data-mf-remote]', () => {
    expect(run("[data-mf-remote='products'],.x{--a:1}")).toBe(
      `${S}{[data-mf-remote='products'],.x{--a:1}}`,
    )
    // [data-mf-remote] as an ancestor only: subject is .x, so it is scoped
    expect(run("[data-mf-remote='products'] .x{--a:1}")).toBe(
      `${S}{[data-mf-remote='products'] .x{--a:1}}`,
    )
  })

  test('commas inside :where() are not selector-list separators', () => {
    const out = run('.dark\\:bg-x:where([data-theme=dark],[data-theme=dark] *){color:red}')
    expect(out).toBe(`${S}{.dark\\:bg-x:where([data-theme=dark],[data-theme=dark] *){color:red}}`)
  })

  test('nested layer blocks are recursed; nested theme layer stays global', () => {
    expect(run('@layer outer{@layer theme{:root{--a:1}}.a{color:red}}')).toBe(
      `@layer outer{@layer theme{:root{--a:1}}${S}{.a{color:red}}}`,
    )
  })

  test('empty input and comment-only input are left alone', () => {
    expect(run('')).toBe('')
    expect(run('/*! banner */')).toBe('/*! banner */')
  })

  test('returns a source map', () => {
    expect(scopeCss('.a{color:red}', 'products', '/x/a.css').map).toBeTruthy()
  })
})

describe('remoteCssScopePlugin', () => {
  const plugin = remoteCssScopePlugin('products', { exclude: ['/repo/packages/ui/styles/host.css'] })
  const transform = (code: string, id: string) =>
    (plugin.transform as (code: string, id: string) => { code: string } | null | undefined)(code, id)

  test('normal-phase plugin (runs after Tailwind and vite:css, before vite:css-post)', () => {
    expect(plugin.name).toBe('nineh-mf:scope-remote-css')
    expect((plugin as { enforce?: string }).enforce).toBeUndefined()
  })

  test('transforms css files and vue style blocks', () => {
    expect(transform('.a{color:red}', '/repo/src/style.css')?.code).toContain('@scope')
    expect(
      transform('.a{color:red}', '/repo/src/A.vue?vue&type=style&index=0&lang.css')?.code,
    ).toContain('@scope')
  })

  test('skips non-css modules, ?raw/?url/?inline css and excluded files (standalone host.css)', () => {
    expect(transform('export default 1', '/repo/src/a.ts')).toBeFalsy()
    expect(transform('.a{}', '/repo/src/a.css?raw')).toBeFalsy()
    expect(transform('.a{}', '/repo/src/a.css?url')).toBeFalsy()
    expect(transform('.a{}', '/repo/src/a.css?inline')).toBeFalsy()
    expect(transform('.a{}', '/repo/packages/ui/styles/host.css')).toBeFalsy()
    // windows-style id / drive-letter case
    const win = remoteCssScopePlugin('products', { exclude: ['H:\\repo\\packages\\ui\\styles\\host.css'] })
    expect(
      (win.transform as (c: string, id: string) => unknown)('.a{}', 'h:/repo/packages/ui/styles/host.css'),
    ).toBeFalsy()
  })
})
