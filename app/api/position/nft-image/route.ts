import { NextResponse } from 'next/server'
import { fetchPositionNftImage } from '@/lib/position/fetch-position-nft-image'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get('tokenId')?.trim() ?? ''

  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: 'tokenId must be a positive integer' }, { status: 400 })
  }

  try {
    // tokenURI SVG generation is heavy — allow a longer RPC timeout.
    const client = createBasePublicClient(60_000)
    const result = await fetchPositionNftImage(client, tokenId)
    if (!result.imageUri) {
      return NextResponse.json(result, { status: result.error?.includes('tokenId') ? 400 : 502 })
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to load position NFT image') },
      { status: 502 },
    )
  }
}
