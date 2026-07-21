import { formatUnits } from 'viem'

/** Raw bigint → decimal string with token symbol (full precision). */
export function formatRawAmount(raw: bigint, decimals: number, symbol: string): string {
  const units = formatUnits(raw, decimals)
  return `${units} ${symbol}`
}

/** Raw USDC (6 decimals) for calculation panels. */
export function formatRawUsdc(raw: bigint): string {
  return `${formatUnits(raw, 6)} USDC`
}
