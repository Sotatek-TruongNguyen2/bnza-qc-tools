import type { TxPnlCalcHints } from './build-tx-pnl-calc-hints'

export type { TxPnlCalcHints } from './build-tx-pnl-calc-hints'

export type TxPnlHlLeg = {
  entryHyperliquidUsdc: string
  currentHlTotalUsdc: string
  hlTotalPnlUsdc: string
  hlTotalPnlPct: number
}

export type TxPnlCombinedLeg = {
  currentCombinedTotalUsdc: string
  combinedTotalPnlUsdc: string
  combinedTotalPnlPct: number
}

export type TxPnlPositionStatus = 'open' | 'closed'

export type TxPnlResult = {
  raw: {
    chainId: number
    network: string
    txHash: string
    closeTxHash: string | null
    tokenId: string
    openedAtIso: string
    poolAddress: string
    txFrom: string
    txTo: string | null
    positionStatus: TxPnlPositionStatus
    needsCloseTx: boolean
    pnlMode: 'live' | 'realized' | 'closed-needs-close-tx'
    entryTotalUsdc: string
    entryUniswapUsdc: string
    entryHyperliquidUsdc: string
    currentPrincipalUsdc: string
    currentFeesUsdc: string
    currentTotalUsdc: string
    principalOnlyPnlUsdc: string | null
    totalPnlUsdc: string | null
    principalOnlyPnlPct: number | null
    totalPnlPct: number | null
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
      closeTx: string | null
      pool: string
      positionManager: string
      owner: string
    }
  }
  human: {
    summary: string
    tokenId: string
    positionStatus: TxPnlPositionStatus
    needsCloseTx: boolean
    pnlMode: 'live' | 'realized' | 'closed-needs-close-tx'
    closedNotice: string | null
    entryUniswapUsdc: string
    entryHyperliquidUsdc: string
    entryTotalUsdc: string
    currentPrincipalUsdc: string
    currentFeesUsdc: string
    currentTotalUsdc: string
    principalOnlyPnl: string | null
    totalPnl: string | null
    principalOnlyPnlPct: string | null
    totalPnlPct: string | null
    hlLeg: {
      entryHyperliquidUsdc: string
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
    calcHints: TxPnlCalcHints
    caveats: string[]
    links: TxPnlResult['raw']['links']
  }
}
