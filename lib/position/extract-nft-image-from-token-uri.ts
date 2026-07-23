/**
 * Uniswap V3 NPM tokenURI is typically:
 * data:application/json;base64,{"name":"...","image":"data:image/svg+xml;base64,..."}
 */
export function extractImageFromTokenUri(tokenUri: string): string | null {
  const uri = tokenUri.trim()
  if (!uri) return null

  if (uri.startsWith('data:image/')) return uri

  try {
    if (uri.startsWith('data:application/json;base64,')) {
      const b64 = uri.slice('data:application/json;base64,'.length)
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as {
        image?: string
      }
      return typeof json.image === 'string' && json.image.length > 0 ? json.image : null
    }

    if (uri.startsWith('data:application/json,')) {
      const raw = decodeURIComponent(uri.slice('data:application/json,'.length))
      const json = JSON.parse(raw) as { image?: string }
      return typeof json.image === 'string' && json.image.length > 0 ? json.image : null
    }
  } catch {
    return null
  }

  // http(s) metadata — uncommon for Uni V3 NPM; caller may fetch separately.
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  return null
}
