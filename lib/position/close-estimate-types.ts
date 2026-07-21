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

export type CloseEstimateLine = {
  label: string
  value: string
}

export type CloseEstimateCalcSection = {
  title: string
  summary: string
  formula: string
  inputs: CloseEstimateLine[]
  steps: CloseEstimateLine[]
  result: string
}

export type CloseEstimateBreakdown = {
  principalUsdcDirect: string
  principalUsdcFromSwap: string
  principalUsdcSpotSwap: string
  principalUsdcTotal: string
  principalUsdcSpotTotal: string
  earnedGrossUsdcEquiv: string
  earnedNetUsdcEquiv: string
  earnedFeesCharged: boolean
  earnedFeeNote: string
  earnedNet0: string
  earnedNet1: string
  operationFeeUsdcEquiv: string
  performanceFeeUsdcEquiv: string
  totalUsdcSpot: string
  totalUsdcConservative: string
  assumptions: string[]
  details: {
    principal: CloseEstimateCalcSection
    earned: CloseEstimateCalcSection
  }
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
