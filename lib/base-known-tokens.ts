import { getAddress } from 'viem'

export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
export const BASE_WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const
export const BASE_DAI_ADDRESS = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' as const
export const BASE_USDT_ADDRESS = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2' as const
export const BASE_USDBC_ADDRESS = '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca' as const
export const BASE_CBETH_ADDRESS = '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' as const
export const BASE_WSTETH_ADDRESS = '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452' as const
export const BASE_CBBTC_ADDRESS = '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf' as const

export const BASE_KNOWN_TOKENS = {
  USDC: BASE_USDC_ADDRESS,
  WETH: BASE_WETH_ADDRESS,
  ETH: BASE_WETH_ADDRESS,
} as const

export const BASE_KNOWN_TOKEN_META: Record<string, { symbol: string; decimals: number }> = {
  [BASE_USDC_ADDRESS.toLowerCase()]: { symbol: 'USDC', decimals: 6 },
  [BASE_WETH_ADDRESS.toLowerCase()]: { symbol: 'WETH', decimals: 18 },
  [BASE_DAI_ADDRESS.toLowerCase()]: { symbol: 'DAI', decimals: 18 },
  [BASE_USDT_ADDRESS.toLowerCase()]: { symbol: 'USDT', decimals: 6 },
  [BASE_USDBC_ADDRESS.toLowerCase()]: { symbol: 'USDbC', decimals: 6 },
  [BASE_CBETH_ADDRESS.toLowerCase()]: { symbol: 'cbETH', decimals: 18 },
  [BASE_WSTETH_ADDRESS.toLowerCase()]: { symbol: 'wstETH', decimals: 18 },
  [BASE_CBBTC_ADDRESS.toLowerCase()]: { symbol: 'cbBTC', decimals: 8 },
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
