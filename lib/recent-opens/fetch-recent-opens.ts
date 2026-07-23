import { formatUnits, getAddress, parseAbiItem, type Hex } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import { basescanLink } from '@/lib/position/format'
import {
  POSITION_MANAGER_ADDRESS,
  POSITION_OPENED_EVENT,
  RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS,
  RECENT_OPENS_LOGS_CONCURRENCY,
  RECENT_OPENS_LOG_CHUNK_BLOCKS,
  RECENT_OPENS_MAX_LOOKBACK_BLOCKS,
  RECENT_OPENS_MIN_LOOKBACK_BLOCKS,
  RECENT_OPENS_RELOAD_MS,
} from './constants'
import type { RecentOpenRow, RecentOpensResult } from './types'

function formatUsdc(raw: bigint): string {
  return `${Number(formatUnits(raw, 6)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })} USDC`
}

function approxLookbackLabel(blocks: bigint): string {
  const seconds = Number(blocks) * 2
  const hours = seconds / 3600
  if (hours < 48) return `~${Math.round(hours)}h @ ~2s/block`
  const days = hours / 24
  return `~${days.toFixed(1)}d @ ~2s/block`
}

export function clampLookbackBlocks(input?: string | null): bigint {
  if (input == null || input.trim() === '') return RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS
  if (!/^\d+$/.test(input.trim())) return RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS
  let n = BigInt(input.trim())
  if (n < RECENT_OPENS_MIN_LOOKBACK_BLOCKS) n = RECENT_OPENS_MIN_LOOKBACK_BLOCKS
  if (n > RECENT_OPENS_MAX_LOOKBACK_BLOCKS) n = RECENT_OPENS_MAX_LOOKBACK_BLOCKS
  return n
}

async function getPositionOpenedLogs(
  client: BasePublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  warnings: string[],
) {
  const event = parseAbiItem(POSITION_OPENED_EVENT)
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
            address: POSITION_MANAGER_ADDRESS,
            event,
            fromBlock: from,
            toBlock: to,
          })
        } catch (err) {
          warnings.push(
            formatRpcError(err, `getLogs failed for blocks ${from.toString()}–${to.toString()}`),
          )
          return []
        }
      }),
    )
    for (const part of parts) logs.push(...part)
  }
  return logs
}

export async function fetchRecentOpens(
  client: BasePublicClient,
  lookbackBlocks = RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS,
): Promise<RecentOpensResult> {
  const warnings: string[] = []
  const latest = await client.getBlockNumber()
  const fromBlock = latest > lookbackBlocks ? latest - lookbackBlocks : 0n
  const toBlock = latest

  const logs = await getPositionOpenedLogs(client, fromBlock, toBlock, warnings)

  const opens: RecentOpenRow[] = []
  for (const log of logs) {
    const args = log.args
    if (
      args.owner == null ||
      args.botId == null ||
      args.positionId == null ||
      args.tokenId == null ||
      args.pool == null ||
      args.tickLower == null ||
      args.tickUpper == null ||
      args.totalUsdc == null ||
      args.uniswapUsdc == null ||
      args.hyperliquidUsdc == null ||
      log.blockNumber == null ||
      log.transactionHash == null
    ) {
      continue
    }
    const owner = getAddress(args.owner)
    const totalUsdc = args.totalUsdc
    opens.push({
      tokenId: args.tokenId.toString(),
      positionId: args.positionId.toString(),
      owner,
      botId: args.botId as Hex,
      pool: getAddress(args.pool),
      tickLower: Number(args.tickLower),
      tickUpper: Number(args.tickUpper),
      totalUsdc: totalUsdc.toString(),
      uniswapUsdc: args.uniswapUsdc.toString(),
      hyperliquidUsdc: args.hyperliquidUsdc.toString(),
      totalUsdcHuman: formatUsdc(totalUsdc),
      blockNumber: log.blockNumber.toString(),
      txHash: log.transactionHash,
      basescanTx: `https://basescan.org/tx/${log.transactionHash}`,
      basescanOwner: basescanLink(owner),
    })
  }

  opens.sort((a, b) => {
    const bn = BigInt(b.blockNumber) - BigInt(a.blockNumber)
    if (bn !== 0n) return bn > 0n ? 1 : -1
    return b.tokenId.localeCompare(a.tokenId, undefined, { numeric: true })
  })

  let totalUsdc = 0n
  let uniswapUsdc = 0n
  let hyperliquidUsdc = 0n
  const users = new Set<string>()
  const bots = new Set<string>()
  for (const row of opens) {
    totalUsdc += BigInt(row.totalUsdc)
    uniswapUsdc += BigInt(row.uniswapUsdc)
    hyperliquidUsdc += BigInt(row.hyperliquidUsdc)
    users.add(row.owner.toLowerCase())
    bots.add(row.botId.toLowerCase())
  }

  return {
    positionManager: POSITION_MANAGER_ADDRESS,
    lookbackBlocks: lookbackBlocks.toString(),
    lookbackApproxLabel: approxLookbackLabel(lookbackBlocks),
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    fetchedAtIso: new Date().toISOString(),
    reloadEveryMs: RECENT_OPENS_RELOAD_MS,
    stats: {
      openCount: opens.length,
      uniqueUsers: users.size,
      uniqueBots: bots.size,
      totalUsdc: totalUsdc.toString(),
      totalUsdcHuman: formatUsdc(totalUsdc),
      uniswapUsdc: uniswapUsdc.toString(),
      uniswapUsdcHuman: formatUsdc(uniswapUsdc),
      hyperliquidUsdc: hyperliquidUsdc.toString(),
      hyperliquidUsdcHuman: formatUsdc(hyperliquidUsdc),
    },
    opens,
    warnings,
  }
}
