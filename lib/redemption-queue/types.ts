export type RedemptionPendingRequest = {
  requestId: string
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
  /** Fulfilled events found in lookback window (null if log scan skipped/failed). */
  fulfilledRecentCount: number | null
  fulfillLookbackLabel: string
}

export type RedemptionQueueResult = {
  queueAddress: string
  basescanQueue: string
  fetchedAtIso: string
  stats: RedemptionQueueStats
  pending: RedemptionPendingRequest[]
  warnings: string[]
}
