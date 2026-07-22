'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalculationHint } from './calculation-hint'
import { CopyJsonButton } from './copy-json-button'
import { TokenAmountLine, TokenSymbol } from './token-icon'
import { PositionCloseEstimate } from './position-close-estimate'
import { apiGetJson } from '@/lib/api-client'
import { buildPrincipalAmountsHint } from '@/lib/position/build-principal-amounts-hint'
import type { PositionResult } from '@/lib/position/types'

function statusClass(status: string): string {
  if (status.startsWith('IN RANGE')) return 'badge-ok'
  if (status.startsWith('CLOSED')) return 'badge-muted'
  return 'badge-warn'
}

export function PositionPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenIdFromUrl = searchParams.get('tokenId')
  const [tokenId, setTokenId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PositionResult | null>(null)
  const [openHintId, setOpenHintId] = useState<string | null>(null)

  const principalHint = useMemo(
    () => (result ? buildPrincipalAmountsHint(result.raw) : null),
    [result],
  )

  useEffect(() => {
    if (!tokenIdFromUrl || !/^\d+$/.test(tokenIdFromUrl)) return
    setTokenId(tokenIdFromUrl)
    void runQuery(tokenIdFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIdFromUrl])

  async function runQuery(id: string) {
    setLoading(true)
    setError(null)
    setResult(null)
    setOpenHintId(null)

    const params = new URLSearchParams(searchParams.toString())
    params.set('tool', 'position')
    params.set('tokenId', id)
    router.replace(`/?${params.toString()}`)

    try {
      const data = await apiGetJson<PositionResult>(
        `/api/position?tokenId=${encodeURIComponent(id)}`,
      )
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = tokenId.trim()
    if (!/^\d+$/.test(id)) {
      setError('tokenId must be a positive integer')
      return
    }
    void runQuery(id)
  }

  return (
    <section className="panel">
      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field">
          <span>LP NFT tokenId</span>
          <input
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="e.g. 5036939"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Querying…' : 'Query position'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-header">
            <div>
              <h2 className="token-pair-heading">
                <TokenSymbol symbol={result.raw.token0Symbol} address={result.raw.token0} size={22} />
                <span className="muted">/</span>
                <TokenSymbol symbol={result.raw.token1Symbol} address={result.raw.token1} size={22} />
                <span>
                  | fee {result.raw.feeLabel} | tokenId #{result.raw.tokenId}
                </span>
              </h2>
              <p className="muted">{result.raw.network}</p>
            </div>
            <div className="result-actions">
              <span className={statusClass(result.human.status)}>{result.human.status}</span>
              <CopyJsonButton value={result} />
            </div>
          </div>

          <dl className="kv">
            <div>
              <dt>Owner</dt>
              <dd className="mono">
                <a href={result.human.links.owner} target="_blank" rel="noreferrer">
                  {result.human.owner}
                </a>
              </dd>
            </div>
            <div className="tick-range-highlight">
              <dt>Tick range</dt>
              <dd className="mono">{result.human.tickRange}</dd>
            </div>
          </dl>

          <h3>Prices</h3>
          <ul className="plain-list mono">
            <li>{result.human.prices.atLowerTick}</li>
            <li>{result.human.prices.atUpperTick}</li>
            <li>{result.human.prices.atCurrentTick}</li>
            <li>{result.human.prices.inverseAtCurrentTick}</li>
          </ul>

          <div className="section-heading-row">
            <h3>Principal</h3>
            {principalHint && (
              <CalculationHint
                hintId="principal-amounts"
                isOpen={openHintId === 'principal-amounts'}
                onToggle={(id) => setOpenHintId((cur) => (cur === id ? null : id))}
                onClose={() => setOpenHintId(null)}
                section={principalHint}
              />
            )}
          </div>
          <p className="hint section-hint">
            Token amounts locked in the LP NFT (not fees). Click <strong>?</strong> to see how they
            are calculated.
          </p>
          <ul className="plain-list mono">
            <li>
              <TokenAmountLine
                prefix="Token0"
                symbol={result.raw.token0Symbol}
                address={result.raw.token0}
                amount={result.human.principal.token0}
              />
            </li>
            <li>
              <TokenAmountLine
                prefix="Token1"
                symbol={result.raw.token1Symbol}
                address={result.raw.token1}
                amount={result.human.principal.token1}
              />
            </li>
          </ul>

          <h3>Uncollected fees</h3>
          <ul className="plain-list mono">
            <li>
              <TokenAmountLine
                prefix="Token0"
                symbol={result.raw.token0Symbol}
                address={result.raw.token0}
                amount={result.human.uncollectedFees.token0}
              />
            </li>
            <li>
              <TokenAmountLine
                prefix="Token1"
                symbol={result.raw.token1Symbol}
                address={result.raw.token1}
                amount={result.human.uncollectedFees.token1}
              />
            </li>
            <li className="muted">{result.human.uncollectedFees.note}</li>
          </ul>

          <PositionCloseEstimate raw={result.raw} />

          <h3>Basescan</h3>
          <ul className="plain-list">
            <li>
              <a href={result.human.links.pool} target="_blank" rel="noreferrer">
                Pool
              </a>
            </li>
            <li>
              <a href={result.human.links.owner} target="_blank" rel="noreferrer">
                Owner
              </a>
            </li>
            <li>
              <a href={result.human.links.token0} target="_blank" rel="noreferrer">
                <TokenSymbol symbol={result.raw.token0Symbol} address={result.raw.token0} size={16} />{' '}
                (Token0)
              </a>
            </li>
            <li>
              <a href={result.human.links.token1} target="_blank" rel="noreferrer">
                <TokenSymbol symbol={result.raw.token1Symbol} address={result.raw.token1} size={16} />{' '}
                (Token1)
              </a>
            </li>
          </ul>
        </div>
      )}
    </section>
  )
}
