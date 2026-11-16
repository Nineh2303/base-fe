import { describe, it, expect } from 'vitest'
import { mfRuntime } from '../../src/remotes/runtime'

describe('mfRuntime against the real @module-federation/runtime', () => {
  it('rejects (no hang, no crash) for an unreachable remote with no host instance', async () => {
    mfRuntime.register([{ name: 'ghost', entry: 'http://127.0.0.1:1/remoteEntry.js' }])
    await expect(mfRuntime.load('ghost/routes')).rejects.toBeInstanceOf(Error)
    await expect(mfRuntime.load('unregistered/routes')).rejects.toBeInstanceOf(Error)
  }, 20000)
})
