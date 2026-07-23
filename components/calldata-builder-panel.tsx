'use client'

import { useEffect, useState } from 'react'
import { CalldataBuilderResult } from './calldata-builder-result'
import {
  buildCloseExecuteStrategy,
  buildRebalanceExecuteStrategy,
  type CalldataAction,
  type ExecuteStrategyFields,
} from '@/lib/calldata/encode-strategy-params'
import {
  DEFAULT_PERFORMANCE_FEE_BPS,
  DEFAULT_REBALANCE_SLIPPAGE_BPS,
} from '@/lib/calldata/constants'

export function CalldataBuilderPanel() {
  const [action, setAction] = useState<CalldataAction>('close')
  const [user, setUser] = useState('')
  const [botId, setBotId] = useState('')
  const [tokenId, setTokenId] = useState('')

  // Close
  const [performanceFeeBps, setPerformanceFeeBps] = useState(String(DEFAULT_PERFORMANCE_FEE_BPS))
  const [amountOutMinimum, setAmountOutMinimum] = useState('0')
  const [swapPath, setSwapPath] = useState('')
  const [defaultSwapFee, setDefaultSwapFee] = useState('500')
  const [convertPrincipalToUsdc, setConvertPrincipalToUsdc] = useState(true)

  // Rebalance
  const [newTickLower, setNewTickLower] = useState('')
  const [newTickUpper, setNewTickUpper] = useState('')
  const [slippageBps, setSlippageBps] = useState(String(DEFAULT_REBALANCE_SLIPPAGE_BPS))
  const [rebalanceAmountOutMin, setRebalanceAmountOutMin] = useState('0')

  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExecuteStrategyFields | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const a = params.get('action')
    if (a === 'close' || a === 'rebalance') setAction(a)
    const u = params.get('user')
    const b = params.get('botId')
    const t = params.get('tokenId')
    if (u) setUser(u)
    if (b) setBotId(b)
    if (t) setTokenId(t)
    const tl = params.get('tickLower')
    const tu = params.get('tickUpper')
    if (tl) setNewTickLower(tl)
    if (tu) setNewTickUpper(tu)
  }, [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const url = new URL(window.location.href)
    url.searchParams.set('tool', 'calldata')
    url.searchParams.set('action', action)
    if (user.trim()) url.searchParams.set('user', user.trim())
    if (botId.trim()) url.searchParams.set('botId', botId.trim())
    if (tokenId.trim()) url.searchParams.set('tokenId', tokenId.trim())
    window.history.replaceState({}, '', url)

    try {
      if (action === 'close') {
        setResult(
          buildCloseExecuteStrategy({
            user,
            botId,
            tokenId,
            performanceFeeBps,
            amountOutMinimum,
            swapPath,
            defaultSwapFee,
            convertPrincipalToUsdc,
          }),
        )
      } else {
        setResult(
          buildRebalanceExecuteStrategy({
            user,
            botId,
            tokenId,
            newTickLower,
            newTickUpper,
            slippageBps,
            amountOutMinimum: rebalanceAmountOutMin,
          }),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed')
    }
  }

  return (
    <section className="panel">
      <div className="result-header addresses-header">
        <div>
          <h2>Calldata builder</h2>
          <p className="muted">
            Build vault <code>executeStrategy</code> args for Basescan paste. Does not send txs.
          </p>
        </div>
      </div>

      <form className="calldata-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Action</span>
          <select
            className="calldata-select"
            value={action}
            onChange={(e) => {
              setAction(e.target.value as CalldataAction)
              setResult(null)
            }}
          >
            <option value="close">Close position</option>
            <option value="rebalance">Rebalance position</option>
          </select>
        </label>

        <div className="calldata-row">
          <label className="field field-with-hint">
            <span>User address (custody wallet)</span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="field-hint">Vault `user`, not investor EOA.</span>
          </label>

          <label className="field">
            <span>Bot ID</span>
            <input
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              placeholder="UUID or 0x bytes32"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <div className="calldata-row">
          <label className="field">
            <span>Position tokenId</span>
            <input
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="e.g. 42"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>

          {action === 'close' ? (
            <label className="field">
              <span>performanceFeeBps</span>
              <input
                value={performanceFeeBps}
                onChange={(e) => setPerformanceFeeBps(e.target.value)}
                inputMode="numeric"
              />
            </label>
          ) : (
            <label className="field">
              <span>slippageBps</span>
              <input
                value={slippageBps}
                onChange={(e) => setSlippageBps(e.target.value)}
                inputMode="numeric"
              />
            </label>
          )}
        </div>

        {action === 'close' ? (
          <>
            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>amountOutMinimum (USDC raw)</span>
                <input
                  value={amountOutMinimum}
                  onChange={(e) => setAmountOutMinimum(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">0 = no floor. 1 USDC = 1000000.</span>
              </label>

              <label className="field field-with-hint">
                <span>Default swap fee (if path empty)</span>
                <input
                  value={defaultSwapFee}
                  onChange={(e) => setDefaultSwapFee(e.target.value)}
                  inputMode="numeric"
                  placeholder="500"
                />
                <span className="field-hint">500 = 0.05%, 3000 = 0.3%.</span>
              </label>
            </div>

            <label className="field field-with-hint">
              <span>swapPath (hex, optional)</span>
              <input
                value={swapPath}
                onChange={(e) => setSwapPath(e.target.value)}
                placeholder="Leave empty → default WETH→USDC"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="field-hint">Empty fills WETH→USDC single-hop with the fee above.</span>
            </label>

            <label className="calldata-check">
              <input
                type="checkbox"
                checked={convertPrincipalToUsdc}
                onChange={(e) => setConvertPrincipalToUsdc(e.target.checked)}
              />
              <span>convertPrincipalToUsdc (recommended)</span>
            </label>
          </>
        ) : (
          <>
            <div className="calldata-row">
              <label className="field">
                <span>newTickLower</span>
                <input
                  value={newTickLower}
                  onChange={(e) => setNewTickLower(e.target.value)}
                  placeholder="e.g. -200100"
                  inputMode="numeric"
                />
              </label>
              <label className="field">
                <span>newTickUpper</span>
                <input
                  value={newTickUpper}
                  onChange={(e) => setNewTickUpper(e.target.value)}
                  placeholder="e.g. -199500"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="field field-with-hint">
              <span>amountOutMinimum</span>
              <input
                value={rebalanceAmountOutMin}
                onChange={(e) => setRebalanceAmountOutMin(e.target.value)}
                inputMode="numeric"
              />
              <span className="field-hint">Internal swap floor; 0 OK for smoke tests.</span>
            </label>
          </>
        )}

        <button type="submit" className="btn-primary calldata-submit">
          Build Basescan params
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && <CalldataBuilderResult result={result} />}
    </section>
  )
}
