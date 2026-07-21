'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CopyJsonButton } from './copy-json-button'
import { TokenAmountLine, TokenIcon } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import type { TxPnlResult } from '@/lib/tx-pnl/types'

function pnlClass(value: string): string {
  if (value.startsWith('+')) return 'badge-ok'
  if (value.startsWith('-')) return 'badge-warn'
  return 'badge-muted'
}

export function TxPnlPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const txHashFromUrl = searchParams.get('txHash')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TxPnlResult | null>(null)

  useEffect(() => {
    if (!txHashFromUrl || !/^0x[a-fA-F0-9]{64}$/.test(txHashFromUrl)) return
    setTxHash(txHashFromUrl)
    void runQuery(txHashFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHashFromUrl])

  async function runQuery(hash: string) {
    setLoading(true)
    setError(null)
    setResult(null)

    const params = new URLSearchParams(searchParams.toString())
    params.set('tool', 'tx-pnl')
    params.set('txHash', hash)
    router.replace(`/?${params.toString()}`)

    try {
      const data = await apiGetJson<TxPnlResult>(`/api/tx-pnl?txHash=${encodeURIComponent(hash)}`)
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
    void runQuery(hash)
  }

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
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Calculating…' : 'Compute Uniswap PnL'}
        </button>
      </form>

      <p className="hint">
        Paste the EXBOT open-position tx hash. The tool extracts the minted LP NFT and recorded
        <code> uniswapUsdc </code> entry basis from on-chain logs, then marks the Uniswap leg to
        current pool price.
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
              <span className={pnlClass(result.human.totalPnl)}>
                {result.human.totalPnl} ({result.human.totalPnlPct})
              </span>
              <CopyJsonButton value={result} />
            </div>
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
              <dt>Current principal value</dt>
              <dd className="mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.currentPrincipalUsdc}</span>
              </dd>
            </div>
            <div>
              <dt>Current uncollected fees</dt>
              <dd className="mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.currentFeesUsdc}</span>
              </dd>
            </div>
            <div className="estimate-highlight">
              <dt>Current Uniswap total</dt>
              <dd className="mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.currentTotalUsdc}</span>
              </dd>
            </div>
            <div>
              <dt>Principal-only PnL</dt>
              <dd className="mono">{result.human.principalOnlyPnl} ({result.human.principalOnlyPnlPct})</dd>
            </div>
            <div className="estimate-highlight">
              <dt>Total PnL incl. fees</dt>
              <dd className="mono">{result.human.totalPnl} ({result.human.totalPnlPct})</dd>
            </div>
          </dl>

          <h3>Open tx split</h3>
          <p className="mono">{result.human.entrySplit}</p>

          <h3>Current LP state</h3>
          <ul className="plain-list mono">
            <li>{result.human.currentPrice}</li>
            <li>
              <TokenAmountLine symbol={result.raw.token0Symbol} amount={result.human.currentPrincipal.token0} prefix="Principal token0" />
            </li>
            <li>
              <TokenAmountLine symbol={result.raw.token1Symbol} amount={result.human.currentPrincipal.token1} prefix="Principal token1" />
            </li>
            <li>
              <TokenAmountLine symbol={result.raw.token0Symbol} amount={result.human.currentUncollectedFees.token0} prefix="Fees token0" />
            </li>
            <li>
              <TokenAmountLine symbol={result.raw.token1Symbol} amount={result.human.currentUncollectedFees.token1} prefix="Fees token1" />
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
