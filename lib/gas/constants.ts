import type { Address } from 'viem'
import { VAULT_ADDRESS } from '@/lib/bot/constants'
import type { GasOpId } from './types'

/** ~3 days on Base (~2s blocks). Chunked eth_getLogs finds recent successful calls to replay. */
export const GAS_LOOKBACK_BLOCKS = 129_600n

/** Max txs to eth_estimateGas per operation. */
export const GAS_MAX_SAMPLES = 5

/** Stay under Base public RPC’s 10_000 inclusive getLogs range. */
export const GAS_LOG_CHUNK_BLOCKS = 2_000n

/** Match bnza-operator tx-executor (+20% on estimateContractGas). */
export const GAS_BUFFER_BPS = 1_200n // 120%

export const GAS_VAULT_ADDRESS = VAULT_ADDRESS

export type GasOpConfig = {
  id: GasOpId
  label: string
  payer: 'user' | 'operator'
  strategyAddress: Address | null
  kind: 'deposit' | 'withdraw' | 'strategy'
}

export function getGasOpConfigs(): GasOpConfig[] {
  return [
    {
      id: 'deposit',
      label: 'Deposit',
      payer: 'user',
      strategyAddress: null,
      kind: 'deposit',
    },
    {
      id: 'withdraw',
      label: 'Withdraw',
      payer: 'user',
      strategyAddress: null,
      kind: 'withdraw',
    },
    {
      id: 'open',
      label: 'Open position',
      payer: 'operator',
      strategyAddress: '0x5A175761D74afeF00aB1f44F1681B33eD623233F',
      kind: 'strategy',
    },
    {
      id: 'close',
      label: 'Close position',
      payer: 'operator',
      strategyAddress: '0x1C46D4B32a6FA5D3Bb14Ddd137EDBd71E1C8501b',
      kind: 'strategy',
    },
    {
      id: 'rebalance',
      label: 'Rebalance',
      payer: 'operator',
      strategyAddress: '0xaC825f50b854b9A6f56C0278691172e3D2e9D365',
      kind: 'strategy',
    },
    {
      id: 'collect-fee',
      label: 'Fee collection',
      payer: 'operator',
      strategyAddress: '0x4C2F87b29f2e157e442Fb735a4C0b257D9303a13',
      kind: 'strategy',
    },
  ]
}
