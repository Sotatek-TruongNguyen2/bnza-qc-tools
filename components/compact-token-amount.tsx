import { compactHumanTokenAmount } from '@/lib/format-token-amount'

type Props = {
  value: string
  /** Max fraction digits shown; full value on hover when truncated. */
  maxFractionDigits?: number
  className?: string
}

/** Compact token amount for tables; hover reveals full precision. */
export function CompactTokenAmount({ value, maxFractionDigits = 6, className }: Props) {
  const { compact, full, truncated } = compactHumanTokenAmount(value, maxFractionDigits)
  return (
    <span
      className={['mono', className].filter(Boolean).join(' ')}
      title={truncated ? full : undefined}
    >
      {compact}
    </span>
  )
}
