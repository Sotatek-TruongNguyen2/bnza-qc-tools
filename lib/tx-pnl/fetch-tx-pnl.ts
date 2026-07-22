import { decodeEventLog, formatUnits, getAddress, isHash, parseAbiItem } from 'viem'
import { CHAIN_ID, NPM_ADDRESS } from '@/lib/position/constants'
import { fetchPosition } from '@/lib/position/fetch-position'
import { basescanLink, formatPrice, formatTokenAmount } from '@/lib/position/format'
import type { BasePublicClient } from '@/lib/rpc'
import { buildTxPnlCalcHints } from './build-tx-pnl-calc-hints'
import { decodeCloseTx } from './decode-close-tx'
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
  const wethUsdcRaw = BigInt(
    Math.round(Number(formatUnits(args.wethRaw, 18)) * args.wethPriceUsdc * 1_000_000),
  )
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
  options?: { currentHlTotalUsdc?: number | null; closeTxHash?: string | null },
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
  const isClosed = BigInt(position.raw.liquidity) === 0n
  const closeTxHashInput = options?.closeTxHash?.trim() || null

  const isWethUsdcPair =
    position.raw.token0Symbol === 'WETH' && position.raw.token1Symbol === 'USDC'
  if (!isWethUsdcPair) {
    throw new Error(`Only WETH/USDC PnL is supported right now. Got ${position.raw.pair}.`)
  }

  const currentPrice = position.raw.priceToken1PerToken0AtCurrentTick
  const block = await client.getBlock({ blockHash: receipt.blockHash })
  const blockTimeIso = new Date(Number(block.timestamp) * 1000).toISOString()

  // Closed NFT: do not mark live principal (often 0 → fake −100% PnL).
  if (isClosed && !closeTxHashInput) {
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
      entryUniswapUsdc: decoded.uniswapUsdc,
      entryHyperliquidUsdc: decoded.hyperliquidUsdc,
      entryTotalUsdc: decoded.totalUsdc,
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
        txHash: trimmedHash,
        closeTxHash: null,
        tokenId: decoded.tokenId.toString(),
        openedAtIso: blockTimeIso,
        poolAddress: decoded.pool,
        txFrom: getAddress(tx.from),
        txTo: tx.to ? getAddress(tx.to) : null,
        positionStatus: 'closed',
        needsCloseTx: true,
        pnlMode: 'closed-needs-close-tx',
        entryTotalUsdc: decoded.totalUsdc.toString(),
        entryUniswapUsdc: decoded.uniswapUsdc.toString(),
        entryHyperliquidUsdc: decoded.hyperliquidUsdc.toString(),
        currentPrincipalUsdc: '0',
        currentFeesUsdc: '0',
        currentTotalUsdc: '0',
        principalOnlyPnlUsdc: null,
        totalPnlUsdc: null,
        principalOnlyPnlPct: null,
        totalPnlPct: null,
        hlLeg: null,
        combinedLeg: null,
        currentPriceUsdcPerWeth: currentPrice,
        currentPrincipalAmount0: '0',
        currentPrincipalAmount1: '0',
        currentUncollectedFees0: '0',
        currentUncollectedFees1: '0',
        token0Symbol: position.raw.token0Symbol,
        token1Symbol: position.raw.token1Symbol,
        links: {
          tx: `https://basescan.org/tx/${trimmedHash}`,
          closeTx: null,
          pool: basescanLink(decoded.pool),
          positionManager: basescanLink(NPM_ADDRESS),
          owner: basescanLink(decoded.owner),
        },
      },
      human: {
        summary: `Position closed · tokenId #${decoded.tokenId} — paste close tx to compute PnL`,
        tokenId: decoded.tokenId.toString(),
        positionStatus: 'closed',
        needsCloseTx: true,
        pnlMode: 'closed-needs-close-tx',
        closedNotice:
          'This LP NFT is already closed (liquidity = 0). Live Uniswap principal is empty, so mark-to-market PnL would look like −100% and is not shown. Paste the EXBOT close/redeem tx hash to compute realized PnL from PositionLiquidated.',
        entryUniswapUsdc: formatUsdc(decoded.uniswapUsdc),
        entryHyperliquidUsdc: formatUsdc(decoded.hyperliquidUsdc),
        entryTotalUsdc: formatUsdc(decoded.totalUsdc),
        currentPrincipalUsdc: formatUsdc(0n),
        currentFeesUsdc: formatUsdc(0n),
        currentTotalUsdc: formatUsdc(0n),
        principalOnlyPnl: null,
        totalPnl: null,
        principalOnlyPnlPct: null,
        totalPnlPct: null,
        hlLeg: null,
        combinedLeg: null,
        entrySplit: `${formatUsdc(decoded.uniswapUsdc)} Uniswap / ${formatUsdc(decoded.hyperliquidUsdc)} Hyperliquid / ${formatUsdc(decoded.totalUsdc)} total`,
        currentPrice: formatPrice('USDC per WETH', currentPrice),
        currentPrincipal: {
          token0: formatTokenAmount(0n, position.raw.token0Decimals, position.raw.token0Symbol),
          token1: formatTokenAmount(0n, position.raw.token1Decimals, position.raw.token1Symbol),
        },
        currentUncollectedFees: {
          token0: formatTokenAmount(0n, position.raw.token0Decimals, position.raw.token0Symbol),
          token1: formatTokenAmount(0n, position.raw.token1Decimals, position.raw.token1Symbol),
          note: 'Position closed — fees were settled in the close tx, not on the NFT.',
        },
        calcHints,
        caveats: [
          'Closed position detected from Uniswap NPM liquidity = 0.',
          'Provide closeTxHash (EXBOT redeem tx with PositionLiquidated) to compute realized Uniswap PnL.',
          'Optionally add HL exit value (USDC) for combined PnL after the close tx is set.',
        ],
        links: {
          tx: `https://basescan.org/tx/${trimmedHash}`,
          closeTx: null,
          pool: basescanLink(decoded.pool),
          positionManager: basescanLink(NPM_ADDRESS),
          owner: basescanLink(decoded.owner),
        },
      },
    }
  }

  let exitPrincipalUsdc: bigint
  let exitFeesUsdc: bigint
  let principal0 = BigInt(position.raw.principalAmount0)
  let principal1 = BigInt(position.raw.principalAmount1)
  let fee0 = BigInt(position.raw.uncollectedFees0)
  let fee1 = BigInt(position.raw.uncollectedFees1)
  let fees0Human = position.human.uncollectedFees.token0
  let fees1Human = position.human.uncollectedFees.token1
  let principal0Human = position.human.principal.token0
  let principal1Human = position.human.principal.token1
  let feesNote = position.human.uncollectedFees.note
  let pnlMode: 'live' | 'realized' = 'live'
  let closeTxHash: string | null = null

  if (isClosed && closeTxHashInput) {
    const closeDecoded = await decodeCloseTx(client, closeTxHashInput)
    if (closeDecoded.tokenId !== decoded.tokenId) {
      throw new Error(
        `Close tx tokenId #${closeDecoded.tokenId} does not match open tx tokenId #${decoded.tokenId}`,
      )
    }

    exitPrincipalUsdc = closeDecoded.principalUsdc
    exitFeesUsdc = usdcPriceOfPositionLegs({
      wethRaw: closeDecoded.feeNet0,
      wethPriceUsdc: currentPrice,
      usdcRaw: closeDecoded.feeNet1,
    })
    principal0 = 0n
    principal1 = 0n
    fee0 = closeDecoded.feeNet0
    fee1 = closeDecoded.feeNet1
    principal0Human = formatTokenAmount(0n, position.raw.token0Decimals, position.raw.token0Symbol)
    principal1Human = formatTokenAmount(0n, position.raw.token1Decimals, position.raw.token1Symbol)
    fees0Human = formatTokenAmount(fee0, position.raw.token0Decimals, position.raw.token0Symbol)
    fees1Human = formatTokenAmount(fee1, position.raw.token1Decimals, position.raw.token1Symbol)
    feesNote = 'Net earned fees from CloseFeesCollected in the close tx (after op/PF).'
    pnlMode = 'realized'
    closeTxHash = closeDecoded.closeTxHash
  } else {
    exitPrincipalUsdc = usdcPriceOfPositionLegs({
      wethRaw: principal0,
      wethPriceUsdc: currentPrice,
      usdcRaw: principal1,
    })
    exitFeesUsdc = usdcPriceOfPositionLegs({
      wethRaw: fee0,
      wethPriceUsdc: currentPrice,
      usdcRaw: fee1,
    })
  }

  const currentTotalUsdc = exitPrincipalUsdc + exitFeesUsdc
  const principalOnlyPnlUsdc = exitPrincipalUsdc - decoded.uniswapUsdc
  const totalPnlUsdc = currentTotalUsdc - decoded.uniswapUsdc
  const principalOnlyPnlPct = pctFromPnl(decoded.uniswapUsdc, principalOnlyPnlUsdc)
  const totalPnlPct = pctFromPnl(decoded.uniswapUsdc, totalPnlUsdc)

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

  const calcHints = buildTxPnlCalcHints({
    mode: pnlMode,
    token0Symbol: position.raw.token0Symbol,
    token1Symbol: position.raw.token1Symbol,
    principal0Human,
    principal1Human,
    fees0Human,
    fees1Human,
    currentPriceUsdcPerWeth: currentPrice,
    currentPrincipalUsdc: exitPrincipalUsdc,
    currentFeesUsdc: exitFeesUsdc,
    currentTotalUsdc,
    entryUniswapUsdc: decoded.uniswapUsdc,
    entryHyperliquidUsdc: decoded.hyperliquidUsdc,
    entryTotalUsdc: decoded.totalUsdc,
    principalOnlyPnlUsdc,
    totalPnlUsdc,
    principalOnlyPnlPct,
    totalPnlPct,
    closeTxHash,
    hlLeg: hlLeg
      ? {
          currentHlTotalUsdc: BigInt(hlLeg.currentHlTotalUsdc),
          hlTotalPnlUsdc: BigInt(hlLeg.hlTotalPnlUsdc),
          hlTotalPnlPct: hlLeg.hlTotalPnlPct,
        }
      : null,
    combinedLeg: combinedLeg
      ? {
          currentCombinedTotalUsdc: BigInt(combinedLeg.currentCombinedTotalUsdc),
          combinedTotalPnlUsdc: BigInt(combinedLeg.combinedTotalPnlUsdc),
          combinedTotalPnlPct: combinedLeg.combinedTotalPnlPct,
        }
      : null,
  })

  const realized = pnlMode === 'realized'

  return {
    raw: {
      chainId: CHAIN_ID,
      network: 'Base mainnet',
      txHash: trimmedHash,
      closeTxHash,
      tokenId: decoded.tokenId.toString(),
      openedAtIso: blockTimeIso,
      poolAddress: decoded.pool,
      txFrom: getAddress(tx.from),
      txTo: tx.to ? getAddress(tx.to) : null,
      positionStatus: isClosed ? 'closed' : 'open',
      needsCloseTx: false,
      pnlMode,
      entryTotalUsdc: decoded.totalUsdc.toString(),
      entryUniswapUsdc: decoded.uniswapUsdc.toString(),
      entryHyperliquidUsdc: decoded.hyperliquidUsdc.toString(),
      currentPrincipalUsdc: exitPrincipalUsdc.toString(),
      currentFeesUsdc: exitFeesUsdc.toString(),
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
        closeTx: closeTxHash ? `https://basescan.org/tx/${closeTxHash}` : null,
        pool: basescanLink(decoded.pool),
        positionManager: basescanLink(NPM_ADDRESS),
        owner: basescanLink(decoded.owner),
      },
    },
    human: {
      summary: realized
        ? `Realized PnL (close tx) · tokenId #${decoded.tokenId}`
        : combinedLeg
          ? `Combined PnL now vs open tx · tokenId #${decoded.tokenId}`
          : `PnL now vs open tx · tokenId #${decoded.tokenId}`,
      tokenId: decoded.tokenId.toString(),
      positionStatus: isClosed ? 'closed' : 'open',
      needsCloseTx: false,
      pnlMode,
      closedNotice: realized
        ? 'Position is closed. Uniswap numbers below are realized from the close tx (PositionLiquidated + CloseFeesCollected), not live NFT principal.'
        : null,
      entryUniswapUsdc: formatUsdc(decoded.uniswapUsdc),
      entryHyperliquidUsdc: formatUsdc(decoded.hyperliquidUsdc),
      entryTotalUsdc: formatUsdc(decoded.totalUsdc),
      currentPrincipalUsdc: formatUsdc(exitPrincipalUsdc),
      currentFeesUsdc: formatUsdc(exitFeesUsdc),
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
        token0: principal0Human,
        token1: principal1Human,
      },
      currentUncollectedFees: {
        token0: fees0Human,
        token1: fees1Human,
        note: feesNote,
      },
      calcHints,
      caveats: [
        realized
          ? 'Realized Uniswap exit principal comes from PositionLiquidated.principalUsdc on the close tx.'
          : combinedLeg
            ? 'HL entry basis is hyperliquidUsdc from the open tx; current HL value is your input.'
            : 'Uniswap leg only — add current HL leg value (USDC) to include the Hyperliquid hedge.',
        realized
          ? 'Net earned fees from CloseFeesCollected are marked to USDC (WETH leg uses current pool price).'
          : 'Current HL value should be the mark-to-market equity/value of the HL leg now (from Hyperliquid).',
        realized
          ? 'Does not include close gas or BNZA buyback. HL redemption may still be pending separately.'
          : 'Spot mark-to-market at current pool price for the Uniswap leg, not guaranteed execution.',
        'Does not include close gas, EXBOT close-side fees beyond CloseFeesCollected, or BNZA buyback.',
      ],
      links: {
        tx: `https://basescan.org/tx/${trimmedHash}`,
        closeTx: closeTxHash ? `https://basescan.org/tx/${closeTxHash}` : null,
        pool: basescanLink(decoded.pool),
        positionManager: basescanLink(NPM_ADDRESS),
        owner: basescanLink(decoded.owner),
      },
    },
  }
}
