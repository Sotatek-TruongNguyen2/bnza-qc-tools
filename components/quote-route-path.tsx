'use client'

import { TokenIcon } from './token-icon'
import { INTERMEDIATE_TOKEN_META } from '@/lib/quote/constants'
import type { RouteHop, TokenInfo } from '@/lib/quote/types'

type Props = {
  hops: RouteHop[]
  tokenIn: TokenInfo
  tokenOut: TokenInfo
  /** Fallback text description for accessibility / title. */
  description?: string
}

function feeShort(fee: number): string {
  if (fee === 100) return '0.01%'
  if (fee === 500) return '0.05%'
  if (fee === 3000) return '0.3%'
  if (fee === 10_000) return '1%'
  return `${fee / 10_000}%`
}

function resolveSymbol(
  address: string,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
): string {
  const lower = address.toLowerCase()
  if (tokenIn.address.toLowerCase() === lower) return tokenIn.symbol
  if (tokenOut.address.toLowerCase() === lower) return tokenOut.symbol
  return INTERMEDIATE_TOKEN_META[lower]?.symbol ?? `${address.slice(0, 6)}…`
}

/** Icon + symbol path for a quote route (direct or multi-hop). */
export function QuoteRoutePath({ hops, tokenIn, tokenOut, description }: Props) {
  if (hops.length === 0) {
    return (
      <span className="quote-route-path" title={description}>
        <TokenIcon symbol={tokenIn.symbol} address={tokenIn.address} size={18} />
        <span>{tokenIn.symbol}</span>
      </span>
    )
  }

  const nodes: { address: string; symbol: string }[] = [
    {
      address: hops[0]!.tokenIn,
      symbol: resolveSymbol(hops[0]!.tokenIn, tokenIn, tokenOut),
    },
  ]
  for (const hop of hops) {
    nodes.push({
      address: hop.tokenOut,
      symbol: resolveSymbol(hop.tokenOut, tokenIn, tokenOut),
    })
  }

  return (
    <span className="quote-route-path" title={description}>
      {nodes.map((node, i) => (
        <span key={`${node.address}-${i}`} className="quote-route-node">
          {i > 0 && (
            <span className="quote-route-hop muted">
              <span className="quote-route-fee">{feeShort(hops[i - 1]!.fee)}</span>
              <span className="quote-route-arrow" aria-hidden>
                →
              </span>
            </span>
          )}
          <span className="quote-route-token">
            <TokenIcon symbol={node.symbol} address={node.address} size={18} />
            <span>{node.symbol}</span>
          </span>
        </span>
      ))}
    </span>
  )
}
