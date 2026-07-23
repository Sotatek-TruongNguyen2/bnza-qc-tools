import { NextResponse } from 'next/server'
import {
  clampLookbackBlocks,
  fetchRecentOpens,
} from '@/lib/recent-opens/fetch-recent-opens'
import { createBaseLogsPublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lookback = clampLookbackBlocks(searchParams.get('blocks'))

  try {
    const client = createBaseLogsPublicClient(60_000)
    const result = await fetchRecentOpens(client, lookback)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to load recent PositionOpened events') },
      { status: 502 },
    )
  }
}
