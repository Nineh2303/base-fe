import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { remoteCssScopePlugin, scopeCss, scopePrelude } from '../src/scope-css'

const S = '@scope ([data-mf-remote="products"]) to ([data-mf-remote])'
const flat = (css: string) => css.replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1').trim()
const run = (css: string, name = 'products') => flat(scopeCss(css, name).code)

describe('scopeCss: scope-element rules stay global (token overrides)', () => {
  test.each([
    "[data-mf-remote='products'][data-theme='dark']{--a:1}",
    "[data-mf-remote='products'].dark{--a:1}",
    "[data-mf-remote='products']:hover{--a:1}",
    ':where([data-mf-remote="products"]){--a:1}',
    "[data-theme='dark'] [data-mf-remote='products'][data-density=compact]{--a:1}",
    '[data-mf-remote="products" i]{--a:1}',
    '[data-mf-remote^="prod"]{--a:1}',
    '[data-mf-remote]{--a:1}',
  ])('%s is not wrapped (it must keep matching the scope root)', (sel) => {
    expect(run(sel)).toBe(flat(sel))
  })

  test('selectors whose subject is a descendant, or only mention the attribute in :not/:has, are scoped', () => {
    for (const sel of [
      "[data-mf-remote='products'] .x{--a:1}",
      "[data-mf-remote='products']>.x{--a:1}",
      '.x:not([data-mf-remote]){--a:1}',
      '.x:has([data-mf-remote="a"]){--a:1}',
    ]) {
      expect(run(sel), sel).toBe(`${S}{${sel}}`)
    }
  })

  test('a list mixing root and descendant selectors is scoped as a whole', () => {
    expect(run("[data-mf-remote='products'].dark,.x{--a:1}")).toBe(
      `${S}{[data-mf-remote='products'].dark,.x{--a:1}}`,
    )
  })

  test('another remote name inside the attribute does not change classification', () => {
    expect(run("[data-mf-remote='other']{--a:1}")).toBe("[data-mf-remote='other']{--a:1}")
  })

  test('attribute value containing a bracket does not break the compound split', () => {
    expect(run('[data-mf-remote="a]"] .x{a:b}')).toBe(`${S}{[data-mf-remote="a]"] .x{a:b}}`)
  })
})

