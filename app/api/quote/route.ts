import { NextResponse } from 'next/server'
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/quote/constants'
import { fetchQuotes } from '@/lib/quote/fetch-quotes'
import { createBasePublicClient, formatRpcError } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseSlippageBps(params: URLSearchParams): number {
  const bpsRaw = params.get('slippageBps')
  if (bpsRaw != null && bpsRaw !== '') {
    if (!/^\d+$/.test(bpsRaw)) {
      throw new Error('slippageBps must be a non-negative integer')
    }
    const bps = Number(bpsRaw)
    if (bps > 10_000) throw new Error('slippageBps must be <= 10000')
    return bps
  }

  const pctRaw = params.get('slippage')
  if (pctRaw != null && pctRaw !== '') {
    if (!/^\d+(\.\d+)?$/.test(pctRaw)) {
      throw new Error('slippage must be a non-negative number')
    }
    const pct = Number(pctRaw)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new Error('slippage must be between 0 and 100')
    }
    return Math.round(pct * 100)
  }

  return DEFAULT_SLIPPAGE_BPS
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const amount = searchParams.get('amount')?.trim() ?? ''
  const tokenIn = searchParams.get('tokenIn')?.trim() ?? ''
  const tokenOut = searchParams.get('tokenOut')?.trim() ?? ''

  if (!amount || !tokenIn || !tokenOut) {
    return NextResponse.json(
      { error: 'Missing required params: amount, tokenIn, tokenOut' },
      { status: 400 },
    )
  }

  if (!/^\d+(\.\d+)?$/.test(amount)) {
    return NextResponse.json(
      { error: 'amount must be a positive number' },
      { status: 400 },
    )
  }

  try {
    const slippageBps = parseSlippageBps(searchParams)
    const client = createBasePublicClient(25_000)
    const result = await fetchQuotes(client, {
      amount,
      tokenIn,
      tokenOut,
      slippageBps,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = formatRpcError(err, 'Failed to quote routes')
    const status =
      message.startsWith('Unknown token') || message.includes('slippage') ? 400 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
