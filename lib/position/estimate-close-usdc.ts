import { Q96 } from './constants'
import type {
  CloseEstimateBreakdown,
  CloseEstimateCalcSection,
  CloseEstimateParams,
  CloseEstimateResult,
} from './close-estimate-types'
import { formatRawAmount, formatRawUsdc } from './format-raw-amount'
import type { PositionRaw } from './types'

export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const DEFAULT_CLOSE_ESTIMATE_PARAMS: CloseEstimateParams = {
  operationFeeBps: 50,
  performanceFeeBps: 3000,
  minEarnedUsdc: 10,
  swapSlippageBps: 100,
}

const BPS = 10_000n

function mulDivFloor(a: bigint, b: bigint, d: bigint): bigint {
  if (d === 0n) return 0n
  return (a * b) / d
}

function quoteSpotSwapOut(args: {
  amountIn: bigint
  sqrtPriceX96: bigint
  zeroForOne: boolean
}): bigint {
  if (args.amountIn === 0n) return 0n
  const priceX96 = mulDivFloor(args.sqrtPriceX96, args.sqrtPriceX96, Q96)
  if (args.zeroForOne) return mulDivFloor(args.amountIn, priceX96, Q96)
  if (priceX96 === 0n) return 0n
  return mulDivFloor(args.amountIn, Q96, priceX96)
}

function applySwapHaircut(expectedOut: bigint, poolFee: number, slippageBps: number): bigint {
  const poolFeeBps = BigInt(poolFee) / 100n
  const totalDeduction = poolFeeBps + BigInt(slippageBps)
  if (totalDeduction >= BPS) return 0n
  return (expectedOut * (BPS - totalDeduction)) / BPS
}

function chargeEarnedFees(
  amount0: bigint,
  amount1: bigint,
  operationFeeBps: number,
  performanceFeeBps: number,
): {
  net0: bigint
  net1: bigint
  opFee0: bigint
  opFee1: bigint
  pf0: bigint
  pf1: bigint
} {
  const opBps = BigInt(operationFeeBps)
  const pfBps = BigInt(performanceFeeBps)

  const opFee0 = (amount0 * opBps) / BPS
  const opFee1 = (amount1 * opBps) / BPS
  const afterOp0 = amount0 - opFee0
  const afterOp1 = amount1 - opFee1
  const pf0 = (afterOp0 * pfBps) / BPS
  const pf1 = (afterOp1 * pfBps) / BPS

  return {
    net0: afterOp0 - pf0,
    net1: afterOp1 - pf1,
    opFee0,
    opFee1,
    pf0,
    pf1,
  }
}

function earnedUsdcEquivalent(args: {
  amount0: bigint
  amount1: bigint
  token0: string
  token1: string
  token0Symbol: string
  token1Symbol: string
  dec0: number
  dec1: number
  usdc: string
  sqrtPriceX96: bigint
}): { total: bigint; steps: string[] } {
  const usdc = args.usdc.toLowerCase()
  const t0 = args.token0.toLowerCase()
  const t1 = args.token1.toLowerCase()
  const steps: string[] = []

  if (t0 === usdc) {
    let total = args.amount0
    steps.push(`USDC leg (token0): ${formatRawAmount(args.amount0, args.dec0, args.token0Symbol)}`)
    if (args.amount1 > 0n && t1 !== usdc) {
      const swapped = quoteSpotSwapOut({
        amountIn: args.amount1,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: false,
      })
      steps.push(
        `Swap ${formatRawAmount(args.amount1, args.dec1, args.token1Symbol)} → USDC @ spot: ${formatRawUsdc(swapped)}`,
      )
      total += swapped
    }
    steps.push(`Sum: ${formatRawUsdc(total)}`)
    return { total, steps }
  }

  if (t1 === usdc) {
    let total = args.amount1
    steps.push(`USDC leg (token1): ${formatRawAmount(args.amount1, args.dec1, args.token1Symbol)}`)
    if (args.amount0 > 0n && t0 !== usdc) {
      const swapped = quoteSpotSwapOut({
        amountIn: args.amount0,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: true,
      })
      steps.push(
        `Swap ${formatRawAmount(args.amount0, args.dec0, args.token0Symbol)} → USDC @ spot: ${formatRawUsdc(swapped)}`,
      )
      total += swapped
    }
    steps.push(`Sum: ${formatRawUsdc(total)}`)
    return { total, steps }
  }

  steps.push('Non-USDC pair — USDC equivalent not computed.')
  return { total: 0n, steps }
}

