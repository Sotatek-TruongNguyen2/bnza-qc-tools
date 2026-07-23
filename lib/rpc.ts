import { createPublicClient, fallback, http, type Transport } from 'viem'
import { base } from 'viem/chains'

const PUBLIC_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.publicnode.com',
  'https://1rpc.io/base',
  'https://base.drpc.org',
  'https://rpc.ankr.com/base',
] as const

/** Logs-friendly public endpoints (skip Alchemy free 10-block getLogs cap / flaky archive). */
const PUBLIC_BASE_LOGS_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://1rpc.io/base',
  'https://base.drpc.org',
] as const

/** Round-robin cursor so successive clients don't all hammer the first URL. */
let rpcRotateCursor = 0

function splitEnvUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    const key = url.replace(/\/$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
  }
  return out
}

/**
 * Ordered Base RPC list:
 * 1) BASE_RPC_URL / BASE_RPC_URLS (paid / preferred)
 * 2) Alchemy if ALCHEMY_API_KEY set
 * 3) Public Base RPCs as rotation backups
 */
export function getBaseRpcUrls(): string[] {
  const preferred = [
    ...splitEnvUrls(process.env.BASE_RPC_URL),
    ...splitEnvUrls(process.env.BASE_RPC_URLS),
  ]

  const alchemyKey = process.env.ALCHEMY_API_KEY?.trim()
  if (alchemyKey) {
    preferred.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`)
  }

  return dedupeUrls([...preferred, ...PUBLIC_BASE_RPCS])
}

export function getBaseLogsRpcUrls(): string[] {
  const preferred = [
    ...splitEnvUrls(process.env.BASE_RPC_URL),
    ...splitEnvUrls(process.env.BASE_RPC_URLS),
  ]
  // Do not put Alchemy first for getLogs — free tier 10-block limit breaks history scans.
  return dedupeUrls([...preferred, ...PUBLIC_BASE_LOGS_RPCS])
}

/** Rotate start index so load spreads across the pool. */
export function rotateUrlList(urls: string[]): string[] {
  if (urls.length <= 1) return urls
  const start = rpcRotateCursor % urls.length
  rpcRotateCursor = (rpcRotateCursor + 1) % 1_000_000
  return [...urls.slice(start), ...urls.slice(0, start)]
}

function buildFallbackTransport(urls: string[], timeoutMs: number): Transport {
  const ordered = rotateUrlList(urls)
  return fallback(
    ordered.map((url) =>
      http(url, {
        timeout: timeoutMs,
        // Per-transport retries before moving to the next URL in the fallback chain.
        retryCount: 2,
        retryDelay: 200,
      }),
    ),
    {
      // Keep order from rotateUrlList (don't re-rank mid-request).
      rank: false,
      retryCount: 0,
    },
  )
}

export function createBasePublicClient(timeoutMs = 20_000) {
  return createPublicClient({
    chain: base,
    transport: buildFallbackTransport(getBaseRpcUrls(), timeoutMs),
  })
}

/**
 * Prefer public Base endpoints for eth_getLogs.
 * Alchemy free tier caps getLogs to a 10-block range (unusable for historical scans).
 */
export function createBaseLogsPublicClient(timeoutMs = 45_000) {
  return createPublicClient({
    chain: base,
    transport: buildFallbackTransport(getBaseLogsRpcUrls(), timeoutMs),
  })
}

export type BasePublicClient = ReturnType<typeof createBasePublicClient>

/** Same rotating URL pool for a custom viem transport (e.g. future wallet / write clients). */
export function createRotatingBaseTransport(timeoutMs = 20_000): Transport {
  return buildFallbackTransport(getBaseRpcUrls(), timeoutMs)
}

/** Short, QC-friendly message from viem / RPC failures. */
export function formatRpcError(err: unknown, fallback = 'Request failed'): string {
  const raw = err instanceof Error ? err.message : String(err ?? fallback)
  const lower = raw.toLowerCase()

  if (lower.includes('over rate limit') || lower.includes('429') || lower.includes('rate limit')) {
    return (
      'Base RPC rate-limited across the rotation pool. Set BASE_RPC_URL or comma-separated ' +
      'BASE_RPC_URLS (and/or ALCHEMY_API_KEY) in .env.local / Vercel, then retry.'
    )
  }

  if (lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('econnrefused')) {
    return 'Could not reach the API. Is the QC tools server running? (pnpm dev → http://localhost:3099)'
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'RPC timed out after trying rotated endpoints. Prefer BASE_RPC_URL / BASE_RPC_URLS / ALCHEMY_API_KEY.'
  }

  // Keep first line only — viem dumps huge multi-line diagnostics.
  const firstLine = raw.split('\n').find((line) => line.trim().length > 0) ?? fallback
  return firstLine.length > 220 ? `${firstLine.slice(0, 220)}…` : firstLine
}
