'use client'

import { useEffect, useState } from 'react'
import { CopyJsonButton } from './copy-json-button'
import { TokenIcon, TokenSymbol } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import type { QuoteResult } from '@/lib/quote/types'

const TOKEN_OPTIONS = ['USDC', 'WETH', 'ETH', 'CUSTOM'] as const
type TokenChoice = (typeof TOKEN_OPTIONS)[number]

function parseTokenChoice(value: string | null, fallback: Exclude<TokenChoice, 'CUSTOM'>): {
  choice: TokenChoice
  custom: string
} {
  const trimmed = value?.trim() ?? ''
  const upper = trimmed.toUpperCase()
  if (upper === 'USDC' || upper === 'WETH' || upper === 'ETH') {
    return { choice: upper, custom: '' }
  }
  if (!trimmed) return { choice: fallback, custom: '' }
  return { choice: 'CUSTOM', custom: trimmed }
}

function resolveTokenInput(choice: TokenChoice, custom: string): string {
  return choice === 'CUSTOM' ? custom.trim() : choice
}

export function QuotePanel() {
  const [amount, setAmount] = useState('100')
  const [tokenInChoice, setTokenInChoice] = useState<TokenChoice>('USDC')
  const [tokenInCustom, setTokenInCustom] = useState('')
  const [tokenOutChoice, setTokenOutChoice] = useState<TokenChoice>('WETH')
  const [tokenOutCustom, setTokenOutCustom] = useState('')
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
    const parsedIn = parseTokenChoice(tin, 'USDC')
    const parsedOut = parseTokenChoice(tout, 'WETH')
    setTokenInChoice(parsedIn.choice)
    setTokenInCustom(parsedIn.custom)
    setTokenOutChoice(parsedOut.choice)
    setTokenOutCustom(parsedOut.custom)
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
    const tokenIn = resolveTokenInput(tokenInChoice, tokenInCustom)
    const tokenOut = resolveTokenInput(tokenOutChoice, tokenOutCustom)
    void runQuote({
      amount: amount.trim(),
      tokenIn,
      tokenOut,
      slippage: slippage.trim() || '0.5',
    })
  }

  function swapTokens() {
    setTokenInChoice(tokenOutChoice)
    setTokenInCustom(tokenOutCustom)
    setTokenOutChoice(tokenInChoice)
    setTokenOutCustom(tokenInCustom)
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
          <label className="field quote-token-field">
            <span>Token in</span>
            <div className="token-select-wrap">
              <TokenIcon symbol={tokenInChoice === 'CUSTOM' ? undefined : tokenInChoice} size={18} />
              <select
                value={tokenInChoice}
                onChange={(e) => setTokenInChoice(e.target.value as TokenChoice)}
              >
                <option value="USDC">USDC</option>
                <option value="WETH">WETH</option>
                <option value="ETH">ETH</option>
                <option value="CUSTOM">Custom address</option>
              </select>
            </div>
            {tokenInChoice === 'CUSTOM' && (
              <input
                value={tokenInCustom}
                onChange={(e) => setTokenInCustom(e.target.value)}
                placeholder="0x token address"
                spellCheck={false}
                autoComplete="off"
              />
            )}
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

          <label className="field quote-token-field">
            <span>Token out</span>
            <div className="token-select-wrap">
              <TokenIcon symbol={tokenOutChoice === 'CUSTOM' ? undefined : tokenOutChoice} size={18} />
              <select
                value={tokenOutChoice}
                onChange={(e) => setTokenOutChoice(e.target.value as TokenChoice)}
              >
                <option value="USDC">USDC</option>
                <option value="WETH">WETH</option>
                <option value="ETH">ETH</option>
                <option value="CUSTOM">Custom address</option>
              </select>
            </div>
            {tokenOutChoice === 'CUSTOM' && (
              <input
                value={tokenOutCustom}
                onChange={(e) => setTokenOutCustom(e.target.value)}
                placeholder="0x token address"
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </label>
        </div>

        <button type="submit" className="btn-primary quote-submit" disabled={loading}>
          {loading ? 'Quoting…' : 'Quote routes'}
        </button>
      </form>

      <p className="hint">
        Quotes Uniswap V3 on Base via QuoterV2: <strong>direct</strong> pools plus{' '}
        <strong>2-hop</strong> routes through liquid hubs (WETH, USDC, DAI, USDT, USDbC, cbETH,
        wstETH, cbBTC). Pool discovery uses Multicall3; quotes are concurrency-limited. Best =
        highest amount out.
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
                {result.routeStats
                  ? ` · direct ${result.routeStats.directQuoted}/${result.routeStats.directFound} · multi-hop ${result.routeStats.multiHopQuoted}/${result.routeStats.multiHopFound}`
                  : ''}
              </p>
            </div>
            <CopyJsonButton value={result} />
          </div>

          {best ? (
            <div className="best-card">
              <h3>
                Best route{' '}
                <span className="muted">
                  ({best.kind === 'multi-hop' ? `${best.hopCount ?? best.hops.length}-hop` : best.kind})
                </span>
              </h3>
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
                      <th>Kind</th>
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
                          <td className="mono">
                            {q.kind === 'multi-hop' ? `${q.hopCount ?? q.hops.length}-hop` : q.kind}
                          </td>
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
