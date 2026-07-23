'use client'

import { formatUtcDateTime } from '@/lib/format-datetime'
import { formatChartPrice, getDisplayQuote } from '@/lib/position/range-chart-math'
import type { PositionOpenPrice, PositionRaw } from '@/lib/position/types'

type Props = {
  raw: PositionRaw
  openPrice: PositionOpenPrice | null
  loading: boolean
}

export function PositionOpenPriceLine({ raw, openPrice, loading }: Props) {
  if (loading) {
    return <p className="muted range-open-price">Opened at: resolving mint tx…</p>
  }

  if (!openPrice?.found || openPrice.priceToken1PerToken0 == null || openPrice.tick == null) {
    return (
      <p className="muted range-open-price">
        Opened at: —
        {openPrice?.error
          ? ` (${openPrice.error})`
          : openPrice?.note
            ? ` (${openPrice.note})`
            : ''}
      </p>
    )
  }

  const quote = getDisplayQuote(raw)
  const display = quote.toDisplay(openPrice.priceToken1PerToken0)
  const priceLine = quote.inverted
    ? `1 ${raw.token1Symbol} = ${formatChartPrice(display)} ${raw.token0Symbol}`
    : `1 ${raw.token0Symbol} = ${formatChartPrice(display)} ${raw.token1Symbol}`

  const openedWhen =
    openPrice.openedAtLabel ||
    formatUtcDateTime(openPrice.openedAtIso) ||
    null

  return (
    <p className="range-open-price">
      Opened at: <strong>{priceLine}</strong>
      <span className="muted">
        {' '}
        · tick {openPrice.tick}
        {openedWhen ? ` · ${openedWhen}` : ''}
        {openPrice.links.tx && (
          <>
            {' · '}
            <a href={openPrice.links.tx} target="_blank" rel="noreferrer">
              mint tx
            </a>
          </>
        )}
      </span>
    </p>
  )
}
