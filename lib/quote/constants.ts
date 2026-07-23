import { parseAbi } from 'viem'
import {
  BASE_CBBTC_ADDRESS,
  BASE_CBETH_ADDRESS,
  BASE_DAI_ADDRESS,
  BASE_KNOWN_TOKEN_META,
  BASE_KNOWN_TOKENS,
  BASE_USDBC_ADDRESS,
  BASE_USDC_ADDRESS,
  BASE_USDT_ADDRESS,
  BASE_WETH_ADDRESS,
  BASE_WSTETH_ADDRESS,
} from '@/lib/base-known-tokens'

export const CHAIN_ID = 8453
export const DEFAULT_SLIPPAGE_BPS = 50
export const BPS = 10_000n

export const FACTORY_ADDRESS = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as const
export const QUOTER_ADDRESS = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const

export const FEE_TIERS = [100, 500, 3000, 10_000] as const

export const KNOWN_TOKENS = BASE_KNOWN_TOKENS
export const KNOWN_TOKEN_META = BASE_KNOWN_TOKEN_META

export {
  BASE_DAI_ADDRESS,
  BASE_USDT_ADDRESS,
  BASE_USDBC_ADDRESS,
  BASE_CBETH_ADDRESS,
  BASE_WSTETH_ADDRESS,
  BASE_CBBTC_ADDRESS,
}

/** Common Base liquid hubs used as 2-hop intermediates (not only WETH/USDC). */
export const INTERMEDIATE_TOKENS = [
  BASE_WETH_ADDRESS.toLowerCase(),
  BASE_USDC_ADDRESS.toLowerCase(),
  BASE_DAI_ADDRESS.toLowerCase(),
  BASE_USDT_ADDRESS.toLowerCase(),
  BASE_USDBC_ADDRESS.toLowerCase(),
  BASE_CBETH_ADDRESS.toLowerCase(),
  BASE_WSTETH_ADDRESS.toLowerCase(),
  BASE_CBBTC_ADDRESS.toLowerCase(),
] as const

export const INTERMEDIATE_TOKEN_META: Record<string, { symbol: string; decimals: number }> = {
  ...BASE_KNOWN_TOKEN_META,
}

export const FACTORY_ABI = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
])

export const QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
  'function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)',
])

export const ERC20_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])
