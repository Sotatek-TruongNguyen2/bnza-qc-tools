import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { fetchPositionOpenPrice } from '@/lib/position/fetch-open-price'
import { createBaseLogsPublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get('tokenId')?.trim() ?? ''
  const pool = searchParams.get('pool')?.trim() ?? ''
  const token0Decimals = Number(searchParams.get('token0Decimals') ?? '18')
  const token1Decimals = Number(searchParams.get('token1Decimals') ?? '6')

  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: 'tokenId must be a positive integer' }, { status: 400 })
  }
  if (!isAddress(pool)) {
    return NextResponse.json({ error: 'pool must be a valid address' }, { status: 400 })
  }

  try {
    const client = createBaseLogsPublicClient(45_000)
    const result = await fetchPositionOpenPrice(client, {
      tokenId,
      poolAddress: pool as `0x${string}`,
      token0Decimals: Number.isFinite(token0Decimals) ? token0Decimals : 18,
      token1Decimals: Number.isFinite(token1Decimals) ? token1Decimals : 6,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to resolve open price') },
      { status: 502 },
    )
  }
}
