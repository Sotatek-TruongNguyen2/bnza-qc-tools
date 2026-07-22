export type GasOpId =
  | 'deposit'
  | 'withdraw'
  | 'open'
  | 'close'
  | 'rebalance'
  | 'collect-fee'

export type GasSample = {
  txHash: string
  /** eth_estimateGas result (at the sample tx’s block). */
  gasEstimate: string
  /** Receipt gasUsed for comparison. */
  gasUsed: string | null
  blockNumber: string
  feeEth: string | null
}

export type GasOpEstimate = {
  id: GasOpId
  label: string
  payer: 'user' | 'operator'
  strategyAddress: string | null
  method: 'eth_estimateGas' | null
  sampleCount: number
  /** Median eth_estimateGas (with buffer applied for fee). */
  gasEstimateMedian: string | null
  gasEstimateMin: string | null
  gasEstimateMax: string | null
  /** medianEstimate × buffer × current (baseFee + tip) */
  estimatedFeeEth: string | null
  estimatedFeeUsd: string | null
  samples: GasSample[]
  note: string | null
  error: string | null
}

export type GasEstimateResult = {
  network: string
  chainId: number
  vault: string
  /** e.g. 1.2 = +20% like bnza-operator tx-executor */
  gasBuffer: number
  lookedBackBlocks: string
  fromBlock: string
  toBlock: string
  ethUsd: number | null
  feePerGasWei: string
  feePerGasGwei: string
  fetchedAt: string
  operations: GasOpEstimate[]
  caveats: string[]
}
