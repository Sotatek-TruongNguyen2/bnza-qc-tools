import { Q96 } from './constants'
import type { CloseEstimateBreakdown, CloseEstimateParams, CloseEstimateResult } from './close-estimate-types'
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
  usdc: string
  sqrtPriceX96: bigint
}): bigint {
  const usdc = args.usdc.toLowerCase()
  const t0 = args.token0.toLowerCase()
  const t1 = args.token1.toLowerCase()

  if (t0 === usdc) {
    let total = args.amount0
    if (args.amount1 > 0n && t1 !== usdc) {
      total += quoteSpotSwapOut({
        amountIn: args.amount1,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: false,
      })
    }
    return total
  }

  if (t1 === usdc) {
    let total = args.amount1
    if (args.amount0 > 0n && t0 !== usdc) {
      total += quoteSpotSwapOut({
        amountIn: args.amount0,
        sqrtPriceX96: args.sqrtPriceX96,
        zeroForOne: true,
      })
    }
    return total
  }

  return 0n
}

function principalToUsdc(args: {
  principal0: bigint
  principal1: bigint
  token0: string
  token1: string
  usdc: string
  poolFee: number
  sqrtPriceX96: bigint
  swapSlippageBps: number
}): { direct: bigint; fromSwap: bigint; spotSwap: bigint; conservativeSwap: bigint } {
  const usdc = args.usdc.toLowerCase()
  const t0 = args.token0.toLowerCase()
  const t1 = args.token1.toLowerCase()

  let direct = 0n
  let spotSwap = 0n
  let conservativeSwap = 0n

  if (t0 === usdc) direct += args.principal0
  else if (args.principal0 > 0n) {
    const expected = quoteSpotSwapOut({
      amountIn: args.principal0,
      sqrtPriceX96: args.sqrtPriceX96,
      zeroForOne: true,
    })
    spotSwap += expected
    conservativeSwap += applySwapHaircut(expected, args.poolFee, args.swapSlippageBps)
  }

  if (t1 === usdc) direct += args.principal1
  else if (args.principal1 > 0n) {
    const expected = quoteSpotSwapOut({
      amountIn: args.principal1,
      sqrtPriceX96: args.sqrtPriceX96,
      zeroForOne: false,
    })
    spotSwap += expected
    conservativeSwap += applySwapHaircut(expected, args.poolFee, args.swapSlippageBps)
  }

  return { direct, fromSwap: conservativeSwap, spotSwap, conservativeSwap }
}

function formatUsdc(raw: bigint, decimals = 6): string {
  const value = Number(raw) / 10 ** decimals
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC`
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
    usdc: BASE_USDC,
    poolFee: raw.fee,
    sqrtPriceX96,
    swapSlippageBps: params.swapSlippageBps,
  })

  const principalSpotTotal = principal.direct + principal.spotSwap
  const principalConservativeTotal = principal.direct + principal.conservativeSwap

  const earnedGrossUsdc = earnedUsdcEquivalent({
    amount0: fee0,
    amount1: fee1,
    token0: raw.token0,
    token1: raw.token1,
    usdc: BASE_USDC,
    sqrtPriceX96,
  })

  let earnedNet0 = fee0
  let earnedNet1 = fee1
  let earnedFeesCharged = false
  let earnedFeeNote = 'No uncollected fees.'
  let opFeeUsdc = 0n
  let pfFeeUsdc = 0n

  if (fee0 > 0n || fee1 > 0n) {
    if (earnedGrossUsdc < minEarnedRaw) {
      earnedFeeNote = `Earned below $${params.minEarnedUsdc} dust — EXBOT skips op/PF on close.`
    } else {
      const charged = chargeEarnedFees(
        fee0,
        fee1,
        params.operationFeeBps,
        params.performanceFeeBps,
      )
      earnedNet0 = charged.net0
      earnedNet1 = charged.net1
      earnedFeesCharged = true
      earnedFeeNote = `Earned fees charged: ${params.operationFeeBps / 100}% op + ${params.performanceFeeBps / 100}% PF.`
      opFeeUsdc = earnedUsdcEquivalent({
        amount0: charged.opFee0,
        amount1: charged.opFee1,
        token0: raw.token0,
        token1: raw.token1,
        usdc: BASE_USDC,
        sqrtPriceX96,
      })
      pfFeeUsdc = earnedUsdcEquivalent({
        amount0: charged.pf0,
        amount1: charged.pf1,
        token0: raw.token0,
        token1: raw.token1,
        usdc: BASE_USDC,
        sqrtPriceX96,
      })
    }
  }

  const earnedNetUsdc = earnedUsdcEquivalent({
    amount0: earnedNet0,
    amount1: earnedNet1,
    token0: raw.token0,
    token1: raw.token1,
    usdc: BASE_USDC,
    sqrtPriceX96,
  })

  const totalSpot = principalSpotTotal + earnedNetUsdc
  const totalConservative = principalConservativeTotal + earnedNetUsdc

  if (BigInt(raw.liquidity) === 0n && fee0 === 0n && fee1 === 0n) {
    assumptions.push('Position liquidity is zero — only fees would remain if any.')
  }

  const breakdown: CloseEstimateBreakdown = {
    principalUsdcDirect: principal.direct.toString(),
    principalUsdcFromSwap: principal.conservativeSwap.toString(),
    principalUsdcTotal: principalConservativeTotal.toString(),
    earnedGrossUsdcEquiv: earnedGrossUsdc.toString(),
    earnedNetUsdcEquiv: earnedNetUsdc.toString(),
    earnedFeesCharged,
    earnedFeeNote,
    operationFeeUsdcEquiv: opFeeUsdc.toString(),
    performanceFeeUsdcEquiv: pfFeeUsdc.toString(),
    totalUsdcSpot: totalSpot.toString(),
    totalUsdcConservative: totalConservative.toString(),
    assumptions,
  }

  return {
    params,
    breakdown,
    human: {
      principalUsdc: formatUsdc(principalConservativeTotal),
      earnedNetUsdc: formatUsdc(earnedNetUsdc),
      totalSpot: formatUsdc(totalSpot),
      totalConservative: formatUsdc(totalConservative),
    },
  }
}
