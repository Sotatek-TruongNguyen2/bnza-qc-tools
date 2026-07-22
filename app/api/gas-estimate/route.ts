import { NextResponse } from 'next/server'
import { fetchGasEstimates } from '@/lib/gas/fetch-gas-estimates'
import { createBaseLogsPublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Historical gasUsed for vault deposit / withdraw / strategies. Manual reload only. */
export async function GET() {
  try {
    // Public RPCs first — Alchemy free eth_getLogs is capped at 10 blocks.
    const client = createBaseLogsPublicClient(45_000)
    const result = await fetchGasEstimates(client)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to estimate gas') },
      { status: 502 },
    )
  }
}
