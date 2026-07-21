import { NextResponse } from 'next/server'
import { fetchPosition } from '@/lib/position/fetch-position'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get('tokenId')?.trim() ?? ''

  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json(
      { error: 'tokenId must be a positive integer' },
      { status: 400 },
    )
  }

  try {
    const client = createBasePublicClient(15_000)
    const result = await fetchPosition(client, tokenId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to query position') },
      { status: 502 },
    )
  }
}
