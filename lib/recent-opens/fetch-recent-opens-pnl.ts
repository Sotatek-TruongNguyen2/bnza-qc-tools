import { formatUnits, getAddress, parseAbiItem } from 'viem'
import { BASE_USDC_ADDRESS, BASE_WETH_ADDRESS } from '@/lib/base-known-tokens'
import {
  FACTORY_ABI,
  FACTORY_ADDRESS,
  NPM_ABI,
  NPM_ADDRESS,
  POOL_ABI,
} from '@/lib/position/constants'
import {
  getAmountsForLiquidity,
  getSqrtRatioAtTick,
  tickToPriceRatio,
} from '@/lib/position/format'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import {
  POSITION_LIQUIDATED_EVENT,
  CLOSE_FEES_COLLECTED_EVENT,
  RECENT_OPENS_LOGS_CONCURRENCY,
  RECENT_OPENS_LOG_CHUNK_BLOCKS,
  RECENT_OPENS_STATUS_MULTICALL_CHUNK,
  REDEEM_STRATEGY_ADDRESS,
} from './constants'
import type { RecentOpenRow } from './types'

export type RecentOpensPnlTotals = {
  uniswapPnlUsdc: string
  uniswapPnlUsdcHuman: string
  hlPnlUsdc: string
  hlPnlUsdcHuman: string
  totalPnlUsdc: string
  totalPnlUsdcHuman: string
  /** Rows included in Uniswap PnL (open live + closed realized). */
  uniswapPnlSampled: number
  uniswapPnlSkipped: number
  /** HL has no per-position live mark — assumed flat (0). */
  hlPnlNote: string
}

function formatSignedUsdc(raw: bigint): string {
  const sign = raw < 0n ? '−' : '+'
  const abs = raw < 0n ? -raw : raw
  return `${sign}${Number(formatUnits(abs, 6)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })} USDC`
}

function usdcFromWethUsdcLegs(args: {
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

async function getRedeemStrategyLogs(
  client: BasePublicClient,
  eventAbi: typeof POSITION_LIQUIDATED_EVENT | typeof CLOSE_FEES_COLLECTED_EVENT,
  fromBlock: bigint,
  toBlock: bigint,
  warnings: string[],
  label: string,
) {
  const event = parseAbiItem(eventAbi)
  const ranges: { from: bigint; to: bigint }[] = []
  for (let start = fromBlock; start <= toBlock; start += RECENT_OPENS_LOG_CHUNK_BLOCKS + 1n) {
    const end =
      start + RECENT_OPENS_LOG_CHUNK_BLOCKS > toBlock
        ? toBlock
        : start + RECENT_OPENS_LOG_CHUNK_BLOCKS
    ranges.push({ from: start, to: end })
  }

  const logs = []
  for (let i = 0; i < ranges.length; i += RECENT_OPENS_LOGS_CONCURRENCY) {
    const batch = ranges.slice(i, i + RECENT_OPENS_LOGS_CONCURRENCY)
    const parts = await Promise.all(
      batch.map(async ({ from, to }) => {
        try {
          return await client.getLogs({
            address: REDEEM_STRATEGY_ADDRESS,
            event,
            fromBlock: from,
            toBlock: to,
          })
        } catch (err) {
          warnings.push(
            formatRpcError(err, `${label} getLogs failed ${from.toString()}–${to.toString()}`),
          )
          return []
        }
      }),
    )
    for (const part of parts) logs.push(...part)
  }
  return logs
}

async function sumClosedUniswapPnl(
  client: BasePublicClient,
  closed: RecentOpenRow[],
  fromBlock: bigint,
  toBlock: bigint,
  warnings: string[],
): Promise<{ pnl: bigint; sampled: number; skipped: number }> {
  if (closed.length === 0) return { pnl: 0n, sampled: 0, skipped: 0 }

  const byTokenId = new Map(closed.map((r) => [r.tokenId, r]))

  const liquidatedLogs = await getRedeemStrategyLogs(
    client,
    POSITION_LIQUIDATED_EVENT,
    fromBlock,
    toBlock,
    warnings,
    'PositionLiquidated',
  )
  const feeLogs = await getRedeemStrategyLogs(
    client,
    CLOSE_FEES_COLLECTED_EVENT,
    fromBlock,
    toBlock,
    warnings,
    'CloseFeesCollected',
  )

  const principalByToken = new Map<string, bigint>()
  for (const log of liquidatedLogs) {
    const args = log.args as {
      tokenId?: bigint
      principalUsdc?: bigint
    }
    if (args.tokenId == null || args.principalUsdc == null) continue
    principalByToken.set(args.tokenId.toString(), args.principalUsdc)
  }

  const feesByToken = new Map<
    string,
    { token0: `0x${string}`; token1: `0x${string}`; fee0: bigint; fee1: bigint }
  >()
  for (const log of feeLogs) {
    const args = log.args as {
      tokenId?: bigint
      token0?: `0x${string}`
      token1?: `0x${string}`
      gross0?: bigint
      gross1?: bigint
      operationFee0?: bigint
      operationFee1?: bigint
      performanceFee0?: bigint
      performanceFee1?: bigint
    }
    if (
      args.tokenId == null ||
      args.token0 == null ||
      args.token1 == null ||
      args.gross0 == null ||
      args.gross1 == null ||
      args.operationFee0 == null ||
      args.operationFee1 == null ||
      args.performanceFee0 == null ||
      args.performanceFee1 == null
    ) {
      continue
    }
    feesByToken.set(args.tokenId.toString(), {
      token0: getAddress(args.token0),
      token1: getAddress(args.token1),
      fee0: args.gross0 - args.operationFee0 - args.performanceFee0,
      fee1: args.gross1 - args.operationFee1 - args.performanceFee1,
    })
  }

  // Spot for fee conversion — WETH/USDC 0.05% pool preferred.
  let spotUsdcPerWeth = 0
  try {
    const pool = await client.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [BASE_WETH_ADDRESS, BASE_USDC_ADDRESS, 500],
    })
    if (pool !== '0x0000000000000000000000000000000000000000') {
      const slot0 = await client.readContract({
        address: getAddress(pool),
        abi: POOL_ABI,
        functionName: 'slot0',
      })
      const tick = Number(slot0[1])
      const token0IsWeth =
        BASE_WETH_ADDRESS.toLowerCase() < BASE_USDC_ADDRESS.toLowerCase()
      const price = tickToPriceRatio(tick, token0IsWeth ? 18 : 6, token0IsWeth ? 6 : 18)
      spotUsdcPerWeth = token0IsWeth ? price : price > 0 ? 1 / price : 0
    }
  } catch (err) {
    warnings.push(formatRpcError(err, 'Failed to read WETH/USDC spot for closed fee PnL'))
  }

  let pnl = 0n
  let sampled = 0
  let skipped = 0
  for (const [tokenId, row] of byTokenId) {
    const principal = principalByToken.get(tokenId)
    if (principal == null) {
      skipped += 1
      continue
    }
    let feesUsdc = 0n
    const fees = feesByToken.get(tokenId)
    if (fees && spotUsdcPerWeth > 0) {
      const priced = usdcFromWethUsdcLegs({
        token0: fees.token0,
        token1: fees.token1,
        amount0: fees.fee0,
        amount1: fees.fee1,
        priceToken1PerToken0:
          fees.token0.toLowerCase() === BASE_WETH_ADDRESS.toLowerCase()
            ? spotUsdcPerWeth
            : spotUsdcPerWeth > 0
              ? 1 / spotUsdcPerWeth
              : 0,
      })
      if (priced != null) feesUsdc = priced
    }
    pnl += principal + feesUsdc - BigInt(row.uniswapUsdc)
    sampled += 1
  }

  return { pnl, sampled, skipped }
}

