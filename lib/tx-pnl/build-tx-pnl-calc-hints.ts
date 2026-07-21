import { formatUnits } from 'viem'
import type { CloseEstimateCalcSection } from '@/lib/position/close-estimate-types'

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

export type TxPnlCalcHints = {
  currentPrincipal: CloseEstimateCalcSection
  currentFees: CloseEstimateCalcSection
  currentUniswapTotal: CloseEstimateCalcSection
  principalOnlyPnl: CloseEstimateCalcSection
  uniswapTotalPnl: CloseEstimateCalcSection
  hlPnl: CloseEstimateCalcSection | null
  combinedTotal: CloseEstimateCalcSection | null
  combinedPnl: CloseEstimateCalcSection | null
}

export function buildTxPnlCalcHints(args: {
  token0Symbol: string
  token1Symbol: string
  principal0Human: string
  principal1Human: string
  fees0Human: string
  fees1Human: string
  currentPriceUsdcPerWeth: number
  currentPrincipalUsdc: bigint
  currentFeesUsdc: bigint
  currentTotalUsdc: bigint
  entryUniswapUsdc: bigint
  entryHyperliquidUsdc: bigint
  entryTotalUsdc: bigint
  principalOnlyPnlUsdc: bigint
  totalPnlUsdc: bigint
  principalOnlyPnlPct: number
  totalPnlPct: number
  hlLeg: {
    currentHlTotalUsdc: bigint
    hlTotalPnlUsdc: bigint
    hlTotalPnlPct: number
  } | null
  combinedLeg: {
    currentCombinedTotalUsdc: bigint
    combinedTotalPnlUsdc: bigint
    combinedTotalPnlPct: number
  } | null
}): TxPnlCalcHints {
  const priceLabel = `${args.currentPriceUsdcPerWeth.toLocaleString('en-US', {
    maximumFractionDigits: 6,
  })} USDC / WETH`

  const currentPrincipal: CloseEstimateCalcSection = {
    title: 'Current principal value',
    summary: 'Mark Uniswap LP principal to USDC at the current pool tick price.',
    formula: `principalUsdc = amount(${args.token0Symbol}) × price + amount(${args.token1Symbol})`,
    inputs: [
      { label: `Principal ${args.token0Symbol}`, value: args.principal0Human },
      { label: `Principal ${args.token1Symbol}`, value: args.principal1Human },
      { label: 'Current pool price', value: priceLabel },
    ],
    steps: [
      {
        label: 'WETH → USDC',
        value: `${args.principal0Human} × ${priceLabel}`,
      },
      {
        label: '+ USDC principal',
        value: args.principal1Human,
      },
    ],
    result: formatUsdc(args.currentPrincipalUsdc),
  }

  const currentFees: CloseEstimateCalcSection = {
    title: 'Current uncollected fees',
    summary: 'Mark uncollected LP fees to USDC at the same current pool price.',
    formula: `feesUsdc = fee(${args.token0Symbol}) × price + fee(${args.token1Symbol})`,
    inputs: [
      { label: `Fees ${args.token0Symbol}`, value: args.fees0Human },
      { label: `Fees ${args.token1Symbol}`, value: args.fees1Human },
      { label: 'Current pool price', value: priceLabel },
    ],
    steps: [
      { label: 'WETH fees → USDC', value: `${args.fees0Human} × ${priceLabel}` },
      { label: '+ USDC fees', value: args.fees1Human },
    ],
    result: formatUsdc(args.currentFeesUsdc),
  }

  const currentUniswapTotal: CloseEstimateCalcSection = {
    title: 'Current Uniswap total',
    summary: 'Uniswap leg mark-to-market = principal + uncollected fees.',
    formula: 'uniswapTotal = principalUsdc + feesUsdc',
    inputs: [
      { label: 'Current principal', value: formatUsdc(args.currentPrincipalUsdc) },
      { label: 'Current fees', value: formatUsdc(args.currentFeesUsdc) },
    ],
    steps: [
      {
        label: 'Sum',
        value: `${formatUsdc(args.currentPrincipalUsdc)} + ${formatUsdc(args.currentFeesUsdc)}`,
      },
    ],
    result: formatUsdc(args.currentTotalUsdc),
  }

  const principalOnlyPnl: CloseEstimateCalcSection = {
    title: 'Principal-only PnL',
    summary: 'Uniswap principal change vs entry uniswapUsdc from PositionOpened (excludes fees).',
    formula: 'principalPnl = currentPrincipalUsdc − entryUniswapUsdc',
    inputs: [
      { label: 'Current principal', value: formatUsdc(args.currentPrincipalUsdc) },
      { label: 'Entry Uniswap basis (tx)', value: formatUsdc(args.entryUniswapUsdc) },
    ],
    steps: [
      {
        label: 'Difference',
        value: `${formatUsdc(args.currentPrincipalUsdc)} − ${formatUsdc(args.entryUniswapUsdc)}`,
      },
      {
        label: 'Pct vs entry',
        value: `pnl / entryUniswapUsdc = ${formatPct(args.principalOnlyPnlPct)}`,
      },
    ],
    result: `${formatSignedUsdc(args.principalOnlyPnlUsdc)} (${formatPct(args.principalOnlyPnlPct)})`,
  }

  const uniswapTotalPnl: CloseEstimateCalcSection = {
    title: 'Total PnL incl. fees',
    summary: 'Full Uniswap leg PnL vs entry uniswapUsdc, including uncollected fees.',
    formula: 'uniswapPnl = (principalUsdc + feesUsdc) − entryUniswapUsdc',
    inputs: [
      { label: 'Current Uniswap total', value: formatUsdc(args.currentTotalUsdc) },
      { label: 'Entry Uniswap basis (tx)', value: formatUsdc(args.entryUniswapUsdc) },
    ],
    steps: [
      {
        label: 'Difference',
        value: `${formatUsdc(args.currentTotalUsdc)} − ${formatUsdc(args.entryUniswapUsdc)}`,
      },
      {
        label: 'Pct vs entry',
        value: `pnl / entryUniswapUsdc = ${formatPct(args.totalPnlPct)}`,
      },
    ],
    result: `${formatSignedUsdc(args.totalPnlUsdc)} (${formatPct(args.totalPnlPct)})`,
  }

  let hlPnl: CloseEstimateCalcSection | null = null
  let combinedTotal: CloseEstimateCalcSection | null = null
  let combinedPnl: CloseEstimateCalcSection | null = null

  if (args.hlLeg && args.combinedLeg) {
    hlPnl = {
      title: 'HL PnL',
      summary:
        'Hyperliquid entry basis is hyperliquidUsdc from the open tx; current value is your USDC input.',
      formula: 'hlPnl = currentHlValue − entryHyperliquidUsdc',
      inputs: [
        { label: 'Entry HL basis (tx)', value: formatUsdc(args.entryHyperliquidUsdc) },
        { label: 'Current HL value (input)', value: formatUsdc(args.hlLeg.currentHlTotalUsdc) },
      ],
      steps: [
        {
          label: 'Difference',
          value: `${formatUsdc(args.hlLeg.currentHlTotalUsdc)} − ${formatUsdc(args.entryHyperliquidUsdc)}`,
        },
        {
          label: 'Pct vs entry HL',
          value: `pnl / entryHyperliquidUsdc = ${formatPct(args.hlLeg.hlTotalPnlPct)}`,
        },
      ],
      result: `${formatSignedUsdc(args.hlLeg.hlTotalPnlUsdc)} (${formatPct(args.hlLeg.hlTotalPnlPct)})`,
    }

    combinedTotal = {
      title: 'Current combined total',
      summary: 'Sum of current Uniswap mark and current HL value.',
      formula: 'combined = uniswapTotal + currentHlValue',
      inputs: [
        { label: 'Current Uniswap total', value: formatUsdc(args.currentTotalUsdc) },
        { label: 'Current HL value (input)', value: formatUsdc(args.hlLeg.currentHlTotalUsdc) },
      ],
      steps: [
        {
          label: 'Sum',
          value: `${formatUsdc(args.currentTotalUsdc)} + ${formatUsdc(args.hlLeg.currentHlTotalUsdc)}`,
        },
      ],
      result: formatUsdc(args.combinedLeg.currentCombinedTotalUsdc),
    }

    combinedPnl = {
      title: 'Combined total PnL',
      summary: 'Full-leg PnL vs entry totalUsdc from PositionOpened.',
      formula: 'combinedPnl = (uniswapTotal + currentHlValue) − entryTotalUsdc',
      inputs: [
        {
          label: 'Current combined total',
          value: formatUsdc(args.combinedLeg.currentCombinedTotalUsdc),
        },
        { label: 'Entry total basis (tx)', value: formatUsdc(args.entryTotalUsdc) },
      ],
      steps: [
        {
          label: 'Difference',
          value: `${formatUsdc(args.combinedLeg.currentCombinedTotalUsdc)} − ${formatUsdc(args.entryTotalUsdc)}`,
        },
        {
          label: 'Pct vs entry total',
          value: `pnl / entryTotalUsdc = ${formatPct(args.combinedLeg.combinedTotalPnlPct)}`,
        },
      ],
      result: `${formatSignedUsdc(args.combinedLeg.combinedTotalPnlUsdc)} (${formatPct(args.combinedLeg.combinedTotalPnlPct)})`,
    }
  }

  return {
    currentPrincipal,
    currentFees,
    currentUniswapTotal,
    principalOnlyPnl,
    uniswapTotalPnl,
    hlPnl,
    combinedTotal,
    combinedPnl,
  }
}
