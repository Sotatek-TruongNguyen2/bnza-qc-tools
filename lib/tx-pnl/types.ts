export type TxPnlHlLeg = {
  hlSizeUsdc: number
  openPriceUsdcPerWeth: number
  currentHlUnrealizedPnlUsdc: string
  currentHlTotalUsdc: string
  hlTotalPnlUsdc: string
  hlTotalPnlPct: number
}

export type TxPnlCombinedLeg = {
  currentCombinedTotalUsdc: string
  combinedTotalPnlUsdc: string
  combinedTotalPnlPct: number
}

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
    hlLeg: TxPnlHlLeg | null
    combinedLeg: TxPnlCombinedLeg | null
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
    entryTotalUsdc: string
    currentPrincipalUsdc: string
    currentFeesUsdc: string
    currentTotalUsdc: string
    principalOnlyPnl: string
    totalPnl: string
    principalOnlyPnlPct: string
    totalPnlPct: string
    hlLeg: {
      hlSizeUsdc: string
      openPrice: string
      currentHlUnrealizedPnl: string
      currentHlTotal: string
      hlTotalPnl: string
      hlTotalPnlPct: string
    } | null
    combinedLeg: {
      currentCombinedTotal: string
      combinedTotalPnl: string
      combinedTotalPnlPct: string
    } | null
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
