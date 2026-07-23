import { formatUnits } from 'viem'
import {
  POSITION_MANAGER_ABI,
  POSITION_MANAGER_ADDRESS,
} from '@/lib/bot/constants'
import { CHAIN_ID } from '@/lib/position/constants'
import { fetchPosition } from '@/lib/position/fetch-position'
import { formatPrice, formatTokenAmount } from '@/lib/position/format'
import type { BasePublicClient } from '@/lib/rpc'
import { buildTxPnlCalcHints, type TxPnlCalcHints } from '@/lib/tx-pnl/build-tx-pnl-calc-hints'

export type UniswapLegPnlResult = {
  raw: {
    chainId: number
    network: string
    tokenId: string
    positionStatus: 'open' | 'closed'
    pnlMode: 'live' | 'closed-needs-close-tx'
    entryUniswapUsdc: string
    entryHyperliquidUsdc: string
    entryTotalUsdc: string
    currentPrincipalUsdc: string
    currentFeesUsdc: string
    currentTotalUsdc: string
    principalOnlyPnlUsdc: string | null
    totalPnlUsdc: string | null
    principalOnlyPnlPct: number | null
    totalPnlPct: number | null
    currentPriceUsdcPerWeth: number
    token0Symbol: string
    token1Symbol: string
  }
  human: {
    summary: string
    closedNotice: string | null
    entryUniswapUsdc: string
    currentPrincipalUsdc: string
    currentFeesUsdc: string
    currentTotalUsdc: string
    principalOnlyPnl: string | null
    totalPnl: string | null
    principalOnlyPnlPct: string | null
    totalPnlPct: string | null
    currentPrice: string
    currentPrincipal: { token0: string; token1: string }
    currentUncollectedFees: { token0: string; token1: string; note: string }
    calcHints: TxPnlCalcHints
    caveats: string[]
  }
}

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
  const wethUsdcRaw = BigInt(
    Math.round(Number(formatUnits(args.wethRaw, 18)) * args.wethPriceUsdc * 1_000_000),
  )
  return wethUsdcRaw + args.usdcRaw
}

function pctFromPnl(entryUsdcRaw: bigint, pnlUsdcRaw: bigint): number {
  const entryNum = Number(formatUnits(entryUsdcRaw, 6))
  if (entryNum <= 0) return 0
  return (Number(formatUnits(pnlUsdcRaw, 6)) / entryNum) * 100
}

/**
 * Live Uniswap-leg PnL for a tokenId.
 * Entry = EXBOT getPositionDeployment.uniswapUsdc (same basis as PositionOpened).
 */
