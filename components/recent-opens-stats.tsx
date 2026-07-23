'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGetJson } from '@/lib/api-client'
import { formatLocalDateTime } from '@/lib/format-datetime'
import {
  RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS,
  RECENT_OPENS_DISMISSED_STORAGE_KEY,
  RECENT_OPENS_RELOAD_MS,
} from '@/lib/recent-opens/constants'
import type { RecentOpensResult } from '@/lib/recent-opens/types'

function shorten(addr: string, left = 4, right = 4): string {
  if (addr.length < left + right + 2) return addr
  return `${addr.slice(0, left + 2)}…${addr.slice(-right)}`
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(RECENT_OPENS_DISMISSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (dismissed) window.localStorage.setItem(RECENT_OPENS_DISMISSED_STORAGE_KEY, '1')
    else window.localStorage.removeItem(RECENT_OPENS_DISMISSED_STORAGE_KEY)
  } catch {
    // ignore quota
  }
}

const LIST_LIMIT = 8

export function RecentOpensStats() {
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecentOpensResult | null>(null)
  const [nextReloadAt, setNextReloadAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setDismissed(readDismissed())
    setHydrated(true)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGetJson<RecentOpensResult>(
        `/api/recent-opens?blocks=${RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS.toString()}`,
      )
      setResult(data)
      setNextReloadAt(Date.now() + (data.reloadEveryMs || RECENT_OPENS_RELOAD_MS))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent opens')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hydrated || dismissed) return
    void reload()
    const interval = window.setInterval(() => void reload(), RECENT_OPENS_RELOAD_MS)
    return () => window.clearInterval(interval)
  }, [hydrated, dismissed, reload])

  useEffect(() => {
    if (dismissed) return
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [dismissed])

  function closeSection() {
    setDismissed(true)
    writeDismissed(true)
    setResult(null)
    setError(null)
    setNextReloadAt(null)
  }

  function openSection() {
    setDismissed(false)
    writeDismissed(false)
  }

  if (!hydrated) return null

  if (dismissed) {
    return (
      <div className="recent-opens-collapsed">
        <button type="button" className="recent-opens-show" onClick={openSection}>
          Show recent opens
        </button>
      </div>
    )
  }

  const secsLeft =
    nextReloadAt == null ? null : Math.max(0, Math.ceil((nextReloadAt - now) / 1000))
  const countdown =
    secsLeft == null
      ? '—'
      : `${String(Math.floor(secsLeft / 60)).padStart(1, '0')}:${String(secsLeft % 60).padStart(2, '0')}`

  const stats = result?.stats
  const recent = result?.opens.slice(0, LIST_LIMIT) ?? []

  return (
    <section className="recent-opens" aria-label="Recent open positions">
      <div className="recent-opens-head">
        <div>
          <h2 className="recent-opens-title">Recent opens</h2>
          <p className="muted recent-opens-sub">
            <code>PositionOpened</code> events · live open/closed via{' '}
            <code>getPositionDeployment</code> · last{' '}
            {result
              ? `${Number(result.lookbackBlocks).toLocaleString('en-US')} blocks (${result.lookbackApproxLabel})`
              : `${Number(RECENT_OPENS_DEFAULT_LOOKBACK_BLOCKS).toLocaleString('en-US')} blocks`}
            · auto-refresh every 10 min
          </p>
        </div>
        <div className="recent-opens-actions">
          <span className="muted recent-opens-countdown" title="Time until next auto-refresh">
            Next {countdown}
          </span>
          <button
            type="button"
            className="recent-opens-icon-btn"
            disabled={loading}
            onClick={() => void reload()}
            aria-label={loading ? 'Refreshing' : 'Refresh'}
            title={loading ? 'Refreshing…' : 'Refresh now'}
          >
            <svg
              className={loading ? 'recent-opens-refresh-icon is-spinning' : 'recent-opens-refresh-icon'}
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden
            >
              <path
                fill="currentColor"
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="recent-opens-icon-btn"
            onClick={closeSection}
            aria-label="Hide recent opens"
            title="Hide this section"
          >
            ✕
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && !result && <p className="muted">Scanning PositionOpened logs…</p>}

      {result && stats && (
        <>
          <div className="recent-opens-stats">
            <div className="ro-stat">
              <span className="ro-stat-label">Still open</span>
              <span className="ro-stat-value">{stats.stillOpenCount}</span>
            </div>
            <div className="ro-stat">
              <span className="ro-stat-label">Closed</span>
              <span className="ro-stat-value">{stats.closedCount}</span>
            </div>
            <div className="ro-stat">
              <span className="ro-stat-label">Total USDC</span>
              <span className="ro-stat-value ro-stat-value-sm">{stats.totalUsdcHuman}</span>
            </div>
            <div className="ro-stat">
              <span className="ro-stat-label">Uniswap leg</span>
              <span className="ro-stat-value ro-stat-value-sm">{stats.uniswapUsdcHuman}</span>
            </div>
            <div className="ro-stat">
              <span className="ro-stat-label">HL leg</span>
              <span className="ro-stat-value ro-stat-value-sm">{stats.hyperliquidUsdcHuman}</span>
            </div>
            <div className="ro-stat">
              <span className="ro-stat-label">Users</span>
              <span className="ro-stat-value">{stats.uniqueUsers}</span>
            </div>
            <div className="ro-stat">
              <span className="ro-stat-label">Bots</span>
              <span className="ro-stat-value">{stats.uniqueBots}</span>
            </div>
          </div>

          {result.warnings.length > 0 && (
            <ul className="calldata-warnings">
              {result.warnings.slice(0, 3).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <p className="muted recent-opens-meta">
            Fetched {formatLocalDateTime(result.fetchedAtIso)} · blocks{' '}
            <span className="mono">
              {result.fromBlock}–{result.toBlock}
            </span>
          </p>

          {recent.length > 0 ? (
            <div className="recent-opens-table-wrap">
              <table className="recent-opens-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Status</th>
                    <th>USDC</th>
                    <th>Owner</th>
                    <th>Block</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={`${row.txHash}-${row.tokenId}`}>
                      <td>
                        <a
                          href={`/?tool=position&tokenId=${encodeURIComponent(row.tokenId)}`}
                          className="mono"
                        >
                          #{row.tokenId}
                        </a>
                      </td>
                      <td>
                        <span
                          className={
                            row.status === 'open'
                              ? 'badge-ok'
                              : row.status === 'closed'
                                ? 'badge-warn'
                                : 'muted'
                          }
                        >
                          {row.status === 'open'
                            ? 'Open'
                            : row.status === 'closed'
                              ? 'Closed'
                              : 'Unknown'}
                        </span>
                      </td>
                      <td className="mono">{row.totalUsdcHuman.replace(' USDC', '')}</td>
                      <td className="mono">
                        <a href={row.basescanOwner} target="_blank" rel="noreferrer">
                          {shorten(row.owner)}
                        </a>
                      </td>
                      <td className="mono">{row.blockNumber}</td>
                      <td className="mono">
                        <a href={row.basescanTx} target="_blank" rel="noreferrer">
                          {shorten(row.txHash, 4, 4)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.opens.length > LIST_LIMIT && (
                <p className="muted recent-opens-more">
                  Showing {LIST_LIMIT} of {result.opens.length} opens in window
                </p>
              )}
            </div>
          ) : (
            <p className="muted">No PositionOpened events in this window.</p>
          )}
        </>
      )}
    </section>
  )
}
