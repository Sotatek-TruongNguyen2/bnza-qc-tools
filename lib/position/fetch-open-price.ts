import {
  decodeEventLog,
  keccak256,
  numberToHex,
  pad,
  parseAbiItem,
  toBytes,
  toHex,
  type Hex,
} from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import { NPM_ADDRESS } from './constants'
import { tickToPriceRatio } from './format'
import type { PositionOpenPrice } from './types'

export type { PositionOpenPrice }

const TRANSFER_TOPIC = keccak256(toBytes('Transfer(address,address,uint256)'))
const ZERO_TOPIC = pad('0x0' as Hex, { size: 32 })

const SWAP_EVENT = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
)

const INCREASE_LIQUIDITY_EVENT = parseAbiItem(
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
)

const POOL_SLOT0_ABI = [
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { type: 'uint160' },
      { type: 'int24' },
      { type: 'uint16' },
      { type: 'uint16' },
      { type: 'uint16' },
      { type: 'uint8' },
      { type: 'bool' },
    ],
  },
] as const

/** ~90 days on Base (~2s blocks). Walk newest→oldest; mint Transfer is unique. */
const OPEN_PRICE_LOOKBACK_BLOCKS = 3_888_000n
/** Stay under Base public RPC’s 10_000 inclusive getLogs range. */
const OPEN_PRICE_LOG_CHUNK = 9_999n

function emptyOpenPrice(partial: Partial<PositionOpenPrice> = {}): PositionOpenPrice {
  return {
    found: false,
    txHash: null,
    blockNumber: null,
    openedAtIso: null,
    openedAtLabel: null,
    tick: null,
    sqrtPriceX96: null,
    priceToken1PerToken0: null,
    priceToken0PerToken1: null,
    principalAmount0: null,
    principalAmount1: null,
    liquidity: null,
    source: null,
    note: null,
    error: null,
    links: { tx: null },
    ...partial,
  }
}

/** Etherscan API V2 (Basescan V1 is deprecated). */
async function findMintTxViaBasescan(tokenId: bigint): Promise<Hex | null> {
  const topic3 = pad(toHex(tokenId), { size: 32 })
  const apiKey =
    process.env.BASESCAN_API_KEY ??
    process.env.ETHERSCAN_API_KEY ??
    process.env.ETHERSCAN_API_KEY_V2 ??
    ''
  const qs = new URLSearchParams({
    chainid: '8453',
    module: 'logs',
    action: 'getLogs',
    address: NPM_ADDRESS,
    fromBlock: '0',
    toBlock: 'latest',
    topic0: TRANSFER_TOPIC,
    topic1: ZERO_TOPIC,
    topic3,
    topic0_1_opr: 'and',
    topic1_3_opr: 'and',
  })
  if (apiKey) qs.set('apikey', apiKey)

  try {
    const res = await fetch(`https://api.etherscan.io/v2/api?${qs}`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      status?: string
      message?: string
      result?: Array<{ transactionHash?: string }> | string
    }
    if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) {
      return null
    }
    // Mint Transfer is unique — prefer earliest block if multiple returned
    const sorted = [...data.result].sort((a, b) => {
      const ba = Number((a as { blockNumber?: string }).blockNumber ?? 0)
      const bb = Number((b as { blockNumber?: string }).blockNumber ?? 0)
      return ba - bb
    })
    const hash = sorted[0]?.transactionHash
    return hash?.startsWith('0x') ? (hash as Hex) : null
  } catch {
    return null
  }
}

async function findMintTxViaRpc(client: BasePublicClient, tokenId: bigint): Promise<Hex | null> {
  const latest = await client.getBlockNumber()
  const fromFloor = latest > OPEN_PRICE_LOOKBACK_BLOCKS ? latest - OPEN_PRICE_LOOKBACK_BLOCKS : 0n
  const topic3 = pad(toHex(tokenId), { size: 32 })

  for (let to = latest; to >= fromFloor; to -= OPEN_PRICE_LOG_CHUNK + 1n) {
    const from = to - OPEN_PRICE_LOG_CHUNK < fromFloor ? fromFloor : to - OPEN_PRICE_LOG_CHUNK
    try {
      const logs = (await client.request({
        method: 'eth_getLogs',
        params: [
          {
            address: NPM_ADDRESS,
            fromBlock: numberToHex(from),
            toBlock: numberToHex(to),
            topics: [TRANSFER_TOPIC, ZERO_TOPIC, null, topic3],
          },
        ],
      })) as Array<{ transactionHash: Hex; topics: Hex[] }>

      const match = (logs ?? []).find(
        (l) =>
          (l.topics?.[0] ?? '').toLowerCase() === TRANSFER_TOPIC.toLowerCase() &&
          (l.topics?.[1] ?? '').toLowerCase() === ZERO_TOPIC.toLowerCase(),
      )
      if (match?.transactionHash) return match.transactionHash
    } catch (err) {
      console.warn(
        `[open-price] getLogs ${from}-${to}:`,
        formatRpcError(err, 'getLogs failed'),
      )
    }
  }
  return null
}

