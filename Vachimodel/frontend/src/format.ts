import type { Price } from './api'

/** $0.0042, $0.12, $12.50 */
export function formatUsd(value: number): string {
  if (value === 0) return '$0'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

/** "free", "$4 / $20 per 1M tokens" */
export function formatPrice(price: Price | null): string | null {
  if (!price) return null
  if (price.input === 0 && price.output === 0) return 'free'
  return `$${price.input} / $${price.output} per 1M tokens`
}

/** 1234 -> "1.2K", 1048576 -> "1M" */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`
  return String(n)
}
