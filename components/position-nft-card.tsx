'use client'

import { useEffect, useState } from 'react'
import { apiGetJson } from '@/lib/api-client'
import type { PositionNftImageResult } from '@/lib/position/fetch-position-nft-image'
import { getCachedNftImage, setCachedNftImage } from '@/lib/position/nft-image-local-cache'

type Props = {
  tokenId: string
  /** Bust cache when live tick changes (NFT art encodes current tick). */
  currentTick: number
}

export function PositionNftCard({ tokenId, currentTick }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const cached = getCachedNftImage(tokenId, currentTick)
    if (cached) {
      setImageUri(cached.imageUri)
      setName(cached.name)
      setLoading(false)
      return
    }

    void (async () => {
      try {
        const data = await apiGetJson<PositionNftImageResult>(
          `/api/position/nft-image?tokenId=${encodeURIComponent(tokenId)}`,
        )
        if (cancelled) return
        if (!data.imageUri) {
          setError(data.error ?? 'NFT image unavailable')
          setImageUri(null)
          return
        }
        setCachedNftImage(tokenId, currentTick, {
          imageUri: data.imageUri,
          name: data.name,
        })
        setImageUri(data.imageUri)
        setName(data.name)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load NFT image')
          setImageUri(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tokenId, currentTick])

  return (
    <div className="position-nft-card">
      <div className="position-nft-card-head">
        <h3>Uniswap V3 position NFT</h3>
        <p className="muted">From NPM <code>tokenURI</code> (on-chain SVG).</p>
      </div>
      {loading && <p className="muted">Loading NFT art…</p>}
      {error && !loading && <p className="muted">{error}</p>}
      {imageUri && (
        <figure className="position-nft-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- data:image SVG from chain */}
          <img src={imageUri} alt={name ?? `Uniswap V3 position #${tokenId}`} />
          {name && <figcaption className="muted">{name}</figcaption>}
        </figure>
      )}
    </div>
  )
}
