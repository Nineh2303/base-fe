import { describe, it, expect, vi } from 'vitest'
import { createBus } from '../src/bus/bus'

describe('bus', () => {
  it('delivers payload to handler', () => {
    const bus = createBus()
    const h = vi.fn()
    bus.on('notify', h)
    bus.emit('notify', { type: 'info', message: 'x' })
    expect(h).toHaveBeenCalledWith({ type: 'info', message: 'x' })
  })
  it('off removes handler', () => {
    const bus = createBus()
    const h = vi.fn()
    bus.on('notify', h)
    bus.off('notify', h)
    bus.emit('notify', { type: 'info', message: 'x' })
    expect(h).not.toHaveBeenCalled()
  })
})
