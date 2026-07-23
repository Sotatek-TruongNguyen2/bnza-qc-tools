const STORAGE_KEY = 'bnza-qc:mint-tx-by-token-id:v1'
const MAX_ENTRIES = 200

type MintTxMap = Record<string, string>

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

function readMap(): MintTxMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as MintTxMap
  } catch {
    return {}
  }
}

function writeMap(map: MintTxMap): void {
  if (typeof window === 'undefined') return
  try {
    const entries = Object.entries(map)
    const trimmed =
      entries.length <= MAX_ENTRIES
        ? map
        : Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES))
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // quota / private mode — ignore
  }
}

/** Cached Uniswap mint / EXBOT open tx for a tokenId, if previously resolved. */
export function getCachedMintTx(tokenId: string): string | null {
  const id = tokenId.trim()
  if (!/^\d+$/.test(id)) return null
  const hash = readMap()[id]
  return hash && isTxHash(hash) ? hash : null
}

/** Persist mint/open tx after a successful lookup (client-only). */
export function setCachedMintTx(tokenId: string, txHash: string): void {
  const id = tokenId.trim()
  const hash = txHash.trim()
  if (!/^\d+$/.test(id) || !isTxHash(hash)) return
  const map = readMap()
  map[id] = hash
  writeMap(map)
}
