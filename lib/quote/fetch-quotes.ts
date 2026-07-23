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
  INTERMEDIATE_TOKEN_META,
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

function asAddress(value: string): `0x${string}` {
  // Always lowercase first so a bad mixed-case checksum cannot abort quoting.
  return getAddress(value.toLowerCase() as `0x${string}`)
}

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
    ? asAddress(known)
    : isAddress(trimmed, { strict: false })
      ? asAddress(trimmed)
      : null

  if (!address) {
    throw new Error(`Unknown token "${input}". Use USDC/WETH or a 0x address.`)
  }

  const cached =
    KNOWN_TOKEN_META[address.toLowerCase()] ?? INTERMEDIATE_TOKEN_META[address.toLowerCase()]
  if (cached) {
    return { address, ...cached }
  }

  const [symbol, decimals] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
    client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
  ])

  return { address, symbol, decimals: Number(decimals) }
}

function poolKey(tokenA: string, tokenB: string, fee: number): string {
  const a = tokenA.toLowerCase()
  const b = tokenB.toLowerCase()
  return a < b ? `${a}|${b}|${fee}` : `${b}|${a}|${fee}`
}

/** One Multicall3 round-trip for many factory.getPool checks. */
async function fetchPoolsExist(
  client: BasePublicClient,
  queries: Array<{ tokenA: `0x${string}`; tokenB: `0x${string}`; fee: number }>,
): Promise<Map<string, boolean>> {
  const unique = new Map<string, { tokenA: `0x${string}`; tokenB: `0x${string}`; fee: number }>()
  for (const q of queries) {
    const key = poolKey(q.tokenA, q.tokenB, q.fee)
    if (!unique.has(key)) unique.set(key, q)
  }

  const list = [...unique.entries()]
  const results = await client.multicall({
    contracts: list.map(([, q]) => ({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'getPool' as const,
      args: [q.tokenA, q.tokenB, q.fee] as const,
    })),
    allowFailure: true,
  })

  const out = new Map<string, boolean>()
  for (let i = 0; i < list.length; i += 1) {
    const [key] = list[i]!
    const item = results[i]!
    if (item.status !== 'success') {
      out.set(key, false)
      continue
    }
    const pool = item.result as `0x${string}`
    out.set(key, pool !== '0x0000000000000000000000000000000000000000')
  }
  return out
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

function routeDescription(hops: RouteHop[], tokenMeta: Map<string, TokenInfo>): string {
  return hops
    .map((hop) => {
      const inSymbol = tokenMeta.get(hop.tokenIn.toLowerCase())?.symbol ?? hop.tokenIn.slice(0, 8)
      const outSymbol =
        tokenMeta.get(hop.tokenOut.toLowerCase())?.symbol ?? hop.tokenOut.slice(0, 8)
      return `${inSymbol}→${outSymbol} @ ${feeLabel(hop.fee)}`
    })
    .join(' · ')
}

function dedupeRoutes(routes: DiscoveredRoute[]): DiscoveredRoute[] {
  const seen = new Set<string>()
  const out: DiscoveredRoute[] = []
  for (const route of routes) {
    const key = route.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(route)
  }
  return out
}

async function discoverRoutes(
  client: BasePublicClient,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
): Promise<DiscoveredRoute[]> {
  if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
    return [
      {
        kind: 'identity',
        hops: [],
        path: '0x',
        description: `${tokenIn.symbol} → ${tokenOut.symbol} (same token)`,
      },
    ]
  }

  const intermediates = INTERMEDIATE_TOKENS.map(asAddress).filter((addr) => {
    const lower = addr.toLowerCase()
    return (
      lower !== tokenIn.address.toLowerCase() && lower !== tokenOut.address.toLowerCase()
    )
  })

  // Unique getPool queries — batched in one Multicall3 RPC (was ~200 separate calls).
  const poolQueries: Array<{ tokenA: `0x${string}`; tokenB: `0x${string}`; fee: number }> = []
  for (const fee of FEE_TIERS) {
    poolQueries.push({ tokenA: tokenIn.address, tokenB: tokenOut.address, fee })
  }
  for (const intermediate of intermediates) {
    for (const fee of FEE_TIERS) {
      poolQueries.push({ tokenA: tokenIn.address, tokenB: intermediate, fee })
      poolQueries.push({ tokenA: intermediate, tokenB: tokenOut.address, fee })
    }
  }

  const exists = await fetchPoolsExist(client, poolQueries)
  const hasPool = (a: `0x${string}`, b: `0x${string}`, fee: number) =>
    exists.get(poolKey(a, b, fee)) === true

  const routes: DiscoveredRoute[] = []

  for (const fee of FEE_TIERS) {
    if (!hasPool(tokenIn.address, tokenOut.address, fee)) continue
    const hops: RouteHop[] = [
      { tokenIn: tokenIn.address, tokenOut: tokenOut.address, fee },
    ]
    routes.push({
      kind: 'direct',
      hops,
      path: buildPath(hops),
      description: `Direct ${tokenIn.symbol}→${tokenOut.symbol} @ ${feeLabel(fee)}`,
    })
  }

  for (const intermediate of intermediates) {
    for (const fee1 of FEE_TIERS) {
      if (!hasPool(tokenIn.address, intermediate, fee1)) continue
      for (const fee2 of FEE_TIERS) {
        if (!hasPool(intermediate, tokenOut.address, fee2)) continue
        const hops: RouteHop[] = [
          { tokenIn: tokenIn.address, tokenOut: intermediate, fee: fee1 },
          { tokenIn: intermediate, tokenOut: tokenOut.address, fee: fee2 },
        ]
        routes.push({
          kind: 'multi-hop',
          hops,
          path: buildPath(hops),
          description: `2-hop via intermediate`,
        })
      }
    }
  }

  return dedupeRoutes(routes)
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

  // Multi-hop: QuoterV2 quoteExactInput is non-view (returns via eth_call).
  try {
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
  } catch {
    const { result } = await client.simulateContract({
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
}

/** QuoterV2 is non-view (revert-style returns) — cannot Multicall reliably. Cap concurrency. */
const QUOTE_CONCURRENCY = 6

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next
      next += 1
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]!) }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function quoteAllRoutes(
  client: BasePublicClient,
  routes: DiscoveredRoute[],
  amountInRaw: bigint,
  tokenMeta: Map<string, TokenInfo>,
  slippageBps: number,
): Promise<QuotedRoute[]> {
  const settled = await mapPool(routes, QUOTE_CONCURRENCY, async (route) => {
    const quote = await quoteRoute(client, route, amountInRaw)
    if (quote.amountOut <= 0n) return null

    return {
      ...route,
      description:
        route.kind === 'multi-hop'
          ? routeDescription(route.hops, tokenMeta)
          : route.description,
      amountOut: quote.amountOut.toString(),
      amountOutMinimum: applySlippage(quote.amountOut, slippageBps).toString(),
      gasEstimate: quote.gasEstimate.toString(),
      ticksCrossed: quote.ticksCrossed,
    } satisfies QuotedRoute
  })

  const quoted: QuotedRoute[] = []
  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) quoted.push(item.value)
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
    try {
      const address = asAddress(addr)
      const lower = address.toLowerCase()
      const cached = INTERMEDIATE_TOKEN_META[lower]
      tokenMeta.set(
        lower,
        cached ? { address, ...cached } : await resolveToken(client, address),
      )
    } catch {
      // Skip a bad hub address — do not fail the whole quote.
    }
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

  const directFound = normalizedRoutes.filter((r) => r.kind === 'direct').length
  const multiHopFound = normalizedRoutes.filter((r) => r.kind === 'multi-hop').length
  const directQuoted = quoted.filter((r) => r.kind === 'direct').length
  const multiHopQuoted = quoted.filter((r) => r.kind === 'multi-hop').length

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
    routeStats: {
      directFound,
      multiHopFound,
      directQuoted,
      multiHopQuoted,
      intermediates: INTERMEDIATE_TOKENS.length,
    },
    quotes: quoted.map((route, index) => ({
      rank: index + 1,
      kind: route.kind,
      description: route.description,
      hops: route.hops,
      hopCount: route.hops.length || 1,
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
