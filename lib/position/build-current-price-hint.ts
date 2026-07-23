import type { CloseEstimateCalcSection } from './close-estimate-types'
import { formatChartPrice, getDisplayQuote } from './range-chart-math'
import type { PositionRaw } from './types'

/**
 * QC hint for “Current price” / current tick on the position range chart.
 * Source: Uniswap V3 pool.slot0() at the latest read.
 */
export function buildCurrentPriceHint(raw: PositionRaw): CloseEstimateCalcSection {
  const quote = getDisplayQuote(raw)
  const token1PerToken0 = raw.priceToken1PerToken0AtCurrentTick
  const display = quote.toDisplay(token1PerToken0)
  const displayLine = quote.inverted
    ? `1 ${raw.token1Symbol} = ${formatChartPrice(display)} ${raw.token0Symbol}`
    : `1 ${raw.token0Symbol} = ${formatChartPrice(display)} ${raw.token1Symbol}`

  const token1PerToken0Line = `1 ${raw.token0Symbol} = ${formatChartPrice(token1PerToken0)} ${raw.token1Symbol}`
  const inverse =
    raw.priceToken0PerToken1AtCurrentTick != null && raw.priceToken0PerToken1AtCurrentTick > 0
      ? `1 ${raw.token1Symbol} = ${formatChartPrice(raw.priceToken0PerToken1AtCurrentTick)} ${raw.token0Symbol}`
      : '—'

  const decAdj = raw.token1Decimals - raw.token0Decimals

  return {
    title: 'Current price / tick',
    summary:
      'Live pool spot from Uniswap V3 `slot0()` on this position’s pool.\n' +
      'Not the mint/open price — refreshes every Position lookup.',
    formula:
      'slot0 → (sqrtPriceX96, tick)\n' +
      'price(token1/token0) = 1.0001^tick × 10^(decimals0 − decimals1)\n' +
      '(equiv. (sqrtPriceX96 / 2^96)^2 × 10^(decimals0 − decimals1))',
    inputs: [
      { label: 'Pool', value: raw.poolAddress },
      { label: 'Pair', value: `${raw.token0Symbol} / ${raw.token1Symbol} · fee ${raw.feeLabel}` },
      {
        label: 'slot0.tick (currentTick)',
        value: String(raw.currentTick),
      },
      {
        label: 'slot0.sqrtPriceX96 (√Pc × 2^96)',
        value: raw.sqrtPriceX96,
      },
      {
        label: 'decimals',
        value: `${raw.token0Symbol}=${raw.token0Decimals}, ${raw.token1Symbol}=${raw.token1Decimals}`,
      },
    ],
    steps: [
      {
        label: 'Read pool.slot0()',
        value:
          `On ${raw.poolAddress}:\n` +
          `  tick = ${raw.currentTick}\n` +
          `  sqrtPriceX96 = ${raw.sqrtPriceX96}`,
      },
      {
        label: 'Convert tick → raw price',
        value:
          `token1 per token0 (raw units)\n` +
          `  = 1.0001^(${raw.currentTick})\n` +
          `Then adjust decimals:\n` +
          `  × 10^(${raw.token0Decimals} − ${raw.token1Decimals})` +
          ` = × 10^(${-decAdj})`,
      },
      {
        label: `${raw.token1Symbol} per ${raw.token0Symbol}`,
        value: token1PerToken0Line,
      },
      {
        label: `${raw.token0Symbol} per ${raw.token1Symbol}`,
        value: inverse,
      },
      {
        label: 'UI display quote',
        value: quote.inverted
          ? `Prefer readable side (≥1): show ${raw.token0Symbol} per ${raw.token1Symbol}\n→ ${displayLine}`
          : `Show ${raw.token1Symbol} per ${raw.token0Symbol}\n→ ${displayLine}`,
      },
      {
        label: 'Gray chart line',
        value: `Plotted at tick ${raw.currentTick} (same slot0 tick).`,
      },
    ],
    result: `${displayLine}\n· tick ${raw.currentTick}`,
  }
}
