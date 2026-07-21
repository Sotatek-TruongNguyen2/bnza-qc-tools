import { encodePacked, getAddress, isAddress } from 'viem'
import { formatTokenAmount } from '@/lib/format-token-amount'
import type { BasePublicClient } from '@/lib/rpc'
import {
  BPS,
  CHAIN_ID,
  ERC20_ABI,
  FACTORY_ABI,
  FACTORY_ADDRESS,
  FEE_TIERS,
  INTERMEDIATE_TOKENS,
  KNOWN_TOKEN_META,
  KNOWN_TOKENS,
  QUOTER_ABI,
  QUOTER_ADDRESS,
} from './constants'
import type {
  DiscoveredRoute,
  QuoteResult,
  QuotedRoute,
  RouteHop,
  TokenInfo,
} from './types'

function feeLabel(fee: number): string {
  return `${fee} (${fee / 10_000}%)`
}

function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * (BPS - BigInt(slippageBps))) / BPS
}

function parseHumanAmount(value: string, decimals: number): bigint {
  const [whole, fraction = ''] = value.split('.')
  const paddedFraction = `${fraction}${'0'.repeat(decimals)}`.slice(0, decimals)
  const raw =
    BigInt(whole ?? '0') * 10n ** BigInt(decimals) + BigInt(paddedFraction || '0')
  if (raw <= 0n) throw new Error('amount must be greater than 0')
  return raw
}

async function resolveToken(client: BasePublicClient, input: string): Promise<TokenInfo> {
  const trimmed = input.trim()
  const upper = trimmed.toUpperCase()
  const known = KNOWN_TOKENS[upper as keyof typeof KNOWN_TOKENS]

  const address = known
    ? getAddress(known)
    : isAddress(trimmed)
      ? getAddress(trimmed)
      : null

  if (!address) {
    throw new Error(`Unknown token "${input}". Use USDC/WETH or a 0x address.`)
  }

  const cached = KNOWN_TOKEN_META[address.toLowerCase()]
  if (cached) {
    return { address, ...cached }
  }

  const [symbol, decimals] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
    client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
  ])

  return { address, symbol, decimals: Number(decimals) }
}

async function poolExists(
  client: BasePublicClient,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  fee: number,
): Promise<boolean> {
  const pool = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: [tokenA, tokenB, fee],
  })
  return pool !== '0x0000000000000000000000000000000000000000'
}

function buildPath(hops: RouteHop[]): `0x${string}` {
  const types: Array<'address' | 'uint24'> = []
  const values: Array<`0x${string}` | number> = []

  for (let i = 0; i < hops.length; i += 1) {
    const hop = hops[i]!
    if (i === 0) {
      types.push('address', 'uint24', 'address')
      values.push(hop.tokenIn, hop.fee, hop.tokenOut)
    } else {
      types.push('uint24', 'address')
      values.push(hop.fee, hop.tokenOut)
    }
  }

  return encodePacked(types, values)
}

function routeDescription(
  hops: RouteHop[],
  tokenMeta: Map<string, TokenInfo>,
): string {
  return hops
    .map((hop) => {
      const inSymbol = tokenMeta.get(hop.tokenIn.toLowerCase())?.symbol ?? hop.tokenIn
      const outSymbol = tokenMeta.get(hop.tokenOut.toLowerCase())?.symbol ?? hop.tokenOut
      return `${inSymbol}->${outSymbol} @ ${feeLabel(hop.fee)}`
    })
    .join(' | ')
}

async function discoverRoutes(
  client: BasePublicClient,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = []

  if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
    return [
      {
        kind: 'identity',
        hops: [],
        path: '0x',
        description: `${tokenIn.symbol} -> ${tokenOut.symbol} (same token)`,
      },
    ]
  }

  for (const fee of FEE_TIERS) {
    const exists = await poolExists(client, tokenIn.address, tokenOut.address, fee)
    if (!exists) continue

    routes.push({
      kind: 'direct',
      hops: [{ tokenIn: tokenIn.address, tokenOut: tokenOut.address, fee }],
      path: buildPath([{ tokenIn: tokenIn.address, tokenOut: tokenOut.address, fee }]),
      description: `Direct ${tokenIn.symbol}->${tokenOut.symbol} @ ${feeLabel(fee)}`,
    })
  }

  const intermediates = INTERMEDIATE_TOKENS.map(getAddress).filter((addr) => {
    const lower = addr.toLowerCase()
    return (
      lower !== tokenIn.address.toLowerCase() && lower !== tokenOut.address.toLowerCase()
    )
  })

  for (const intermediate of intermediates) {
    for (const fee1 of FEE_TIERS) {
      const hop1Exists = await poolExists(client, tokenIn.address, intermediate, fee1)
      if (!hop1Exists) continue

      for (const fee2 of FEE_TIERS) {
        const hop2Exists = await poolExists(client, intermediate, tokenOut.address, fee2)
        if (!hop2Exists) continue

        const hops: RouteHop[] = [
          { tokenIn: tokenIn.address, tokenOut: intermediate, fee: fee1 },
          { tokenIn: intermediate, tokenOut: tokenOut.address, fee: fee2 },
        ]

        routes.push({
          kind: 'multi-hop',
          hops,
          path: buildPath(hops),
          description: `Via ${hops.map((h) => h.tokenOut).join(' ')}`,
        })
      }
    }
  }

  return routes
}

