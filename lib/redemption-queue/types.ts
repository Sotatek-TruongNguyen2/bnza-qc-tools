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
  /** Redeem/close executeStrategy tx that called createRequest (RequestCreated). */
  closeTxHash: string | null
  basescanCloseTx: string | null
  closeBlockNumber: string | null
}

export type RedemptionQueueStats = {
  pendingCount: number
  headRequestId: string | null
  oldestWaitSeconds: number | null
  oldestWaitLabel: string | null
  avgWaitSeconds: number | null
  avgWaitLabel: string | null
  /** Distinct close txs that enqueued the current pending set. */
  uniqueCloseTxCount: number
}

export type RedemptionCloseTxSummary = {
  closeTxHash: string
  basescanCloseTx: string
  requestIds: string[]
}

export type RedemptionQueueResult = {
  queueAddress: string
  basescanQueue: string
  fetchedAtIso: string
  stats: RedemptionQueueStats
  pending: RedemptionPendingRequest[]
  /** Unique close txs for current pending requests (newest-ish order by request id). */
  closeTxs: RedemptionCloseTxSummary[]
  warnings: string[]
}
