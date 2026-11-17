import postcss, { AtRule, type ChildNode, type Container, type Rule } from 'postcss'
import type { Plugin } from 'vite'

/**
 * Scoping of a remote's CSS to its `[data-mf-remote="<name>"]` subtree (rendered by RemoteBoundary).
 *
 * Without it a remote's stylesheet, appended after the host's when the remote loads, contains
 * utilities such as `.hidden{display:none}` in the same layer and with the same specificity as
 * the host's own, so it wins by source order and breaks host elements (`hidden md:flex`).
 * Wrapping the remote's style rules in `@scope (…) to ([data-mf-remote])` limits them to the
 * remote's own area (nested remotes excluded), and scoped rules beat equal-specificity
 * unscoped ones inside it (scope proximity), so the reverse case is fixed too.
 */

/** At-rules that are global by nature (or cannot live inside @scope): never wrapped. */
const GLOBAL_AT_RULES = new Set([
  'import',
  'charset',
  'namespace',
  'property',
  'keyframes',
  '-webkit-keyframes',
  'font-face',
  'font-feature-values',
  'font-palette-values',
  'counter-style',
  'page',
  'position-try',
  'view-transition',
])

/** Conditional group rules: recursed into, so rules inside them are classified individually. */
const RECURSE_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'starting-style'])

/** Split on top-level commas (ignores commas inside (), [] and strings). */
function splitTopLevel(selector: string, sep: (ch: string) => boolean): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]!
    if (quote) {
      cur += ch
      if (ch === '\\') cur += selector[++i] ?? ''
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '\\') {
      cur += ch + (selector[++i] ?? '')
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (depth === 0 && sep(ch)) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

const SCOPE_ATTR =
  /\[\s*data-mf-remote\s*(?:[~|^$*]?=\s*(?:"[^"]*"|'[^']*'|[^\]\s]+)\s*(?:[iIsS]\s*)?)?\]/
/** `:not(...)` / `:has(...)` arguments (one nesting level) say nothing about the subject itself. */
const NEGATIVE_OR_RELATIONAL = /:(?:not|has)\((?:[^()]|\([^()]*\))*\)/g

/**
 * True when the selector's subject (last compound) is the scope element: it carries a
 * `[data-mf-remote…]` attribute, alone or combined (`[data-mf-remote='x'][data-theme=dark]`,
 * `[data-mf-remote='x'].dark`, `[data-mf-remote='x']:hover`, `:where([data-mf-remote='x'])`).
 */
function targetsScopeElement(selector: string): boolean {
  const compounds = splitTopLevel(selector.trim(), (ch) => /[\s>+~]/.test(ch)).filter(Boolean)
  const subject = (compounds[compounds.length - 1] ?? '').replace(NEGATIVE_OR_RELATIONAL, '')
  return SCOPE_ATTR.test(subject)
}

/** Token overrides such as `[data-mf-remote='x']{--mf-…}` target the scope root: keep them global. */
function isScopeElementRule(rule: Rule): boolean {
  const selectors = splitTopLevel(rule.selector, (ch) => ch === ',')
  return selectors.length > 0 && selectors.every(targetsScopeElement)
}

function scopeContainer(container: Container, prelude: string): void {
  let run: ChildNode[] = []
  const flush = () => {
    const nodes = run
    run = []
    if (!nodes.some((n) => n.type !== 'comment')) return
    const wrap = new AtRule({ name: 'scope', params: prelude })
    nodes[0]!.before(wrap)
    wrap.append(nodes)
  }
  for (const node of [...(container.nodes ?? [])]) {
    if (node.type === 'comment') {
      if (run.length) run.push(node)
      continue
    }
    if (node.type === 'atrule') {
      const name = node.name.toLowerCase()
      if (GLOBAL_AT_RULES.has(name) || (name === 'layer' && !node.nodes)) {
        flush()
        continue
      }
      if (RECURSE_AT_RULES.has(name)) {
        flush()
        if (!(name === 'layer' && node.params.trim() === 'theme')) scopeContainer(node, prelude)
        continue
      }
    } else if (node.type === 'rule' && isScopeElementRule(node)) {
      flush()
      continue
    }
    run.push(node)
  }
  flush()
}

export function scopePrelude(name: string): string {
  return `([data-mf-remote="${name}"]) to ([data-mf-remote])`
}

export function scopeCss(
  css: string,
  name: string,
  from?: string,
): { code: string; map: string | null } {
  const root = postcss.parse(css, from ? { from } : undefined)
  scopeContainer(root, scopePrelude(name))
  const result = root.toResult({
    map: from ? { inline: false, annotation: false, sourcesContent: false } : false,
  })
  return { code: result.css, map: result.map ? result.map.toString() : null }
}

/** Same CSS id test as Vite (`.css` files and `?vue&type=style&lang.css` blocks, etc.). */
const CSS_RE = /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
const SKIP_QUERY_RE = /[?&](?:raw|url|inline)(?:&|=|$)/

function normalizePath(p: string): string {
  const s = p.split('?')[0]!.replace(/\\/g, '/')
  return process.platform === 'win32' || /^[a-zA-Z]:\//.test(s) ? s.toLowerCase() : s
}

export interface ScopePluginOptions {
  /** Absolute file paths never scoped (the standalone entry's `ui/styles/host.css`). */
  exclude?: string[]
}

/**
 * Normal-phase plugin (no `enforce`): Vite runs it after the `enforce: 'pre'` Tailwind generate
 * plugin and the core `vite:css` plugin, and before `vite:css-post` turns CSS into JS (dev
 * injection) or collects it into chunks (build). So it sees plain compiled CSS in both modes.
 */
export function remoteCssScopePlugin(name: string, opts: ScopePluginOptions = {}): Plugin {
  const exclude = new Set((opts.exclude ?? []).map(normalizePath))
  return {
    name: 'nineh-mf:scope-remote-css',
    transform(code, id) {
      if (!CSS_RE.test(id) || SKIP_QUERY_RE.test(id)) return null
      if (exclude.has(normalizePath(id))) return null
      return scopeCss(code, name, id.split('?')[0])
    },
  }
}
