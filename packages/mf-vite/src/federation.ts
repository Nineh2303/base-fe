import type { ModuleFederationOptions } from '@module-federation/vite'
import type { UserConfig } from 'vite'
import { buildShared, type SharedConfig } from './shared'
import { metaModulePath } from './meta'

export interface HostOptions {
  name: string
  port?: number
  shared?: SharedConfig
  vite?: UserConfig
}

export interface RemoteOptions {
  name: string
  port?: number
  exposes: Record<string, string>
  shared?: SharedConfig
  vite?: UserConfig
}

export interface FederationContext {
  root: string
  versions: Record<string, string>
  coreVersion: string
}

export type FederationOptions = ModuleFederationOptions & {
  shared: SharedConfig
  exposes: Record<string, string>
  remotes: Record<string, string>
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

export function buildFederationOptions(
  kind: 'host' | 'remote',
  opts: HostOptions | RemoteOptions,
  ctx: FederationContext,
): FederationOptions {
  if (!IDENTIFIER.test(opts.name)) {
    throw new Error(
      `Invalid federation name "${opts.name}": name must be a valid JS identifier (JS identifier rules)`,
    )
  }
  const shared = buildShared(ctx.versions, opts.shared, ctx.coreVersion)
  const base = { name: opts.name, shared, manifest: true }

  if (kind === 'host') {
    return { ...base, remotes: {}, exposes: {} }
  }
  const { exposes } = opts as RemoteOptions
  return {
    ...base,
    filename: 'remoteEntry.js',
    remotes: {},
    exposes: { ...exposes, './mf-meta': metaModulePath(ctx.root) },
  }
}
