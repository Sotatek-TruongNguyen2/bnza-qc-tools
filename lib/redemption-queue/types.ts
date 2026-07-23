export type RedemptionPendingRequest = {
  /** On-chain requestId from getRequest / RequestCreated (not queue index). */
  requestId: string
  /** Topic-style uint256 hex (64 nibbles) as shown on Basescan. */
  requestIdHex: string
  queueIndex: number
  isHead: boolean
  user: string
  botId: string
  positionId: string
  hlPortionId: string
  createdAtUnix: number
  createdAtIso: string
  waitSeconds: number
  waitLabel: string
  basescanUser: string
}

export type RedemptionQueueStats = {
  pendingCount: number
  headRequestId: string | null
  oldestWaitSeconds: number | null
  oldestWaitLabel: string | null
  avgWaitSeconds: number | null
  avgWaitLabel: string | null
}

export type RedemptionQueueResult = {
  queueAddress: string
  basescanQueue: string
  fetchedAtIso: string
  stats: RedemptionQueueStats
  pending: RedemptionPendingRequest[]
}
