'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CopyJsonButton } from './copy-json-button'
import { TokenIcon, TokenSymbol } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import type { BotResult } from '@/lib/bot/types'

function statusClass(state: string): string {
  if (state.startsWith('Idle')) return 'badge-muted'
  if (state.startsWith('Partially')) return 'badge-warn'
  if (state.startsWith('Fully')) return 'badge-ok'
  if (state.startsWith('Empty')) return 'badge-muted'
  return 'badge-muted'
}

export function BotPanel() {
  const [user, setUser] = useState('')
  const [botId, setBotId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BotResult | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const u = params.get('user')
    const b = params.get('botId')
    if (u && b) {
      setUser(u)
      setBotId(b)
      void runQuery(u, b)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runQuery(userAddress: string, botIdValue: string) {
    setLoading(true)
    setError(null)
    setResult(null)

    const url = new URL(window.location.href)
    url.searchParams.set('tool', 'bot')
    url.searchParams.set('user', userAddress)
    url.searchParams.set('botId', botIdValue)
    window.history.replaceState({}, '', url)

    try {
      const data = await apiGetJson<BotResult>(
        `/api/bot?user=${encodeURIComponent(userAddress)}&botId=${encodeURIComponent(botIdValue)}`,
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
    const u = user.trim()
    const b = botId.trim()
    if (!u) {
      setError('User address is required')
      return
    }
    if (!b) {
      setError('Bot ID is required')
      return
    }
    void runQuery(u, b)
  }

  return (
    <section className="panel">
      <form className="form-grid bot-form" onSubmit={onSubmit}>
        <label className="field field-with-hint">
          <span>User address (custody wallet)</span>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="field-hint">
            EXBOT vault `user` — the per-user custody wallet, not the investor EOA.
          </span>
        </label>
        <label className="field field-with-hint">
          <span>Bot ID</span>
          <input
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            placeholder="UUID e.g. 019f… or 0x bytes32"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="field-hint">
            API bot UUID (hashed keccak256 on-chain). Advanced: paste raw 32-byte hex.
          </span>
        </label>
        <button type="submit" className="btn-primary bot-submit" disabled={loading}>
          {loading ? 'Querying…' : 'Query bot'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-header">
            <div>
              <h2>{result.human.summary}</h2>
              <p className="muted">{result.raw.network}</p>
            </div>
            <div className="result-actions">
              <span className={statusClass(result.human.capitalState)}>
                {result.human.capitalState}
              </span>
              {result.human.vaultPaused && <span className="badge-warn">Vault paused</span>}
              <CopyJsonButton value={result} />
            </div>
          </div>

          <dl className="kv">
            <div>
              <dt>User (custody)</dt>
              <dd className="mono">
                <a href={result.human.links.user} target="_blank" rel="noreferrer">
                  {result.human.user}
                </a>
              </dd>
            </div>
            <div>
              <dt>Bot ID (input)</dt>
              <dd className="mono">{result.human.botIdInput}</dd>
            </div>
            <div>
              <dt>Bot ID (bytes32)</dt>
              <dd className="mono">{result.human.botIdBytes32}</dd>
            </div>
            <div>
              <dt>Deposit token</dt>
              <dd className="mono deposit-token-row">
                <a href={result.human.links.depositToken} target="_blank" rel="noreferrer">
                  <TokenSymbol
                    symbol={result.human.depositTokenSymbol}
                    address={result.human.depositToken}
                    size={18}
                  />
                  <span className="deposit-token-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="deposit-token-address">{result.human.depositToken}</span>
                </a>
              </dd>
            </div>
            <div className="estimate-highlight">
              <dt>Unspent balance</dt>
              <dd className="mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.unspentUsdc}</span>
              </dd>
            </div>
            <div className="estimate-highlight">
              <dt>Deployed capital</dt>
              <dd className="mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.deployedUsdc}</span>
              </dd>
            </div>
            <div>
              <dt>Total tracked (unspent + deployed)</dt>
              <dd className="mono token-inline">
                <TokenIcon symbol="USDC" size={16} />
                <span>{result.human.totalTrackedUsdc}</span>
              </dd>
            </div>
            <div>
              <dt>WL master</dt>
              <dd className="mono">{result.human.wlMaster ?? '— (regular bot)'}</dd>
            </div>
            <div>
              <dt>Position NFT count</dt>
              <dd className="mono">{result.human.positionCount}</dd>
            </div>
          </dl>

          {result.human.positions.length > 0 && (
            <>
              <h3>Positions</h3>
              <div className="bot-position-list">
                {result.human.positions.map((p) => (
                  <article key={p.tokenId} className="bot-position-card">
                    <div className="bot-position-card-header">
                      <strong>
                        NFT #{p.tokenId}
                        <span className="muted"> · positionId {p.positionId}</span>
                      </strong>
                      <span className={p.active ? 'badge-ok' : 'badge-muted'}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <ul className="plain-list mono">
                      <li className="bot-metric-row">
                        <span className="bot-metric-label">Total deployment</span>
                        <span className="bot-metric-value token-inline">
                          <TokenIcon symbol="USDC" size={16} />
                          <span>{p.totalUsdc}</span>
                        </span>
                      </li>
                      <li className="bot-metric-row">
                        <span className="bot-metric-label">Uniswap leg</span>
                        <span className="bot-metric-value token-inline">
                          <TokenIcon symbol="USDC" size={16} />
                          <span>{p.uniswapUsdc}</span>
                        </span>
                      </li>
                      <li className="bot-metric-row">
                        <span className="bot-metric-label">Hyperliquid leg (on-chain accounting)</span>
                        <span className="bot-metric-value token-inline">
                          <TokenIcon symbol="USDC" size={16} />
                          <span>{p.hyperliquidUsdc}</span>
                        </span>
                      </li>
                      <li>Tick range: {p.tickRange}</li>
                      <li>Liquidity: {p.liquidity}</li>
                      <li>Opened: {p.openedAt}</li>
                    </ul>
                    <p>
                      <Link href={p.positionLink} target="_blank" rel="noopener noreferrer">
                        Open LP position lookup (new tab) →
                      </Link>
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}

          <h3>Basescan</h3>
          <ul className="plain-list">
            <li>
              <a href={result.human.links.vault} target="_blank" rel="noreferrer">
                Vault
              </a>
            </li>
            <li>
              <a href={result.human.links.positionManager} target="_blank" rel="noreferrer">
                Position manager
              </a>
            </li>
          </ul>
        </div>
      )}
    </section>
  )
}
