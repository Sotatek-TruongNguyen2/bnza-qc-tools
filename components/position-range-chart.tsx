'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGetJson } from '@/lib/api-client'
import { buildCurrentPriceHint } from '@/lib/position/build-current-price-hint'
import { tickToPriceRatio } from '@/lib/position/format'
import {
  buildDensityAreaPath,
  buildViewWindow,
  formatChartPrice,
  getDisplayQuote,
  type DensityPoint,
} from '@/lib/position/range-chart-math'
import type { PositionOpenPrice, PositionRaw } from '@/lib/position/types'
import { CalculationHint } from './calculation-hint'
import { PositionOpenPriceLine } from './position-open-price-line'
import { PositionRangeLegend } from './position-range-legend'

type Props = {
  raw: PositionRaw
  openPrice: PositionOpenPrice | null
  openPriceLoading: boolean
}

const W = 640
const H = 200
const PAD_L = 8
const PAD_R = 8
const PAD_T = 16
const PAD_B = 28

export function PositionRangeChart({ raw, openPrice, openPriceLoading }: Props) {
  const [density, setDensity] = useState<DensityPoint[]>([])
  const [openHintId, setOpenHintId] = useState<string | null>(null)
  const currentPriceHint = useMemo(() => buildCurrentPriceHint(raw), [raw])

  const quote = useMemo(() => getDisplayQuote(raw), [raw])
  const priceAtTick = (tick: number) =>
    quote.toDisplay(tickToPriceRatio(tick, raw.token0Decimals, raw.token1Decimals))

  const { viewMinTick, viewMaxTick } = useMemo(
    () =>
      buildViewWindow({
        tickLower: raw.tickLower,
        tickUpper: raw.tickUpper,
        currentTick: raw.currentTick,
      }),
    [raw.tickLower, raw.tickUpper, raw.currentTick],
  )

  const minPrice = Math.min(priceAtTick(raw.tickLower), priceAtTick(raw.tickUpper))
  const maxPrice = Math.max(priceAtTick(raw.tickLower), priceAtTick(raw.tickUpper))
  const currentPrice = priceAtTick(raw.currentTick)
  const viewMinPrice = Math.min(priceAtTick(viewMinTick), priceAtTick(viewMaxTick))
  const viewMaxPrice = Math.max(priceAtTick(viewMinTick), priceAtTick(viewMaxTick))
  const priceSpan = Math.max(viewMaxPrice - viewMinPrice, Number.EPSILON)

  const xOfPrice = (price: number) =>
    PAD_L + ((price - viewMinPrice) / priceSpan) * (W - PAD_L - PAD_R)

  const rangeX1 = xOfPrice(minPrice)
  const rangeX2 = xOfPrice(maxPrice)
  const currentX = xOfPrice(currentPrice)

  useEffect(() => {
    let cancelled = false
    setDensity([])
    void (async () => {
      try {
        const data = await apiGetJson<{ points: DensityPoint[] }>(
          `/api/position/liquidity-density?pool=${encodeURIComponent(raw.poolAddress)}` +
            `&fee=${raw.fee}&viewMinTick=${viewMinTick}&viewMaxTick=${viewMaxTick}`,
        )
        if (!cancelled) setDensity(data.points)
      } catch {
        if (!cancelled) setDensity([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [raw.poolAddress, raw.fee, viewMinTick, viewMaxTick])

  const densityPath = useMemo(
    () =>
      buildDensityAreaPath({
        density,
        priceAtTick,
        xOfPrice,
        chartTop: PAD_T,
        chartBottom: H - PAD_B,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [density, viewMinPrice, viewMaxPrice, quote.inverted, raw.token0Decimals, raw.token1Decimals],
  )

  const axisTicks = useMemo(() => {
    const labels: number[] = []
    for (let i = 0; i <= 4; i++) labels.push(viewMinPrice + (priceSpan * i) / 4)
    return labels
  }, [viewMinPrice, priceSpan])

  const inverseCurrent =
    currentPrice > 0
      ? quote.inverted
        ? raw.priceToken1PerToken0AtCurrentTick
        : (raw.priceToken0PerToken1AtCurrentTick ?? 0)
      : 0

  const currentHeader = quote.inverted
    ? `1 ${raw.token1Symbol} = ${formatChartPrice(currentPrice)} ${raw.token0Symbol}`
    : `1 ${raw.token0Symbol} = ${formatChartPrice(currentPrice)} ${raw.token1Symbol}`

  const inverseHint =
    inverseCurrent > 0
      ? quote.inverted
        ? `(${formatChartPrice(inverseCurrent)} ${raw.token1Symbol} per ${raw.token0Symbol})`
        : `(${formatChartPrice(inverseCurrent)} ${raw.token0Symbol} per ${raw.token1Symbol})`
      : null

  const inRange =
    raw.liquidity !== '0' && raw.currentTick >= raw.tickLower && raw.currentTick < raw.tickUpper

  return (
    <div className="range-chart">
      <div className="range-chart-header">
        <div className="range-chart-current-row">
          <p className="range-chart-current">
            Current price: <strong>{currentHeader}</strong>
            {inverseHint && <span className="muted"> {inverseHint}</span>}
            <span className="muted">
              {' '}
              · tick {raw.currentTick}
            </span>
          </p>
          <CalculationHint
            hintId="current-price"
            isOpen={openHintId === 'current-price'}
            onToggle={(id) => setOpenHintId((cur) => (cur === id ? null : id))}
            onClose={() => setOpenHintId(null)}
            section={currentPriceHint}
          />
        </div>
        <p className="muted range-chart-ticks mono">
          ticks [{raw.tickLower}, {raw.tickUpper}) · current {raw.currentTick}
          {inRange ? ' · in range' : raw.liquidity === '0' ? ' · closed' : ' · out of range'}
        </p>
        <PositionOpenPriceLine raw={raw} openPrice={openPrice} loading={openPriceLoading} />
      </div>

      <div className="range-chart-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="range-chart-svg" role="img" aria-label="Price range">
          {densityPath && (
            <path d={densityPath} className="range-density">
              <title>
                Pool liquidity density — relative liquidityGross at sampled ticks (whole pool, not
                only this position)
              </title>
            </path>
          )}
          <rect
            x={Math.min(rangeX1, rangeX2)}
            y={PAD_T}
            width={Math.max(Math.abs(rangeX2 - rangeX1), 2)}
            height={H - PAD_T - PAD_B}
            className="range-band"
          >
            <title>
              This position’s tick range — min {formatChartPrice(minPrice)} → max{' '}
              {formatChartPrice(maxPrice)} {quote.unit}
            </title>
          </rect>
          {[
            { x: rangeX1, label: 'Min', price: minPrice, tick: quote.inverted ? raw.tickUpper : raw.tickLower },
            { x: rangeX2, label: 'Max', price: maxPrice, tick: quote.inverted ? raw.tickLower : raw.tickUpper },
          ].map((h, i) => (
            <g key={i}>
              <line x1={h.x} y1={PAD_T} x2={h.x} y2={H - PAD_B} className="range-handle-line" />
              {/* Wider invisible hit target for hover */}
              <rect x={h.x - 8} y={PAD_T} width={16} height={H - PAD_T - PAD_B} className="range-hit">
                <title>
                  {h.label} price {formatChartPrice(h.price)} {quote.unit} (tick {h.tick})
                </title>
              </rect>
              <rect x={h.x - 6} y={PAD_T - 2} width={12} height={18} rx={3} className="range-handle-cap" />
              <line x1={h.x - 2} y1={PAD_T + 4} x2={h.x - 2} y2={PAD_T + 12} className="range-handle-grip" />
              <line x1={h.x + 2} y1={PAD_T + 4} x2={h.x + 2} y2={PAD_T + 12} className="range-handle-grip" />
            </g>
          ))}
          <line
            x1={currentX}
            y1={PAD_T}
            x2={currentX}
            y2={H - PAD_B}
            className={inRange ? 'range-current-line in' : 'range-current-line out'}
          />
          <rect x={currentX - 8} y={PAD_T} width={16} height={H - PAD_T - PAD_B} className="range-hit">
            <title>
              Current pool price {formatChartPrice(currentPrice)} {quote.unit} (tick{' '}
              {raw.currentTick})
              {inRange ? ' — in range' : raw.liquidity === '0' ? ' — closed' : ' — out of range'}
            </title>
          </rect>
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} className="range-axis" />
          {axisTicks.map((p, i) => (
            <text key={i} x={xOfPrice(p)} y={H - 8} textAnchor="middle" className="range-axis-label">
              {formatChartPrice(p)}
            </text>
          ))}
        </svg>
      </div>

      <PositionRangeLegend showDensity={Boolean(densityPath)} />

      <div className="range-price-cards">
        <div className="range-price-card">
          <div className="range-price-card-top">
            <span className="range-price-icon min" aria-hidden="true">
              ↓
            </span>
            <span className="range-price-label">Min price</span>
          </div>
          <p className="range-price-value mono">{formatChartPrice(minPrice)}</p>
          <p className="range-price-unit muted">{quote.unit}</p>
        </div>
        <div className="range-price-card">
          <div className="range-price-card-top">
            <span className="range-price-icon max" aria-hidden="true">
              ↑
            </span>
            <span className="range-price-label">Max price</span>
          </div>
          <p className="range-price-value mono">{formatChartPrice(maxPrice)}</p>
          <p className="range-price-unit muted">{quote.unit}</p>
        </div>
      </div>
    </div>
  )
}
