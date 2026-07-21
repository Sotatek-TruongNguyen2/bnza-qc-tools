import { getAddress } from 'viem'

export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
export const BASE_WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const

export const BASE_KNOWN_TOKENS = {
  USDC: BASE_USDC_ADDRESS,
  WETH: BASE_WETH_ADDRESS,
  ETH: BASE_WETH_ADDRESS,
} as const

export const BASE_KNOWN_TOKEN_META: Record<string, { symbol: string; decimals: number }> = {
  [BASE_USDC_ADDRESS.toLowerCase()]: { symbol: 'USDC', decimals: 6 },
  [BASE_WETH_ADDRESS.toLowerCase()]: { symbol: 'WETH', decimals: 18 },
}

export function knownTokenMeta(address: string): { symbol: string; decimals: number } | null {
  try {
    return BASE_KNOWN_TOKEN_META[getAddress(address).toLowerCase()] ?? null
  } catch {
    return null
  }
}

export function knownTokenSymbol(address: string): string | null {
  return knownTokenMeta(address)?.symbol ?? null
}

/** Prefer canonical USDC/WETH labels on Base when address matches. */
export function normalizeTokenSymbol(address: string, onChainSymbol: string): string {
  return knownTokenSymbol(address) ?? onChainSymbol
}

export function formatTokenLabel(address: string, symbol?: string | null): string {
  const sym = symbol ?? knownTokenSymbol(address)
  const addr = getAddress(address)
  return sym ? `${sym} · ${addr}` : addr
}
