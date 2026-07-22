import { Q96 } from './constants'
import type {
  CloseEstimateBreakdown,
  CloseEstimateCalcSection,
  CloseEstimateParams,
  CloseEstimateResult,
} from './close-estimate-types'
import {
  describeConservativeSwap,
  describeFeeDeduction,
  describeNetAfterFees,
  describeSpotSwap,
  describeSum,
  describeUsdcLeg,
  formatEarnedFormula,
  formatPrincipalFormula,
  getQcPoolPrices,
} from './close-estimate-derivations'
import { formatRawAmount, formatRawUsdc } from './format-raw-amount'
import type { PositionRaw } from './types'

export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const DEFAULT_CLOSE_ESTIMATE_PARAMS: CloseEstimateParams = {
  operationFeeBps: 50,
  performanceFeeBps: 3000,
  minEarnedUsdc: 10,
  swapSlippageBps: 100,
  showOnChainDerivation: false,
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
  poolPrices: ReturnType<typeof getQcPoolPrices>
  showOnChain: boolean
}): { total: bigint; steps: string[] } {
  const usdc = args.usdc.toLowerCase()
  const t0 = args.token0.toLowerCase()
  const t1 = args.token1.toLowerCase()
  const steps: string[] = []

  if (t0 === usdc) {
    let total = args.amount0
    steps.push(describeUsdcLeg(args.amount0, args.token0Symbol, args.dec0))
    if (args.amount1 > 0n && t1 !== usdc) {
      const swapped = quoteSpotSwapOut({
        amountIn: args.amount1,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: false,
      })
      const swap = describeSpotSwap({
        amountIn: args.amount1,
        spotOut: swapped,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: false,
        inSymbol: args.token1Symbol,
        outSymbol: 'USDC',
        inDecimals: args.dec1,
        outDecimals: 6,
        poolPrices: args.poolPrices,
      })
      steps.push(`Swap to USDC: ${swap.human}`)
      if (args.showOnChain) steps.push(`On-chain: ${swap.onChain}`)
      total += swapped
    }
    if (steps.length > 1) {
      steps.push(
        describeSum({
          parts: [
            { label: 'USDC leg', raw: args.amount0, decimals: 6 },
            ...(args.amount1 > 0n && t1 !== usdc
              ? [
                  {
                    label: 'from other token (swap)',
                    raw: total - args.amount0,
                    decimals: 6,
                  },
                ]
              : []),
          ],
          total,
          showOnChain: args.showOnChain,
        }),
      )
    }
    return { total, steps }
  }

  if (t1 === usdc) {
    let total = args.amount1
    steps.push(describeUsdcLeg(args.amount1, args.token1Symbol, args.dec1))
    if (args.amount0 > 0n && t0 !== usdc) {
      const swapped = quoteSpotSwapOut({
        amountIn: args.amount0,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: true,
      })
      const swap = describeSpotSwap({
        amountIn: args.amount0,
        spotOut: swapped,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: true,
        inSymbol: args.token0Symbol,
        outSymbol: 'USDC',
        inDecimals: args.dec0,
        outDecimals: 6,
        poolPrices: args.poolPrices,
      })
      steps.push(`Swap to USDC: ${swap.human}`)
      if (args.showOnChain) steps.push(`On-chain: ${swap.onChain}`)
      total += swapped
    }
    if (steps.length > 1) {
      steps.push(
        describeSum({
          parts: [
            { label: 'USDC leg', raw: args.amount1, decimals: 6 },
            ...(args.amount0 > 0n && t0 !== usdc
              ? [
                  {
                    label: 'from other token (swap)',
                    raw: total - args.amount1,
                    decimals: 6,
                  },
                ]
              : []),
          ],
          total,
          showOnChain: args.showOnChain,
        }),
      )
    }
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
  zeroForOne?: boolean
  inSymbol?: string
  inDecimals?: number
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
      inSymbol: args.token0Symbol,
      inDecimals: args.dec0,
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
      zeroForOne: true,
      inSymbol: args.token0Symbol,
      inDecimals: args.dec0,
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
      inSymbol: args.token1Symbol,
      inDecimals: args.dec1,
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
      zeroForOne: false,
      inSymbol: args.token1Symbol,
      inDecimals: args.dec1,
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
  sqrtPriceX96: bigint
  poolPrices: ReturnType<typeof getQcPoolPrices>
}): CloseEstimateCalcSection {
  const { raw, params, principal, principalConservativeTotal, sqrtPriceX96, poolPrices } = args
  const dec0 = raw.token0Decimals
  const dec1 = raw.token1Decimals
  const showOnChain = params.showOnChainDerivation ?? false

  const steps = principal.legs.flatMap((leg) => {
    if (leg.isDirectUsdc) {
      return [
        {
          label: leg.label,
          value: describeUsdcLeg(
            leg.amountIn,
            leg.inSymbol ?? raw.token0Symbol,
            leg.inDecimals ?? dec0,
          ),
        },
      ]
    }

    const swap = describeSpotSwap({
      amountIn: leg.amountIn,
      spotOut: leg.spotOut,
      sqrtPriceX96,
      zeroForOne: leg.zeroForOne ?? true,
      inSymbol: leg.inSymbol ?? raw.token0Symbol,
      outSymbol: 'USDC',
      inDecimals: leg.inDecimals ?? dec0,
      outDecimals: 6,
      poolPrices,
    })

    return [
      {
        label: `${leg.label} — spot USDC out`,
        value: swap.human,
      },
      ...(showOnChain
        ? [
            {
              label: `${leg.label} — on-chain spot`,
              value: swap.onChain,
            },
          ]
        : []),
      {
        label: `${leg.label} — after pool fee + slippage`,
        value: describeConservativeSwap({
          spotOut: leg.spotOut,
          conservativeOut: leg.conservativeOut,
          poolFeeTier: raw.fee,
          slippageBps: params.swapSlippageBps,
          showOnChain,
        }),
      },
    ]
  })

  steps.push(
    {
      label: 'USDC already in position',
      value: formatRawUsdc(principal.direct),
    },
    {
      label: 'From other token after fee + slippage',
      value: formatRawUsdc(principal.conservativeSwap),
    },
    {
      label: 'Principal total (safer estimate)',
      value: describeSum({
        parts: [
          { label: 'USDC already in position', raw: principal.direct },
          { label: 'from other token after fee + slippage', raw: principal.conservativeSwap },
        ],
        total: principalConservativeTotal,
        showOnChain,
      }),
    },
  )

  const inputs: CloseEstimateCalcSection['inputs'] = [
    {
      label: `${raw.token0Symbol} principal`,
      value: formatRawAmount(BigInt(raw.principalAmount0), dec0, raw.token0Symbol),
    },
    {
      label: `${raw.token1Symbol} principal`,
      value: formatRawAmount(BigInt(raw.principalAmount1), dec1, raw.token1Symbol),
    },
    { label: 'Pool price', value: poolPrices.token1PerToken0Label },
    { label: 'Inverse price', value: poolPrices.token0PerToken1Label },
    { label: 'Pool fee tier', value: `${raw.fee / 10_000}%` },
    { label: 'Extra slippage buffer', value: `${params.swapSlippageBps / 100}%` },
    { label: 'Current tick', value: String(raw.currentTick) },
  ]

  if (showOnChain) {
    inputs.push({ label: 'sqrtPriceX96', value: raw.sqrtPriceX96 })
  }

  return {
    title: 'Principal (USDC, after fee & slippage)',
    summary:
      'Convert the position to USDC at today’s pool price. For the non-USDC token, ' +
      'subtract pool fee and slippage so the estimate is a bit lower (safer for QC).',
    formula: formatPrincipalFormula(),
    inputs,
    steps,
    result: formatUsdc(principalConservativeTotal),
  }
}

