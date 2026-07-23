import { parseAbi } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { tickSpacingForFee } from './range-chart-math'

const POOL_TICK_ABI = parseAbi([
  'function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)',
])

export type LiquidityDensityPoint = {
  tick: number
  liquidityGross: string
}

/**
 * Sample initialized tick liquidityGross across a view window for the density chart.
 * Caps RPC load — skips uninitialized ticks (gross = 0).
 */
export async function fetchLiquidityDensity(
  client: BasePublicClient,
  args: {
    poolAddress: `0x${string}`
    fee: number
    viewMinTick: number
    viewMaxTick: number
    maxSamples?: number
  },
): Promise<LiquidityDensityPoint[]> {
  const spacing = tickSpacingForFee(args.fee)
  const maxSamples = args.maxSamples ?? 48

  const start = Math.ceil(args.viewMinTick / spacing) * spacing
  const end = Math.floor(args.viewMaxTick / spacing) * spacing
  if (end < start) return []

  const allTicks: number[] = []
  for (let t = start; t <= end; t += spacing) allTicks.push(t)

  // Subsample evenly if too many ticks
  const step = Math.max(1, Math.ceil(allTicks.length / maxSamples))
  const sampled = allTicks.filter((_, i) => i % step === 0)

  const results = await client.multicall({
    contracts: sampled.map((tick) => ({
      address: args.poolAddress,
      abi: POOL_TICK_ABI,
      functionName: 'ticks' as const,
      args: [tick] as const,
    })),
    allowFailure: true,
  })

  const points: LiquidityDensityPoint[] = []
  for (let i = 0; i < sampled.length; i++) {
    const r = results[i]
    if (r.status !== 'success') continue
    const liquidityGross = r.result[0] as bigint
    if (liquidityGross === 0n) continue
    points.push({ tick: sampled[i]!, liquidityGross: liquidityGross.toString() })
  }
  return points
}
