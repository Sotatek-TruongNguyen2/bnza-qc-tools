import { POSITION_MANAGER_ABI, POSITION_MANAGER_ADDRESS } from '@/lib/bot/constants'

export { POSITION_MANAGER_ABI, POSITION_MANAGER_ADDRESS }

/** RedeemStrategyV1 — PositionLiquidated / CloseFeesCollected. */
export const REDEEM_STRATEGY_ADDRESS =
  '0x1C46D4B32a6FA5D3Bb14Ddd137EDBd71E1C8501b' as const

/** Batch size for getPositionDeployment multicalls. */
export const RECENT_OPENS_STATUS_MULTICALL_CHUNK = 80

/** Default lookback: 100_000 Base blocks (~2.3 days at ~2s/block). */
export const RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS = 100_000n

/** Floor / ceiling for ?blocks= override. */
export const RECENT_OPENS_MIN_LOOKBACK_BLOCKS = 10_000n
export const RECENT_OPENS_MAX_LOOKBACK_BLOCKS = 250_000n

/** Stay under Base public RPC’s 10_000 inclusive getLogs range. */
export const RECENT_OPENS_LOG_CHUNK_BLOCKS = 9_999n

export const RECENT_OPENS_LOGS_CONCURRENCY = 4

/** Client auto-refresh interval. */
export const RECENT_OPENS_RELOAD_MS = 10 * 60 * 1000

export const RECENT_OPENS_DISMISSED_STORAGE_KEY = 'bnza-qc:recent-opens-dismissed:v1'

export const POSITION_OPENED_EVENT =
  'event PositionOpened(address indexed owner, bytes32 indexed botId, uint256 indexed positionId, uint256 tokenId, address pool, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 totalUsdc, uint256 uniswapUsdc, uint256 hyperliquidUsdc)' as const

export const POSITION_LIQUIDATED_EVENT =
  'event PositionLiquidated(address indexed user, uint256 indexed tokenId, uint256 principalUsdc)' as const

export const CLOSE_FEES_COLLECTED_EVENT =
  'event CloseFeesCollected(address indexed user, uint256 indexed tokenId, address token0, address token1, uint256 gross0, uint256 gross1, uint256 operationFee0, uint256 operationFee1, uint256 performanceFee0, uint256 performanceFee1)' as const
