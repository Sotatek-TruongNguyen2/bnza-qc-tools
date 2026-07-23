import { parseAbiItem } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import {
  REDEMPTION_CLOSE_TX_LOOKUP_CONCURRENCY,
  REDEMPTION_QUEUE_ADDRESS,
  REQUEST_CREATED_EVENT,
} from './constants'

export type CloseTxLookup = {
  closeTxHash: string | null
  basescanCloseTx: string | null
  closeBlockNumber: string | null
}

/**
 * Trace redeem/close tx that enqueued each request via RequestCreated
 * (same tx as RedeemStrategy → createRequest).
 * Uses indexed requestId topic so providers can search without a tight block window.
 */
export async function resolveCloseTxsForRequests(
  client: BasePublicClient,
  requestIds: string[],
  warnings: string[],
): Promise<Map<string, CloseTxLookup>> {
  const out = new Map<string, CloseTxLookup>()
  const event = parseAbiItem(REQUEST_CREATED_EVENT)
  const unique = [...new Set(requestIds.filter((id) => /^\d+$/.test(id)))]

  for (let i = 0; i < unique.length; i += REDEMPTION_CLOSE_TX_LOOKUP_CONCURRENCY) {
    const batch = unique.slice(i, i + REDEMPTION_CLOSE_TX_LOOKUP_CONCURRENCY)
    await Promise.all(
      batch.map(async (id) => {
        try {
          const logs = await client.getLogs({
            address: REDEMPTION_QUEUE_ADDRESS,
            event,
            args: { requestId: BigInt(id) },
            fromBlock: 0n,
            toBlock: 'latest',
          })
          const log = logs[0]
          const hash = log?.transactionHash ?? null
          out.set(id, {
            closeTxHash: hash,
            basescanCloseTx: hash ? `https://basescan.org/tx/${hash}` : null,
            closeBlockNumber: log?.blockNumber != null ? log.blockNumber.toString() : null,
          })
          if (!hash) {
            warnings.push(`No RequestCreated log found for requestId ${id}`)
          }
        } catch (err) {
          warnings.push(formatRpcError(err, `RequestCreated lookup failed for requestId ${id}`))
          out.set(id, {
            closeTxHash: null,
            basescanCloseTx: null,
            closeBlockNumber: null,
          })
        }
      }),
    )
  }

  return out
}
