import { NextResponse } from 'next/server'
import { fetchRedemptionQueue } from '@/lib/redemption-queue/fetch-redemption-queue'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pending FIFO + RequestCreated → close tx lookup. */
export async function GET() {
  try {
    const client = createBasePublicClient(45_000)
    const result = await fetchRedemptionQueue(client)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to load redemption queue') },
      { status: 502 },
    )
  }
}