type PrincipalLegDetail = {
  label: string
  amountIn: bigint
  spotOut: bigint
  conservativeOut: bigint
  isDirectUsdc: boolean
}

function principalToUsdc(args: {
  principal0: bigint
  principal1: bigint
  token0: string
  token1: string
  token0Symbol: string
  token1Symbol: string
  dec0: number
  dec1: number
  usdc: string
  poolFee: number
  sqrtPriceX96: bigint
  swapSlippageBps: number
}): {
  direct: bigint
  spotSwap: bigint
  conservativeSwap: bigint
  legs: PrincipalLegDetail[]
  poolFeeBps: bigint
  totalDeductionBps: bigint
} {
  const usdc = args.usdc.toLowerCase()
  const t0 = args.token0.toLowerCase()
  const t1 = args.token1.toLowerCase()
  const poolFeeBps = BigInt(args.poolFee) / 100n
  const totalDeductionBps = poolFeeBps + BigInt(args.swapSlippageBps)

  let direct = 0n
  let spotSwap = 0n
  let conservativeSwap = 0n
  const legs: PrincipalLegDetail[] = []

  if (t0 === usdc) {
    direct += args.principal0
    legs.push({
      label: `${args.token0Symbol} principal (already USDC)`,
      amountIn: args.principal0,
      spotOut: args.principal0,
      conservativeOut: args.principal0,
      isDirectUsdc: true,
    })
  } else if (args.principal0 > 0n) {
    const expected = quoteSpotSwapOut({
      amountIn: args.principal0,
      sqrtPriceX96: args.sqrtPriceX96,
      zeroForOne: true,
    })
    const conservative = applySwapHaircut(expected, args.poolFee, args.swapSlippageBps)
    spotSwap += expected
    conservativeSwap += conservative
    legs.push({
      label: `${args.token0Symbol} principal → USDC`,
      amountIn: args.principal0,
      spotOut: expected,
      conservativeOut: conservative,
      isDirectUsdc: false,
    })
  }

  if (t1 === usdc) {
    direct += args.principal1
    legs.push({
      label: `${args.token1Symbol} principal (already USDC)`,
      amountIn: args.principal1,
      spotOut: args.principal1,
      conservativeOut: args.principal1,
      isDirectUsdc: true,
    })
  } else if (args.principal1 > 0n) {
    const expected = quoteSpotSwapOut({
      amountIn: args.principal1,
      sqrtPriceX96: args.sqrtPriceX96,
      zeroForOne: false,
    })
    const conservative = applySwapHaircut(expected, args.poolFee, args.swapSlippageBps)
    spotSwap += expected
    conservativeSwap += conservative
    legs.push({
      label: `${args.token1Symbol} principal → USDC`,
      amountIn: args.principal1,
      spotOut: expected,
      conservativeOut: conservative,
      isDirectUsdc: false,
    })
  }

  return { direct, spotSwap, conservativeSwap, legs, poolFeeBps, totalDeductionBps }
}

