export type PositionRaw = {
  chainId: number
  network: string
  tokenId: string
  owner: string
  operator: string
  nonce: string
  token0: string
  token1: string
  token0Symbol: string
  token1Symbol: string
  token0Decimals: number
  token1Decimals: number
  pair: string
  fee: number
  feeLabel: string
  tickLower: number
  tickUpper: number
  currentTick: number
  rangeStatus: string
  liquidity: string
  poolAddress: string
  sqrtPriceX96: string
  feeGrowthInside0LastX128: string
  feeGrowthInside1LastX128: string
  tokensOwed0: string
  tokensOwed1: string
  uncollectedFees0: string
  uncollectedFees1: string
  uncollectedFeesSource: string
  principalAmount0: string
  principalAmount1: string
  priceToken1PerToken0AtLowerTick: number
  priceToken1PerToken0AtUpperTick: number
  priceToken1PerToken0AtCurrentTick: number
  priceToken0PerToken1AtCurrentTick: number | null
  npmAddress: string
  factoryAddress: string
  basescan: {
    positionNft: string
    owner: string
    pool: string
    token0: string
    token1: string
  }
}

export type PositionHuman = {
  summary: string
  owner: string
  status: string
  tickRange: string
  prices: {
    atLowerTick: string
    atUpperTick: string
    atCurrentTick: string
    inverseAtCurrentTick: string
  }
  principal: { token0: string; token1: string }
  uncollectedFees: { token0: string; token1: string; note: string }
  liquidity: string
  poolAddress: string
  links: PositionRaw['basescan']
}

export type PositionResult = {
  raw: PositionRaw
  human: PositionHuman
}

export type PositionOpenPrice = {
  found: boolean
  txHash: string | null
  blockNumber: string | null
  openedAtIso: string | null
  openedAtLabel: string | null
  tick: number | null
  sqrtPriceX96: string | null
  priceToken1PerToken0: number | null
  priceToken0PerToken1: number | null
  /** Raw token amounts deposited at first mint (IncreaseLiquidity). */
  principalAmount0: string | null
  principalAmount1: string | null
  liquidity: string | null
  source: 'swap_event' | 'slot0_parent' | null
  note: string | null
  error: string | null
  links: { tx: string | null }
}
