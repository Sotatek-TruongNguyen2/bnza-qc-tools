import { formatUnits } from 'viem'

/**
 * Human-readable token amount preserving full on-chain precision (up to token decimals).
 * Avoids Number() + artificial 8-decimal cap that hid WETH tail digits.
 */
export function formatTokenAmount(raw: bigint, decimals: number, symbol: string): string {
  const units = formatUnits(raw, decimals)
  const negative = units.startsWith('-')
  const body = negative ? units.slice(1) : units
  const [whole, fraction = ''] = body.split('.')
  const wholeFormatted = Number(whole).toLocaleString('en-US')
  const display = fraction ? `${wholeFormatted}.${fraction}` : wholeFormatted
  return `${negative ? '-' : ''}${display} ${symbol}`
}

/**
 * Trim a `formatTokenAmount` string to ~`maxFractionDigits` for display.
 * Full string is unchanged for hover / copy.
 */
export function compactHumanTokenAmount(
  human: string,
  maxFractionDigits = 6,
): { compact: string; full: string; truncated: boolean } {
  const full = human.trim()
  const match = full.match(/^([+-]?)([\d,]+)(?:\.(\d+))?(.*)$/)
  if (!match) return { compact: full, full, truncated: false }

  const sign = match[1] ?? ''
  const whole = match[2] ?? '0'
  const fraction = match[3] ?? ''
  const suffix = match[4] ?? ''

  if (fraction.length <= maxFractionDigits) {
    return { compact: full, full, truncated: false }
  }

  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
  const compact = trimmed
    ? `${sign}${whole}.${trimmed}${suffix}`
    : `${sign}${whole}${suffix}`
  return { compact, full, truncated: true }
}

/** Decimal-adjusted pool price with sensible precision (not capped at 8 for all cases). */
export function formatPrice(label: string, price: number): string {
  if (!Number.isFinite(price) || price <= 0) return `${label}: n/a`

  let maximumFractionDigits: number
  if (price >= 10_000) maximumFractionDigits = 2
  else if (price >= 1) maximumFractionDigits = 6
  else if (price >= 0.0001) maximumFractionDigits = 10
  else maximumFractionDigits = 14

  return `${label}: ${price.toLocaleString('en-US', { maximumFractionDigits })}`
}
