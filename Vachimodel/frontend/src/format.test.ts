import { describe, expect, it } from 'vitest'
import { formatPrice, formatTokens, formatUsd } from './format'

describe('format', () => {
  it('formats money', () => {
    expect(formatUsd(0)).toBe('$0')
    expect(formatUsd(0.0042)).toBe('$0.0042')
    expect(formatUsd(12.5)).toBe('$12.50')
  })
  it('formats prices', () => {
    expect(formatPrice(null)).toBeNull()
    expect(formatPrice({ input: 0, output: 0 })).toBe('free')
    expect(formatPrice({ input: 4, output: 20 })).toBe('$4 / $20 per 1M tokens')
  })
  it('formats token counts', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(131072)).toBe('131.1K')
    expect(formatTokens(1_000_000)).toBe('1M')
  })
})