async function sumOpenUniswapPnl(
  client: BasePublicClient,
  openRows: Array<RecentOpenRow & { liveTokenId: string }>,
  warnings: string[],
): Promise<{ pnl: bigint; sampled: number; skipped: number }> {
  if (openRows.length === 0) return { pnl: 0n, sampled: 0, skipped: 0 }

  const chunk = RECENT_OPENS_STATUS_MULTICALL_CHUNK
  type Pos = {
    row: RecentOpenRow & { liveTokenId: string }
    token0: `0x${string}`
    token1: `0x${string}`
    fee: number
    tickLower: number
    tickUpper: number
    liquidity: bigint
    tokensOwed0: bigint
    tokensOwed1: bigint
  }
  const positions: Pos[] = []

  for (let i = 0; i < openRows.length; i += chunk) {
    const slice = openRows.slice(i, i + chunk)
    try {
      const results = await client.multicall({
        allowFailure: true,
        contracts: slice.map((row) => ({
          address: NPM_ADDRESS,
          abi: NPM_ABI,
          functionName: 'positions' as const,
          args: [BigInt(row.liveTokenId)] as const,
        })),
      })
      for (let j = 0; j < results.length; j++) {
        const r = results[j]!
        const row = slice[j]!
        if (r.status !== 'success') {
          warnings.push(`NPM.positions failed for tokenId ${row.liveTokenId}`)
          continue
        }
        const [
          ,
          ,
          token0Raw,
          token1Raw,
          fee,
          tickLower,
          tickUpper,
          liquidity,
          ,
          ,
          tokensOwed0,
          tokensOwed1,
        ] = r.result
        positions.push({
          row,
          token0: getAddress(token0Raw),
          token1: getAddress(token1Raw),
          fee: Number(fee),
          tickLower: Number(tickLower),
          tickUpper: Number(tickUpper),
          liquidity,
          tokensOwed0,
          tokensOwed1,
        })
      }
    } catch (err) {
      warnings.push(formatRpcError(err, 'NPM.positions multicall failed for open PnL'))
    }
  }

  const poolKeys = new Map<string, { token0: `0x${string}`; token1: `0x${string}`; fee: number }>()
  for (const p of positions) {
    const key = `${p.token0}-${p.token1}-${p.fee}`
    if (!poolKeys.has(key)) {
      poolKeys.set(key, { token0: p.token0, token1: p.token1, fee: p.fee })
    }
  }

  const poolAddrs = await client.multicall({
    allowFailure: true,
    contracts: [...poolKeys.values()].map((p) => ({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'getPool' as const,
      args: [p.token0, p.token1, p.fee] as const,
    })),
  })

  const keyList = [...poolKeys.keys()]
  const poolByKey = new Map<string, `0x${string}`>()
  for (let i = 0; i < keyList.length; i++) {
    const r = poolAddrs[i]!
    if (r.status === 'success' && r.result !== '0x0000000000000000000000000000000000000000') {
      poolByKey.set(keyList[i]!, getAddress(r.result))
    }
  }

  const uniquePools = [...new Set(poolByKey.values())]
  const slot0Results = await client.multicall({
    allowFailure: true,
    contracts: uniquePools.map((pool) => ({
      address: pool,
      abi: POOL_ABI,
      functionName: 'slot0' as const,
    })),
  })
  const slot0ByPool = new Map<string, { sqrtPriceX96: bigint; tick: number }>()
  for (let i = 0; i < uniquePools.length; i++) {
    const r = slot0Results[i]!
    if (r.status === 'success') {
      slot0ByPool.set(uniquePools[i]!.toLowerCase(), {
        sqrtPriceX96: r.result[0],
        tick: Number(r.result[1]),
      })
    }
  }

  let pnl = 0n
  let sampled = 0
  let skipped = 0
  for (const p of positions) {
    const key = `${p.token0}-${p.token1}-${p.fee}`
    const pool = poolByKey.get(key)
    const slot0 = pool ? slot0ByPool.get(pool.toLowerCase()) : undefined
    if (!slot0 || p.liquidity === 0n) {
      skipped += 1
      continue
    }

    const dec0 = p.token0.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() ? 6 : 18
    const dec1 = p.token1.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() ? 6 : 18
    // Only WETH/USDC supported for USDC mark (same as position PnL tool).
    const isWethUsdc =
      (p.token0.toLowerCase() === BASE_WETH_ADDRESS.toLowerCase() &&
        p.token1.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase()) ||
      (p.token0.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
        p.token1.toLowerCase() === BASE_WETH_ADDRESS.toLowerCase())
    if (!isWethUsdc) {
      skipped += 1
      continue
    }

    const priceToken1PerToken0 = tickToPriceRatio(slot0.tick, dec0, dec1)
    const { amount0, amount1 } = getAmountsForLiquidity(
      slot0.sqrtPriceX96,
      getSqrtRatioAtTick(p.tickLower),
      getSqrtRatioAtTick(p.tickUpper),
      p.liquidity,
    )
    const principalUsdc = usdcFromWethUsdcLegs({
      token0: p.token0,
      token1: p.token1,
      amount0,
      amount1,
      priceToken1PerToken0,
    })
    const feesUsdc = usdcFromWethUsdcLegs({
      token0: p.token0,
      token1: p.token1,
      amount0: p.tokensOwed0,
      amount1: p.tokensOwed1,
      priceToken1PerToken0,
    })
    if (principalUsdc == null || feesUsdc == null) {
      skipped += 1
      continue
    }
    pnl += principalUsdc + feesUsdc - BigInt(p.row.uniswapUsdc)
    sampled += 1
  }

  return { pnl, sampled, skipped }
}

