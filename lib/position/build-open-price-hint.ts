import { formatLocalDateTime } from '@/lib/format-datetime'
import type { CloseEstimateCalcSection } from './close-estimate-types'
import { formatChartPrice, getDisplayQuote } from './range-chart-math'
import type { PositionOpenPrice, PositionRaw } from './types'

/**
 * QC hint for “Opened at” price / tick — pool spot when the NFT was minted.
 * Not live slot0; resolved from mint tx Swap (preferred) or parent-block slot0.
 */
export function buildOpenPriceHint(
  raw: PositionRaw,
  open: PositionOpenPrice,
): CloseEstimateCalcSection | null {
  if (!open.found || open.tick == null || open.priceToken1PerToken0 == null) {
    return null
  }

  const quote = getDisplayQuote(raw)
  const display = quote.toDisplay(open.priceToken1PerToken0)
  const displayLine = quote.inverted
    ? `1 ${raw.token1Symbol} = ${formatChartPrice(display)} ${raw.token0Symbol}`
    : `1 ${raw.token0Symbol} = ${formatChartPrice(display)} ${raw.token1Symbol}`

  const token1PerToken0Line = `1 ${raw.token0Symbol} = ${formatChartPrice(open.priceToken1PerToken0)} ${raw.token1Symbol}`
  const inverse =
    open.priceToken0PerToken1 != null && open.priceToken0PerToken1 > 0
      ? `1 ${raw.token1Symbol} = ${formatChartPrice(open.priceToken0PerToken1)} ${raw.token0Symbol}`
      : '—'

  const sourceLabel =
    open.source === 'swap_event'
      ? 'Swap event in the mint tx (last Swap on this pool in that tx)'
      : open.source === 'slot0_parent'
        ? 'pool.slot0() at parent block of the mint tx (no Swap in mint tx)'
        : 'unknown'

  const openedWhen = open.openedAtIso ? formatLocalDateTime(open.openedAtIso) : open.openedAtLabel ?? '—'

  return {
    title: 'Opened-at price / tick',
    summary:
      'Pool spot when this LP NFT was first minted — not the live “Current price”.\n' +
      (open.note ?? ''),
    formula:
      '1) Find mint tx = Uniswap NPM Transfer(from=0x0, tokenId)\n' +
      '2) Prefer last pool Swap in that tx → (sqrtPriceX96, tick)\n' +
      '   else slot0 at mintBlock − 1\n' +
      '3) price(token1/token0) = 1.0001^tick × 10^(decimals0 − decimals1)',
    inputs: [
      { label: 'tokenId', value: raw.tokenId },
      { label: 'Mint tx', value: open.txHash ?? '—' },
      { label: 'Mint block', value: open.blockNumber ?? '—' },
      { label: 'Opened at (local)', value: openedWhen },
      { label: 'Pool', value: raw.poolAddress },
      { label: 'Price source', value: sourceLabel },
      {
        label: 'Tick at open',
        value: String(open.tick),
      },
      {
        label: 'sqrtPriceX96 at open',
        value: open.sqrtPriceX96 ?? '—',
      },
    ],
    steps: [
      {
        label: 'Resolve mint tx',
        value:
          `NPM Transfer(from=0x0 → …, tokenId=${raw.tokenId})\n` +
          `tx = ${open.txHash ?? '—'} · block ${open.blockNumber ?? '—'}`,
      },
      {
        label: 'Read pool spot at open',
        value:
          open.source === 'swap_event'
            ? `Decode Swap on ${raw.poolAddress} in the mint tx:\n` +
              `  tick = ${open.tick}\n` +
              `  sqrtPriceX96 = ${open.sqrtPriceX96 ?? '—'}`
            : `No Swap in mint tx → read slot0 at block ${(open.blockNumber ? BigInt(open.blockNumber) - 1n : 'n/a').toString()}:\n` +
              `  tick = ${open.tick}\n` +
              `  sqrtPriceX96 = ${open.sqrtPriceX96 ?? '—'}`,
      },
      {
        label: 'Convert tick → price',
        value:
          `token1 per token0\n` +
          `  = 1.0001^(${open.tick}) × 10^(${raw.token0Decimals} − ${raw.token1Decimals})\n` +
          `→ ${token1PerToken0Line}\n` +
          `Inverse: ${inverse}`,
      },
      {
        label: 'UI display quote',
        value: quote.inverted
          ? `Prefer readable side (≥1): show ${raw.token0Symbol} per ${raw.token1Symbol}\n→ ${displayLine}`
          : `Show ${raw.token1Symbol} per ${raw.token0Symbol}\n→ ${displayLine}`,
      },
    ],
    result: `${displayLine}\n· tick ${open.tick} · ${openedWhen}`,
  }
}
