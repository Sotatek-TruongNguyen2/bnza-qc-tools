'use client'

import { useMemo, useState } from 'react'
import { formatLocalDateTime } from '@/lib/format-datetime'
import { buildOpenPriceHint } from '@/lib/position/build-open-price-hint'
import { formatChartPrice, getDisplayQuote } from '@/lib/position/range-chart-math'
import type { PositionOpenPrice, PositionRaw } from '@/lib/position/types'
import { CalculationHint } from './calculation-hint'

type Props = {
  raw: PositionRaw
  openPrice: PositionOpenPrice | null
  loading: boolean
}

export function PositionOpenPriceLine({ raw, openPrice, loading }: Props) {
  const [hintOpen, setHintOpen] = useState(false)
  const openPriceHint = useMemo(
    () => (openPrice ? buildOpenPriceHint(raw, openPrice) : null),
    [raw, openPrice],
  )

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

  const openedWhen = openPrice.openedAtIso
    ? formatLocalDateTime(openPrice.openedAtIso)
    : openPrice.openedAtLabel || null

  return (
    <div className="range-open-price-row">
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
      {openPriceHint && (
        <CalculationHint
          hintId="open-price"
          isOpen={hintOpen}
          onToggle={() => setHintOpen((v) => !v)}
          onClose={() => setHintOpen(false)}
          section={openPriceHint}
        />
      )}
    </div>
  )
}
