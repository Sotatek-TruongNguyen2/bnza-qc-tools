export type TokenInfo = {
  address: `0x${string}`
  symbol: string
  decimals: number
}

export type RouteHop = {
  tokenIn: `0x${string}`
  tokenOut: `0x${string}`
  fee: number
}

export type DiscoveredRoute = {
  kind: 'identity' | 'direct' | 'multi-hop'
  hops: RouteHop[]
  path: `0x${string}`
  description: string
}

export type QuotedRoute = DiscoveredRoute & {
  amountOut: string
  amountOutMinimum: string
  gasEstimate: string
  ticksCrossed: number
}

export type QuoteResult = {
  chainId: number
  network: string
  tokenIn: TokenInfo
  tokenOut: TokenInfo
  amountIn: string
  amountInHuman: string
  slippageBps: number
  slippagePercent: number
  quoterAddress: string
  factoryAddress: string
  routesFound: number
  routeStats: {
    directFound: number
    multiHopFound: number
    directQuoted: number
    multiHopQuoted: number
    intermediates: number
  }
  quotes: Array<{
    rank: number
    kind: QuotedRoute['kind']
    description: string
    hops: RouteHop[]
    hopCount: number
    path: string
    amountOut: string
    amountOutHuman: string
    amountOutMinimum: string
    amountOutMinimumHuman: string
    gasEstimate: string
    ticksCrossed: number
  }>
}
