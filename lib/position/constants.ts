import { parseAbi } from 'viem'

export const CHAIN_ID = 8453
export const NPM_ADDRESS = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1' as const
export const FACTORY_ADDRESS = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as const
export const MAX_UINT128 = 2n ** 128n - 1n
export const Q96 = 2n ** 96n

export const NPM_ABI = parseAbi([
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) payable returns (uint256 amount0, uint256 amount1)',
])

export const FACTORY_ABI = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
])

export const POOL_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
])

export const ERC20_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])
