const STORAGE_KEY = 'bnza-qc:npm-nft-image-by-token:v1'
const MAX_ENTRIES = 80

type NftImageCacheEntry = {
  savedAt: number
  currentTick: number
  imageUri: string
  name: string | null
}

type NftImageCacheMap = Record<string, NftImageCacheEntry>

function readMap(): NftImageCacheMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as NftImageCacheMap
  } catch {
    return {}
  }
}

function writeMap(map: NftImageCacheMap): void {
  if (typeof window === 'undefined') return
  try {
    const entries = Object.entries(map).sort((a, b) => a[1].savedAt - b[1].savedAt)
    const trimmed =
      entries.length <= MAX_ENTRIES ? entries : entries.slice(entries.length - MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)))
  } catch {
    // ignore quota
  }
}

export function getCachedNftImage(
  tokenId: string,
  currentTick: number,
): { imageUri: string; name: string | null } | null {
  const id = tokenId.trim()
  if (!/^\d+$/.test(id)) return null
  const entry = readMap()[id]
  if (!entry?.imageUri) return null
  // Art encodes live tick — reuse only when tick still matches.
  if (entry.currentTick !== currentTick) return null
  return { imageUri: entry.imageUri, name: entry.name }
}

export function setCachedNftImage(
  tokenId: string,
  currentTick: number,
  value: { imageUri: string; name: string | null },
): void {
  const id = tokenId.trim()
  if (!/^\d+$/.test(id) || !value.imageUri.startsWith('data:image/')) return
  const map = readMap()
  map[id] = {
    savedAt: Date.now(),
    currentTick,
    imageUri: value.imageUri,
    name: value.name,
  }
  writeMap(map)
}