function formatUsdc(raw: bigint, decimals = 6): string {
  const value = Number(raw) / 10 ** decimals
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })} USDC`
}

function buildPrincipalDetails(args: {
  raw: PositionRaw
  params: CloseEstimateParams
  principal: ReturnType<typeof principalToUsdc>
  principalConservativeTotal: bigint
}): CloseEstimateCalcSection {
  const { raw, params, principal, principalConservativeTotal } = args
  const dec0 = raw.token0Decimals
  const dec1 = raw.token1Decimals

  const steps = principal.legs.flatMap((leg) => {
    if (leg.isDirectUsdc) {
      return [
        {
          label: leg.label,
          value: formatRawAmount(leg.amountIn, raw.token0Decimals, raw.token0Symbol),
        },
      ]
    }

    const symbol = leg.label.startsWith(raw.token0Symbol) ? raw.token0Symbol : raw.token1Symbol
    const decimals = symbol === raw.token0Symbol ? dec0 : dec1

    return [
      {
        label: `${leg.label} — amount in`,
        value: formatRawAmount(leg.amountIn, decimals, symbol),
      },
      {
        label: `${leg.label} — spot USDC out`,
        value: formatRawUsdc(leg.spotOut),
      },
      {
        label: `${leg.label} — conservative out`,
        value: `${formatRawUsdc(leg.conservativeOut)} (× (1 − (${principal.poolFeeBps} pool + ${params.swapSlippageBps} slippage) / 10000))`,
      },
    ]
  })

  steps.push(
    {
      label: 'USDC direct subtotal',
      value: formatRawUsdc(principal.direct),
    },
    {
      label: 'Swapped principal subtotal (conservative)',
      value: formatRawUsdc(principal.conservativeSwap),
    },
    {
      label: 'Principal total (conservative)',
      value: `${formatRawUsdc(principalConservativeTotal)} = direct + conservative swap`,
    },
  )

  return {
    title: 'Principal (USDC, conservative)',
    summary: 'Liquidity at current pool price, non-USDC leg swapped to USDC with pool fee + slippage haircut.',
    formula:
      'principal_usdc = usdc_direct + Σ (spot_swap_out × (1 − (pool_fee_bps + slippage_bps) / 10000)); spot_swap from sqrtPriceX96',
    inputs: [
      {
        label: `${raw.token0Symbol} principal (raw)`,
        value: formatRawAmount(BigInt(raw.principalAmount0), dec0, raw.token0Symbol),
      },
      {
        label: `${raw.token1Symbol} principal (raw)`,
        value: formatRawAmount(BigInt(raw.principalAmount1), dec1, raw.token1Symbol),
      },
      { label: 'sqrtPriceX96', value: raw.sqrtPriceX96 },
      { label: 'Pool fee tier', value: `${raw.fee} (${raw.fee / 10_000}% → ${principal.poolFeeBps} bps)` },
      { label: 'Swap slippage', value: `${params.swapSlippageBps} bps (${params.swapSlippageBps / 100}%)` },
      { label: 'Current tick', value: String(raw.currentTick) },
    ],
    steps,
    result: formatUsdc(principalConservativeTotal),
  }
}

function buildEarnedDetails(args: {
  raw: PositionRaw
  params: CloseEstimateParams
  fee0: bigint
  fee1: bigint
  minEarnedRaw: bigint
  earnedGrossUsdc: bigint
  earnedGrossSteps: string[]
  earnedFeesCharged: boolean
  charged: ReturnType<typeof chargeEarnedFees> | null
  earnedNet0: bigint
  earnedNet1: bigint
  earnedNetUsdc: bigint
  earnedNetSteps: string[]
}): CloseEstimateCalcSection {
  const {
    raw,
    params,
    fee0,
    fee1,
    minEarnedRaw,
    earnedGrossUsdc,
    earnedGrossSteps,
    earnedFeesCharged,
    charged,
    earnedNet0,
    earnedNet1,
    earnedNetUsdc,
    earnedNetSteps,
  } = args

  const steps: { label: string; value: string }[] = [
    {
      label: 'Gross uncollected fees',
      value: `${formatRawAmount(fee0, raw.token0Decimals, raw.token0Symbol)} + ${formatRawAmount(fee1, raw.token1Decimals, raw.token1Symbol)}`,
    },
    ...earnedGrossSteps.map((line, i) => ({ label: `Gross USDC equiv. step ${i + 1}`, value: line })),
    {
      label: 'Gross USDC equivalent',
      value: formatRawUsdc(earnedGrossUsdc),
    },
    {
      label: 'Min earned threshold',
      value: `${formatRawUsdc(minEarnedRaw)} ($${params.minEarnedUsdc})`,
    },
  ]

  if (!earnedFeesCharged || !charged) {
    steps.push({
      label: 'Fee deduction',
      value:
        earnedGrossUsdc < minEarnedRaw
          ? 'Skipped — below dust threshold (user keeps gross earned)'
          : 'No earned fees',
    })
  } else {
    steps.push(
      {
        label: `Op fee (${params.operationFeeBps} bps) on ${raw.token0Symbol}`,
        value: formatRawAmount(charged.opFee0, raw.token0Decimals, raw.token0Symbol),
      },
      {
        label: `Op fee (${params.operationFeeBps} bps) on ${raw.token1Symbol}`,
        value: formatRawAmount(charged.opFee1, raw.token1Decimals, raw.token1Symbol),
      },
      {
        label: `PF (${params.performanceFeeBps} bps) on ${raw.token0Symbol} after op`,
        value: formatRawAmount(charged.pf0, raw.token0Decimals, raw.token0Symbol),
      },
      {
        label: `PF (${params.performanceFeeBps} bps) on ${raw.token1Symbol} after op`,
        value: formatRawAmount(charged.pf1, raw.token1Decimals, raw.token1Symbol),
      },
      {
        label: 'Net earned token0',
        value: formatRawAmount(earnedNet0, raw.token0Decimals, raw.token0Symbol),
      },
      {
        label: 'Net earned token1',
        value: formatRawAmount(earnedNet1, raw.token1Decimals, raw.token1Symbol),
      },
      ...earnedNetSteps.map((line, i) => ({ label: `Net USDC equiv. step ${i + 1}`, value: line })),
    )
  }

  steps.push({
    label: 'Earned net USDC equivalent',
    value: formatRawUsdc(earnedNetUsdc),
  })

  return {
    title: 'Earned fees net (USDC equiv.)',
    summary: 'Uncollected fees after optional LpFeeOps op + performance fee, converted to USDC at spot.',
    formula:
      'If gross_usdc_equiv ≥ min_earned: net_i = fee_i × (1 − op_bps/10000) × (1 − pf_bps/10000); then sum USDC legs + spot swap of other leg',
    inputs: [
      {
        label: `${raw.token0Symbol} uncollected`,
        value: formatRawAmount(fee0, raw.token0Decimals, raw.token0Symbol),
      },
      {
        label: `${raw.token1Symbol} uncollected`,
        value: formatRawAmount(fee1, raw.token1Decimals, raw.token1Symbol),
      },
      { label: 'Operation fee', value: `${params.operationFeeBps} bps (${params.operationFeeBps / 100}%)` },
      { label: 'Performance fee', value: `${params.performanceFeeBps} bps (${params.performanceFeeBps / 100}%)` },
      { label: 'Min earned (USDC)', value: `$${params.minEarnedUsdc}` },
      { label: 'Fee source', value: raw.uncollectedFeesSource },
    ],
    steps,
    result: formatUsdc(earnedNetUsdc),
  }
}

export function estimateCloseUsdc(
  raw: PositionRaw,
  inputParams?: Partial<CloseEstimateParams>,
): CloseEstimateResult {
  const params: CloseEstimateParams = {
    ...DEFAULT_CLOSE_ESTIMATE_PARAMS,
    ...inputParams,
  }

  const sqrtPriceX96 = BigInt(raw.sqrtPriceX96)
  const principal0 = BigInt(raw.principalAmount0)
  const principal1 = BigInt(raw.principalAmount1)
  const fee0 = BigInt(raw.uncollectedFees0)
  const fee1 = BigInt(raw.uncollectedFees1)
  const minEarnedRaw = BigInt(Math.round(params.minEarnedUsdc * 1_000_000))

  const assumptions: string[] = [
    'Principal swapped to USDC at pool spot price (EXBOT redeem `convertPrincipalToUsdc`).',
    'Earned fees stay in pair currency on-chain; USDC equivalent shown at spot.',
    'Does not include gas, HL redemption leg, or BNZA buyback.',
  ]

  const principal = principalToUsdc({
    principal0,
    principal1,
    token0: raw.token0,
    token1: raw.token1,
    token0Symbol: raw.token0Symbol,
    token1Symbol: raw.token1Symbol,
    dec0: raw.token0Decimals,
    dec1: raw.token1Decimals,
    usdc: BASE_USDC,
    poolFee: raw.fee,
    sqrtPriceX96,
    swapSlippageBps: params.swapSlippageBps,
  })

  const principalSpotTotal = principal.direct + principal.spotSwap
  const principalConservativeTotal = principal.direct + principal.conservativeSwap

  const earnedGross = earnedUsdcEquivalent({
    amount0: fee0,
    amount1: fee1,
    token0: raw.token0,
    token1: raw.token1,
    token0Symbol: raw.token0Symbol,
    token1Symbol: raw.token1Symbol,
    dec0: raw.token0Decimals,
    dec1: raw.token1Decimals,
    usdc: BASE_USDC,
    sqrtPriceX96,
  })

  let earnedNet0 = fee0
  let earnedNet1 = fee1
  let earnedFeesCharged = false
  let earnedFeeNote = 'No uncollected fees.'
  let opFeeUsdc = 0n
  let pfFeeUsdc = 0n
  let charged: ReturnType<typeof chargeEarnedFees> | null = null

  if (fee0 > 0n || fee1 > 0n) {
    if (earnedGross.total < minEarnedRaw) {
      earnedFeeNote = `Earned below $${params.minEarnedUsdc} dust — EXBOT skips op/PF on close.`
    } else {
      charged = chargeEarnedFees(fee0, fee1, params.operationFeeBps, params.performanceFeeBps)
      earnedNet0 = charged.net0
      earnedNet1 = charged.net1
      earnedFeesCharged = true
      earnedFeeNote = `Earned fees charged: ${params.operationFeeBps / 100}% op + ${params.performanceFeeBps / 100}% PF.`
      opFeeUsdc = earnedUsdcEquivalent({
        amount0: charged.opFee0,
        amount1: charged.opFee1,
        token0: raw.token0,
        token1: raw.token1,
        token0Symbol: raw.token0Symbol,
        token1Symbol: raw.token1Symbol,
        dec0: raw.token0Decimals,
        dec1: raw.token1Decimals,
        usdc: BASE_USDC,
        sqrtPriceX96,
      }).total
      pfFeeUsdc = earnedUsdcEquivalent({
        amount0: charged.pf0,
        amount1: charged.pf1,
        token0: raw.token0,
        token1: raw.token1,
        token0Symbol: raw.token0Symbol,
        token1Symbol: raw.token1Symbol,
        dec0: raw.token0Decimals,
        dec1: raw.token1Decimals,
        usdc: BASE_USDC,
        sqrtPriceX96,
      }).total
    }
  }

  const earnedNet = earnedUsdcEquivalent({
    amount0: earnedNet0,
    amount1: earnedNet1,
    token0: raw.token0,
    token1: raw.token1,
    token0Symbol: raw.token0Symbol,
    token1Symbol: raw.token1Symbol,
    dec0: raw.token0Decimals,
    dec1: raw.token1Decimals,
    usdc: BASE_USDC,
    sqrtPriceX96,
  })

  const totalSpot = principalSpotTotal + earnedNet.total
  const totalConservative = principalConservativeTotal + earnedNet.total

  if (BigInt(raw.liquidity) === 0n && fee0 === 0n && fee1 === 0n) {
    assumptions.push('Position liquidity is zero — only fees would remain if any.')
  }

  const principalDetails = buildPrincipalDetails({
    raw,
    params,
    principal,
    principalConservativeTotal,
  })

  const earnedDetails = buildEarnedDetails({
    raw,
    params,
    fee0,
    fee1,
    minEarnedRaw,
    earnedGrossUsdc: earnedGross.total,
    earnedGrossSteps: earnedGross.steps,
    earnedFeesCharged,
    charged,
    earnedNet0,
    earnedNet1,
    earnedNetUsdc: earnedNet.total,
    earnedNetSteps: earnedNet.steps,
  })

  const breakdown: CloseEstimateBreakdown = {
    principalUsdcDirect: principal.direct.toString(),
    principalUsdcFromSwap: principal.conservativeSwap.toString(),
    principalUsdcSpotSwap: principal.spotSwap.toString(),
    principalUsdcTotal: principalConservativeTotal.toString(),
    principalUsdcSpotTotal: principalSpotTotal.toString(),
    earnedGrossUsdcEquiv: earnedGross.total.toString(),
    earnedNetUsdcEquiv: earnedNet.total.toString(),
    earnedFeesCharged,
    earnedFeeNote,
    earnedNet0: earnedNet0.toString(),
    earnedNet1: earnedNet1.toString(),
    operationFeeUsdcEquiv: opFeeUsdc.toString(),
    performanceFeeUsdcEquiv: pfFeeUsdc.toString(),
    totalUsdcSpot: totalSpot.toString(),
    totalUsdcConservative: totalConservative.toString(),
    assumptions,
    details: {
      principal: principalDetails,
      earned: earnedDetails,
    },
  }

  return {
    params,
    breakdown,
    human: {
      principalUsdc: formatUsdc(principalConservativeTotal),
      earnedNetUsdc: formatUsdc(earnedNet.total),
      totalSpot: formatUsdc(totalSpot),
      totalConservative: formatUsdc(totalConservative),
    },
  }
}
