import { parseAbi } from 'viem'

export { BASE_USDC_ADDRESS } from '@/lib/base-known-tokens'

/** Base mainnet — override via env on Vercel. */
export const VAULT_ADDRESS = (process.env.BASE_BNZA_EX_VAULT_ADDRESS ??
  '0x71C6Bc7d0Ca95C1d901A2A185E8c90d4530e3005') as `0x${string}`

export const POSITION_MANAGER_ADDRESS = (process.env.BASE_BNZA_EX_POSITION_MANAGER_ADDRESS ??
  '0x5D1A6AC93895d17C8312Ffbd1C38B3beb8C46D6A') as `0x${string}`

export const CHAIN_ID = 8453

export const VAULT_ABI = parseAbi([
  'function usdc() view returns (address)',
  'function botDepositToken(address user, bytes32 botId) view returns (address)',
  'function unspentBalance(address user, bytes32 botId) view returns (uint256)',
  'function deployedCapital(address user, bytes32 botId) view returns (uint256)',
  'function wlMasterOf(address user, bytes32 botId) view returns (address)',
  'function paused() view returns (bool)',
])

export const POSITION_MANAGER_ABI = parseAbi([
  'function getBotPositionCount(address user, bytes32 botId) view returns (uint256)',
  'function getBotPositionIds(address user, bytes32 botId) view returns (uint256[])',
  'function getBotPositionOpenCount(address user, bytes32 botId) view returns (uint256)',
  'function getPosition(uint256 tokenId) view returns ((uint256 tokenId, address owner, bytes32 botId, address pool, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 openedAt, uint256 positionId))',
  'function getPositionDeployment(address user, bytes32 botId, uint256 positionId) view returns ((uint256 tokenId, uint256 totalUsdc, uint256 uniswapUsdc, uint256 hyperliquidUsdc, bool active))',
  'function deployedCapitalForPosition(uint256 tokenId) view returns (uint256)',
])
