import type { CloseEstimateCalcSection } from './close-estimate-types'
import { formatRawAmount } from './format-raw-amount'
import { getSqrtRatioAtTick } from './format'
import type { PositionRaw } from './types'

/**
 * QC hint for Position lookup “Principal” token amounts.
 * Same Uniswap V3 liquidity math as `getAmountsForLiquidity` in format.ts.
 */
export function buildPrincipalAmountsHint(raw: PositionRaw): CloseEstimateCalcSection {
  const liquidity = BigInt(raw.liquidity)
  const sqrtCurrent = BigInt(raw.sqrtPriceX96)
  const sqrtLower = getSqrtRatioAtTick(raw.tickLower)
  const sqrtUpper = getSqrtRatioAtTick(raw.tickUpper)
  const amount0 = BigInt(raw.principalAmount0)
  const amount1 = BigInt(raw.principalAmount1)

  const token0 = formatRawAmount(amount0, raw.token0Decimals, raw.token0Symbol)
  const token1 = formatRawAmount(amount1, raw.token1Decimals, raw.token1Symbol)

  const rangeBranch =
    liquidity === 0n
      ? 'closed'
      : sqrtCurrent <= sqrtLower
        ? 'below'
        : sqrtCurrent < sqrtUpper
          ? 'in-range'
          : 'above'

  const branchLabel =
    rangeBranch === 'closed'
      ? 'CLOSED — liquidity = 0 → both principals are 0'
      : rangeBranch === 'below'
        ? 'OUT OF RANGE (below) — 100% token0, amount1 = 0'
        : rangeBranch === 'above'
          ? 'OUT OF RANGE (above) — 100% token1, amount0 = 0'
          : 'IN RANGE — both token0 and token1 from liquidity between √Pl and √Pu'

  const formula =
    rangeBranch === 'below'
      ? 'amount0 = L × (√Pu − √Pl) / (√Pu × √Pl); amount1 = 0'
      : rangeBranch === 'above'
        ? 'amount0 = 0; amount1 = L × (√Pu − √Pl) / 2^96'
        : rangeBranch === 'in-range'
          ? 'amount0 = L × (√Pu − √Pc) / (√Pu × √Pc); amount1 = L × (√Pc − √Pl) / 2^96'
          : 'amount0 = 0; amount1 = 0'

  const steps: CloseEstimateCalcSection['steps'] = [
    { label: 'Range branch', value: branchLabel },
  ]

  if (rangeBranch === 'below' || rangeBranch === 'in-range') {
    const sqrtA = rangeBranch === 'below' ? sqrtLower : sqrtCurrent
    const sqrtB = sqrtUpper
    steps.push({
      label: `${raw.token0Symbol} (amount0)`,
      value:
        `L × (√B − √A) / (√B × √A) ` +
        `= L × (${sqrtB} − ${sqrtA}) / (${sqrtB} × ${sqrtA}) ` +
        `→ ${token0}`,
    })
  } else {
    steps.push({
      label: `${raw.token0Symbol} (amount0)`,
      value: `0 (${rangeBranch === 'closed' ? 'no liquidity' : 'price above range'})`,
    })
  }

  if (rangeBranch === 'above' || rangeBranch === 'in-range') {
    const sqrtA = sqrtLower
    const sqrtB = rangeBranch === 'above' ? sqrtUpper : sqrtCurrent
    steps.push({
      label: `${raw.token1Symbol} (amount1)`,
      value:
        `L × (√B − √A) / 2^96 ` +
        `= L × (${sqrtB} − ${sqrtA}) / 2^96 ` +
        `→ ${token1}`,
    })
  } else {
    steps.push({
      label: `${raw.token1Symbol} (amount1)`,
      value: `0 (${rangeBranch === 'closed' ? 'no liquidity' : 'price below range'})`,
    })
  }

  steps.push({
    label: 'Note',
    value: 'Principal = locked tokens only. Uncollected fees are shown in the next section.',
  })

  return {
    title: 'Principal (token amounts)',
    summary:
      'How many of each token are locked in this Uniswap V3 position right now. ' +
      'This does not include uncollected fees (those are listed separately).',
    formula,
    inputs: [
      { label: 'Liquidity L', value: raw.liquidity },
      { label: 'tickLower / √Pl', value: `${raw.tickLower} / ${sqrtLower.toString()}` },
      { label: 'tickUpper / √Pu', value: `${raw.tickUpper} / ${sqrtUpper.toString()}` },
      { label: 'currentTick', value: String(raw.currentTick) },
      { label: '√Pc (sqrtPriceX96)', value: raw.sqrtPriceX96 },
      { label: 'Status', value: raw.rangeStatus },
    ],
    steps,
    result: `${token0} + ${token1}`,
  }
}
