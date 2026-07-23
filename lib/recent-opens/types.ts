/** Live EXBOT status from getPositionDeployment.active. */
export type RecentOpenStatus = 'open' | 'closed' | 'unknown'

export type RecentOpenRow = {
  tokenId: string
  positionId: string
  owner: string
  botId: string
  pool: string
  tickLower: number
  tickUpper: number
  totalUsdc: string
  uniswapUsdc: string
  hyperliquidUsdc: string
  totalUsdcHuman: string
  blockNumber: string
  txHash: string
  basescanTx: string
  basescanOwner: string
  /** Current on-chain status (not “opened in window”). */
  status: RecentOpenStatus
}

export type RecentOpensStats = {
  /** PositionOpened events in the lookback window. */
  openCount: number
  stillOpenCount: number
  closedCount: number
  unknownCount: number
  uniqueUsers: number
  uniqueBots: number
  /** Entry capital across all opens in the window. */
  totalUsdc: string
  totalUsdcHuman: string
  uniswapUsdc: string
  uniswapUsdcHuman: string
  hyperliquidUsdc: string
  hyperliquidUsdcHuman: string
  /** Uniswap entry capital for positions that are now closed. */
  closedUniswapUsdc: string
  closedUniswapUsdcHuman: string
  /** Live open + realized closed Uniswap leg PnL. */
  uniswapPnlUsdc: string
  uniswapPnlUsdcHuman: string
  uniswapPnlSampled: number
  uniswapPnlSkipped: number
}

export type RecentOpensResult = {
  positionManager: string
  lookbackBlocks: string
  lookbackApproxLabel: string
  fromBlock: string
  toBlock: string
  fetchedAtIso: string
  reloadEveryMs: number
  stats: RecentOpensStats
  /** Newest first. */
  opens: RecentOpenRow[]
  warnings: string[]
}
