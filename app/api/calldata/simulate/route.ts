import { NextResponse } from 'next/server'
import {
  simulateExecuteStrategy,
  type SimulateExecuteStrategyInput,
} from '@/lib/calldata/simulate-execute-strategy'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: SimulateExecuteStrategyInput
  try {
    body = (await request.json()) as SimulateExecuteStrategyInput
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body?.strategy || !body?.user || !body?.botIdBytes32 || !body?.params) {
    return NextResponse.json(
      { error: 'Missing strategy, user, botIdBytes32, or params' },
      { status: 400 },
    )
  }
  if (!body.executeStrategyCalldata) {
    return NextResponse.json({ error: 'Missing executeStrategyCalldata' }, { status: 400 })
  }

  try {
    const client = createBasePublicClient(45_000)
    const result = await simulateExecuteStrategy(client, body)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: formatRpcError(err, 'Failed to simulate executeStrategy') },
      { status: 400 },
    )
  }
}
