import { encodePacked, type Hex } from 'viem'
import { BASE_USDC_ADDRESS, BASE_WETH_ADDRESS } from '@/lib/base-known-tokens'

/** Uniswap V3 single-hop path: tokenIn | fee | tokenOut */
export function buildDirectSwapPath(
  tokenIn: `0x${string}`,
  fee: number,
  tokenOut: `0x${string}`,
): Hex {
  return encodePacked(['address', 'uint24', 'address'], [tokenIn, fee, tokenOut])
}

/** Default close path: WETH → USDC via 0.05% pool (common EXBOT LP). */
export function defaultWethUsdcSwapPath(fee = 500): Hex {
  return buildDirectSwapPath(BASE_WETH_ADDRESS, fee, BASE_USDC_ADDRESS)
}
