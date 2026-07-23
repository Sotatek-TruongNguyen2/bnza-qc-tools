import { compactHumanTokenAmount } from '@/lib/format-token-amount'

type Props = {
  value: string
  /** Max fraction digits shown; full value on hover when truncated. */
  maxFractionDigits?: number
  className?: string
}

/**
 * Compact token amount for tables / kv rows.
 * Hover anywhere on the control (fills the cell hit area) shows full precision immediately.
 */
export function CompactTokenAmount({ value, maxFractionDigits = 6, className }: Props) {
  const { compact, full, truncated } = compactHumanTokenAmount(value, maxFractionDigits)

  if (!truncated) {
    return <span className={['mono', 'compact-token-amount', className].filter(Boolean).join(' ')}>{full}</span>
  }

  return (
    <span
      className={['mono', 'compact-token-amount', 'is-truncated', className].filter(Boolean).join(' ')}
    >
      <span className="compact-token-amount-short">{compact}</span>
      <span className="compact-token-amount-full">{full}</span>
    </span>
  )
}
