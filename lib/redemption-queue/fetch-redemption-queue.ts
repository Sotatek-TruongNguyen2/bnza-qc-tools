import { getAddress, parseAbiItem, type Hex } from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import { basescanLink } from '@/lib/position/format'
import {
  BASESCAN_QUEUE,
  FULFILL_LOOKBACK_BLOCKS,
  LOGS_CHUNK_BLOCKS,
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

async function countRecentFulfills(
  client: BasePublicClient,
  warnings: string[],
): Promise<number | null> {
  try {
    const latest = await client.getBlockNumber()
    const fromBlock = latest > FULFILL_LOOKBACK_BLOCKS ? latest - FULFILL_LOOKBACK_BLOCKS : 0n
    const event = parseAbiItem(
      'event RequestFulfilled(uint256 indexed requestId, address indexed user, bytes32 indexed hlPortionId, address operator, bytes32 botId, uint256 positionId, address wlRecipient, address[] tokens, uint256[] principalAmounts, uint256[] profitAmounts)',
    )

    let total = 0
    for (let start = fromBlock; start <= latest; start += LOGS_CHUNK_BLOCKS + 1n) {
      const end = start + LOGS_CHUNK_BLOCKS > latest ? latest : start + LOGS_CHUNK_BLOCKS
      const logs = await client.getLogs({
        address: REDEMPTION_QUEUE_ADDRESS,
        event,
        fromBlock: start,
        toBlock: end,
      })
      total += logs.length
    }
    return total
  } catch (err) {
    warnings.push(formatRpcError(err, 'Could not scan recent RequestFulfilled logs'))
    return null
  }
}

export async function fetchRedemptionQueue(
  client: BasePublicClient,
): Promise<RedemptionQueueResult> {
  const warnings: string[] = []
  const nowSec = Math.floor(Date.now() / 1000)

  const [pendingCountRaw, headRaw] = await Promise.all([
    client.readContract({
      address: REDEMPTION_QUEUE_ADDRESS,
      abi: REDEMPTION_QUEUE_ABI,
      functionName: 'pendingQueueLength',
    }),
    client.readContract({
      address: REDEMPTION_QUEUE_ADDRESS,
      abi: REDEMPTION_QUEUE_ABI,
      functionName: 'nextPendingRequestId',
    }),
  ])

  const pendingCount = Number(pendingCountRaw)
  const headRequestId = headRaw === 0n ? null : headRaw.toString()

  let pending: RedemptionPendingRequest[] = []

  if (pendingCount > 0) {
    const idResults = await client.multicall({
      allowFailure: false,
      contracts: Array.from({ length: pendingCount }, (_, i) => ({
        address: REDEMPTION_QUEUE_ADDRESS,
        abi: REDEMPTION_QUEUE_ABI,
        functionName: 'pendingRequestAt' as const,
        args: [BigInt(i)] as const,
      })),
    })

    const requestIds = idResults as readonly bigint[]

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

  const fulfilledRecentCount = await countRecentFulfills(client, warnings)

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
      fulfilledRecentCount,
      fulfillLookbackLabel: '~7 days',
    },
    pending,
    warnings,
  }
}
