import type { RemoteEntry, RemotesManifest } from '../types'

export type ManifestSource = string | RemotesManifest | (() => Promise<RemotesManifest>)

export interface ParsedManifest {
  remotes: RemoteEntry[]
  errors: string[]
}

/** Same rule as mf-vite: a remote name must be a valid JS identifier. */
export const REMOTE_NAME = /^[A-Za-z_$][\w$]*$/

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseEntry(raw: unknown, i: number, errors: string[]): RemoteEntry | null {
  const at = `remotes[${i}]`
  if (!isObject(raw)) {
    errors.push(`${at}: must be an object`)
    return null
  }
  const { name, entry, routePrefix, critical, menu } = raw
  if (typeof name !== 'string' || !REMOTE_NAME.test(name)) {
    errors.push(`${at}: invalid name ${JSON.stringify(name)} (must match ${REMOTE_NAME})`)
    return null
  }
  if (typeof entry !== 'string' || entry.trim() === '') {
    errors.push(`${at} (${name}): missing "entry" URL`)
    return null
  }
  if (typeof routePrefix !== 'string' || !routePrefix.startsWith('/')) {
    errors.push(`${at} (${name}): "routePrefix" must be a string starting with "/"`)
    return null
  }
  const prefix = routePrefix.replace(/\/+$/, '')
  if (prefix === '') {
    errors.push(`${at} (${name}): "routePrefix" must not be the root "/"`)
    return null
  }

  const out: RemoteEntry = { name, entry: entry.trim(), routePrefix: prefix }
  if (critical !== undefined) {
    if (typeof critical === 'boolean') out.critical = critical
    else errors.push(`${at} (${name}): "critical" must be a boolean, ignored`)
  }
  if (menu !== undefined) {
    if (isObject(menu) && typeof menu.label === 'string') {
      out.menu = { label: menu.label }
      if (typeof menu.order === 'number') out.menu.order = menu.order
    } else {
      errors.push(`${at} (${name}): "menu" must be { label: string; order?: number }, ignored`)
    }
  }
  return out
}

/** Validates an untrusted manifest. Broken entries are dropped and reported in `errors`. */
export function parseManifest(input: unknown): ParsedManifest {
  const errors: string[] = []
  if (!isObject(input) || !Array.isArray(input.remotes)) {
    return { remotes: [], errors: ['manifest must be an object with a "remotes" array'] }
  }
  const remotes: RemoteEntry[] = []
  input.remotes.forEach((raw, i) => {
    const e = parseEntry(raw, i, errors)
    if (e) remotes.push(e)
  })
  return { remotes, errors }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Resolves a manifest from a URL, an inline object or an async factory. Never rejects. */
export async function loadManifest(src: ManifestSource): Promise<ParsedManifest> {
  try {
    let data: unknown
    if (typeof src === 'string') {
      const res = await fetch(src, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim())
      try {
        data = await res.json()
      } catch (err) {
        throw new Error(`invalid JSON (${message(err)})`, { cause: err })
      }
    } else if (typeof src === 'function') {
      data = await src()
    } else {
      data = src
    }
    return parseManifest(data)
  } catch (err) {
    const where = typeof src === 'string' ? ` from ${src}` : ''
    return { remotes: [], errors: [`failed to load manifest${where}: ${message(err)}`] }
  }
}
