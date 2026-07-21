import { decodeEventLog, formatUnits, getAddress, isHash, parseAbiItem } from 'viem'
import { CHAIN_ID, NPM_ADDRESS } from '@/lib/position/constants'
import { fetchPosition } from '@/lib/position/fetch-position'
import { basescanLink, formatPrice } from '@/lib/position/format'
import type { BasePublicClient } from '@/lib/rpc'
import type { TxPnlCombinedLeg, TxPnlHlLeg, TxPnlResult } from './types'

const POSITION_OPENED_EVENT = parseAbiItem(
  'event PositionOpened(address indexed owner, bytes32 indexed botId, uint256 indexed positionId, uint256 tokenId, address pool, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 totalUsdc, uint256 uniswapUsdc, uint256 hyperliquidUsdc)',
)

function formatUsdc(raw: bigint): string {
  return `${Number(formatUnits(raw, 6)).toLocaleString('en-US', { maximumFractionDigits: 6 })} USDC`
}

function formatSignedUsdc(raw: bigint): string {
  const sign = raw < 0n ? '-' : '+'
  const abs = raw < 0n ? -raw : raw
  return `${sign}${formatUsdc(abs)}`
}

function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(4)}%`
}

function usdcPriceOfPositionLegs(args: {
  wethRaw: bigint
  wethPriceUsdc: number
  usdcRaw: bigint
}): bigint {
  const wethUsdcRaw = BigInt(Math.round(Number(formatUnits(args.wethRaw, 18)) * args.wethPriceUsdc * 1_000_000))
  return wethUsdcRaw + args.usdcRaw
}

function usdToUsdcRaw(valueUsd: number): bigint {
  return BigInt(Math.round(valueUsd * 1_000_000))
}

function pctFromPnl(entryUsdcRaw: bigint, pnlUsdcRaw: bigint): number {
  const entryNum = Number(formatUnits(entryUsdcRaw, 6))
  if (entryNum <= 0) return 0
  return (Number(formatUnits(pnlUsdcRaw, 6)) / entryNum) * 100
}

function computeHlLeg(args: {
  currentHlTotalUsdc: number
  entryHyperliquidUsdc: bigint
}): TxPnlHlLeg {
  const currentHlTotalUsdc = usdToUsdcRaw(args.currentHlTotalUsdc)
  const hlTotalPnlUsdc = currentHlTotalUsdc - args.entryHyperliquidUsdc

  return {
    entryHyperliquidUsdc: args.entryHyperliquidUsdc.toString(),
    currentHlTotalUsdc: currentHlTotalUsdc.toString(),
    hlTotalPnlUsdc: hlTotalPnlUsdc.toString(),
    hlTotalPnlPct: pctFromPnl(args.entryHyperliquidUsdc, hlTotalPnlUsdc),
  }
}

export async function fetchTxPnl(
  client: BasePublicClient,
  txHash: string,
  options?: { currentHlTotalUsdc?: number | null },
): Promise<TxPnlResult> {
  const trimmedHash = txHash.trim()
  if (!isHash(trimmedHash)) throw new Error('txHash must be a valid 0x transaction hash')

  const [receipt, tx] = await Promise.all([
    client.getTransactionReceipt({ hash: trimmedHash as `0x${string}` }),
    client.getTransaction({ hash: trimmedHash as `0x${string}` }),
  ])

  let decoded:
    | {
        owner: `0x${string}`
        tokenId: bigint
        pool: `0x${string}`
        totalUsdc: bigint
        uniswapUsdc: bigint
        hyperliquidUsdc: bigint
      }
    | null = null

  for (const log of receipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: [POSITION_OPENED_EVENT],
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName !== 'PositionOpened') continue
      decoded = {
        owner: getAddress(parsed.args.owner),
        tokenId: parsed.args.tokenId,
        pool: getAddress(parsed.args.pool),
        totalUsdc: parsed.args.totalUsdc,
        uniswapUsdc: parsed.args.uniswapUsdc,
        hyperliquidUsdc: parsed.args.hyperliquidUsdc,
      }
      break
    } catch {
      continue
    }
  }

  if (!decoded) {
    throw new Error('No PositionOpened event found in this tx. Use an EXBOT open-position transaction.')
  }

  const position = await fetchPosition(client, decoded.tokenId.toString())
  const principal0 = BigInt(position.raw.principalAmount0)
  const principal1 = BigInt(position.raw.principalAmount1)
  const fee0 = BigInt(position.raw.uncollectedFees0)
  const fee1 = BigInt(position.raw.uncollectedFees1)

  const isWethUsdcPair =
    position.raw.token0Symbol === 'WETH' && position.raw.token1Symbol === 'USDC'
  if (!isWethUsdcPair) {
    throw new Error(`Only WETH/USDC PnL is supported right now. Got ${position.raw.pair}.`)
  }

  const currentPrice = position.raw.priceToken1PerToken0AtCurrentTick
  const currentPrincipalUsdc = usdcPriceOfPositionLegs({
    wethRaw: principal0,
    wethPriceUsdc: currentPrice,
    usdcRaw: principal1,
  })
  const currentFeesUsdc = usdcPriceOfPositionLegs({
    wethRaw: fee0,
    wethPriceUsdc: currentPrice,
    usdcRaw: fee1,
  })
  const currentTotalUsdc = currentPrincipalUsdc + currentFeesUsdc

  const principalOnlyPnlUsdc = currentPrincipalUsdc - decoded.uniswapUsdc
  const totalPnlUsdc = currentTotalUsdc - decoded.uniswapUsdc
  const entryUniswapUsdcNum = Number(formatUnits(decoded.uniswapUsdc, 6))
  const principalOnlyPnlPct =
    entryUniswapUsdcNum > 0
      ? (Number(formatUnits(principalOnlyPnlUsdc, 6)) / entryUniswapUsdcNum) * 100
      : 0
  const totalPnlPct =
    entryUniswapUsdcNum > 0 ? (Number(formatUnits(totalPnlUsdc, 6)) / entryUniswapUsdcNum) * 100 : 0

  const block = await client.getBlock({ blockHash: receipt.blockHash })
  const blockTimeIso = new Date(Number(block.timestamp) * 1000).toISOString()

  let hlLeg: TxPnlHlLeg | null = null
  let combinedLeg: TxPnlCombinedLeg | null = null

  if (options?.currentHlTotalUsdc != null && Number.isFinite(options.currentHlTotalUsdc)) {
    hlLeg = computeHlLeg({
      currentHlTotalUsdc: options.currentHlTotalUsdc,
      entryHyperliquidUsdc: decoded.hyperliquidUsdc,
    })

    const combinedCurrentTotalUsdc = currentTotalUsdc + BigInt(hlLeg.currentHlTotalUsdc)
    const combinedTotalPnlUsdc = combinedCurrentTotalUsdc - decoded.totalUsdc
    combinedLeg = {
      currentCombinedTotalUsdc: combinedCurrentTotalUsdc.toString(),
      combinedTotalPnlUsdc: combinedTotalPnlUsdc.toString(),
      combinedTotalPnlPct: pctFromPnl(decoded.totalUsdc, combinedTotalPnlUsdc),
    }
  }

  return {
    raw: {
      chainId: CHAIN_ID,
      network: 'Base mainnet',
      txHash: trimmedHash,
      tokenId: decoded.tokenId.toString(),
      openedAtIso: blockTimeIso,
      poolAddress: decoded.pool,
      txFrom: getAddress(tx.from),
      txTo: tx.to ? getAddress(tx.to) : null,
      entryTotalUsdc: decoded.totalUsdc.toString(),
      entryUniswapUsdc: decoded.uniswapUsdc.toString(),
      entryHyperliquidUsdc: decoded.hyperliquidUsdc.toString(),
      currentPrincipalUsdc: currentPrincipalUsdc.toString(),
      currentFeesUsdc: currentFeesUsdc.toString(),
      currentTotalUsdc: currentTotalUsdc.toString(),
      principalOnlyPnlUsdc: principalOnlyPnlUsdc.toString(),
      totalPnlUsdc: totalPnlUsdc.toString(),
      principalOnlyPnlPct,
      totalPnlPct,
      hlLeg,
      combinedLeg,
      currentPriceUsdcPerWeth: currentPrice,
      currentPrincipalAmount0: principal0.toString(),
      currentPrincipalAmount1: principal1.toString(),
      currentUncollectedFees0: fee0.toString(),
      currentUncollectedFees1: fee1.toString(),
      token0Symbol: position.raw.token0Symbol,
      token1Symbol: position.raw.token1Symbol,
      links: {
        tx: `https://basescan.org/tx/${trimmedHash}`,
        pool: basescanLink(decoded.pool),
        positionManager: basescanLink(NPM_ADDRESS),
        owner: basescanLink(decoded.owner),
      },
    },
    human: {
      summary: combinedLeg
        ? `Combined PnL now vs open tx · tokenId #${decoded.tokenId}`
        : `PnL now vs open tx · tokenId #${decoded.tokenId}`,
      tokenId: decoded.tokenId.toString(),
      entryUniswapUsdc: formatUsdc(decoded.uniswapUsdc),
      entryHyperliquidUsdc: formatUsdc(decoded.hyperliquidUsdc),
      entryTotalUsdc: formatUsdc(decoded.totalUsdc),
      currentPrincipalUsdc: formatUsdc(currentPrincipalUsdc),
      currentFeesUsdc: formatUsdc(currentFeesUsdc),
      currentTotalUsdc: formatUsdc(currentTotalUsdc),
      principalOnlyPnl: formatSignedUsdc(principalOnlyPnlUsdc),
      totalPnl: formatSignedUsdc(totalPnlUsdc),
      principalOnlyPnlPct: formatPct(principalOnlyPnlPct),
      totalPnlPct: formatPct(totalPnlPct),
      hlLeg: hlLeg
        ? {
            entryHyperliquidUsdc: formatUsdc(decoded.hyperliquidUsdc),
            currentHlTotal: formatUsdc(BigInt(hlLeg.currentHlTotalUsdc)),
            hlTotalPnl: formatSignedUsdc(BigInt(hlLeg.hlTotalPnlUsdc)),
            hlTotalPnlPct: formatPct(hlLeg.hlTotalPnlPct),
          }
        : null,
      combinedLeg: combinedLeg
        ? {
            currentCombinedTotal: formatUsdc(BigInt(combinedLeg.currentCombinedTotalUsdc)),
            combinedTotalPnl: formatSignedUsdc(BigInt(combinedLeg.combinedTotalPnlUsdc)),
            combinedTotalPnlPct: formatPct(combinedLeg.combinedTotalPnlPct),
          }
        : null,
      entrySplit: `${formatUsdc(decoded.uniswapUsdc)} Uniswap / ${formatUsdc(decoded.hyperliquidUsdc)} Hyperliquid / ${formatUsdc(decoded.totalUsdc)} total`,
      currentPrice: formatPrice('USDC per WETH', currentPrice),
      currentPrincipal: {
        token0: position.human.principal.token0,
        token1: position.human.principal.token1,
      },
      currentUncollectedFees: {
        token0: position.human.uncollectedFees.token0,
        token1: position.human.uncollectedFees.token1,
        note: position.human.uncollectedFees.note,
      },
      caveats: [
        combinedLeg
          ? 'HL entry basis is hyperliquidUsdc from the open tx; current HL value is your input.'
          : 'Uniswap leg only — add current HL leg value (USDC) to include the Hyperliquid hedge.',
        'Current HL value should be the mark-to-market equity/value of the HL leg now (from Hyperliquid).',
        'Spot mark-to-market at current pool price for the Uniswap leg, not guaranteed execution.',
        'Does not include close gas, EXBOT close-side fees, or BNZA buyback.',
      ],
      links: {
        tx: `https://basescan.org/tx/${trimmedHash}`,
        pool: basescanLink(decoded.pool),
        positionManager: basescanLink(NPM_ADDRESS),
        owner: basescanLink(decoded.owner),
      },
    },
  }
}
