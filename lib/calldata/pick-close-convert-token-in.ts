import { BASE_USDC_ADDRESS, BASE_WETH_ADDRESS } from '@/lib/base-known-tokens'
import type { PositionResult } from '@/lib/position/types'

export function feeTierShortLabel(fee: number): string {
  if (fee === 100) return '0.01%'
  if (fee === 500) return '0.05%'
  if (fee === 3000) return '0.3%'
  if (fee === 10_000) return '1%'
  return `${fee / 10_000}%`
}

/** Non-USDC principal token to swap → USDC on close (falls back to WETH). */
export function pickCloseConvertTokenIn(position: PositionResult): {
  tokenIn: string
  tokenInSymbol: string
  note: string
} {
  const { token0, token1, token0Symbol, token1Symbol } = position.raw
  const usdc = BASE_USDC_ADDRESS.toLowerCase()
  if (token0.toLowerCase() === usdc) {
    return {
      tokenIn: token1,
      tokenInSymbol: token1Symbol,
      note: `Routes for close convert: ${token1Symbol} → USDC (from tokenId).`,
    }
  }
  if (token1.toLowerCase() === usdc) {
    return {
      tokenIn: token0,
      tokenInSymbol: token0Symbol,
      note: `Routes for close convert: ${token0Symbol} → USDC (from tokenId).`,
    }
  }
  return {
    tokenIn: BASE_WETH_ADDRESS,
    tokenInSymbol: 'WETH',
    note: `LP is ${token0Symbol}/${token1Symbol} (no USDC). Showing WETH → USDC routes — pick Custom if needed.`,
  }
}
