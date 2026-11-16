import { describe, expect, test } from 'vitest'
import { buildFederationOptions, DEFAULT_SHARED_NAMES, buildShared } from '../src/index'

const ctx = {
  root: '/r',
  versions: {
    vue: '^3.5.0',
    pinia: '^3.0.0',
    'vue-router': '^4.5.0',
    'vue-i18n': '^11.0.0',
    '@nineh-fe-base/mf-core': 'workspace:*',
  },
  coreVersion: '0.1.0',
}

describe('buildFederationOptions', () => {
  test('host: shared singleton đủ 5 package', () => {
    const o = buildFederationOptions('host', { name: 'shell' }, ctx) as any
    for (const n of DEFAULT_SHARED_NAMES) expect(o.shared[n]).toMatchObject({ singleton: true })
    expect(o.shared.vue.requiredVersion).toBe('^3.5.0')
    expect(o.shared['@nineh-fe-base/mf-core'].requiredVersion).toBe('^0.1.0')
    expect(o.remotes).toEqual({})
    expect(o.manifest).toBe(true)
  })

  test('dts bị tắt cho cả host và remote (remote nạp lúc runtime)', () => {
    expect((buildFederationOptions('host', { name: 'shell' }, ctx) as any).dts).toBe(false)
    expect((buildFederationOptions('remote', { name: 'products', exposes: {} }, ctx) as any).dts).toBe(false)
  })

  test.each(['*', 'workspace:*', 'link:../core', 'file:../core'])(
    'mf-core spec %s → ^coreVersion',
    (spec) => {
      const shared = buildShared({ ...ctx.versions, '@nineh-fe-base/mf-core': spec }, undefined, '0.1.0')
      expect(shared['@nineh-fe-base/mf-core']!.requiredVersion).toBe('^0.1.0')
    },
  )

  test('remote: filename, exposes giữ nguyên + ./mf-meta tự thêm', () => {
    const o = buildFederationOptions(
      'remote',
      { name: 'products', exposes: { './routes': './src/routes.ts' } },
      ctx,
    ) as any
    expect(o.filename).toBe('remoteEntry.js')
    expect(o.exposes['./routes']).toBe('./src/routes.ts')
    expect(o.exposes['./mf-meta']).toMatch(/node_modules[\\/]\.nineh-mf[\\/]mf-meta\.js$/)
  })

  test('shared của dự án merge đè lên mặc định', () => {
    const o = buildFederationOptions(
      'host',
      { name: 'shell', shared: { dayjs: { singleton: true } } },
      ctx,
    ) as any
    expect(o.shared.dayjs).toEqual({ singleton: true })
    expect(o.shared.vue).toBeDefined()
  })

  test('tên remote không hợp lệ (không phải identifier JS) → throw', () => {
    expect(() =>
      buildFederationOptions('remote', { name: 'my-products', exposes: {} }, ctx),
    ).toThrow(/name/)
  })
})
