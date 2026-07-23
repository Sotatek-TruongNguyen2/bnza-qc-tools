'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalculationHint } from './calculation-hint'
import { TokenIcon } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import type { CloseEstimateCalcSection } from '@/lib/position/close-estimate-types'
import type { UniswapLegPnlResult } from '@/lib/position/fetch-uniswap-leg-pnl'

type Props = {
  tokenId: string
}

function pnlClass(value: string | null): string {
  if (!value) return ''
  if (value.startsWith('+')) return 'badge-ok'
  if (value.startsWith('-')) return 'badge-warn'
  return ''
}

function DtWithHint(props: {
  label: string
  hintId: string
  section: CloseEstimateCalcSection | null
  openHintId: string | null
  onToggle: (id: string) => void
  onClose: () => void
}) {
  return (
    <dt className="estimate-dt-row">
      <span>{props.label}</span>
      {props.section && (
        <CalculationHint
          hintId={props.hintId}
          isOpen={props.openHintId === props.hintId}
          onToggle={props.onToggle}
          onClose={props.onClose}
          section={props.section}
        />
      )}
    </dt>
  )
}

/** Live Uniswap-leg PnL embedded in Position lookup (no HL). */
export function PositionUniswapPnl({ tokenId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UniswapLegPnlResult | null>(null)
  const [openHintId, setOpenHintId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setResult(null)
    setOpenHintId(null)

    void (async () => {
      try {
        const data = await apiGetJson<UniswapLegPnlResult>(
          `/api/position/uniswap-pnl?tokenId=${encodeURIComponent(tokenId)}`,
        )
        if (!cancelled) setResult(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'PnL failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tokenId])

  function toggleHint(id: string) {
    setOpenHintId((cur) => (cur === id ? null : id))
  }

  return (
    <div className="position-uni-pnl">
      <div className="section-heading-row">
        <h3>Uniswap-leg PnL (live)</h3>
      </div>
      <p className="hint section-hint">
        Mark-to-market vs EXBOT Uniswap entry. Hyperliquid excluded — use{' '}
        <Link href={`/?tool=tx-pnl`}>PnL tab</Link> for full / realized.
      </p>

      {loading && <p className="muted">Computing Uniswap-leg PnL…</p>}
      {error && <p className="error">{error}</p>}

      {result?.human.closedNotice && (
        <div className="pnl-closed-banner">
          <strong>Closed position</strong>
          <p>{result.human.closedNotice}</p>
          <p className="mono">Entry Uniswap basis: {result.human.entryUniswapUsdc}</p>
        </div>
      )}

      {result && !result.human.closedNotice && (
        <dl className="kv pnl-totals">
          <div>
            <dt>Entry Uniswap basis</dt>
            <dd className="mono token-inline">
              <TokenIcon symbol="USDC" size={16} />
              <span>{result.human.entryUniswapUsdc}</span>
            </dd>
          </div>
          <div>
            <DtWithHint
              label="Current principal value"
              hintId="pos-principal"
              section={result.human.calcHints.currentPrincipal}
              openHintId={openHintId}
              onToggle={toggleHint}
              onClose={() => setOpenHintId(null)}
            />
            <dd className="mono token-inline">
              <TokenIcon symbol="USDC" size={16} />
              <span>{result.human.currentPrincipalUsdc}</span>
            </dd>
          </div>
          <div>
            <DtWithHint
              label="Current uncollected fees"
              hintId="pos-fees"
              section={result.human.calcHints.currentFees}
              openHintId={openHintId}
              onToggle={toggleHint}
              onClose={() => setOpenHintId(null)}
            />
            <dd className="mono token-inline">
              <TokenIcon symbol="USDC" size={16} />
              <span>{result.human.currentFeesUsdc}</span>
            </dd>
          </div>
          <div>
            <DtWithHint
              label="Current Uniswap total"
              hintId="pos-total"
              section={result.human.calcHints.currentUniswapTotal}
              openHintId={openHintId}
              onToggle={toggleHint}
              onClose={() => setOpenHintId(null)}
            />
            <dd className="mono token-inline">
              <TokenIcon symbol="USDC" size={16} />
              <span>{result.human.currentTotalUsdc}</span>
            </dd>
          </div>
          {result.human.principalOnlyPnl && result.human.principalOnlyPnlPct && (
            <div>
              <DtWithHint
                label="Principal-only PnL"
                hintId="pos-prin-pnl"
                section={result.human.calcHints.principalOnlyPnl}
                openHintId={openHintId}
                onToggle={toggleHint}
                onClose={() => setOpenHintId(null)}
              />
              <dd className={`mono ${pnlClass(result.human.principalOnlyPnl)}`}>
                {result.human.principalOnlyPnl}{' '}
                <span className="muted">({result.human.principalOnlyPnlPct})</span>
              </dd>
            </div>
          )}
          {result.human.totalPnl && result.human.totalPnlPct && (
            <div>
              <DtWithHint
                label="Total PnL incl. fees"
                hintId="pos-total-pnl"
                section={result.human.calcHints.uniswapTotalPnl}
                openHintId={openHintId}
                onToggle={toggleHint}
                onClose={() => setOpenHintId(null)}
              />
              <dd className={`mono ${pnlClass(result.human.totalPnl)}`}>
                <strong>
                  {result.human.totalPnl}{' '}
                  <span className="muted">({result.human.totalPnlPct})</span>
                </strong>
              </dd>
            </div>
          )}
        </dl>
      )}

      {result && result.human.caveats.length > 0 && (
        <ul className="plain-list muted position-uni-pnl-caveats">
          {result.human.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
