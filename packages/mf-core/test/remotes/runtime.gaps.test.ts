import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const registerRemotes = vi.fn()
const loadRemote = vi.fn()
const getInstance = vi.fn()
const init = vi.fn()

vi.mock('@module-federation/runtime', () => ({
  getInstance: (...a: unknown[]) => getInstance(...a),
  init: (...a: unknown[]) => init(...a),
}))

import { mfRuntime } from '../../src/remotes/runtime'

const fake = { registerRemotes, loadRemote }

beforeEach(() => {
  registerRemotes.mockReset()
  loadRemote.mockReset()
  getInstance.mockReset()
  init.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('mfRuntime instance resolution', () => {
  it('prefers the instance bound to this copy of the runtime', () => {
    getInstance.mockReturnValueOnce(fake)
    mfRuntime.register([{ name: 'a', entry: 'http://x/remoteEntry.js' }])
    expect(registerRemotes).toHaveBeenCalledTimes(1)
    expect(init).not.toHaveBeenCalled()
    expect(getInstance).toHaveBeenCalledTimes(1)
  })

  it('falls back to a global __FEDERATION__ instance (the host plugin one)', () => {
    getInstance.mockReturnValueOnce(undefined).mockReturnValueOnce(fake)
    mfRuntime.register([{ name: 'a', entry: 'http://x/remoteEntry.js' }])
    expect(registerRemotes).toHaveBeenCalledTimes(1)
    expect(init).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('survives the global lookup throwing, then creates a warned fallback instance', () => {
    getInstance.mockReturnValueOnce(undefined).mockImplementationOnce(() => {
      throw new Error('no __FEDERATION__')
    })
    init.mockReturnValueOnce(fake)
    mfRuntime.register([{ name: 'a', entry: 'http://x/remoteEntry.js' }])
    expect(init).toHaveBeenCalledWith({ name: '__mf_core_host__', remotes: [] })
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(registerRemotes).toHaveBeenCalledTimes(1)
  })

  it('creates a fallback when neither lookup finds an instance', () => {
    getInstance.mockReturnValue(undefined)
    init.mockReturnValueOnce(fake)
    mfRuntime.register([])
    expect(init).toHaveBeenCalledTimes(1)
  })
})

describe('mfRuntime.register entry typing', () => {
  beforeEach(() => getInstance.mockReturnValue(fake))

  it('bare remoteEntry.js is registered as an ES module; mf-manifest.json (with or without query) is left to MF', () => {
    mfRuntime.register([
      { name: 'a', entry: 'http://x/remoteEntry.js' },
      { name: 'b', entry: 'http://x/mf-manifest.json' },
      { name: 'c', entry: 'http://x/mf-manifest.json?v=3' },
      { name: 'd', entry: 'http://x/mf-manifest.json.js' },
    ])
    expect(registerRemotes.mock.calls[0]![0]).toEqual([
      { name: 'a', entry: 'http://x/remoteEntry.js', type: 'module' },
      { name: 'b', entry: 'http://x/mf-manifest.json' },
      { name: 'c', entry: 'http://x/mf-manifest.json?v=3' },
      { name: 'd', entry: 'http://x/mf-manifest.json.js', type: 'module' },
    ])
  })
})

describe('mfRuntime.load', () => {
  beforeEach(() => getInstance.mockReturnValue(fake))

  it('returns the module', async () => {
    loadRemote.mockResolvedValueOnce({ x: 1 })
    await expect(mfRuntime.load('a/routes')).resolves.toEqual({ x: 1 })
  })

  it.each([null, undefined])('a %s result (swallowed by errorLoadRemote) becomes a descriptive error', async (v) => {
    loadRemote.mockResolvedValueOnce(v)
    await expect(mfRuntime.load('a/routes')).rejects.toThrow(/a\/routes.*could not be loaded/)
  })

  it('falsy-but-valid modules (0, "", false, []) are not mistaken for failures', async () => {
    for (const v of [0, '', false, []]) {
      loadRemote.mockResolvedValueOnce(v)
      await expect(mfRuntime.load('a/x')).resolves.toBe(v)
    }
  })

  it('propagates loadRemote rejections unchanged', async () => {
    const e = new Error('network')
    loadRemote.mockRejectedValueOnce(e)
    await expect(mfRuntime.load('a/x')).rejects.toBe(e)
  })
})
