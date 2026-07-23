import { NextResponse } from 'next/server'
import { fetchUniswapLegPnl } from '@/lib/position/fetch-uniswap-leg-pnl'
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
    const client = createBasePublicClient(20_000)
    const result = await fetchUniswapLegPnl(client, tokenId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : formatRpcError(err)
    const status =
      message.includes('Only WETH/USDC') ||
      message.includes('not found') ||
      message.includes('Entry Uniswap')
        ? 400
        : 502
    return NextResponse.json({ error: message }, { status })
  }
}
