'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ButtonLoadingLabel } from './button-loading-label'
import { CalculationHint } from './calculation-hint'
import { CopyJsonButton } from './copy-json-button'
import { TokenAmountLine, TokenIcon } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import { formatLocalDateTime } from '@/lib/format-datetime'
import type { CloseEstimateCalcSection } from '@/lib/position/close-estimate-types'
import type { TxPnlResult } from '@/lib/tx-pnl/types'
import { replaceQueryParams } from '@/lib/url-query'
import { highlightKeywords } from './highlight-keywords'

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

function entrySplitPct(partRaw: string, totalRaw: string): number {
  const part = Number(partRaw)
  const total = Number(totalRaw)
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, (part / total) * 100))
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

function readTxHashParam(value: string | null): string | null {
  const hash = value?.trim() ?? null
  if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return null
  return hash
}

export function TxPnlPanel() {
  const searchParams = useSearchParams()
  const initialHash = readTxHashParam(searchParams.get('txHash'))
  const [txHash, setTxHash] = useState(initialHash ?? '')
  const [closeTxHash, setCloseTxHash] = useState(() => searchParams.get('closeTxHash') ?? '')
  const [hlCurrent, setHlCurrent] = useState(
    () => searchParams.get('hlCurrent') ?? searchParams.get('hlSize') ?? '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TxPnlResult | null>(null)
  const [openHintId, setOpenHintId] = useState<string | null>(null)
  const [showBothTokens, setShowBothTokens] = useState(false)
  const autoFetchedKeyRef = useRef<string | null>(null)

  function toggleHint(hintId: string) {
    setOpenHintId((current) => (current === hintId ? null : hintId))
  }

  // Prefill + auto-run from `/?tool=tx-pnl&txHash=…` once (not on every tab switch).
  useEffect(() => {
    if (searchParams.get('tool') !== 'tx-pnl') return

    const hash =
      readTxHashParam(searchParams.get('txHash')) ??
      readTxHashParam(new URLSearchParams(window.location.search).get('txHash'))
    const closeHash = searchParams.get('closeTxHash') ?? ''
    const hl = searchParams.get('hlCurrent') ?? searchParams.get('hlSize') ?? ''
    if (!hash) return

    setTxHash(hash)
    if (closeHash) setCloseTxHash(closeHash)
    if (hl) setHlCurrent(hl)

    const key = `${hash}|${closeHash}|${hl}`
    if (autoFetchedKeyRef.current === key) return
    autoFetchedKeyRef.current = key
    void runQuery(hash, closeHash, hl, { syncUrl: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function runQuery(
    hash: string,
    closeHash: string,
    hlCurrentInput: string,
    opts?: { syncUrl?: boolean },
  ) {
    setLoading(true)
    setError(null)
    setResult(null)
    setOpenHintId(null)

    const trimmedClose = closeHash.trim()
    const trimmedHlCurrent = hlCurrentInput.trim()

    if (opts?.syncUrl !== false) {
      replaceQueryParams((params) => {
        params.set('tool', 'tx-pnl')
        params.set('txHash', hash)
        if (trimmedClose) params.set('closeTxHash', trimmedClose)
        else params.delete('closeTxHash')
        if (trimmedHlCurrent) params.set('hlCurrent', trimmedHlCurrent)
        else params.delete('hlCurrent')
        params.delete('hlSize')
      })
    }

    const query = new URLSearchParams({ txHash: hash })
    if (trimmedClose) query.set('closeTxHash', trimmedClose)
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
      setError('Open tx hash must be a full 0x transaction hash')
      return
    }
    const closeHash = closeTxHash.trim()
    if (closeHash && !/^0x[a-fA-F0-9]{64}$/.test(closeHash)) {
      setError('Close tx hash must be a full 0x transaction hash')
      return
    }
    if (hlCurrent.trim() && !Number.isFinite(Number(hlCurrent.trim()))) {
      setError('HL value must be a USDC number (e.g. 5.48)')
      return
    }
    autoFetchedKeyRef.current = `${hash}|${closeHash}|${hlCurrent.trim()}`
    void runQuery(hash, closeHash, hlCurrent, { syncUrl: true })
  }

  const needsCloseTx = result?.human.needsCloseTx === true
  const realized = result?.human.pnlMode === 'realized'
  const hasPnl = result?.human.totalPnl != null

  const headlinePnl = hasPnl ? result?.human.combinedLeg ?? null : null
  const headlinePnlLabel = !hasPnl
    ? 'PnL unavailable'
    : headlinePnl
      ? 'Combined total PnL'
      : realized
        ? 'Realized Uniswap PnL'
        : 'Uniswap total PnL incl. fees'
  const headlinePnlValue = !hasPnl
    ? 'Needs close tx'
    : headlinePnl
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
          <span>Close tx hash {needsCloseTx || realized ? '(required for closed positions)' : '(optional)'}</span>
          <input
            value={closeTxHash}
            onChange={(e) => setCloseTxHash(e.target.value)}
            placeholder="0xc1b10ddd..."
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>HL leg value (USDC, optional)</span>
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
          {loading ? <ButtonLoadingLabel>Calculating…</ButtonLoadingLabel> : 'Compute PnL'}
        </button>
      </form>

      <p className="hint">
        Paste the EXBOT <strong>open</strong> tx hash. If the LP NFT is already closed, also paste the{' '}
        <strong>close/redeem</strong> tx (with <code>PositionLiquidated</code>) — live NFT principal is
        empty and would wrongly show about −100% PnL. Optional HL USDC value for combined PnL.
      </p>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-header">
            <div>
              <h2>{result.human.summary}</h2>
              <p className="muted">
                Base mainnet · tokenId #{result.human.tokenId} · opened{' '}
                {formatLocalDateTime(result.raw.openedAtIso)}
                {result.human.positionStatus === 'closed' ? ' · CLOSED' : ''}
              </p>
            </div>
            <div className="result-actions">
              {result.human.positionStatus === 'closed' && (
                <span className="badge-closed">Closed</span>
              )}
              <span className={pnlClass(headlinePnlValue)}>{headlinePnlValue}</span>
              <CopyJsonButton value={result} />
            </div>
          </div>

          {result.human.closedNotice && (
            <div className="pnl-closed-banner" role="status">
              <strong>Position is closed.</strong>
              <p>{highlightKeywords(result.human.closedNotice)}</p>
              {needsCloseTx && (
                <p>
                  Enter the close tx hash above and click <strong>Compute PnL</strong> again.
                </p>
              )}
            </div>
          )}

          {!needsCloseTx && result.human.combinedLeg && (
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
                    label={realized ? 'Exit combined total' : 'Current combined total'}
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

          {!needsCloseTx && (
            <>
              <div className="pnl-uniswap-header">
                <h3>{realized ? 'Uniswap leg (realized)' : 'Uniswap leg'}</h3>
                {!realized && (
                  <label className="pnl-slide-toggle">
                    <span className="pnl-slide-label">Show both tokens</span>
                    <input
                      type="checkbox"
                      checked={showBothTokens}
                      onChange={(e) => setShowBothTokens(e.target.checked)}
                      aria-label="Show principal and fees in both tokens"
                    />
                    <span className="pnl-slide-track" aria-hidden="true">
                      <span className="pnl-slide-thumb" />
                    </span>
                  </label>
                )}
              </div>
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
                    label={realized ? 'Exit principal value' : 'Current principal value'}
                    hintId="principal"
                    section={result.human.calcHints.currentPrincipal}
                    openHintId={openHintId}
                    onToggle={toggleHint}
                    onClose={() => setOpenHintId(null)}
                  />
                  {!showBothTokens || realized ? (
                    <dd className="mono token-inline">
                      <TokenIcon symbol="USDC" size={16} />
                      <span>{result.human.currentPrincipalUsdc}</span>
                    </dd>
                  ) : (
                    <dd className="pnl-token-breakdown">
                      <TokenAmountLine
                        symbol={result.raw.token0Symbol}
                        amount={result.human.currentPrincipal.token0}
                      />
                      <TokenAmountLine
                        symbol={result.raw.token1Symbol}
                        amount={result.human.currentPrincipal.token1}
                      />
                      <span className="muted mono pnl-usdc-equiv">
                        ≈ {result.human.currentPrincipalUsdc}
                      </span>
                    </dd>
                  )}
                </div>
                <div>
                  <DtWithHint
                    label={realized ? 'Exit fees net' : 'Current uncollected fees'}
                    hintId="fees"
                    section={result.human.calcHints.currentFees}
                    openHintId={openHintId}
                    onToggle={toggleHint}
                    onClose={() => setOpenHintId(null)}
                  />
                  {!showBothTokens || realized ? (
                    <dd className="mono token-inline">
                      <TokenIcon symbol="USDC" size={16} />
                      <span>{result.human.currentFeesUsdc}</span>
                    </dd>
                  ) : (
                    <dd className="pnl-token-breakdown">
                      <TokenAmountLine
                        symbol={result.raw.token0Symbol}
                        amount={result.human.currentUncollectedFees.token0}
                      />
                      <TokenAmountLine
                        symbol={result.raw.token1Symbol}
                        amount={result.human.currentUncollectedFees.token1}
                      />
                      <span className="muted mono pnl-usdc-equiv">
                        ≈ {result.human.currentFeesUsdc}
                      </span>
                    </dd>
                  )}
                </div>
                <div className="estimate-highlight">
                  <DtWithHint
                    label={realized ? 'Exit Uniswap total' : 'Current Uniswap total'}
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
                {result.human.principalOnlyPnl && result.human.principalOnlyPnlPct && (
                  <div>
                    <DtWithHint
                      label={realized ? 'Realized principal-only PnL' : 'Principal-only PnL'}
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
                )}
                {result.human.totalPnl && result.human.totalPnlPct && (
                  <div>
                    <DtWithHint
                      label={realized ? 'Realized Uniswap PnL incl. fees' : 'Total PnL incl. fees'}
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
                )}
              </dl>
            </>
          )}

          {!needsCloseTx && result.human.hlLeg && (
            <>
              <h3>Hyperliquid leg</h3>
              <dl className="kv pnl-totals">
                <div>
                  <dt>Entry HL basis (from open tx)</dt>
                  <dd className="mono token-inline">
                    <TokenIcon symbol="USDC" size={16} />
                    <span>{result.human.hlLeg.entryHyperliquidUsdc}</span>
                  </dd>
                </div>
                <div>
                  <dt>HL leg value (input)</dt>
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
          <p className="hint section-hint">How entry capital was allocated at open (from PositionOpened).</p>
          <div className="entry-split" role="group" aria-label="Open tx capital split">
            <div className="entry-split-card">
              <div className="entry-split-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brands/uniswap.svg" alt="" width={28} height={28} />
                <div>
                  <span className="entry-split-label">Uniswap</span>
                  <span className="entry-split-sub muted">LP principal basis</span>
                </div>
              </div>
              <div className="entry-split-amount mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.entryUniswapUsdc}</span>
              </div>
              <div className="entry-split-bar" aria-hidden="true">
                <span
                  className="entry-split-bar-fill entry-split-bar-uni"
                  style={{
                    width: `${entrySplitPct(result.raw.entryUniswapUsdc, result.raw.entryTotalUsdc)}%`,
                  }}
                />
              </div>
              <span className="entry-split-pct muted">
                {entrySplitPct(result.raw.entryUniswapUsdc, result.raw.entryTotalUsdc).toFixed(1)}% of
                total
              </span>
            </div>

            <div className="entry-split-plus" aria-hidden="true">
              +
            </div>

            <div className="entry-split-card">
              <div className="entry-split-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brands/hyperliquid.svg" alt="" width={28} height={28} />
                <div>
                  <span className="entry-split-label">Hyperliquid</span>
                  <span className="entry-split-sub muted">Hedge basis</span>
                </div>
              </div>
              <div className="entry-split-amount mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.entryHyperliquidUsdc}</span>
              </div>
              <div className="entry-split-bar" aria-hidden="true">
                <span
                  className="entry-split-bar-fill entry-split-bar-hl"
                  style={{
                    width: `${entrySplitPct(result.raw.entryHyperliquidUsdc, result.raw.entryTotalUsdc)}%`,
                  }}
                />
              </div>
              <span className="entry-split-pct muted">
                {entrySplitPct(result.raw.entryHyperliquidUsdc, result.raw.entryTotalUsdc).toFixed(1)}%
                of total
              </span>
            </div>

            <div className="entry-split-eq" aria-hidden="true">
              =
            </div>

            <div className="entry-split-card entry-split-card-total">
              <div className="entry-split-brand">
                <span className="entry-split-total-mark" aria-hidden="true">
                  Σ
                </span>
                <div>
                  <span className="entry-split-label">Total</span>
                  <span className="entry-split-sub muted">Entry capital</span>
                </div>
              </div>
              <div className="entry-split-amount mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.entryTotalUsdc}</span>
              </div>
            </div>
          </div>

          {!needsCloseTx && !realized && (
            <>
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
            </>
          )}

          <h3>Caveats</h3>
          <ul className="caveat-list">
            {result.human.caveats.map((line) => (
              <li key={line}>{highlightKeywords(line)}</li>
            ))}
          </ul>

          <h3>Basescan</h3>
          <ul className="plain-list">
            <li>
              <a href={result.human.links.tx} target="_blank" rel="noreferrer">
                Open tx
              </a>
            </li>
            {result.human.links.closeTx && (
              <li>
                <a href={result.human.links.closeTx} target="_blank" rel="noreferrer">
                  Close tx
                </a>
              </li>
            )}
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
