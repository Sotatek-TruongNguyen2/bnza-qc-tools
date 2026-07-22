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
  currentPrincipal: CloseEstimateCalcSection | null
  currentFees: CloseEstimateCalcSection | null
  currentUniswapTotal: CloseEstimateCalcSection | null
  principalOnlyPnl: CloseEstimateCalcSection | null
  uniswapTotalPnl: CloseEstimateCalcSection | null
  hlPnl: CloseEstimateCalcSection | null
  combinedTotal: CloseEstimateCalcSection | null
  combinedPnl: CloseEstimateCalcSection | null
}

export function buildTxPnlCalcHints(args: {
  mode: 'live' | 'realized' | 'closed-needs-close-tx'
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
  principalOnlyPnlUsdc: bigint | null
  totalPnlUsdc: bigint | null
  principalOnlyPnlPct: number | null
  totalPnlPct: number | null
  closeTxHash?: string | null
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
  if (args.mode === 'closed-needs-close-tx') {
    return {
      currentPrincipal: null,
      currentFees: null,
      currentUniswapTotal: null,
      principalOnlyPnl: null,
      uniswapTotalPnl: null,
      hlPnl: null,
      combinedTotal: null,
      combinedPnl: null,
    }
  }

  const priceLabel = `${args.currentPriceUsdcPerWeth.toLocaleString('en-US', {
    maximumFractionDigits: 6,
  })} USDC / WETH`
  const realized = args.mode === 'realized'
  const principalTitle = realized ? 'Exit principal (from close tx)' : 'Current principal value'
  const feesTitle = realized ? 'Exit fees net (from close tx)' : 'Current uncollected fees'
  const totalTitle = realized ? 'Exit Uniswap total' : 'Current Uniswap total'
  const principalSummary = realized
    ? 'PositionLiquidated.principalUsdc from the close/redeem tx (USDC after principal swap).'
    : 'Mark Uniswap LP principal to USDC at the current pool tick price.'
  const feesSummary = realized
    ? 'Net earned fees from CloseFeesCollected (after op/PF), marked to USDC.'
    : 'Mark uncollected LP fees to USDC at the same current pool price.'
  const totalSummary = realized
    ? 'Realized Uniswap exit = principal from PositionLiquidated + net earned fees.'
    : 'Uniswap leg mark-to-market = principal + uncollected fees.'
  const principalFormula = realized
    ? 'exitPrincipalUsdc = PositionLiquidated.principalUsdc'
    : `principalUsdc = amount(${args.token0Symbol}) × price + amount(${args.token1Symbol})`
  const feesFormula = realized
    ? 'exitFeesUsdc = netFee(token0) × price + netFee(token1)'
    : `feesUsdc = fee(${args.token0Symbol}) × price + fee(${args.token1Symbol})`
  const totalFormula = realized
    ? 'exitUniswapTotal = exitPrincipalUsdc + exitFeesUsdc'
    : 'uniswapTotal = principalUsdc + feesUsdc'
  const pnlPrincipalSummary = realized
    ? 'Realized principal PnL vs entry uniswapUsdc from PositionOpened.'
    : 'Uniswap principal change vs entry uniswapUsdc from PositionOpened (excludes fees).'
  const pnlTotalSummary = realized
    ? 'Realized Uniswap PnL incl. net earned fees vs entry uniswapUsdc.'
    : 'Full Uniswap leg PnL vs entry uniswapUsdc, including uncollected fees.'
  const pnlPrincipalFormula = realized
    ? 'principalPnl = exitPrincipalUsdc − entryUniswapUsdc'
    : 'principalPnl = currentPrincipalUsdc − entryUniswapUsdc'
  const pnlTotalFormula = realized
    ? 'uniswapPnl = exitUniswapTotal − entryUniswapUsdc'
    : 'uniswapPnl = (principalUsdc + feesUsdc) − entryUniswapUsdc'

  const currentPrincipal: CloseEstimateCalcSection = {
    title: principalTitle,
    summary: principalSummary,
    formula: principalFormula,
    inputs: realized
      ? [
          { label: 'Close tx', value: args.closeTxHash ?? '—' },
          { label: 'PositionLiquidated.principalUsdc', value: formatUsdc(args.currentPrincipalUsdc) },
        ]
      : [
          { label: `Principal ${args.token0Symbol}`, value: args.principal0Human },
          { label: `Principal ${args.token1Symbol}`, value: args.principal1Human },
          { label: 'Current pool price', value: priceLabel },
        ],
    steps: realized
      ? [{ label: 'From close tx', value: formatUsdc(args.currentPrincipalUsdc) }]
      : [
          { label: 'WETH → USDC', value: `${args.principal0Human} × ${priceLabel}` },
          { label: '+ USDC principal', value: args.principal1Human },
        ],
    result: formatUsdc(args.currentPrincipalUsdc),
  }

  const currentFees: CloseEstimateCalcSection = {
    title: feesTitle,
    summary: feesSummary,
    formula: feesFormula,
    inputs: [
      { label: `Fees ${args.token0Symbol}`, value: args.fees0Human },
      { label: `Fees ${args.token1Symbol}`, value: args.fees1Human },
      ...(realized ? [] : [{ label: 'Current pool price', value: priceLabel }]),
    ],
    steps: [
      { label: 'WETH fees → USDC', value: `${args.fees0Human} × ${priceLabel}` },
      { label: '+ USDC fees', value: args.fees1Human },
    ],
    result: formatUsdc(args.currentFeesUsdc),
  }

  const currentUniswapTotal: CloseEstimateCalcSection = {
    title: totalTitle,
    summary: totalSummary,
    formula: totalFormula,
    inputs: [
      { label: realized ? 'Exit principal' : 'Current principal', value: formatUsdc(args.currentPrincipalUsdc) },
      { label: realized ? 'Exit fees' : 'Current fees', value: formatUsdc(args.currentFeesUsdc) },
    ],
    steps: [
      {
        label: 'Sum',
        value: `${formatUsdc(args.currentPrincipalUsdc)} + ${formatUsdc(args.currentFeesUsdc)}`,
      },
    ],
    result: formatUsdc(args.currentTotalUsdc),
  }

  const principalOnlyPnl: CloseEstimateCalcSection | null =
    args.principalOnlyPnlUsdc == null || args.principalOnlyPnlPct == null
      ? null
      : {
          title: realized ? 'Realized principal-only PnL' : 'Principal-only PnL',
          summary: pnlPrincipalSummary,
          formula: pnlPrincipalFormula,
          inputs: [
            {
              label: realized ? 'Exit principal' : 'Current principal',
              value: formatUsdc(args.currentPrincipalUsdc),
            },
            { label: 'Entry Uniswap basis (open tx)', value: formatUsdc(args.entryUniswapUsdc) },
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

  const uniswapTotalPnl: CloseEstimateCalcSection | null =
    args.totalPnlUsdc == null || args.totalPnlPct == null
      ? null
      : {
          title: realized ? 'Realized Uniswap PnL incl. fees' : 'Total PnL incl. fees',
          summary: pnlTotalSummary,
          formula: pnlTotalFormula,
          inputs: [
            {
              label: realized ? 'Exit Uniswap total' : 'Current Uniswap total',
              value: formatUsdc(args.currentTotalUsdc),
            },
            { label: 'Entry Uniswap basis (open tx)', value: formatUsdc(args.entryUniswapUsdc) },
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
        'Hyperliquid entry basis is hyperliquidUsdc from the open tx; current/exit value is your USDC input.',
      formula: 'hlPnl = hlValue − entryHyperliquidUsdc',
      inputs: [
        { label: 'Entry HL basis (open tx)', value: formatUsdc(args.entryHyperliquidUsdc) },
        { label: 'HL value (input)', value: formatUsdc(args.hlLeg.currentHlTotalUsdc) },
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
      title: realized ? 'Exit combined total' : 'Current combined total',
      summary: realized
        ? 'Sum of realized Uniswap exit and HL value input.'
        : 'Sum of current Uniswap mark and current HL value.',
      formula: 'combined = uniswapTotal + hlValue',
      inputs: [
        { label: realized ? 'Exit Uniswap total' : 'Current Uniswap total', value: formatUsdc(args.currentTotalUsdc) },
        { label: 'HL value (input)', value: formatUsdc(args.hlLeg.currentHlTotalUsdc) },
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
      formula: 'combinedPnl = (uniswapTotal + hlValue) − entryTotalUsdc',
      inputs: [
        {
          label: realized ? 'Exit combined total' : 'Current combined total',
          value: formatUsdc(args.combinedLeg.currentCombinedTotalUsdc),
        },
        { label: 'Entry total basis (open tx)', value: formatUsdc(args.entryTotalUsdc) },
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
