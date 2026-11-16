export type SharedConfig = Record<
  string,
  { singleton?: boolean; requiredVersion?: string; eager?: boolean }
>

export const CORE_PACKAGE = '@nineh-fe-base/mf-core'

export const DEFAULT_SHARED_NAMES = [
  'vue',
  'pinia',
  'vue-router',
  'vue-i18n',
  CORE_PACKAGE,
] as const

/** Version specs that are not real semver ranges (monorepo links). */
function isLocalSpec(spec: string): boolean {
  return (
    spec === '*' ||
    spec.startsWith('workspace:') ||
    spec.startsWith('link:') ||
    spec.startsWith('file:')
  )
}

/**
 * Build the shared config: the 5 mandatory singletons plus project extras (extras override defaults).
 * For `@nineh-fe-base/mf-core`, local specs (`*`, `workspace:*`, `link:`, `file:`) map to `^<coreVersion>`.
 */
export function buildShared(
  versions: Record<string, string>,
  extra: SharedConfig = {},
  coreVersion?: string,
): SharedConfig {
  const shared: SharedConfig = {}
  for (const name of DEFAULT_SHARED_NAMES) {
    let requiredVersion = versions[name]
    if (
      name === CORE_PACKAGE &&
      coreVersion &&
      (!requiredVersion || isLocalSpec(requiredVersion))
    ) {
      requiredVersion = `^${coreVersion}`
    }
    shared[name] = requiredVersion ? { singleton: true, requiredVersion } : { singleton: true }
  }
  return { ...shared, ...extra }
}
