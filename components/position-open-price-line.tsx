'use client'

import { useEffect, useState } from 'react'
import { apiGetJson } from '@/lib/api-client'
import { formatChartPrice, getDisplayQuote } from '@/lib/position/range-chart-math'
import type { PositionOpenPrice } from '@/lib/position/types'
import type { PositionRaw } from '@/lib/position/types'

type Props = { raw: PositionRaw }

export function PositionOpenPriceLine({ raw }: Props) {
  const [openPrice, setOpenPrice] = useState<PositionOpenPrice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setOpenPrice(null)
    void (async () => {
      try {
        const qs =
          `/api/position/open-price?tokenId=${encodeURIComponent(raw.tokenId)}` +
          `&pool=${encodeURIComponent(raw.poolAddress)}` +
          `&token0Decimals=${raw.token0Decimals}&token1Decimals=${raw.token1Decimals}`
        const data = await apiGetJson<PositionOpenPrice>(qs)
        if (!cancelled) setOpenPrice(data)
      } catch (err) {
        if (!cancelled) {
          setOpenPrice({
            found: false,
            txHash: null,
            blockNumber: null,
            openedAtIso: null,
            openedAtLabel: null,
            tick: null,
            sqrtPriceX96: null,
            priceToken1PerToken0: null,
            priceToken0PerToken1: null,
            source: null,
            note: null,
            error: err instanceof Error ? err.message : 'Failed to load open price',
            links: { tx: null },
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [raw.tokenId, raw.poolAddress, raw.token0Decimals, raw.token1Decimals])

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

  return (
    <p className="range-open-price">
      Opened at: <strong>{priceLine}</strong>
      <span className="muted">
        {' '}
        · tick {openPrice.tick}
        {openPrice.openedAtLabel ? ` · ${openPrice.openedAtLabel}` : ''}
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
