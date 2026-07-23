import { compactHumanTokenAmount } from '@/lib/format-token-amount'

type Props = {
  value: string
  /** Max fraction digits shown; full value in tooltip when truncated. */
  maxFractionDigits?: number
  className?: string
}

/**
 * Compact token amount for tables / kv rows.
 * Display stays fixed; hover the cell shows a tooltip with full precision (no layout shift).
 */
export function CompactTokenAmount({ value, maxFractionDigits = 6, className }: Props) {
  const { compact, full, truncated } = compactHumanTokenAmount(value, maxFractionDigits)

  if (!truncated) {
    return (
      <span className={['mono', 'compact-token-amount', className].filter(Boolean).join(' ')}>
        {full}
      </span>
    )
  }

  return (
    <span
      className={['mono', 'compact-token-amount', 'has-tooltip', className]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="compact-token-amount-value">{compact}</span>
      <span className="compact-token-amount-tooltip" role="tooltip">
        {full}
      </span>
    </span>
  )
}
