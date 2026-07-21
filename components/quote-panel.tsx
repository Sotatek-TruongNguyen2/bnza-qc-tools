'use client'

import { useEffect, useState } from 'react'
import { CopyJsonButton } from './copy-json-button'
import { TokenIcon, TokenSymbol } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import type { QuoteResult } from '@/lib/quote/types'

const TOKEN_PRESETS = ['USDC', 'WETH'] as const

export function QuotePanel() {
  const [amount, setAmount] = useState('100')
  const [tokenIn, setTokenIn] = useState('USDC')
  const [tokenOut, setTokenOut] = useState('WETH')
  const [slippage, setSlippage] = useState('0.5')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QuoteResult | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tool') !== 'quote') return

    const a = params.get('amount')
    const tin = params.get('tokenIn')
    const tout = params.get('tokenOut')
    const slip = params.get('slippage')
    if (a) setAmount(a)
    if (tin) setTokenIn(tin)
    if (tout) setTokenOut(tout)
    if (slip) setSlippage(slip)
    if (a && tin && tout) {
      void runQuote({
        amount: a,
        tokenIn: tin,
        tokenOut: tout,
        slippage: slip ?? '0.5',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runQuote(input: {
    amount: string
    tokenIn: string
    tokenOut: string
    slippage: string
  }) {
    setLoading(true)
    setError(null)
    setResult(null)

    const url = new URL(window.location.href)
    url.searchParams.set('tool', 'quote')
    url.searchParams.set('amount', input.amount)
    url.searchParams.set('tokenIn', input.tokenIn)
    url.searchParams.set('tokenOut', input.tokenOut)
    url.searchParams.set('slippage', input.slippage)
    url.searchParams.delete('tokenId')
    window.history.replaceState({}, '', url)

    const qs = new URLSearchParams({
      amount: input.amount,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      slippage: input.slippage,
    })

    try {
      const data = await apiGetJson<QuoteResult>(`/api/quote?${qs.toString()}`)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    void runQuote({
      amount: amount.trim(),
      tokenIn: tokenIn.trim(),
      tokenOut: tokenOut.trim(),
      slippage: slippage.trim() || '0.5',
    })
  }

  function swapTokens() {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
  }

  const best = result?.quotes[0]

  return (
    <section className="panel">
      <form className="quote-form" onSubmit={onSubmit}>
        <div className="quote-meta-row">
          <label className="field">
            <span>Amount in</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              inputMode="decimal"
            />
          </label>

          <label className="field">
            <span>Slippage %</span>
            <input
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              placeholder="0.5"
              inputMode="decimal"
            />
          </label>
        </div>

        <div className="quote-swap-row">
          <label className="field">
            <span>Token in</span>
            <div className="token-input-wrap">
              <TokenIcon symbol={tokenIn} size={18} />
              <input
                value={tokenIn}
                onChange={(e) => setTokenIn(e.target.value)}
                list="token-presets"
                placeholder="USDC"
              />
            </div>
            <div className="token-preset-row">
              {TOKEN_PRESETS.map((t) => (
                <button
                  key={`in-${t}`}
                  type="button"
                  className="token-preset"
                  onClick={() => setTokenIn(t)}
                >
                  <TokenIcon symbol={t} size={16} />
                  {t}
                </button>
              ))}
            </div>
          </label>

          <button
            type="button"
            className="quote-swap-btn btn-secondary"
            onClick={swapTokens}
            aria-label="Swap token pair"
            title="Swap token pair"
          >
            ⇄
          </button>

          <label className="field">
            <span>Token out</span>
            <div className="token-input-wrap">
              <TokenIcon symbol={tokenOut} size={18} />
              <input
                value={tokenOut}
                onChange={(e) => setTokenOut(e.target.value)}
                list="token-presets"
                placeholder="WETH"
              />
            </div>
            <div className="token-preset-row">
              {TOKEN_PRESETS.map((t) => (
                <button
                  key={`out-${t}`}
                  type="button"
                  className="token-preset"
                  onClick={() => setTokenOut(t)}
                >
                  <TokenIcon symbol={t} size={16} />
                  {t}
                </button>
              ))}
            </div>
          </label>
        </div>

        <datalist id="token-presets">
          {TOKEN_PRESETS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <button type="submit" className="btn-primary quote-submit" disabled={loading}>
          {loading ? 'Quoting…' : 'Quote routes'}
        </button>
      </form>

      <p className="hint">
        Symbols: USDC, WETH, ETH — or any Base ERC-20 <span className="mono">0x</span> address.
        Default slippage 0.5%.
      </p>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-header">
            <div>
              <h2 className="token-pair-heading">
                <TokenSymbol symbol={result.tokenIn.symbol} address={result.tokenIn.address} size={22} />
                <span className="muted">→</span>
                <TokenSymbol symbol={result.tokenOut.symbol} address={result.tokenOut.address} size={22} />
              </h2>
              <p className="muted">
                Input {result.amountInHuman} · Slippage {result.slippagePercent.toFixed(2)}% (
                {result.slippageBps} bps) · {result.quotes.length}/{result.routesFound} quoted
              </p>
            </div>
            <CopyJsonButton value={result} />
          </div>

          {best ? (
            <div className="best-card">
              <h3>Best route</h3>
              <p className="mono">{best.description}</p>
              <dl className="kv">
                <div>
                  <dt>Amount out</dt>
                  <dd className="mono">{best.amountOutHuman}</dd>
                </div>
                <div>
                  <dt>Min out</dt>
                  <dd className="mono">{best.amountOutMinimumHuman}</dd>
                </div>
                <div>
                  <dt>Gas est.</dt>
                  <dd className="mono">{best.gasEstimate}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="error">No quotable routes found.</p>
          )}

          {result.quotes.length > 0 && (
            <>
              <h3>All routes</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Route</th>
                      <th>Out</th>
                      <th>Min out</th>
                      <th>Gas</th>
                      <th>vs best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.quotes.map((q) => {
                      const delta =
                        q.rank === 1
                          ? 'best'
                          : `${(
                              ((Number(q.amountOut) - Number(best!.amountOut)) /
                                Number(best!.amountOut)) *
                              100
                            ).toFixed(4)}%`
                      return (
                        <tr key={`${q.rank}-${q.path}`}>
                          <td className="mono">{q.rank}</td>
                          <td>{q.description}</td>
                          <td className="mono">{q.amountOutHuman}</td>
                          <td className="mono">{q.amountOutMinimumHuman}</td>
                          <td className="mono">{q.gasEstimate}</td>
                          <td className="mono">{delta}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