function buildEarnedDetails(args: {
  raw: PositionRaw
  params: CloseEstimateParams
  poolPrices: ReturnType<typeof getQcPoolPrices>
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
    poolPrices,
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

  const showOnChain = params.showOnChainDerivation ?? false

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
      label: 'Earned dust threshold',
      value: `$${params.minEarnedUsdc} USDC equiv. (${formatRawUsdc(minEarnedRaw)})`,
    },
  ]

  if (!earnedFeesCharged || !charged) {
    steps.push({
      label: 'Fee deduction',
      value:
        earnedGrossUsdc < minEarnedRaw
          ? `Skipped — gross ${formatRawUsdc(earnedGrossUsdc)} < threshold`
          : 'No earned fees',
    })
  } else {
    steps.push(
      {
        label: `Op fee on ${raw.token0Symbol}`,
        value: describeFeeDeduction({
          gross: fee0,
          bps: params.operationFeeBps,
          fee: charged.opFee0,
          symbol: raw.token0Symbol,
          decimals: raw.token0Decimals,
          feeKind: 'Op fee',
          showOnChain,
        }),
      },
      {
        label: `Op fee on ${raw.token1Symbol}`,
        value: describeFeeDeduction({
          gross: fee1,
          bps: params.operationFeeBps,
          fee: charged.opFee1,
          symbol: raw.token1Symbol,
          decimals: raw.token1Decimals,
          feeKind: 'Op fee',
          showOnChain,
        }),
      },
      {
        label: `PF on ${raw.token0Symbol} (after op)`,
        value: describeFeeDeduction({
          gross: fee0 - charged.opFee0,
          bps: params.performanceFeeBps,
          fee: charged.pf0,
          symbol: raw.token0Symbol,
          decimals: raw.token0Decimals,
          feeKind: 'PF',
          showOnChain,
        }),
      },
      {
        label: `PF on ${raw.token1Symbol} (after op)`,
        value: describeFeeDeduction({
          gross: fee1 - charged.opFee1,
          bps: params.performanceFeeBps,
          fee: charged.pf1,
          symbol: raw.token1Symbol,
          decimals: raw.token1Decimals,
          feeKind: 'PF',
          showOnChain,
        }),
      },
      {
        label: `Net earned ${raw.token0Symbol}`,
        value: describeNetAfterFees({
          gross: fee0,
          opBps: params.operationFeeBps,
          pfBps: params.performanceFeeBps,
          net: earnedNet0,
          symbol: raw.token0Symbol,
          decimals: raw.token0Decimals,
        }),
      },
      {
        label: `Net earned ${raw.token1Symbol}`,
        value: describeNetAfterFees({
          gross: fee1,
          opBps: params.operationFeeBps,
          pfBps: params.performanceFeeBps,
          net: earnedNet1,
          symbol: raw.token1Symbol,
          decimals: raw.token1Decimals,
        }),
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
    summary: '',
    formula: formatEarnedFormula(
      params.minEarnedUsdc,
      params.operationFeeBps / 100,
      params.performanceFeeBps / 100,
    ),
    inputs: [
      {
        label: `${raw.token0Symbol} uncollected`,
        value: formatRawAmount(fee0, raw.token0Decimals, raw.token0Symbol),
      },
      {
        label: `${raw.token1Symbol} uncollected`,
        value: formatRawAmount(fee1, raw.token1Decimals, raw.token1Symbol),
      },
      { label: 'Pool price', value: poolPrices.token1PerToken0Label },
      { label: 'Operation fee', value: `${params.operationFeeBps / 100}%` },
      { label: 'Performance fee', value: `${params.performanceFeeBps / 100}%` },
      { label: 'Earned dust threshold', value: `$${params.minEarnedUsdc} USDC equiv.` },
      { label: 'Fee source', value: raw.uncollectedFeesSource },
      ...(showOnChain ? [{ label: 'sqrtPriceX96', value: raw.sqrtPriceX96 }] : []),
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
  const showOnChain = params.showOnChainDerivation ?? false

  const sqrtPriceX96 = BigInt(raw.sqrtPriceX96)
  const poolPrices = getQcPoolPrices(raw)
  const principal0 = BigInt(raw.principalAmount0)
  const principal1 = BigInt(raw.principalAmount1)
  const fee0 = BigInt(raw.uncollectedFees0)
  const fee1 = BigInt(raw.uncollectedFees1)
  const minEarnedRaw = BigInt(Math.round(params.minEarnedUsdc * 1_000_000))

  const assumptions: string[] = [
    'Non-USDC principal is converted to USDC using today’s pool price (same idea as EXBOT redeem).',
    'Earned fees stay in the pair tokens on-chain; USDC number is only an estimate at pool price.',
    'Does not include gas, Hyperliquid redemption, or BNZA buyback.',
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
    poolPrices,
    showOnChain,
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
        poolPrices,
        showOnChain,
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
        poolPrices,
        showOnChain,
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
    poolPrices,
    showOnChain,
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
    sqrtPriceX96,
    poolPrices,
  })

  const earnedDetails = buildEarnedDetails({
    raw,
    params,
    poolPrices,
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