describe('scopeCss: structure edge cases', () => {
  test('no layers at all: plain stylesheet is wrapped once, order of global rules preserved', () => {
    expect(run('.a{color:red}@keyframes k{to{opacity:1}}.b{color:blue}')).toBe(
      `${S}{.a{color:red}}@keyframes k{to{opacity:1}}${S}{.b{color:blue}}`,
    )
  })

  test('empty layers and comment-only layers are not wrapped (no empty @scope)', () => {
    expect(run('@layer utilities{}')).toBe('@layer utilities{}')
    expect(run('@layer base{/* only a comment */}')).toBe('@layer base{/* only a comment */}')
    expect(run('@media print{}')).toBe('@media print{}')
  })

  test('whitespace-only and @charset-only input pass through', () => {
    expect(scopeCss('  \n ', 'products').code.trim()).toBe('')
    expect(run('@charset "utf-8";')).toBe('@charset "utf-8";')
  })

  test('@import stays before the first @scope', () => {
    const out = run('@import url(x.css) layer(theme);.a{b:c}')
    expect(out.indexOf('@import')).toBe(0)
    expect(out.indexOf('@scope')).toBeGreaterThan(out.indexOf('@import'))
  })

  test('@media nested in @layer nested in @media: rules scoped at the innermost level', () => {
    expect(run('@media print{@layer base{@supports (a:b){.a{b:c}}}}')).toBe(
      `@media print{@layer base{@supports (a:b){${S}{.a{b:c}}}}}`,
    )
  })

  test('@container and @starting-style recurse; @position-try / @counter-style / @page stay global', () => {
    expect(run('@container (min-width:1px){.a{b:c}}')).toBe(`@container (min-width:1px){${S}{.a{b:c}}}`)
    expect(run('@starting-style{.a{opacity:0}}')).toBe(`@starting-style{${S}{.a{opacity:0}}}`)
    const global = '@position-try --a{top:0}@counter-style c{system:cyclic}@page{margin:0}'
    expect(run(global)).toBe(flat(global))
  })

  test('at-rule names are matched case-insensitively', () => {
    expect(run('@MEDIA print{.a{b:c}}')).toBe(`@MEDIA print{${S}{.a{b:c}}}`)
    expect(run('@KEYFRAMES k{to{a:b}}')).toBe('@KEYFRAMES k{to{a:b}}')
  })

  test('layer theme is global only for the exact name "theme" (sub-layers and look-alikes are scoped)', () => {
    expect(run('@layer theme{.x{a:b}}')).toBe('@layer theme{.x{a:b}}')
    expect(run('@layer theme.dark{.x{a:b}}')).toBe(`@layer theme.dark{${S}{.x{a:b}}}`)
    expect(run('@layer themes{.x{a:b}}')).toBe(`@layer themes{${S}{.x{a:b}}}`)
  })

  test('CSS nesting is preserved untouched inside the wrapped rule', () => {
    expect(run('.a{&:hover{color:red}.b &{color:blue}}')).toBe(
      `${S}{.a{&:hover{color:red}.b &{color:blue}}}`,
    )
  })

  test('comments between rules stay inside the wrapped run; trailing comment before a global at-rule is kept', () => {
    const out = run('.a{b:c}/* mid */.d{e:f}@keyframes k{to{a:b}}/* end */')
    expect(out).toContain('/* mid */')
    expect(out).toContain('/* end */')
    expect(out.match(/@scope/g)).toHaveLength(1)
  })

  test('already scoped CSS (a user @scope) is wrapped, not mangled', () => {
    expect(run('@scope (.x){.a{b:c}}')).toBe(`${S}{@scope (.x){.a{b:c}}}`)
  })

  test('remote names with $ and _ appear verbatim in the prelude; double scoping is not idempotent-safe but valid', () => {
    expect(scopePrelude('my$remote_1')).toBe('([data-mf-remote="my$remote_1"]) to ([data-mf-remote])')
    const out = scopeCss('.a{b:c}', '$s').code
    expect(out).toContain('@scope ([data-mf-remote="$s"])')
  })

  test('minified single-line input (what Tailwind build emits) is handled', () => {
    expect(
      run('@layer theme,base,utilities;@layer theme{:root{--a:1}}@layer utilities{.hidden{display:none}@media (width>=48rem){.md\\:flex{display:flex}}}'),
    ).toBe(
      `@layer theme,base,utilities;@layer theme{:root{--a:1}}@layer utilities{${S}{.hidden{display:none}}@media (width>=48rem){${S}{.md\\:flex{display:flex}}}}`,
    )
  })

  test('Tailwind properties-layer fallback is recursed without throwing', () => {
    expect(() =>
      scopeCss('@layer properties{@supports (((-webkit-hyphens:none))){*,:before,:after,::backdrop{--tw-x:0}}}', 'p'),
    ).not.toThrow()
  })

  test('malformed CSS throws a CssSyntaxError (surfaced by Vite as a build error, not swallowed)', () => {
    expect(() => scopeCss('.a{color:red', 'products')).toThrow(/Unclosed block/)
  })

  test('a source map is only produced when a file name is given', () => {
    expect(scopeCss('.a{b:c}', 'products').map).toBeNull()
    const m = JSON.parse(scopeCss('.a{b:c}', 'products', '/x/a.css').map!)
    expect(m.version).toBe(3)
  })
})

