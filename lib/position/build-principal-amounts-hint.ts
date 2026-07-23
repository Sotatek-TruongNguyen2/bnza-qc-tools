import type { CloseEstimateCalcSection } from './close-estimate-types'
import { formatRawAmount } from './format-raw-amount'
import { getSqrtRatioAtTick, tickToPriceRatio } from './format'
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

  const priceLower = tickToPriceRatio(raw.tickLower, raw.token0Decimals, raw.token1Decimals)
  const priceUpper = tickToPriceRatio(raw.tickUpper, raw.token0Decimals, raw.token1Decimals)
  const priceLowerLabel = formatHumanPrice(priceLower, raw.token0Symbol, raw.token1Symbol)
  const priceUpperLabel = formatHumanPrice(priceUpper, raw.token0Symbol, raw.token1Symbol)

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
      ? 'amount0 = L × (√Pu − √Pl) / (√Pu × √Pl)\namount1 = 0'
      : rangeBranch === 'above'
        ? 'amount0 = 0\namount1 = L × (√Pu − √Pl) / 2^96'
        : rangeBranch === 'in-range'
          ? 'amount0 = L × (√Pu − √Pc) / (√Pu × √Pc)\namount1 = L × (√Pc − √Pl) / 2^96'
          : 'amount0 = 0\namount1 = 0'

  const steps: CloseEstimateCalcSection['steps'] = [
    {
      label: 'Price from tick',
      value:
        `Human price ≈ 1.0001^tick (then adjust for token decimals).\n` +
        `Example:\n` +
        `  tickLower ${raw.tickLower} → about ${priceLowerLabel}\n` +
        `  tickUpper ${raw.tickUpper} → about ${priceUpperLabel}`,
    },
    {
      label: '√P from tick',
      value:
        `Uniswap math uses the square root of price (√P), not the price itself.\n` +
        `\n` +
        `On chain, √P is stored as a big integer:\n` +
        `  √P × 2^96\n` +
        `\n` +
        `So for any tick:\n` +
        `  √P ≈ √(1.0001^tick) × 2^96\n` +
        `\n` +
        `We write:\n` +
        `  √Pl = √P at tickLower\n` +
        `  √Pu = √P at tickUpper`,
    },
    {
      label: 'tickLower → √Pl',
      value:
        `tickLower = ${raw.tickLower}\n` +
        `human price ≈ ${priceLowerLabel}\n` +
        `\n` +
        `√Pl = √(price) × 2^96\n` +
        `    = ${sqrtLower.toString()}`,
    },
    {
      label: 'tickUpper → √Pu',
      value:
        `tickUpper = ${raw.tickUpper}\n` +
        `human price ≈ ${priceUpperLabel}\n` +
        `\n` +
        `√Pu = √(price) × 2^96\n` +
        `    = ${sqrtUpper.toString()}`,
    },
    {
      label: 'Current price √Pc',
      value:
        `Read from the pool’s current price:\n` +
        `  √Pc = ${raw.sqrtPriceX96}\n` +
        `  currentTick = ${raw.currentTick}\n` +
        `\n` +
        `This is √Pc in the formulas below.`,
    },
    { label: 'Range branch', value: branchLabel },
  ]

  if (rangeBranch === 'below') {
    steps.push({
      label: `${raw.token0Symbol} (amount0)`,
      value:
        `L × (√Pu − √Pl) / (√Pu × √Pl)\n` +
        `= L × (${sqrtUpper} − ${sqrtLower}) / (${sqrtUpper} × ${sqrtLower})\n` +
        `→ ${token0}`,
    })
  } else if (rangeBranch === 'in-range') {
    steps.push({
      label: `${raw.token0Symbol} (amount0)`,
      value:
        `L × (√Pu − √Pc) / (√Pu × √Pc)\n` +
        `= L × (${sqrtUpper} − ${sqrtCurrent}) / (${sqrtUpper} × ${sqrtCurrent})\n` +
        `→ ${token0}`,
    })
  } else {
    steps.push({
      label: `${raw.token0Symbol} (amount0)`,
      value: `0 (${rangeBranch === 'closed' ? 'no liquidity' : 'price above range'})`,
    })
  }

  if (rangeBranch === 'above') {
    steps.push({
      label: `${raw.token1Symbol} (amount1)`,
      value:
        `L × (√Pu − √Pl) / 2^96\n` +
        `= L × (${sqrtUpper} − ${sqrtLower}) / 2^96\n` +
        `→ ${token1}`,
    })
  } else if (rangeBranch === 'in-range') {
    steps.push({
      label: `${raw.token1Symbol} (amount1)`,
      value:
        `L × (√Pc − √Pl) / 2^96\n` +
        `= L × (${sqrtCurrent} − ${sqrtLower}) / 2^96\n` +
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
    value: 'Principal = locked tokens only.\nUncollected fees are shown in the next section.',
  })

  return {
    title: 'Principal (token amounts)',
    summary:
      'How many of each token are locked in this Uniswap V3 position right now.\n' +
      'This does not include uncollected fees (those are listed separately).',
    formula,
    inputs: [
      { label: 'Liquidity L', value: raw.liquidity },
      {
        label: 'tickLower → √Pl',
        value:
          `tick = ${raw.tickLower}\n` +
          `√Pl = ${sqrtLower.toString()}\n` +
          `≈ √(1.0001^tick) × 2^96\n` +
          `human price ≈ ${priceLowerLabel}`,
      },
      {
        label: 'tickUpper → √Pu',
        value:
          `tick = ${raw.tickUpper}\n` +
          `√Pu = ${sqrtUpper.toString()}\n` +
          `≈ √(1.0001^tick) × 2^96\n` +
          `human price ≈ ${priceUpperLabel}`,
      },
      { label: 'currentTick', value: String(raw.currentTick) },
      {
        label: '√Pc (current pool price)',
        value: `${raw.sqrtPriceX96}\n(same √P × 2^96 form as √Pl / √Pu)`,
      },
      { label: 'Status', value: raw.rangeStatus },
    ],
    steps,
    result: `${token0}\n${token1}`,
  }
}

function formatHumanPrice(price: number, token0Symbol: string, token1Symbol: string): string {
  if (!Number.isFinite(price) || price <= 0) return 'n/a'
  const digits = price >= 1000 || price < 0.001 ? 6 : 4
  return `${price.toPrecision(digits)} ${token1Symbol} per ${token0Symbol}`
}
