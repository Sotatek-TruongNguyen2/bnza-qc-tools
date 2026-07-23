import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import { NPM_ADDRESS } from './constants'
import { extractImageFromTokenUri } from './extract-nft-image-from-token-uri'

const TOKEN_URI_ABI = [
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
] as const

export type PositionNftImageResult = {
  tokenId: string
  npmAddress: string
  /** data:image/svg+xml;base64,… (or https metadata image URL). */
  imageUri: string | null
  name: string | null
  error: string | null
}

function extractName(tokenUri: string): string | null {
  try {
    if (!tokenUri.startsWith('data:application/json;base64,')) return null
    const b64 = tokenUri.slice('data:application/json;base64,'.length)
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as { name?: string }
    return typeof json.name === 'string' ? json.name : null
  } catch {
    return null
  }
}

/** Read Uniswap V3 NPM tokenURI and extract the on-chain SVG image. */
export async function fetchPositionNftImage(
  client: BasePublicClient,
  tokenIdInput: string,
): Promise<PositionNftImageResult> {
  const tokenId = tokenIdInput.trim()
  if (!/^\d+$/.test(tokenId)) {
    return {
      tokenId,
      npmAddress: NPM_ADDRESS,
      imageUri: null,
      name: null,
      error: 'tokenId must be a positive integer',
    }
  }

  try {
    const tokenUri = await client.readContract({
      address: NPM_ADDRESS,
      abi: TOKEN_URI_ABI,
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    })

    const imageUri = extractImageFromTokenUri(tokenUri)
    if (!imageUri) {
      return {
        tokenId,
        npmAddress: NPM_ADDRESS,
        imageUri: null,
        name: extractName(tokenUri),
        error: 'tokenURI returned metadata without a usable image field',
      }
    }

    return {
      tokenId,
      npmAddress: NPM_ADDRESS,
      imageUri,
      name: extractName(tokenUri),
      error: null,
    }
  } catch (err) {
    return {
      tokenId,
      npmAddress: NPM_ADDRESS,
      imageUri: null,
      name: null,
      error: formatRpcError(err, 'Failed to read NPM tokenURI'),
    }
  }
}
