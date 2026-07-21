'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalculationHint } from './calculation-hint'
import { CopyJsonButton } from './copy-json-button'
import { TokenAmountLine, TokenIcon } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import type { CloseEstimateCalcSection } from '@/lib/position/close-estimate-types'
import type { TxPnlResult } from '@/lib/tx-pnl/types'

function pnlClass(value: string): string {
  if (value.startsWith('+')) return 'badge-ok'
  if (value.startsWith('-')) return 'badge-warn'
  return 'badge-muted'
}

function pnlPctClass(pct: string): string {
  if (pct.startsWith('-')) return 'pnl-pct-neg'
  if (pct.startsWith('+') || /^0/.test(pct)) return 'pnl-pct-pos'
  return 'pnl-pct-pos'
}

function PnlPct({ value }: { value: string }) {
  return <span className={pnlPctClass(value)}>({value})</span>
}

function DtWithHint({
  label,
  hintId,
  section,
  openHintId,
  onToggle,
  onClose,
}: {
  label: string
  hintId: string
  section: CloseEstimateCalcSection | null | undefined
  openHintId: string | null
  onToggle: (hintId: string) => void
  onClose: () => void
}) {
  if (!section) return <dt>{label}</dt>
  return (
    <dt className="estimate-dt-row">
      <span>{label}</span>
      <CalculationHint
        hintId={hintId}
        isOpen={openHintId === hintId}
        onToggle={onToggle}
        onClose={onClose}
        section={section}
      />
    </dt>
  )
}

