import { describe, expect, it } from 'vitest'
import { cn } from '../src/lib/utils'

describe('cn', () => {
  it('lets the later conflicting class win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
  it('drops falsy values', () => {
    expect(cn('bg-primary', undefined, null, false, 'rounded-full')).toBe('bg-primary rounded-full')
  })
})
