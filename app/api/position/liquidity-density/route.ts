import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { fetchLiquidityDensity } from '@/lib/position/fetch-liquidity-density'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pool = searchParams.get('pool')?.trim() ?? ''
  const fee = Number(searchParams.get('fee') ?? '')
  const viewMinTick = Number(searchParams.get('viewMinTick') ?? '')
  const viewMaxTick = Number(searchParams.get('viewMaxTick') ?? '')

  if (!isAddress(pool)) {
    return NextResponse.json({ error: 'pool must be a valid address' }, { status: 400 })
  }
  if (!Number.isFinite(fee) || fee <= 0) {
    return NextResponse.json({ error: 'fee is required' }, { status: 400 })
  }
  if (!Number.isFinite(viewMinTick) || !Number.isFinite(viewMaxTick) || viewMaxTick <= viewMinTick) {
    return NextResponse.json({ error: 'invalid view tick window' }, { status: 400 })
  }

  try {
    const client = createBasePublicClient(25_000)
    const points = await fetchLiquidityDensity(client, {
      poolAddress: pool as `0x${string}`,
      fee,
      viewMinTick,
      viewMaxTick,
    })
    return NextResponse.json({ points })
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to load liquidity density') },
      { status: 502 },
    )
  }
}