export function TxPnlPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const txHashFromUrl = searchParams.get('txHash')
  const hlCurrentFromUrl = searchParams.get('hlCurrent') ?? searchParams.get('hlSize')
  const [txHash, setTxHash] = useState('')
  const [hlCurrent, setHlCurrent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TxPnlResult | null>(null)
  const [openHintId, setOpenHintId] = useState<string | null>(null)
  const [principalInTokens, setPrincipalInTokens] = useState(false)

  function toggleHint(hintId: string) {
    setOpenHintId((current) => (current === hintId ? null : hintId))
  }

  useEffect(() => {
    if (!txHashFromUrl || !/^0x[a-fA-F0-9]{64}$/.test(txHashFromUrl)) return
    setTxHash(txHashFromUrl)
    if (hlCurrentFromUrl != null) setHlCurrent(hlCurrentFromUrl)
    void runQuery(txHashFromUrl, hlCurrentFromUrl ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHashFromUrl, hlCurrentFromUrl])

  async function runQuery(hash: string, hlCurrentInput: string) {
    setLoading(true)
    setError(null)
    setResult(null)
    setOpenHintId(null)

    const params = new URLSearchParams(searchParams.toString())
    params.set('tool', 'tx-pnl')
    params.set('txHash', hash)
    const trimmedHlCurrent = hlCurrentInput.trim()
    if (trimmedHlCurrent) {
      params.set('hlCurrent', trimmedHlCurrent)
    } else {
      params.delete('hlCurrent')
    }
    params.delete('hlSize')
    router.replace(`/?${params.toString()}`)

    const query = new URLSearchParams({ txHash: hash })
    if (trimmedHlCurrent) query.set('hlCurrent', trimmedHlCurrent)

    try {
      const data = await apiGetJson<TxPnlResult>(`/api/tx-pnl?${query.toString()}`)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const hash = txHash.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      setError('txHash must be a full 0x transaction hash')
      return
    }
    if (hlCurrent.trim() && !Number.isFinite(Number(hlCurrent.trim()))) {
      setError('Current HL value must be a USDC number (e.g. 5.48)')
      return
    }
    void runQuery(hash, hlCurrent)
  }

  const headlinePnl = result?.human.combinedLeg ?? null
  const headlinePnlLabel = headlinePnl ? 'Combined total PnL' : 'Uniswap total PnL incl. fees'
  const headlinePnlValue = headlinePnl
    ? `${headlinePnl.combinedTotalPnl} (${headlinePnl.combinedTotalPnlPct})`
    : result
      ? `${result.human.totalPnl} (${result.human.totalPnlPct})`
      : ''

  return (
    <section className="panel">
      <form className="form-grid tx-pnl-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Open tx hash</span>
          <input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x3a412f23..."
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Current HL leg value (USDC, optional)</span>
          <input
            value={hlCurrent}
            onChange={(e) => setHlCurrent(e.target.value)}
            placeholder="5.48"
            spellCheck={false}
            autoComplete="off"
            inputMode="decimal"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Calculating…' : 'Compute PnL'}
        </button>
      </form>

      <p className="hint">
        Paste the EXBOT open-position tx hash. Entry HL size comes from on-chain{' '}
        <code>hyperliquidUsdc</code>. Optionally paste the current Hyperliquid leg value (USDC) to
        compute combined Uniswap + HL PnL vs full <code>totalUsdc</code>.
      </p>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-header">
            <div>
              <h2>{result.human.summary}</h2>
              <p className="muted">
                Base mainnet · tokenId #{result.human.tokenId} · opened {result.raw.openedAtIso}
              </p>
            </div>
            <div className="result-actions">
              <span className={pnlClass(headlinePnlValue)}>{headlinePnlValue}</span>
              <CopyJsonButton value={result} />
            </div>
          </div>

          {result.human.combinedLeg && (
            <>
              <h3>Combined legs</h3>
              <dl className="kv pnl-totals">
                <div>
                  <dt>Entry total basis</dt>
                  <dd className="mono token-inline">
                    <TokenIcon symbol="USDC" size={16} />
                    <span>{result.human.entryTotalUsdc}</span>
                  </dd>
                </div>
                <div className="estimate-highlight">
                  <DtWithHint
                    label="Current combined total"
                    hintId="combined-total"
                    section={result.human.calcHints.combinedTotal}
                    openHintId={openHintId}
                    onToggle={toggleHint}
                    onClose={() => setOpenHintId(null)}
                  />
                  <dd className="mono token-inline">
                    <TokenIcon symbol="USDC" size={16} />
                    <span>{result.human.combinedLeg.currentCombinedTotal}</span>
                  </dd>
                </div>
                <div className="estimate-highlight">
                  <DtWithHint
                    label={headlinePnlLabel}
                    hintId="combined-pnl"
                    section={result.human.calcHints.combinedPnl}
                    openHintId={openHintId}
                    onToggle={toggleHint}
                    onClose={() => setOpenHintId(null)}
                  />
                  <dd className="mono">
                    {result.human.combinedLeg.combinedTotalPnl}{' '}
                    <PnlPct value={result.human.combinedLeg.combinedTotalPnlPct} />
                  </dd>
                </div>
              </dl>
            </>
          )}

          <h3>Uniswap leg</h3>
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
                hintId="principal"
                section={result.human.calcHints.currentPrincipal}
                openHintId={openHintId}
                onToggle={toggleHint}
                onClose={() => setOpenHintId(null)}
              />
              <div className="pnl-principal-display">
                <label className="pnl-slide-toggle">
                  <span className="pnl-slide-label">Show both tokens</span>
                  <input
                    type="checkbox"
                    checked={principalInTokens}
                    onChange={(e) => setPrincipalInTokens(e.target.checked)}
                    aria-label="Show principal in both tokens"
                  />
                  <span className="pnl-slide-track" aria-hidden="true">
                    <span className="pnl-slide-thumb" />
                  </span>
                </label>
                {!principalInTokens ? (
                  <dd className="mono token-inline">
                    <TokenIcon symbol="USDC" size={16} />
                    <span>{result.human.currentPrincipalUsdc}</span>
                  </dd>
                ) : (
                  <dd className="pnl-principal-tokens">
                    <TokenAmountLine
                      symbol={result.raw.token0Symbol}
                      amount={result.human.currentPrincipal.token0}
                    />
                    <TokenAmountLine
                      symbol={result.raw.token1Symbol}
                      amount={result.human.currentPrincipal.token1}
                    />
                    <span className="muted mono pnl-principal-usdc-equiv">
                      ≈ {result.human.currentPrincipalUsdc}
                    </span>
                  </dd>
                )}
              </div>
            </div>
            <div>
              <DtWithHint
                label="Current uncollected fees"
                hintId="fees"
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
            <div className="estimate-highlight">
              <DtWithHint
                label="Current Uniswap total"
                hintId="uni-total"
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
            <div>
              <DtWithHint
                label="Principal-only PnL"
                hintId="principal-pnl"
                section={result.human.calcHints.principalOnlyPnl}
                openHintId={openHintId}
                onToggle={toggleHint}
                onClose={() => setOpenHintId(null)}
              />
              <dd className="mono">
                {result.human.principalOnlyPnl}{' '}
                <PnlPct value={result.human.principalOnlyPnlPct} />
              </dd>
            </div>
            <div>
              <DtWithHint
                label="Total PnL incl. fees"
                hintId="uni-pnl"
                section={result.human.calcHints.uniswapTotalPnl}
                openHintId={openHintId}
                onToggle={toggleHint}
                onClose={() => setOpenHintId(null)}
              />
              <dd className="mono">
                {result.human.totalPnl} <PnlPct value={result.human.totalPnlPct} />
              </dd>
            </div>
          </dl>

          {result.human.hlLeg && (
            <>
              <h3>Hyperliquid leg</h3>
              <dl className="kv pnl-totals">
                <div>
                  <dt>Entry HL basis (from tx)</dt>
                  <dd className="mono token-inline">
                    <TokenIcon symbol="USDC" size={16} />
                    <span>{result.human.hlLeg.entryHyperliquidUsdc}</span>
                  </dd>
                </div>
                <div>
                  <dt>Current HL leg value (input)</dt>
                  <dd className="mono token-inline">
                    <TokenIcon symbol="USDC" size={16} />
                    <span>{result.human.hlLeg.currentHlTotal}</span>
                  </dd>
                </div>
                <div className="estimate-highlight">
                  <DtWithHint
                    label="HL PnL"
                    hintId="hl-pnl"
                    section={result.human.calcHints.hlPnl}
                    openHintId={openHintId}
                    onToggle={toggleHint}
                    onClose={() => setOpenHintId(null)}
                  />
                  <dd className="mono">
                    {result.human.hlLeg.hlTotalPnl}{' '}
                    <PnlPct value={result.human.hlLeg.hlTotalPnlPct} />
                  </dd>
                </div>
              </dl>
            </>
          )}

          <h3>Open tx split</h3>
          <p className="mono">{result.human.entrySplit}</p>

          <h3>Current LP state</h3>
          <ul className="plain-list mono">
            <li>{result.human.currentPrice}</li>
            <li>
              <TokenAmountLine
                symbol={result.raw.token0Symbol}
                amount={result.human.currentPrincipal.token0}
                prefix="Principal token0"
              />
            </li>
            <li>
              <TokenAmountLine
                symbol={result.raw.token1Symbol}
                amount={result.human.currentPrincipal.token1}
                prefix="Principal token1"
              />
            </li>
            <li>
              <TokenAmountLine
                symbol={result.raw.token0Symbol}
                amount={result.human.currentUncollectedFees.token0}
                prefix="Fees token0"
              />
            </li>
            <li>
              <TokenAmountLine
                symbol={result.raw.token1Symbol}
                amount={result.human.currentUncollectedFees.token1}
                prefix="Fees token1"
              />
            </li>
            <li className="muted">{result.human.currentUncollectedFees.note}</li>
          </ul>

          <h3>Caveats</h3>
          <ul className="plain-list">
            {result.human.caveats.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <h3>Basescan</h3>
          <ul className="plain-list">
            <li>
              <a href={result.human.links.tx} target="_blank" rel="noreferrer">
                Open tx
              </a>
            </li>
            <li>
              <a href={result.human.links.pool} target="_blank" rel="noreferrer">
                Pool
              </a>
            </li>
            <li>
              <a href={result.human.links.positionManager} target="_blank" rel="noreferrer">
                Position manager
              </a>
            </li>
            <li>
              <a href={result.human.links.owner} target="_blank" rel="noreferrer">
                Position owner
              </a>
            </li>
          </ul>
        </div>
      )}
    </section>
  )
}