export async function fetchPositionOpenPrice(
  client: BasePublicClient,
  args: {
    tokenId: string
    poolAddress: `0x${string}`
    token0Decimals: number
    token1Decimals: number
  },
): Promise<PositionOpenPrice> {
  try {
    const id = BigInt(args.tokenId)
    let txHash = await findMintTxViaBasescan(id)
    if (!txHash) txHash = await findMintTxViaRpc(client, id)

    if (!txHash) {
      return emptyOpenPrice({
        note:
          'Could not find the Uniswap NFT mint Transfer in recent history (~90d). Set ETHERSCAN_API_KEY for full-history lookup.',
      })
    }

    const [receipt, txBlock] = await Promise.all([
      client.getTransactionReceipt({ hash: txHash }),
      client.getTransaction({ hash: txHash }).then(async (tx) => {
        if (tx.blockNumber == null) return null
        return client.getBlock({ blockNumber: tx.blockNumber })
      }),
    ])

    const poolLower = args.poolAddress.toLowerCase()
    let sqrtPriceX96: bigint | null = null
    let tick: number | null = null
    let source: 'swap_event' | 'slot0_parent' | null = null
    let principalAmount0: bigint | null = null
    let principalAmount1: bigint | null = null
    let mintedLiquidity: bigint | null = null

    // Prefer last Swap on this pool in the mint tx (post-swap spot used for LP).
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === poolLower) {
        try {
          const decoded = decodeEventLog({
            abi: [SWAP_EVENT],
            data: log.data,
            topics: log.topics,
          })
          sqrtPriceX96 = decoded.args.sqrtPriceX96 as bigint
          tick = Number(decoded.args.tick)
          source = 'swap_event'
        } catch {
          // not a Swap
        }
      }

      try {
        const decoded = decodeEventLog({
          abi: [INCREASE_LIQUIDITY_EVENT],
          data: log.data,
          topics: log.topics,
        })
        if (decoded.args.tokenId === id) {
          principalAmount0 = decoded.args.amount0 as bigint
          principalAmount1 = decoded.args.amount1 as bigint
          mintedLiquidity = decoded.args.liquidity as bigint
        }
      } catch {
        // not IncreaseLiquidity
      }
    }

    if (sqrtPriceX96 == null || tick == null) {
      const parent = receipt.blockNumber > 0n ? receipt.blockNumber - 1n : 0n
      const slot0 = await client.readContract({
        address: args.poolAddress,
        abi: POOL_SLOT0_ABI,
        functionName: 'slot0',
        blockNumber: parent,
      })
      sqrtPriceX96 = slot0[0] as bigint
      tick = Number(slot0[1])
      source = 'slot0_parent'
    }

    const priceToken1PerToken0 = tickToPriceRatio(
      tick,
      args.token0Decimals,
      args.token1Decimals,
    )
    const priceToken0PerToken1 =
      priceToken1PerToken0 > 0 ? 1 / priceToken1PerToken0 : null

    const openedAtIso = txBlock
      ? new Date(Number(txBlock.timestamp) * 1000).toISOString()
      : null

    return {
      found: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      openedAtIso,
      // Label left null — client formats in local timezone via formatLocalDateTime.
      openedAtLabel: null,
      tick,
      sqrtPriceX96: sqrtPriceX96.toString(),
      priceToken1PerToken0,
      priceToken0PerToken1,
      principalAmount0: principalAmount0?.toString() ?? null,
      principalAmount1: principalAmount1?.toString() ?? null,
      liquidity: mintedLiquidity?.toString() ?? null,
      source,
      note:
        source === 'swap_event'
          ? 'Pool spot from Swap in the mint tx (price when liquidity was added).'
          : 'Pool spot from slot0 at the parent block of the mint tx.',
      error: null,
      links: { tx: `https://basescan.org/tx/${txHash}` },
    }
  } catch (err) {
    return emptyOpenPrice({
      error: formatRpcError(err, 'Failed to resolve open price'),
    })
  }
}
