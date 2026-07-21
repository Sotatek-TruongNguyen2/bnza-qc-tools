import { formatUnits } from 'viem'
import { Q96 } from './constants'
import { formatPrice, tickToPriceRatio } from './format'
import { formatRawAmount, formatRawUsdc } from './format-raw-amount'
import type { PositionRaw } from './types'

export type QcPoolPrices = {
  token1PerToken0: number
  token0PerToken1: number
  token1PerToken0Label: string
  token0PerToken1Label: string
}

export function getQcPoolPrices(raw: PositionRaw): QcPoolPrices {
  const token1PerToken0 = tickToPriceRatio(raw.currentTick, raw.token0Decimals, raw.token1Decimals)
  const token0PerToken1 = token1PerToken0 > 0 ? 1 / token1PerToken0 : 0

  return {
    token1PerToken0,
    token0PerToken1,
    token1PerToken0Label: formatPrice(
      `${raw.token1Symbol} per ${raw.token0Symbol}`,
      token1PerToken0,
    ),
    token0PerToken1Label: formatPrice(
      `${raw.token0Symbol} per ${raw.token1Symbol}`,
      token0PerToken1,
    ),
  }
}

function formatDecimal(value: number, maxFractionDigits = 10): string {
  if (!Number.isFinite(value)) return 'n/a'
  return value.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits })
}

function mulDivFloor(a: bigint, b: bigint, d: bigint): bigint {
  if (d === 0n) return 0n
  return (a * b) / d
}

export function describeSpotSwap(args: {
  amountIn: bigint
  spotOut: bigint
  sqrtPriceX96: bigint
  zeroForOne: boolean
  inSymbol: string
  outSymbol: string
  inDecimals: number
  outDecimals: number
  poolPrices: QcPoolPrices
}): { human: string; onChain: string } {
  const amountInHuman = formatUnits(args.amountIn, args.inDecimals)
  const spotOutHuman = formatUnits(args.spotOut, args.outDecimals)
  const priceX96 = mulDivFloor(args.sqrtPriceX96, args.sqrtPriceX96, Q96)

  const humanPrice = args.zeroForOne
    ? args.poolPrices.token1PerToken0
    : args.poolPrices.token0PerToken1
  const priceLabel = args.zeroForOne
    ? `${args.outSymbol} per ${args.inSymbol}`
    : `${args.outSymbol} per ${args.inSymbol}`

  const human = `${amountInHuman} ${args.inSymbol} × ${formatDecimal(humanPrice)} ${priceLabel} = ${spotOutHuman} ${args.outSymbol}`

  const onChain = args.zeroForOne
    ? `(${args.amountIn} × ${priceX96}) / 2^96 = ${args.spotOut} raw (${args.outDecimals} decimals)`
    : `(${args.amountIn} × 2^96) / ${priceX96} = ${args.spotOut} raw (${args.outDecimals} decimals)`

  return { human, onChain }
}

export function describeConservativeSwap(args: {
  spotOut: bigint
  conservativeOut: bigint
  poolFeeTier: number
  slippageBps: number
  outDecimals?: number
  showOnChain?: boolean
}): string {
  const outDecimals = args.outDecimals ?? 6
  const spotHuman = formatUnits(args.spotOut, outDecimals)
  const conservativeHuman = formatUnits(args.conservativeOut, outDecimals)
  const poolPct = args.poolFeeTier / 10_000
  const slipPct = args.slippageBps / 100
  const keepPct = 100 - poolPct - slipPct
  const human = `${spotHuman} USDC × ${keepPct}% = ${conservativeHuman} USDC`

  if (!args.showOnChain) return human

  const keepBps = 10_000n - BigInt(args.poolFeeTier) / 100n - BigInt(args.slippageBps)
  return `${human} (on-chain: ${args.spotOut} × ${keepBps} / 10000 = ${args.conservativeOut})`
}

export function describeFeeDeduction(args: {
  gross: bigint
  bps: number
  fee: bigint
  symbol: string
  decimals: number
  feeKind: string
  showOnChain?: boolean
}): string {
  const grossHuman = formatUnits(args.gross, args.decimals)
  const feeHuman = formatUnits(args.fee, args.decimals)
  const pct = args.bps / 100
  const human = `${args.feeKind}: ${grossHuman} ${args.symbol} × ${pct}% = ${feeHuman} ${args.symbol}`

  if (!args.showOnChain) return human

  return `${human} (on-chain: ${args.gross} × ${args.bps} / 10000 = ${args.fee})`
}

export function describeNetAfterFees(args: {
  gross: bigint
  opBps: number
  pfBps: number
  net: bigint
  symbol: string
  decimals: number
}): string {
  const grossHuman = formatUnits(args.gross, args.decimals)
  const netHuman = formatUnits(args.net, args.decimals)
  const opPct = args.opBps / 100
  const pfPct = args.pfBps / 100
  const afterOpFactor = (10_000 - args.opBps) / 10_000
  const afterPfFactor = (10_000 - args.pfBps) / 10_000
  const combinedPct = afterOpFactor * afterPfFactor * 100

  return (
    `${grossHuman} ${args.symbol} × (1 − ${opPct}%) × (1 − ${pfPct}%) ` +
    `≈ ${netHuman} ${args.symbol} (≈ ${formatDecimal(combinedPct)}% kept)`
  )
}

export function describeSum(args: {
  parts: { label: string; raw: bigint; decimals?: number }[]
  total: bigint
  totalDecimals?: number
  outSymbol?: string
  showOnChain?: boolean
}): string {
  const outSymbol = args.outSymbol ?? 'USDC'
  const totalDecimals = args.totalDecimals ?? 6
  const terms = args.parts.map((p) => {
    const human = formatUnits(p.raw, p.decimals ?? totalDecimals)
    return `${human} (${p.label})`
  })
  const totalHuman = formatUnits(args.total, totalDecimals)
  const human = `${terms.join(' + ')} = ${totalHuman} ${outSymbol}`

  if (!args.showOnChain) return human

  const rawTerms = args.parts.map((p) => p.raw.toString()).join(' + ')
  return `${human} (on-chain: ${rawTerms} = ${args.total})`
}

export function earnedDustThresholdNote(minEarnedUsdc: number): string {
  return (
    `EXBOT only charges op/PF when gross earned ≥ $${minEarnedUsdc} USDC equivalent. ` +
    `Below that, user keeps 100% of earned fees (dust skip).`
  )
}

export function operationFeeApplicabilityNote(): string {
  return (
    'Charged on uncollected LP fees only — not on principal. Applies at close (redeem), ' +
    'collect-fees, and rebalance when earned fees are harvested. Taken first, before performance fee. ' +
    'Skipped when gross earned is below the dust threshold.'
  )
}

export function performanceFeeApplicabilityNote(): string {
  return (
    'Protocol profit share on earned LP fees only — not on principal. Applies at close (redeem), ' +
    'collect-fees, and rebalance, charged on the amount left after operation fee. ' +
    'Skipped when gross earned is below the dust threshold.'
  )
}

export function formatPrincipalFormula(): string {
  return 'USDC total = USDC already in position + (other token × pool price), then haircut on swapped leg'
}

export function formatEarnedFormula(minEarnedUsdc: number, opPct: number, pfPct: number): string {
  return (
    `If gross earned ≥ $${minEarnedUsdc}: net = gross × (1 − ${opPct}%) × (1 − ${pfPct}%); ` +
    `else user keeps full gross`
  )
}

export function describeUsdcLeg(amount: bigint, symbol: string, decimals: number): string {
  return `Already USDC — no swap: ${formatRawAmount(amount, decimals, symbol)}`
}
