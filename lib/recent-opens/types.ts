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
}

export type RecentOpensStats = {
  openCount: number
  uniqueUsers: number
  uniqueBots: number
  totalUsdc: string
  totalUsdcHuman: string
  uniswapUsdc: string
  uniswapUsdcHuman: string
  hyperliquidUsdc: string
  hyperliquidUsdcHuman: string
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
