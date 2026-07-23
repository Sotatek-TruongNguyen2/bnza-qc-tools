import type { PositionRaw } from './types'

export type DisplayQuote = {
  /** Human price used on the chart axis (prefer large readable numbers). */
  inverted: boolean
  /** Unit label e.g. "USDC per WETH" */
  unit: string
  /** token1/token0 → display price */
  toDisplay: (token1PerToken0: number) => number
}

/** Prefer the side where price ≥ 1 (e.g. USDC per ETH instead of ETH per USDC). */
export function getDisplayQuote(raw: PositionRaw): DisplayQuote {
  const p = raw.priceToken1PerToken0AtCurrentTick
  if (Number.isFinite(p) && p > 0 && p < 1) {
    return {
      inverted: true,
      unit: `${raw.token0Symbol} per ${raw.token1Symbol}`,
      toDisplay: (token1PerToken0) => (token1PerToken0 > 0 ? 1 / token1PerToken0 : 0),
    }
  }
  return {
    inverted: false,
    unit: `${raw.token1Symbol} per ${raw.token0Symbol}`,
    toDisplay: (token1PerToken0) => token1PerToken0,
  }
}

export function tickSpacingForFee(fee: number): number {
  if (fee === 100) return 1
  if (fee === 500) return 10
  if (fee === 3000) return 60
  if (fee === 10000) return 200
  // Common Uniswap V3 fallback
  if (fee % 100 === 0 && fee <= 100) return 1
  return 60
}

export function formatChartPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '—'
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 4 })
  if (price >= 0.0001) return price.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return price.toLocaleString('en-US', { maximumFractionDigits: 10 })
}

export function buildViewWindow(args: {
  tickLower: number
  tickUpper: number
  currentTick: number
  zoom: number
}): { viewMinTick: number; viewMaxTick: number } {
  const { tickLower, tickUpper, currentTick, zoom } = args
  const span = Math.max(tickUpper - tickLower, 1)
  // zoom 1 = default padding; higher zoom = tighter (more zoomed in)
  const padFactor = 0.9 / Math.max(zoom, 0.5)
  const pad = Math.max(Math.round(span * padFactor), 20)
  const midLow = Math.min(tickLower, currentTick)
  const midHigh = Math.max(tickUpper, currentTick)
  return {
    viewMinTick: midLow - pad,
    viewMaxTick: midHigh + pad,
  }
}

export type DensityPoint = { tick: number; liquidityGross: string }

/** Build SVG area path for pool liquidityGross samples in display-price space. */
export function buildDensityAreaPath(args: {
  density: DensityPoint[]
  priceAtTick: (tick: number) => number
  xOfPrice: (price: number) => number
  chartTop: number
  chartBottom: number
}): string | null {
  const { density, priceAtTick, xOfPrice, chartTop, chartBottom } = args
  if (density.length === 0) return null

  const maxGross = density.reduce((m, p) => {
    const g = BigInt(p.liquidityGross)
    return g > m ? g : m
  }, 0n)
  if (maxGross === 0n) return null

  const usableH = chartBottom - chartTop
  const pts = density
    .map((p) => {
      const x = xOfPrice(priceAtTick(p.tick))
      const ratio = Number((BigInt(p.liquidityGross) * 10_000n) / maxGross) / 10_000
      const y = chartBottom - ratio * usableH * 0.92
      return { x, y }
    })
    .sort((a, b) => a.x - b.x)

  if (pts.length < 2) return null

  let d = `M ${pts[0]!.x} ${chartBottom} L ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i]!.x} ${pts[i]!.y}`
  }
  d += ` L ${pts[pts.length - 1]!.x} ${chartBottom} Z`
  return d
}
