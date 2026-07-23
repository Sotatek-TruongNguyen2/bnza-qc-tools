import { parseAbiItem } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import {
  RECENT_OPENS_LOG_CHUNK_BLOCKS,
  RECENT_OPENS_LOGS_CONCURRENCY,
} from '@/lib/recent-opens/constants'
import {
  REDEMPTION_QUEUE_ADDRESS,
  REQUEST_CREATED_EVENT,
} from './constants'

export type CloseTxLookup = {
  closeTxHash: string | null
  basescanCloseTx: string | null
  closeBlockNumber: string | null
}

type RequestHint = {
  requestId: string
  createdAtUnix: number
}

/** Base ~2s/block; pad so we don't miss RequestCreated around createdAt. */
function lookbackBlocksForAge(oldestAgeSec: number): bigint {
  const blocks = Math.ceil(oldestAgeSec / 2) + 25_000
  const capped = Math.min(Math.max(blocks, 30_000), 250_000)
  return BigInt(capped)
}

/**
 * Trace redeem/close txs via RequestCreated (same tx as createRequest).
 * Chunked eth_getLogs over a window covering the oldest pending createdAt —
 * avoids fromBlock=0 / full-chain scans that break Alchemy & many public RPCs
 * ("JSON is not a valid request object").
 */
export async function resolveCloseTxsForRequests(
  client: BasePublicClient,
  requests: RequestHint[],
  warnings: string[],
): Promise<Map<string, CloseTxLookup>> {
  const out = new Map<string, CloseTxLookup>()
  const unique = requests.filter((r) => /^\d+$/.test(r.requestId))
  for (const r of unique) {
    out.set(r.requestId, {
      closeTxHash: null,
      basescanCloseTx: null,
      closeBlockNumber: null,
    })
  }
  if (unique.length === 0) return out

  const nowSec = Math.floor(Date.now() / 1000)
  const oldestCreated = Math.min(...unique.map((r) => r.createdAtUnix))
  const oldestAgeSec = Math.max(0, nowSec - oldestCreated)

  const latest = await client.getBlockNumber()
  const lookback = lookbackBlocksForAge(oldestAgeSec)
  const fromBlock = latest > lookback ? latest - lookback : 0n
  const toBlock = latest

  const event = parseAbiItem(REQUEST_CREATED_EVENT)
  const wanted = new Set(unique.map((r) => r.requestId))

  const ranges: { from: bigint; to: bigint }[] = []
  for (let start = fromBlock; start <= toBlock; start += RECENT_OPENS_LOG_CHUNK_BLOCKS + 1n) {
    const end =
      start + RECENT_OPENS_LOG_CHUNK_BLOCKS > toBlock
        ? toBlock
        : start + RECENT_OPENS_LOG_CHUNK_BLOCKS
    ranges.push({ from: start, to: end })
  }

  for (let i = 0; i < ranges.length; i += RECENT_OPENS_LOGS_CONCURRENCY) {
    const batch = ranges.slice(i, i + RECENT_OPENS_LOGS_CONCURRENCY)
    const parts = await Promise.all(
      batch.map(async ({ from, to }) => {
        try {
          return await client.getLogs({
            address: REDEMPTION_QUEUE_ADDRESS,
            event,
            fromBlock: from,
            toBlock: to,
          })
        } catch (err) {
          warnings.push(
            formatRpcError(
              err,
              `RequestCreated getLogs failed ${from.toString()}–${to.toString()}`,
            ),
          )
          return []
        }
      }),
    )

    for (const logs of parts) {
      for (const log of logs) {
        const args = log.args as { requestId?: bigint }
        if (args.requestId == null) continue
        const id = args.requestId.toString()
        if (!wanted.has(id)) continue
        const hash = log.transactionHash ?? null
        if (!hash) continue
        out.set(id, {
          closeTxHash: hash,
          basescanCloseTx: `https://basescan.org/tx/${hash}`,
          closeBlockNumber: log.blockNumber != null ? log.blockNumber.toString() : null,
        })
      }
    }
  }

  for (const r of unique) {
    if (!out.get(r.requestId)?.closeTxHash) {
      warnings.push(
        `No RequestCreated in last ${lookback.toString()} blocks for requestId ${r.requestId}`,
      )
    }
  }

  return out
}
