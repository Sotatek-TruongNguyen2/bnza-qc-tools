import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { fetchBot } from '@/lib/bot/fetch-bot'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const user = searchParams.get('user')?.trim() ?? ''
  const botId = searchParams.get('botId')?.trim() ?? ''

  if (!isAddress(user)) {
    return NextResponse.json(
      { error: 'user must be a valid 0x address (custody wallet)' },
      { status: 400 },
    )
  }

  if (!botId) {
    return NextResponse.json({ error: 'botId is required (UUID or 0x bytes32)' }, { status: 400 })
  }

  try {
    const client = createBasePublicClient(20_000)
    const result = await fetchBot(client, user, botId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to query bot') },
      { status: 502 },
    )
  }
}
