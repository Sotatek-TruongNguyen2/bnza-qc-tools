import { NextResponse } from 'next/server'
import { fetchRedemptionQueue } from '@/lib/redemption-queue/fetch-redemption-queue'
import { createBaseLogsPublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Logs-friendly RPC: pending views + recent RequestFulfilled scan.
    const client = createBaseLogsPublicClient(45_000)
    const result = await fetchRedemptionQueue(client)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to load redemption queue') },
      { status: 502 },
    )
  }
}
