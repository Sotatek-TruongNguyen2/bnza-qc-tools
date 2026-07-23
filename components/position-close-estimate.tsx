'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalculationHint } from './calculation-hint'
import { TokenIcon } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import {
  DEFAULT_CLOSE_ESTIMATE_PARAMS,
  estimateCloseUsdc,
} from '@/lib/position/estimate-close-usdc'
import type { UniswapLegPnlResult } from '@/lib/position/fetch-uniswap-leg-pnl'
import type { PositionRaw } from '@/lib/position/types'

type Props = {
  raw: PositionRaw
}

function parsePct(value: string, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function pnlPctClass(pct: string | null): string {
  if (!pct) return 'muted'
  if (pct.startsWith('+')) return 'badge-ok'
  if (pct.startsWith('-')) return 'badge-warn'
  return 'muted'
}

export function PositionCloseEstimate({ raw }: Props) {
  const [operationFeePct, setOperationFeePct] = useState('0.5')
  const [performanceFeePct, setPerformanceFeePct] = useState('30')
  const [swapSlippagePct, setSwapSlippagePct] = useState('1')
  const [minEarnedUsd, setMinEarnedUsd] = useState('10')
  const [showOnChainDerivation, setShowOnChainDerivation] = useState(false)
  const [openHintId, setOpenHintId] = useState<string | null>(null)
  const [uniPnlPct, setUniPnlPct] = useState<string | null>(null)
  const [uniPnlLoading, setUniPnlLoading] = useState(false)
  const [uniPnlNote, setUniPnlNote] = useState<string | null>(null)

  const estimate = useMemo(() => {
    return estimateCloseUsdc(raw, {
      operationFeeBps: Math.round(parsePct(operationFeePct, 0.5) * 100),
      performanceFeeBps: Math.round(parsePct(performanceFeePct, 30) * 100),
      swapSlippageBps: Math.round(parsePct(swapSlippagePct, 1) * 100),
      minEarnedUsdc: parsePct(minEarnedUsd, 10),
      showOnChainDerivation,
    })
  }, [raw, operationFeePct, performanceFeePct, swapSlippagePct, minEarnedUsd, showOnChainDerivation])

  useEffect(() => {
    let cancelled = false
    setUniPnlLoading(true)
    setUniPnlPct(null)
    setUniPnlNote(null)

    void (async () => {
      try {
        const data = await apiGetJson<UniswapLegPnlResult>(
          `/api/position/uniswap-pnl?tokenId=${encodeURIComponent(raw.tokenId)}`,
        )
        if (cancelled) return
        if (data.human.closedNotice) {
          setUniPnlNote('Closed — use PnL tab for realized %')
          return
        }
        setUniPnlPct(data.human.totalPnlPct)
      } catch (err) {
        if (!cancelled) {
          setUniPnlNote(err instanceof Error ? err.message : 'PnL % unavailable')
        }
      } finally {
        if (!cancelled) setUniPnlLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [raw.tokenId])

  const defaults = DEFAULT_CLOSE_ESTIMATE_PARAMS

  function toggleHint(hintId: string) {
    setOpenHintId((current) => (current === hintId ? null : hintId))
  }

  return (
    <div className="estimate-card">
      <h3>Estimated USDC after close</h3>
      <p className="hint">
        QC estimate for full close: principal → USDC + net earned fees (EXBOT{' '}
        <code>LpFeeOps</code> defaults). Not an on-chain quote guarantee.
      </p>

      <div className="estimate-form">
        <label className="field field-with-hint">
          <span>Operation fee on earned (%)</span>
          <input
            value={operationFeePct}
            onChange={(e) => setOperationFeePct(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.operationFeeBps / 100)}
          />
          <span className="field-hint">
            On earned LP fees at close/collect/rebalance — not principal. Charged first; skipped below
            dust threshold.
          </span>
        </label>
        <label className="field field-with-hint">
          <span>Performance fee on earned (%)</span>
          <input
            value={performanceFeePct}
            onChange={(e) => setPerformanceFeePct(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.performanceFeeBps / 100)}
          />
          <span className="field-hint">
            Protocol share on earned fees after op fee — not principal. Skipped below dust threshold.
          </span>
        </label>
        <label className="field field-with-hint">
          <span>Extra slippage buffer on principal swap (%)</span>
          <input
            value={swapSlippagePct}
            onChange={(e) => setSwapSlippagePct(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.swapSlippageBps / 100)}
          />
          <span className="field-hint">
            When converting non-USDC principal to USDC, we subtract pool fee and this extra %. Makes
            the estimate a bit lower (safer). Does not change earned fees (default 1%).
          </span>
        </label>
        <label className="field field-with-hint">
          <span>Earned dust threshold ($)</span>
          <input
            value={minEarnedUsd}
            onChange={(e) => setMinEarnedUsd(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.minEarnedUsdc)}
            title="EXBOT skips op/PF when gross earned is below this USDC equivalent"
          />
          <span className="field-hint">
            Below this, EXBOT skips op/PF — user keeps 100% of earned fees (default $10).
          </span>
        </label>
        <label className="estimate-toggle estimate-form-full">
          <input
            type="checkbox"
            checked={showOnChainDerivation}
            onChange={(e) => setShowOnChainDerivation(e.target.checked)}
          />
          <span>Show on-chain math in hints (sqrtPriceX96, raw amounts)</span>
        </label>
      </div>

      <dl className="kv estimate-totals">
        <div>
          <dt className="estimate-dt-row">
            <span>Principal (USDC, after fee &amp; slippage)</span>
            <CalculationHint
              hintId="principal"
              isOpen={openHintId === 'principal'}
              onToggle={toggleHint}
              onClose={() => setOpenHintId(null)}
              section={estimate.breakdown.details.principal}
            />
          </dt>
          <dd className="mono token-inline">
            <TokenIcon symbol="USDC" size={16} />
            <span>{estimate.human.principalUsdc}</span>
          </dd>
        </div>
        <div>
          <dt className="estimate-dt-row">
            <span>Earned fees net (USDC equiv.)</span>
            <CalculationHint
              hintId="earned"
              isOpen={openHintId === 'earned'}
              onToggle={toggleHint}
              onClose={() => setOpenHintId(null)}
              section={estimate.breakdown.details.earned}
            />
          </dt>
          <dd className="mono token-inline">
            <TokenIcon symbol="USDC" size={16} />
            <span>{estimate.human.earnedNetUsdc}</span>
          </dd>
        </div>
        <div className="estimate-highlight">
          <dt>Total (spot principal + net earned)</dt>
          <dd className="mono token-inline">
            <TokenIcon symbol="USDC" size={16} />
            <span>{estimate.human.totalSpot}</span>
          </dd>
        </div>
        <div className="estimate-highlight">
          <dt>Total (principal after fee &amp; slippage + net earned)</dt>
          <dd className="mono token-inline">
            <TokenIcon symbol="USDC" size={16} />
            <span>{estimate.human.totalConservative}</span>
          </dd>
        </div>
        <div className="estimate-uni-pnl-line">
          <dt>Uniswap-leg PnL (live)</dt>
          <dd>
            {uniPnlLoading ? (
              <span className="muted">…</span>
            ) : uniPnlPct ? (
              <span className={`mono ${pnlPctClass(uniPnlPct)}`}>{uniPnlPct}</span>
            ) : (
              <span className="muted">{uniPnlNote ?? '—'}</span>
            )}
            <span className="muted estimate-uni-pnl-hint">
              {' '}
              · mark vs EXBOT entry ·{' '}
              <Link href="/?tool=tx-pnl">Open full PnL tab</Link>
            </span>
          </dd>
        </div>
      </dl>

      <p className="muted">{estimate.breakdown.earnedFeeNote}</p>

      {estimate.breakdown.earnedFeesCharged && (
        <ul className="plain-list mono muted">
          <li>
            Op fee (USDC equiv.):{' '}
            {(Number(estimate.breakdown.operationFeeUsdcEquiv) / 1e6).toLocaleString('en-US', {
              maximumFractionDigits: 4,
            })}{' '}
            USDC
          </li>
          <li>
            PF (USDC equiv.):{' '}
            {(Number(estimate.breakdown.performanceFeeUsdcEquiv) / 1e6).toLocaleString('en-US', {
              maximumFractionDigits: 4,
            })}{' '}
            USDC
          </li>
        </ul>
      )}

      <ul className="plain-list muted assumptions">
        {estimate.breakdown.assumptions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
