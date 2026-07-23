import { formatUnits } from 'viem'
import { BASE_USDC_ADDRESS, BASE_WETH_ADDRESS } from '@/lib/base-known-tokens'

export function formatSignedUsdc(raw: bigint): string {
  const sign = raw < 0n ? '−' : '+'
  const abs = raw < 0n ? -raw : raw
  return `${sign}${Number(formatUnits(abs, 6)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })} USDC`
}

/** Mark WETH/USDC legs in USDC raw (6 decimals). Returns null for other pairs. */
export function usdcFromWethUsdcLegs(args: {
  token0: `0x${string}`
  token1: `0x${string}`
  amount0: bigint
  amount1: bigint
  priceToken1PerToken0: number
}): bigint | null {
  const t0 = args.token0.toLowerCase()
  const t1 = args.token1.toLowerCase()
  const weth = BASE_WETH_ADDRESS.toLowerCase()
  const usdc = BASE_USDC_ADDRESS.toLowerCase()

  let wethRaw: bigint
  let usdcRaw: bigint
  let usdcPerWeth: number

  if (t0 === weth && t1 === usdc) {
    wethRaw = args.amount0
    usdcRaw = args.amount1
    usdcPerWeth = args.priceToken1PerToken0
  } else if (t0 === usdc && t1 === weth) {
    usdcRaw = args.amount0
    wethRaw = args.amount1
    usdcPerWeth =
      args.priceToken1PerToken0 > 0 ? 1 / args.priceToken1PerToken0 : Number.NaN
  } else {
    return null
  }

  if (!Number.isFinite(usdcPerWeth) || usdcPerWeth <= 0) return null
  const wethUsdcRaw = BigInt(
    Math.round(Number(formatUnits(wethRaw, 18)) * usdcPerWeth * 1_000_000),
  )
  return wethUsdcRaw + usdcRaw
}

export type PnlSample = { pnl: bigint; sampled: number; skipped: number }
