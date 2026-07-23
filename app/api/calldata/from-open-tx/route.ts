import { NextResponse } from 'next/server'
import { fetchPrefillFromOpenTx } from '@/lib/calldata/fetch-from-open-tx'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tx = searchParams.get('tx')?.trim() ?? ''

  if (!tx) {
    return NextResponse.json({ error: 'tx query param is required' }, { status: 400 })
  }

  try {
    const client = createBasePublicClient(20_000)
    const result = await fetchPrefillFromOpenTx(client, tx)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : formatRpcError(err)
    const status =
      message.includes('Enter a tx') || message.includes('No PositionOpened') || message.includes('failed on-chain')
        ? 400
        : 502
    return NextResponse.json({ error: message }, { status })
  }
}
