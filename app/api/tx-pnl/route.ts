import { NextResponse } from 'next/server'
import { fetchTxPnl } from '@/lib/tx-pnl/fetch-tx-pnl'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseHlSizeEth(value: string | null): number | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    throw new Error('hlSize must be a finite number (signed ETH position size from Hyperliquid)')
  }
  return parsed
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const txHash = searchParams.get('txHash')?.trim() ?? ''

  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json(
      { error: 'txHash must be a full 0x transaction hash' },
      { status: 400 },
    )
  }

  let hlSizeEth: number | null = null
  try {
    hlSizeEth = parseHlSizeEth(searchParams.get('hlSize'))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid hlSize' },
      { status: 400 },
    )
  }

  try {
    const client = createBasePublicClient(20_000)
    const result = await fetchTxPnl(client, txHash, { hlSizeEth })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to compute tx PnL') },
      { status: 502 },
    )
  }
}
