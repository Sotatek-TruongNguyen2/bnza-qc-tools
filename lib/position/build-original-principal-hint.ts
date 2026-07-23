import type { CloseEstimateCalcSection } from './close-estimate-types'
import { formatLocalDateTime } from '@/lib/format-datetime'
import { formatRawAmount } from './format-raw-amount'
import { formatChartPrice, getDisplayQuote } from './range-chart-math'
import type { PositionOpenPrice, PositionRaw } from './types'

/** QC hint for principal token amounts at the first mint (IncreaseLiquidity). */
export function buildOriginalPrincipalHint(
  raw: PositionRaw,
  open: PositionOpenPrice,
): CloseEstimateCalcSection | null {
  if (!open.found || open.principalAmount0 == null || open.principalAmount1 == null) {
    return null
  }

  const amount0 = BigInt(open.principalAmount0)
  const amount1 = BigInt(open.principalAmount1)
  const token0 = formatRawAmount(amount0, raw.token0Decimals, raw.token0Symbol)
  const token1 = formatRawAmount(amount1, raw.token1Decimals, raw.token1Symbol)

  const quote = getDisplayQuote(raw)
  const openPriceLabel =
    open.priceToken1PerToken0 != null
      ? `${formatChartPrice(quote.toDisplay(open.priceToken1PerToken0))} ${quote.unit}`
      : 'n/a'

  return {
    title: 'Original principal (at open)',
    summary:
      'Token amounts deposited when this Uniswap V3 NFT was first minted.\n' +
      'Read from IncreaseLiquidity on the mint tx — not live mark-to-market.',
    formula:
      'amount0, amount1 = IncreaseLiquidity(tokenId).amount0 / .amount1\n' +
      '(first mint only; later increases are not included here)',
    inputs: [
      { label: 'tokenId', value: raw.tokenId },
      { label: 'Mint tx', value: open.txHash ?? '—' },
      {
        label: 'Opened at',
        value: open.openedAtIso
          ? formatLocalDateTime(open.openedAtIso)
          : open.openedAtLabel ?? '—',
      },
      {
        label: 'Pool spot at open',
        value:
          open.tick != null
            ? `tick ${open.tick}\n≈ ${openPriceLabel}`
            : openPriceLabel,
      },
      { label: 'Liquidity minted L', value: open.liquidity ?? '—' },
    ],
    steps: [
      {
        label: 'Find mint tx',
        value:
          'Look up Uniswap NPM Transfer(from=0x0, tokenId) — that is the NFT mint.',
      },
      {
        label: 'Read IncreaseLiquidity',
        value:
          `In that tx, IncreaseLiquidity(tokenId=${raw.tokenId}) emits:\n` +
          `  liquidity = ${open.liquidity ?? '—'}\n` +
          `  amount0 = ${open.principalAmount0}\n` +
          `  amount1 = ${open.principalAmount1}`,
      },
      {
        label: `${raw.token0Symbol} (amount0)`,
        value: `raw ${open.principalAmount0} → ${token0}`,
      },
      {
        label: `${raw.token1Symbol} (amount1)`,
        value: `raw ${open.principalAmount1} → ${token1}`,
      },
      {
        label: 'Note',
        value:
          'Live “Principal” below can differ after price moves / fees.\n' +
          'This block is the original deposit at open.',
      },
    ],
    result: `${token0}\n${token1}`,
  }
}
