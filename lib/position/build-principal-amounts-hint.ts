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
      ? 'amount0 = L × (√Pu − √Pl) / (√Pu × √Pl); amount1 = 0'
      : rangeBranch === 'above'
        ? 'amount0 = 0; amount1 = L × (√Pu − √Pl) / 2^96'
        : rangeBranch === 'in-range'
          ? 'amount0 = L × (√Pu − √Pc) / (√Pu × √Pc); amount1 = L × (√Pc − √Pl) / 2^96'
          : 'amount0 = 0; amount1 = 0'

  const steps: CloseEstimateCalcSection['steps'] = [
    {
      label: 'What is a tick?',
      value:
        'A tick is a price step on Uniswap V3. Each position has a lower and upper tick ' +
        '(tickLower, tickUpper). The pool’s current tick is where price is right now.',
    },
    {
      label: 'Price from tick',
      value:
        `Human price ≈ 1.0001^tick (then adjust for token decimals). ` +
        `Example: tickLower ${raw.tickLower} → about ${priceLowerLabel}; ` +
        `tickUpper ${raw.tickUpper} → about ${priceUpperLabel}.`,
    },
    {
      label: '√P from tick (on-chain form)',
      value:
        'Contracts do not store √P as a normal float. They store √P × 2^96 ' +
        '(called sqrtPriceX96 / √P×2^96). We compute it with Uniswap’s getSqrtRatioAtTick(tick): ' +
        '√Pl = getSqrtRatioAtTick(tickLower), √Pu = getSqrtRatioAtTick(tickUpper). ' +
        'Same idea as: √(1.0001^tick) × 2^96.',
    },
    {
      label: 'tickLower → √Pl',
      value:
        `tickLower = ${raw.tickLower} → √Pl = getSqrtRatioAtTick(${raw.tickLower}) = ${sqrtLower.toString()} ` +
        `(≈ √(${priceLower.toPrecision(6)}) × 2^96).`,
    },
    {
      label: 'tickUpper → √Pu',
      value:
        `tickUpper = ${raw.tickUpper} → √Pu = getSqrtRatioAtTick(${raw.tickUpper}) = ${sqrtUpper.toString()} ` +
        `(≈ √(${priceUpper.toPrecision(6)}) × 2^96).`,
    },
    {
      label: 'Current price √Pc',
      value:
        `Read from the pool slot0 as sqrtPriceX96 = ${raw.sqrtPriceX96} ` +
        `(currentTick = ${raw.currentTick}). This is √Pc in the formulas below.`,
    },
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
      {
        label: 'tickLower → √Pl',
        value:
          `${raw.tickLower} → ${sqrtLower.toString()} ` +
          `(getSqrtRatioAtTick; ≈ √(1.0001^tick) × 2^96; human price ≈ ${priceLowerLabel})`,
      },
      {
        label: 'tickUpper → √Pu',
        value:
          `${raw.tickUpper} → ${sqrtUpper.toString()} ` +
          `(getSqrtRatioAtTick; ≈ √(1.0001^tick) × 2^96; human price ≈ ${priceUpperLabel})`,
      },
      { label: 'currentTick', value: String(raw.currentTick) },
      {
        label: '√Pc (sqrtPriceX96 from pool)',
        value: `${raw.sqrtPriceX96} (same X96 encoding as √Pl / √Pu)`,
      },
      { label: 'Status', value: raw.rangeStatus },
    ],
    steps,
    result: `${token0} + ${token1}`,
  }
}

function formatHumanPrice(price: number, token0Symbol: string, token1Symbol: string): string {
  if (!Number.isFinite(price) || price <= 0) return 'n/a'
  const digits = price >= 1000 || price < 0.001 ? 6 : 4
  return `${price.toPrecision(digits)} ${token1Symbol} per ${token0Symbol}`
}