export async function fetchUniswapLegPnl(
  client: BasePublicClient,
  tokenIdInput: string,
): Promise<UniswapLegPnlResult> {
  const tokenId = tokenIdInput.trim()
  if (!/^\d+$/.test(tokenId)) throw new Error('tokenId must be a positive integer')

  const id = BigInt(tokenId)
  const position = await fetchPosition(client, tokenId)

  const isWethUsdc =
    position.raw.token0Symbol === 'WETH' && position.raw.token1Symbol === 'USDC'
  if (!isWethUsdc) {
    throw new Error(`Only WETH/USDC Uniswap PnL is supported right now. Got ${position.raw.pair}.`)
  }

  const positionInfo = await client.readContract({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPosition',
    args: [id],
  })

  if (positionInfo.tokenId === 0n && positionInfo.owner === '0x0000000000000000000000000000000000000000') {
    throw new Error('tokenId not found on EXBOT position manager')
  }

  const deployment = await client.readContract({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPositionDeployment',
    args: [positionInfo.owner, positionInfo.botId, positionInfo.positionId],
  })

  const entryUniswapUsdc = deployment.uniswapUsdc
  if (entryUniswapUsdc === 0n) {
    throw new Error(
      'Entry Uniswap USDC is 0 on-chain. This NFT may not be an EXBOT-managed position.',
    )
  }

  const currentPrice = position.raw.priceToken1PerToken0AtCurrentTick
  const isClosed = BigInt(position.raw.liquidity) === 0n

  if (isClosed) {
    const calcHints = buildTxPnlCalcHints({
      mode: 'closed-needs-close-tx',
      token0Symbol: position.raw.token0Symbol,
      token1Symbol: position.raw.token1Symbol,
      principal0Human: position.human.principal.token0,
      principal1Human: position.human.principal.token1,
      fees0Human: position.human.uncollectedFees.token0,
      fees1Human: position.human.uncollectedFees.token1,
      currentPriceUsdcPerWeth: currentPrice,
      currentPrincipalUsdc: 0n,
      currentFeesUsdc: 0n,
      currentTotalUsdc: 0n,
      entryUniswapUsdc,
      entryHyperliquidUsdc: deployment.hyperliquidUsdc,
      entryTotalUsdc: deployment.totalUsdc,
      principalOnlyPnlUsdc: null,
      totalPnlUsdc: null,
      principalOnlyPnlPct: null,
      totalPnlPct: null,
      hlLeg: null,
      combinedLeg: null,
    })

    return {
      raw: {
        chainId: CHAIN_ID,
        network: 'Base mainnet',
        tokenId,
        positionStatus: 'closed',
        pnlMode: 'closed-needs-close-tx',
        entryUniswapUsdc: entryUniswapUsdc.toString(),
        entryHyperliquidUsdc: deployment.hyperliquidUsdc.toString(),
        entryTotalUsdc: deployment.totalUsdc.toString(),
        currentPrincipalUsdc: '0',
        currentFeesUsdc: '0',
        currentTotalUsdc: '0',
        principalOnlyPnlUsdc: null,
        totalPnlUsdc: null,
        principalOnlyPnlPct: null,
        totalPnlPct: null,
        currentPriceUsdcPerWeth: currentPrice,
        token0Symbol: position.raw.token0Symbol,
        token1Symbol: position.raw.token1Symbol,
      },
      human: {
        summary: `Position closed · tokenId #${tokenId}`,
        closedNotice:
          'This LP is closed (liquidity = 0). Use the PnL tab with open + close tx hashes for realized Uniswap PnL.',
        entryUniswapUsdc: formatUsdc(entryUniswapUsdc),
        currentPrincipalUsdc: formatUsdc(0n),
        currentFeesUsdc: formatUsdc(0n),
        currentTotalUsdc: formatUsdc(0n),
        principalOnlyPnl: null,
        totalPnl: null,
        principalOnlyPnlPct: null,
        totalPnlPct: null,
        currentPrice: formatPrice('USDC per WETH', currentPrice),
        currentPrincipal: {
          token0: formatTokenAmount(0n, position.raw.token0Decimals, position.raw.token0Symbol),
          token1: formatTokenAmount(0n, position.raw.token1Decimals, position.raw.token1Symbol),
        },
        currentUncollectedFees: {
          token0: formatTokenAmount(0n, position.raw.token0Decimals, position.raw.token0Symbol),
          token1: formatTokenAmount(0n, position.raw.token1Decimals, position.raw.token1Symbol),
          note: 'Settled in close tx — not on the NFT.',
        },
        calcHints,
        caveats: [
          'Closed NFT — live mark would look like −100% and is hidden.',
          'PnL tab supports realized Uniswap PnL when you paste the close tx.',
        ],
      },
    }
  }

  const principal0 = BigInt(position.raw.principalAmount0)
  const principal1 = BigInt(position.raw.principalAmount1)
  const fee0 = BigInt(position.raw.uncollectedFees0)
  const fee1 = BigInt(position.raw.uncollectedFees1)

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
  const principalOnlyPnlUsdc = currentPrincipalUsdc - entryUniswapUsdc
  const totalPnlUsdc = currentTotalUsdc - entryUniswapUsdc
  const principalOnlyPnlPct = pctFromPnl(entryUniswapUsdc, principalOnlyPnlUsdc)
  const totalPnlPct = pctFromPnl(entryUniswapUsdc, totalPnlUsdc)

  const calcHints = buildTxPnlCalcHints({
    mode: 'live',
    token0Symbol: position.raw.token0Symbol,
    token1Symbol: position.raw.token1Symbol,
    principal0Human: position.human.principal.token0,
    principal1Human: position.human.principal.token1,
    fees0Human: position.human.uncollectedFees.token0,
    fees1Human: position.human.uncollectedFees.token1,
    currentPriceUsdcPerWeth: currentPrice,
    currentPrincipalUsdc,
    currentFeesUsdc,
    currentTotalUsdc,
    entryUniswapUsdc,
    entryHyperliquidUsdc: deployment.hyperliquidUsdc,
    entryTotalUsdc: deployment.totalUsdc,
    principalOnlyPnlUsdc,
    totalPnlUsdc,
    principalOnlyPnlPct,
    totalPnlPct,
    hlLeg: null,
    combinedLeg: null,
  })

  return {
    raw: {
      chainId: CHAIN_ID,
      network: 'Base mainnet',
      tokenId,
      positionStatus: 'open',
      pnlMode: 'live',
      entryUniswapUsdc: entryUniswapUsdc.toString(),
      entryHyperliquidUsdc: deployment.hyperliquidUsdc.toString(),
      entryTotalUsdc: deployment.totalUsdc.toString(),
      currentPrincipalUsdc: currentPrincipalUsdc.toString(),
      currentFeesUsdc: currentFeesUsdc.toString(),
      currentTotalUsdc: currentTotalUsdc.toString(),
      principalOnlyPnlUsdc: principalOnlyPnlUsdc.toString(),
      totalPnlUsdc: totalPnlUsdc.toString(),
      principalOnlyPnlPct,
      totalPnlPct,
      currentPriceUsdcPerWeth: currentPrice,
      token0Symbol: position.raw.token0Symbol,
      token1Symbol: position.raw.token1Symbol,
    },
    human: {
      summary: `Uniswap-leg live PnL · tokenId #${tokenId}`,
      closedNotice: null,
      entryUniswapUsdc: formatUsdc(entryUniswapUsdc),
      currentPrincipalUsdc: formatUsdc(currentPrincipalUsdc),
      currentFeesUsdc: formatUsdc(currentFeesUsdc),
      currentTotalUsdc: formatUsdc(currentTotalUsdc),
      principalOnlyPnl: formatSignedUsdc(principalOnlyPnlUsdc),
      totalPnl: formatSignedUsdc(totalPnlUsdc),
      principalOnlyPnlPct: formatPct(principalOnlyPnlPct),
      totalPnlPct: formatPct(totalPnlPct),
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
      calcHints,
      caveats: [
        'Uniswap leg only — Hyperliquid is excluded.',
        'Entry = EXBOT deployment uniswapUsdc (same as PositionOpened).',
        'Live mark at current pool price; not a close estimate (no slippage / fee haircut).',
      ],
    },
  }
}
