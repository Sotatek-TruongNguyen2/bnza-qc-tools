import { createPublicClient, fallback, http } from 'viem'
import { base } from 'viem/chains'

const PUBLIC_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.publicnode.com',
  'https://1rpc.io/base',
] as const

/** Prefer paid RPC, then public Base endpoints (fallback on rate-limit). */
export function getBaseRpcUrls(): string[] {
  if (process.env.BASE_RPC_URL) return [process.env.BASE_RPC_URL]

  const alchemyKey = process.env.ALCHEMY_API_KEY
  if (alchemyKey) {
    return [`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`, ...PUBLIC_BASE_RPCS]
  }

  return [...PUBLIC_BASE_RPCS]
}

export function createBasePublicClient(timeoutMs = 20_000) {
  const urls = getBaseRpcUrls()
  return createPublicClient({
    chain: base,
    transport: fallback(
      urls.map((url) => http(url, { timeout: timeoutMs, retryCount: 1 })),
      { rank: false },
    ),
  })
}

export type BasePublicClient = ReturnType<typeof createBasePublicClient>

/** Short, QC-friendly message from viem / RPC failures. */
export function formatRpcError(err: unknown, fallback = 'Request failed'): string {
  const raw = err instanceof Error ? err.message : String(err ?? fallback)
  const lower = raw.toLowerCase()

  if (lower.includes('over rate limit') || lower.includes('429') || lower.includes('rate limit')) {
    return 'Base RPC rate-limited. Set BASE_RPC_URL or ALCHEMY_API_KEY in .env.local (or Vercel env) and restart the server.'
  }

  if (lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('econnrefused')) {
    return 'Could not reach the API. Is the QC tools server running? (pnpm dev → http://localhost:3099)'
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'RPC timed out. Prefer BASE_RPC_URL / ALCHEMY_API_KEY in .env.local.'
  }

  // Keep first line only — viem dumps huge multi-line diagnostics.
  const firstLine = raw.split('\n').find((line) => line.trim().length > 0) ?? fallback
  return firstLine.length > 220 ? `${firstLine.slice(0, 220)}…` : firstLine
}
