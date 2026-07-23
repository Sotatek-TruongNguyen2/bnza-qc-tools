export type BotPositionSummary = {
  tokenId: string
  positionId: string
  active: boolean
  totalUsdc: string
  uniswapUsdc: string
  hyperliquidUsdc: string
  deployedCapitalForPosition: string
  pool: string
  tickLower: number
  tickUpper: number
  liquidity: string
  openedAt: string
  openedAtIso: string | null
}

export type BotRaw = {
  network: string
  chainId: number
  user: string
  botIdInput: string
  botIdBytes32: string
  vaultAddress: string
  positionManagerAddress: string
  depositToken: string
  depositTokenSymbol: string
  usdcAddress: string
  unspentBalance: string
  deployedCapital: string
  wlMaster: string
  vaultPaused: boolean
  positionCount: string
  positionOpenCount: string
  tokenIds: string[]
  positions: BotPositionSummary[]
}

export type BotResult = {
  raw: BotRaw
  human: {
    summary: string
    capitalState: string
    user: string
    botIdInput: string
    botIdBytes32: string
    depositToken: string
    depositTokenSymbol: string
    depositTokenLabel: string
    unspentUsdc: string
    deployedUsdc: string
    totalTrackedUsdc: string
    wlMaster: string | null
    vaultPaused: boolean
    positionCount: number
    positions: {
      tokenId: string
      positionId: string
      active: boolean
      totalUsdc: string
      uniswapUsdc: string
      hyperliquidUsdc: string
      tickRange: string
      liquidity: string
      openedAt: string
      openedAtIso: string | null
      positionLink: string
    }[]
    links: {
      user: string
      vault: string
      positionManager: string
      depositToken: string
    }
  }
}
