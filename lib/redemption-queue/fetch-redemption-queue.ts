import { getAddress, type Hex } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { basescanLink } from '@/lib/position/format'
import {
  BASESCAN_QUEUE,
  REDEMPTION_QUEUE_ABI,
  REDEMPTION_QUEUE_ADDRESS,
} from './constants'
import type { RedemptionPendingRequest, RedemptionQueueResult } from './types'

function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) {
    const s = seconds % 60
    return s > 0 ? `${mins}m ${s}s` : `${mins}m`
  }
  const hours = Math.floor(mins / 60)
  const m = mins % 60
  if (hours < 48) return m > 0 ? `${hours}h ${m}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const h = hours % 24
  return h > 0 ? `${days}d ${h}h` : `${days}d`
}

/**
 * Pending FIFO via Multicall3 only (no eth_getLogs).
 * Contract views: pendingQueueLength, nextPendingRequestId,
 * pendingRequestAt(i), getRequest(id).
 */
export async function fetchRedemptionQueue(
  client: BasePublicClient,
): Promise<RedemptionQueueResult> {
  const nowSec = Math.floor(Date.now() / 1000)

  const [pendingCountRaw, headRaw] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: REDEMPTION_QUEUE_ADDRESS,
        abi: REDEMPTION_QUEUE_ABI,
        functionName: 'pendingQueueLength',
      },
      {
        address: REDEMPTION_QUEUE_ADDRESS,
        abi: REDEMPTION_QUEUE_ABI,
        functionName: 'nextPendingRequestId',
      },
    ],
  })

  const pendingCount = Number(pendingCountRaw)
  const headRequestId = headRaw === 0n ? null : headRaw.toString()

  let pending: RedemptionPendingRequest[] = []

  if (pendingCount > 0) {
    const requestIds = (await client.multicall({
      allowFailure: false,
      contracts: Array.from({ length: pendingCount }, (_, i) => ({
        address: REDEMPTION_QUEUE_ADDRESS,
        abi: REDEMPTION_QUEUE_ABI,
        functionName: 'pendingRequestAt' as const,
        args: [BigInt(i)] as const,
      })),
    })) as readonly bigint[]

    const reqResults = await client.multicall({
      allowFailure: false,
      contracts: requestIds.map((id) => ({
        address: REDEMPTION_QUEUE_ADDRESS,
        abi: REDEMPTION_QUEUE_ABI,
        functionName: 'getRequest' as const,
        args: [id] as const,
      })),
    })

    pending = requestIds.map((id, queueIndex) => {
      const req = reqResults[queueIndex]!
      const createdAtUnix = Number(req.createdAt)
      const waitSeconds = Math.max(0, nowSec - createdAtUnix)
      const createdAtIso = new Date(createdAtUnix * 1000).toISOString()
      const user = getAddress(req.user)

      return {
        requestId: id.toString(),
        queueIndex,
        isHead: queueIndex === 0,
        user,
        botId: req.botId as Hex,
        positionId: req.positionId.toString(),
        hlPortionId: req.hlPortionId as Hex,
        createdAtUnix,
        createdAtIso,
        waitSeconds,
        waitLabel: formatWait(waitSeconds),
        basescanUser: basescanLink(user),
      }
    })
  }

  const waits = pending.map((p) => p.waitSeconds)
  const oldestWaitSeconds = waits.length > 0 ? Math.max(...waits) : null
  const avgWaitSeconds =
    waits.length > 0 ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null

  return {
    queueAddress: REDEMPTION_QUEUE_ADDRESS,
    basescanQueue: BASESCAN_QUEUE,
    fetchedAtIso: new Date().toISOString(),
    stats: {
      pendingCount,
      headRequestId,
      oldestWaitSeconds,
      oldestWaitLabel: oldestWaitSeconds == null ? null : formatWait(oldestWaitSeconds),
      avgWaitSeconds,
      avgWaitLabel: avgWaitSeconds == null ? null : formatWait(avgWaitSeconds),
    },
    pending,
  }
}