/**
 * Aggregate Uniswap PnL (live open + realized closed) + HL assumed flat.
 */
export async function fetchRecentOpensPnlTotals(
  client: BasePublicClient,
  opens: RecentOpenRow[],
  liveTokenIdByKey: Map<string, string>,
  fromBlock: bigint,
  toBlock: bigint,
  warnings: string[],
): Promise<RecentOpensPnlTotals> {
  const openRows = opens
    .filter((r) => r.status === 'open')
    .map((r) => {
      const key = `${r.txHash}-${r.tokenId}`
      const liveTokenId = liveTokenIdByKey.get(key) ?? r.tokenId
      return { ...r, liveTokenId }
    })
  const closedRows = opens.filter((r) => r.status === 'closed')

  const [openPnl, closedPnl] = await Promise.all([
    sumOpenUniswapPnl(client, openRows, warnings),
    sumClosedUniswapPnl(client, closedRows, fromBlock, toBlock, warnings),
  ])

  const uniswapPnl = openPnl.pnl + closedPnl.pnl
  // No per-position HL equity on-chain — treat HL mark = entry (0 PnL).
  const hlPnl = 0n
  const totalPnl = uniswapPnl + hlPnl

  return {
    uniswapPnlUsdc: uniswapPnl.toString(),
    uniswapPnlUsdcHuman: formatSignedUsdc(uniswapPnl),
    hlPnlUsdc: hlPnl.toString(),
    hlPnlUsdcHuman: formatSignedUsdc(hlPnl),
    totalPnlUsdc: totalPnl.toString(),
    totalPnlUsdcHuman: formatSignedUsdc(totalPnl),
    uniswapPnlSampled: openPnl.sampled + closedPnl.sampled,
    uniswapPnlSkipped: openPnl.skipped + closedPnl.skipped,
    hlPnlNote: 'HL marked flat (entry) — no per-position live equity on-chain.',
  }
}
