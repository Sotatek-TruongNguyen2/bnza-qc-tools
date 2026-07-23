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
  /** Entry capital still in open positions. */
  totalUsdc: string
  totalUsdcHuman: string
  uniswapUsdc: string
  uniswapUsdcHuman: string
  hyperliquidUsdc: string
  hyperliquidUsdcHuman: string
  /** Entry capital from positions that are now closed. */
  closedTotalUsdc: string
  closedTotalUsdcHuman: string
  closedUniswapUsdc: string
  closedUniswapUsdcHuman: string
  closedHyperliquidUsdc: string
  closedHyperliquidUsdcHuman: string
  /** Live open + realized closed Uniswap leg PnL. */
  uniswapPnlUsdc: string
  uniswapPnlUsdcHuman: string
  /** Assumed flat without per-position HL equity. */
  hlPnlUsdc: string
  hlPnlUsdcHuman: string
  totalPnlUsdc: string
  totalPnlUsdcHuman: string
  uniswapPnlSampled: number
  uniswapPnlSkipped: number
  hlPnlNote: string
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
