'use client'

import { useMemo, useState } from 'react'
import {
  DEFAULT_CLOSE_ESTIMATE_PARAMS,
  estimateCloseUsdc,
} from '@/lib/position/estimate-close-usdc'
import type { PositionRaw } from '@/lib/position/types'

type Props = {
  raw: PositionRaw
}

function parsePct(value: string, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function PositionCloseEstimate({ raw }: Props) {
  const [operationFeePct, setOperationFeePct] = useState('0.5')
  const [performanceFeePct, setPerformanceFeePct] = useState('30')
  const [swapSlippagePct, setSwapSlippagePct] = useState('1')
  const [minEarnedUsd, setMinEarnedUsd] = useState('10')

  const estimate = useMemo(() => {
    return estimateCloseUsdc(raw, {
      operationFeeBps: Math.round(parsePct(operationFeePct, 0.5) * 100),
      performanceFeeBps: Math.round(parsePct(performanceFeePct, 30) * 100),
      swapSlippageBps: Math.round(parsePct(swapSlippagePct, 1) * 100),
      minEarnedUsdc: parsePct(minEarnedUsd, 10),
    })
  }, [raw, operationFeePct, performanceFeePct, swapSlippagePct, minEarnedUsd])

  const defaults = DEFAULT_CLOSE_ESTIMATE_PARAMS

  return (
    <div className="estimate-card">
      <h3>Estimated USDC after close</h3>
      <p className="hint">
        QC estimate for full close: principal → USDC + net earned fees (EXBOT{' '}
        <code>LpFeeOps</code> defaults). Not an on-chain quote guarantee.
      </p>

      <div className="estimate-form">
        <label className="field">
          <span>Operation fee on earned (%)</span>
          <input
            value={operationFeePct}
            onChange={(e) => setOperationFeePct(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.operationFeeBps / 100)}
          />
        </label>
        <label className="field">
          <span>Performance fee on earned (%)</span>
          <input
            value={performanceFeePct}
            onChange={(e) => setPerformanceFeePct(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.performanceFeeBps / 100)}
          />
        </label>
        <label className="field">
          <span>Principal swap slippage (%)</span>
          <input
            value={swapSlippagePct}
            onChange={(e) => setSwapSlippagePct(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.swapSlippageBps / 100)}
          />
        </label>
        <label className="field">
          <span>Min earned before fees ($)</span>
          <input
            value={minEarnedUsd}
            onChange={(e) => setMinEarnedUsd(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaults.minEarnedUsdc)}
          />
        </label>
      </div>

      <dl className="kv estimate-totals">
        <div>
          <dt>Principal (USDC, conservative)</dt>
          <dd className="mono">{estimate.human.principalUsdc}</dd>
        </div>
        <div>
          <dt>Earned fees net (USDC equiv.)</dt>
          <dd className="mono">{estimate.human.earnedNetUsdc}</dd>
        </div>
        <div className="estimate-highlight">
          <dt>Total (spot principal + net earned)</dt>
          <dd className="mono">{estimate.human.totalSpot}</dd>
        </div>
        <div className="estimate-highlight">
          <dt>Total (conservative principal + net earned)</dt>
          <dd className="mono">{estimate.human.totalConservative}</dd>
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