describe('remoteCssScopePlugin: more ids', () => {
  const plugin = remoteCssScopePlugin('products')
  const t = (code: string, id: string) =>
    (plugin.transform as (c: string, id: string) => { code: string } | null | undefined)(code, id)

  test('every Vite css extension is transformed; query strings (?used, ?direct, ?t=) do not block', () => {
    for (const id of ['/a.css', '/a.scss', '/a.less', '/a.pcss', '/a.styl', '/a.css?direct', '/a.css?t=123', '/a.css?used']) {
      expect(t('.a{b:c}', id)?.code, id).toContain('@scope')
    }
  })

  test('look-alike ids are not transformed', () => {
    for (const id of ['/a.css.map', '/css', '/a.cssx', '/a.ts?css']) expect(t('.a{b:c}', id), id).toBeFalsy()
  })

  test('?raw / ?url / ?inline detected after other query params too', () => {
    expect(t('.a{}', '/a.css?foo=1&inline')).toBeFalsy()
    expect(t('.a{}', '/a.css?x&raw')).toBeFalsy()
  })

  test('excluded path matches regardless of slashes, query and (windows) case', () => {
    const p = remoteCssScopePlugin('products', { exclude: ['/Repo/ui/styles/host.css'] })
    const tr = p.transform as (c: string, id: string) => unknown
    expect(tr('.a{}', '/Repo/ui/styles/host.css?direct')).toBeFalsy()
    expect(tr('.a{}', '/Repo/ui/styles/other.css')).toBeTruthy()
  })
})

describe('plugin inside a real Vite build and dev server', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mfv-css-'))
    mkdirSync(join(root, 'src'))
    writeFileSync(
      join(root, 'src', 'a.css'),
      '@layer theme,base,utilities;@layer theme{:root{--sp:1px}}@layer utilities{.hidden{display:none}}@keyframes k{to{opacity:1}}',
    )
    writeFileSync(join(root, 'src', 'b.css'), '.other{color:red}')
    writeFileSync(join(root, 'src', 'host.css'), '.pre{margin:0}')
    writeFileSync(join(root, 'src', 'main.js'), "import './a.css'\nimport './b.css'\nimport './host.css'\nexport default 1\n")
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  test('build: every emitted css asset is scoped, except the excluded file; theme/keyframes global', async () => {
    const out: any = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [remoteCssScopePlugin('products', { exclude: [join(root, 'src', 'host.css')] })],
      build: { write: false, lib: { entry: join(root, 'src', 'main.js'), formats: ['es'], cssFileName: 'style' }, cssCodeSplit: false },
    })
    const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output)
    const css = outputs.filter((o: any) => o.fileName.endsWith('.css')).map((o: any) => String(o.source)).join('\n')
    // the minifier may drop the quotes / the space after @scope: normalise before comparing
    const f = flat(css).replaceAll('@scope(', '@scope (').replaceAll('[data-mf-remote=products]', '[data-mf-remote="products"]')
    expect(f).toContain(`@layer utilities{${S}{.hidden{display:none}}}`)
    expect(f).toContain(`${S}{.other{color:red}}`)
    expect(f).toContain('@layer theme{:root{--sp:1px}}')
    expect(f).toContain('@keyframes k{to{opacity:1}}')
    // excluded file is left global
    expect(f).toMatch(/\.pre\{margin:0\}/)
    expect(f).not.toContain(`${S}{.pre`)
  })

  test('dev: the css served to the browser (js injection and ?direct) is scoped', async () => {
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'custom',
      plugins: [remoteCssScopePlugin('products', { exclude: [join(root, 'src', 'host.css')] })],
    })
    try {
      const js = await server.transformRequest('/src/a.css')
      expect(js?.code).toContain('@scope')
      expect(js?.code).toContain('products')
      const direct = await server.transformRequest('/src/b.css?direct')
      expect(direct?.code).toContain('@scope')
      const excluded = await server.transformRequest('/src/host.css?direct')
      expect(excluded?.code).not.toContain('@scope')
    } finally {
      await server.close()
    }
  })
})
