export type CloseEstimateParams = {
  /** Operation fee on earned fees (bps). EXBOT default 50 = 0.5%. */
  operationFeeBps: number
  /** Performance fee on earned fees after op fee (bps). EXBOT default 3000 = 30%. */
  performanceFeeBps: number
  /** Min earned USDC (6 decimals) before op/PF apply. EXBOT default $10. */
  minEarnedUsdc: number
  /** Slippage + pool fee haircut on principal swap to USDC (bps). Default 100 = 1%. */
  swapSlippageBps: number
}

export type CloseEstimateBreakdown = {
  principalUsdcDirect: string
  principalUsdcFromSwap: string
  principalUsdcTotal: string
  earnedGrossUsdcEquiv: string
  earnedNetUsdcEquiv: string
  earnedFeesCharged: boolean
  earnedFeeNote: string
  operationFeeUsdcEquiv: string
  performanceFeeUsdcEquiv: string
  totalUsdcSpot: string
  totalUsdcConservative: string
  assumptions: string[]
}

export type CloseEstimateResult = {
  params: CloseEstimateParams
  breakdown: CloseEstimateBreakdown
  human: {
    principalUsdc: string
    earnedNetUsdc: string
    totalSpot: string
    totalConservative: string
  }
}
