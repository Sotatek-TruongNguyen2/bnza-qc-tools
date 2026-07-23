import { VAULT_ADDRESS } from '@/lib/bot/constants'

/** Base mainnet strategies — same as Addresses / Gas tabs. */
export const OPEN_STRATEGY_ADDRESS =
  '0x5A175761D74afeF00aB1f44F1681B33eD623233F' as const
export const REDEEM_STRATEGY_ADDRESS =
  '0x1C46D4B32a6FA5D3Bb14Ddd137EDBd71E1C8501b' as const
export const REBALANCE_STRATEGY_ADDRESS =
  '0xaC825f50b854b9A6f56C0278691172e3D2e9D365' as const
export const COLLECT_FEE_STRATEGY_ADDRESS =
  '0x4C2F87b29f2e157e442Fb735a4C0b257D9303a13' as const

export const CALLDATA_VAULT_ADDRESS = VAULT_ADDRESS

/** Must match RedeemStrategyV1 / live client PERFORMANCE_FEE_BPS. */
export const DEFAULT_PERFORMANCE_FEE_BPS = 3000

/** CollectFeeStrategyV1 / LpFeeOps.DEFAULT_OPERATION_FEE_BPS. */
export const DEFAULT_OPERATION_FEE_BPS = 50

/** CollectFeeStrategyV1 / LpFeeOps.DEFAULT_MIN_EARNED_USDC ($10, 6 decimals). */
export const DEFAULT_MIN_EARNED_USDC = 10_000_000

export const DEFAULT_REBALANCE_SLIPPAGE_BPS = 100

/** Common Base open defaults (WETH/USDC 0.05% + BNZA from Addresses). */
export const DEFAULT_OPEN_PAIRED_TOKEN =
  '0x4200000000000000000000000000000000000006' as const
export const DEFAULT_OPEN_BNZA_TOKEN =
  '0x9B15D9357A1E28372997C4Fdaf07E2e4a637bF92' as const
export const DEFAULT_OPEN_LP_POOL_FEE = 500
/** CCTP Arbitrum domain — matches live-bnza-exvault-client. */
export const DEFAULT_CCTP_DESTINATION_DOMAIN = 3

/** Deadline = now + this many seconds (matches exbot-integrations makeDeadline default ~20m). */
export const DEFAULT_DEADLINE_OFFSET_SECONDS = 20 * 60

export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

export const BASESCAN_VAULT_WRITE = `https://basescan.org/address/${CALLDATA_VAULT_ADDRESS}#writeProxyContract`

/** Base mainnet OPERATOR_ROLE holder (Addresses tab — deployer / default operator). */
export const DEFAULT_OPERATOR_ADDRESS =
  '0xCFE217b11Aed9B8018fbe2A19285A5B2A19E2369' as const

export const EXECUTE_STRATEGY_ABI = [
  {
    type: 'function',
    name: 'executeStrategy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'user', type: 'address' },
      { name: 'botId', type: 'bytes32' },
      { name: 'params', type: 'bytes' },
    ],
    outputs: [{ name: 'result', type: 'bytes' }],
  },
] as const

export const VAULT_OPERATOR_VIEW_ABI = [
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

/** keccak256("OPERATOR_ROLE") — ExbotRoles.OPERATOR_ROLE */
export const OPERATOR_ROLE =
  '0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929' as const

