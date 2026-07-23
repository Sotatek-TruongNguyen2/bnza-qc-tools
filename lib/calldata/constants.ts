import { VAULT_ADDRESS } from '@/lib/bot/constants'

/** Base mainnet strategies — same as Addresses / Gas tabs. */
export const REDEEM_STRATEGY_ADDRESS =
  '0x1C46D4B32a6FA5D3Bb14Ddd137EDBd71E1C8501b' as const
export const REBALANCE_STRATEGY_ADDRESS =
  '0xaC825f50b854b9A6f56C0278691172e3D2e9D365' as const

export const CALLDATA_VAULT_ADDRESS = VAULT_ADDRESS

/** Must match RedeemStrategyV1 / live client PERFORMANCE_FEE_BPS. */
export const DEFAULT_PERFORMANCE_FEE_BPS = 3000

export const DEFAULT_REBALANCE_SLIPPAGE_BPS = 100

/** Deadline = now + this many seconds (matches exbot-integrations makeDeadline default ~20m). */
export const DEFAULT_DEADLINE_OFFSET_SECONDS = 20 * 60

export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

export const BASESCAN_VAULT_WRITE = `https://basescan.org/address/${CALLDATA_VAULT_ADDRESS}#writeProxyContract`
