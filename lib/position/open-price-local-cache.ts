import type { PositionOpenPrice } from './types'

const STORAGE_KEY = 'bnza-qc:open-price-by-token-id:v1'
/** Legacy mint-hash-only cache (migrated on read). */
const LEGACY_MINT_TX_KEY = 'bnza-qc:mint-tx-by-token-id:v1'
const MAX_ENTRIES = 150

type OpenPriceCacheEntry = {
  savedAt: number
  poolAddress: string
  openPrice: PositionOpenPrice
}

type OpenPriceCacheMap = Record<string, OpenPriceCacheEntry>

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

function isUsableOpenPrice(value: unknown): value is PositionOpenPrice {
  if (!value || typeof value !== 'object') return false
  const o = value as PositionOpenPrice
  return (
    o.found === true &&
    typeof o.txHash === 'string' &&
    isTxHash(o.txHash) &&
    o.principalAmount0 != null &&
    o.principalAmount1 != null
  )
}

function readMap(): OpenPriceCacheMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as OpenPriceCacheMap
  } catch {
    return {}
  }
}

function writeMap(map: OpenPriceCacheMap): void {
  if (typeof window === 'undefined') return
  try {
    const entries = Object.entries(map).sort((a, b) => a[1].savedAt - b[1].savedAt)
    const trimmed =
      entries.length <= MAX_ENTRIES ? entries : entries.slice(entries.length - MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)))
  } catch {
    // quota / private mode — ignore
  }
}

function readLegacyMintTx(tokenId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LEGACY_MINT_TX_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    const hash = parsed?.[tokenId]
    return hash && isTxHash(hash) ? hash : null
  } catch {
    return null
  }
}

/** Full opened-at / mint details for a tokenId, if previously resolved for this pool. */
export function getCachedOpenPrice(
  tokenId: string,
  poolAddress: string,
): PositionOpenPrice | null {
  const id = tokenId.trim()
  if (!/^\d+$/.test(id)) return null
  const pool = poolAddress.trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{40}$/.test(pool)) return null

  const entry = readMap()[id]
  if (!entry) return null
  if (entry.poolAddress.toLowerCase() !== pool) return null
  if (!isUsableOpenPrice(entry.openPrice)) return null
  return entry.openPrice
}

/** Persist full open-price payload after a successful API lookup (client-only). */
export function setCachedOpenPrice(
  tokenId: string,
  poolAddress: string,
  openPrice: PositionOpenPrice,
): void {
  const id = tokenId.trim()
  const pool = poolAddress.trim().toLowerCase()
  if (!/^\d+$/.test(id) || !/^0x[a-fA-F0-9]{40}$/.test(pool)) return
  if (!isUsableOpenPrice(openPrice)) return

  const map = readMap()
  map[id] = {
    savedAt: Date.now(),
    poolAddress: pool,
    openPrice,
  }
  writeMap(map)
}

/** Mint/open tx hash from full cache or legacy hash-only store. */
export function getCachedMintTx(tokenId: string): string | null {
  const id = tokenId.trim()
  if (!/^\d+$/.test(id)) return null

  const entry = readMap()[id]
  if (entry?.openPrice?.txHash && isTxHash(entry.openPrice.txHash)) {
    return entry.openPrice.txHash
  }
  return readLegacyMintTx(id)
}

/**
 * Store mint tx only (e.g. calldata autofill) when full open-price isn’t available yet.
 * Prefer `setCachedOpenPrice` when principal / opened-at details are known.
 */
export function setCachedMintTx(tokenId: string, txHash: string): void {
  const id = tokenId.trim()
  const hash = txHash.trim()
  if (!/^\d+$/.test(id) || !isTxHash(hash)) return

  const map = readMap()
  const existing = map[id]
  if (existing && isUsableOpenPrice(existing.openPrice)) {
    if (existing.openPrice.txHash?.toLowerCase() === hash.toLowerCase()) return
    map[id] = {
      ...existing,
      openPrice: { ...existing.openPrice, txHash: hash, links: { tx: `https://basescan.org/tx/${hash}` } },
      savedAt: Date.now(),
    }
    writeMap(map)
    return
  }

  // Keep legacy key for hash-only until a full open-price write replaces it.
  try {
    const raw = window.localStorage.getItem(LEGACY_MINT_TX_KEY)
    const legacy = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    legacy[id] = hash
    window.localStorage.setItem(LEGACY_MINT_TX_KEY, JSON.stringify(legacy))
  } catch {
    // ignore
  }
}
