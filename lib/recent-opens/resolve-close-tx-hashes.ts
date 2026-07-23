import { parseAbiItem, type Hex } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import {
  POSITION_LIQUIDATED_EVENT,
  RECENT_OPENS_LOGS_CONCURRENCY,
  RECENT_OPENS_LOG_CHUNK_BLOCKS,
  REDEEM_STRATEGY_ADDRESS,
} from './constants'

type CloseTxHit = { txHash: Hex; blockNumber: bigint }

/**
 * Map Uniswap NFT tokenId → EXBOT redeem/close tx hash (PositionLiquidated).
 * When multiple liquidations exist for a tokenId, keep the latest by block.
 */
export async function resolveCloseTxHashesByTokenId(
  client: BasePublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  warnings: string[],
): Promise<Map<string, Hex>> {
  const event = parseAbiItem(POSITION_LIQUIDATED_EVENT)
  const ranges: { from: bigint; to: bigint }[] = []
  for (let start = fromBlock; start <= toBlock; start += RECENT_OPENS_LOG_CHUNK_BLOCKS + 1n) {
    const end =
      start + RECENT_OPENS_LOG_CHUNK_BLOCKS > toBlock
        ? toBlock
        : start + RECENT_OPENS_LOG_CHUNK_BLOCKS
    ranges.push({ from: start, to: end })
  }

  const best = new Map<string, CloseTxHit>()

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
            formatRpcError(
              err,
              `PositionLiquidated getLogs failed ${from.toString()}–${to.toString()}`,
            ),
          )
          return []
        }
      }),
    )

    for (const part of parts) {
      for (const log of part) {
        const tokenId = log.args.tokenId
        const txHash = log.transactionHash
        const blockNumber = log.blockNumber
        if (tokenId == null || txHash == null || blockNumber == null) continue
        const key = tokenId.toString()
        const prev = best.get(key)
        if (!prev || blockNumber >= prev.blockNumber) {
          best.set(key, { txHash, blockNumber })
        }
      }
    }
  }

  const out = new Map<string, Hex>()
  for (const [tokenId, hit] of best) out.set(tokenId, hit.txHash)
  return out
}
