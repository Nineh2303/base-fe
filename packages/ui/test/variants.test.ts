import { describe, expect, it } from 'vitest'
import { buttonVariants, badgeVariants } from '../src'

describe('variants', () => {
  it('button destructive sm', () => {
    const c = buttonVariants({ variant: 'destructive', size: 'sm' })
    expect(c).toContain('bg-destructive')
    expect(c).toContain('h-8')
  })
  it('button defaults', () => {
    expect(buttonVariants()).toContain('bg-primary')
  })
  it('badge defaults', () => {
    expect(badgeVariants()).toContain('bg-primary')
  })
})