async function quoteRoute(
  client: BasePublicClient,
  route: DiscoveredRoute,
  amountInRaw: bigint,
): Promise<{ amountOut: bigint; gasEstimate: bigint; ticksCrossed: number }> {
  if (route.kind === 'identity') {
    return { amountOut: amountInRaw, gasEstimate: 0n, ticksCrossed: 0 }
  }

  if (route.kind === 'direct') {
    const hop = route.hops[0]!
    const result = await client.readContract({
      address: QUOTER_ADDRESS,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn: hop.tokenIn,
          tokenOut: hop.tokenOut,
          amountIn: amountInRaw,
          fee: hop.fee,
          sqrtPriceLimitX96: 0n,
        },
      ],
    })

    return {
      amountOut: result[0],
      gasEstimate: result[3],
      ticksCrossed: Number(result[2]),
    }
  }

  const result = await client.readContract({
    address: QUOTER_ADDRESS,
    abi: QUOTER_ABI,
    functionName: 'quoteExactInput',
    args: [route.path, amountInRaw],
  })

  const ticksList = result[2] as readonly number[]
  return {
    amountOut: result[0],
    gasEstimate: result[3],
    ticksCrossed: ticksList.reduce((sum, n) => sum + Number(n), 0),
  }
}

async function quoteAllRoutes(
  client: BasePublicClient,
  routes: DiscoveredRoute[],
  amountInRaw: bigint,
  tokenMeta: Map<string, TokenInfo>,
  slippageBps: number,
): Promise<QuotedRoute[]> {
  const quoted: QuotedRoute[] = []

  for (const route of routes) {
    try {
      const quote = await quoteRoute(client, route, amountInRaw)
      if (quote.amountOut <= 0n) continue

      quoted.push({
        ...route,
        description:
          route.kind === 'multi-hop'
            ? routeDescription(route.hops, tokenMeta)
            : route.description,
        amountOut: quote.amountOut.toString(),
        amountOutMinimum: applySlippage(quote.amountOut, slippageBps).toString(),
        gasEstimate: quote.gasEstimate.toString(),
        ticksCrossed: quote.ticksCrossed,
      })
    } catch {
      // Route exists on factory but quoter reverted
    }
  }

  quoted.sort((a, b) => {
    const outDiff = BigInt(b.amountOut) - BigInt(a.amountOut)
    if (outDiff > 0n) return 1
    if (outDiff < 0n) return -1
    return Number(BigInt(a.gasEstimate) - BigInt(b.gasEstimate))
  })

  return quoted
}

export async function fetchQuotes(
  client: BasePublicClient,
  params: {
    amount: string
    tokenIn: string
    tokenOut: string
    slippageBps: number
  },
): Promise<QuoteResult> {
  const [tokenIn, tokenOut] = await Promise.all([
    resolveToken(client, params.tokenIn),
    resolveToken(client, params.tokenOut),
  ])

  const amountInRaw = parseHumanAmount(params.amount, tokenIn.decimals)
  const routes = await discoverRoutes(client, tokenIn, tokenOut)

  const tokenMeta = new Map<string, TokenInfo>([
    [tokenIn.address.toLowerCase(), tokenIn],
    [tokenOut.address.toLowerCase(), tokenOut],
  ])

  for (const addr of INTERMEDIATE_TOKENS) {
    const address = getAddress(addr)
    const lower = address.toLowerCase()
    const cached = KNOWN_TOKEN_META[lower]
    tokenMeta.set(
      lower,
      cached ? { address, ...cached } : await resolveToken(client, address),
    )
  }

  const normalizedRoutes = routes.map((route) => ({
    ...route,
    description:
      route.kind === 'multi-hop'
        ? routeDescription(route.hops, tokenMeta)
        : route.description,
  }))

  const quoted = await quoteAllRoutes(
    client,
    normalizedRoutes,
    amountInRaw,
    tokenMeta,
    params.slippageBps,
  )

  return {
    chainId: CHAIN_ID,
    network: 'Base mainnet',
    tokenIn,
    tokenOut,
    amountIn: amountInRaw.toString(),
    amountInHuman: `${params.amount} ${tokenIn.symbol}`,
    slippageBps: params.slippageBps,
    slippagePercent: params.slippageBps / 100,
    quoterAddress: QUOTER_ADDRESS,
    factoryAddress: FACTORY_ADDRESS,
    routesFound: normalizedRoutes.length,
    quotes: quoted.map((route, index) => ({
      rank: index + 1,
      kind: route.kind,
      description: route.description,
      hops: route.hops,
      path: route.path,
      amountOut: route.amountOut,
      amountOutHuman: formatTokenAmount(
        BigInt(route.amountOut),
        tokenOut.decimals,
        tokenOut.symbol,
      ),
      amountOutMinimum: route.amountOutMinimum,
      amountOutMinimumHuman: formatTokenAmount(
        BigInt(route.amountOutMinimum),
        tokenOut.decimals,
        tokenOut.symbol,
      ),
      gasEstimate: route.gasEstimate,
      ticksCrossed: route.ticksCrossed,
    })),
  }
}
