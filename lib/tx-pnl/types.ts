export type TxPnlResult = {
  raw: {
    chainId: number
    network: string
    txHash: string
    tokenId: string
    openedAtIso: string
    poolAddress: string
    txFrom: string
    txTo: string | null
    entryTotalUsdc: string
    entryUniswapUsdc: string
    entryHyperliquidUsdc: string
    currentPrincipalUsdc: string
    currentFeesUsdc: string
    currentTotalUsdc: string
    principalOnlyPnlUsdc: string
    totalPnlUsdc: string
    principalOnlyPnlPct: number
    totalPnlPct: number
    currentPriceUsdcPerWeth: number
    currentPrincipalAmount0: string
    currentPrincipalAmount1: string
    currentUncollectedFees0: string
    currentUncollectedFees1: string
    token0Symbol: string
    token1Symbol: string
    links: {
      tx: string
      pool: string
      positionManager: string
      owner: string
    }
  }
  human: {
    summary: string
    tokenId: string
    entryUniswapUsdc: string
    currentPrincipalUsdc: string
    currentFeesUsdc: string
    currentTotalUsdc: string
    principalOnlyPnl: string
    totalPnl: string
    principalOnlyPnlPct: string
    totalPnlPct: string
    entrySplit: string
    currentPrice: string
    currentPrincipal: {
      token0: string
      token1: string
    }
    currentUncollectedFees: {
      token0: string
      token1: string
      note: string
    }
    caveats: string[]
    links: TxPnlResult['raw']['links']
  }
}
