'use client'

import { useEffect, useMemo, useState } from 'react'
import { ButtonLoadingLabel } from './button-loading-label'
import { CopyJsonButton } from './copy-json-button'
import { apiGetJson } from '@/lib/api-client'
import { formatLocalDateTime } from '@/lib/format-datetime'
import type {
  RedemptionPendingRequest,
  RedemptionQueueResult,
} from '@/lib/redemption-queue/types'

function shorten(addr: string, left = 6, right = 4): string {
  if (addr.length < left + right + 2) return addr
  return `${addr.slice(0, left + 2)}…${addr.slice(-right)}`
}

function shortenBytes32(hex: string): string {
  if (hex.length < 18) return hex
  return `${hex.slice(0, 10)}…${hex.slice(-8)}`
}

export function RedemptionQueuePanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RedemptionQueueResult | null>(null)
  const [userFilter, setUserFilter] = useState('')
  const [idFilter, setIdFilter] = useState('')

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGetJson<RedemptionQueueResult>('/api/redemption-queue')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const filtered = useMemo(() => {
    if (!result) return []
    const userQ = userFilter.trim().toLowerCase()
    const idQ = idFilter.trim()
    return result.pending.filter((row) => {
      if (userQ && !row.user.toLowerCase().includes(userQ)) return false
      if (idQ && !row.requestId.includes(idQ)) return false
      return true
    })
  }, [result, userFilter, idFilter])

  const stats = result?.stats
  const empty = result && result.stats.pendingCount === 0

  return (
    <section className="panel">
      <div className="result-header addresses-header">
        <div>
          <h2>Redemption queue</h2>
          <p className="muted">
            Live FIFO HL redemption requests on{' '}
            {result ? (
              <a href={result.basescanQueue} target="_blank" rel="noreferrer">
                RedemptionQueue
              </a>
            ) : (
              'RedemptionQueue'
            )}
            . Operator fulfills from the head.
          </p>
        </div>
        <div className="result-actions">
          {result && <CopyJsonButton value={result} label="Copy JSON" />}
          <button type="button" className="btn-primary" onClick={() => void reload()} disabled={loading}>
            {loading ? (
              <ButtonLoadingLabel>Loading…</ButtonLoadingLabel>
            ) : result ? (
              'Refresh'
            ) : (
              'Load queue'
            )}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && !result && <p className="muted">Reading pendingQueueLength + pending requests…</p>}

      {result && stats && (
        <>
          <div className="rq-stats">
            <div className={`rq-stat ${stats.pendingCount > 0 ? 'rq-stat-warn' : 'rq-stat-ok'}`}>
              <span className="rq-stat-label">Pending</span>
              <span className="rq-stat-value">{stats.pendingCount}</span>
              <span className="rq-stat-hint">
                {stats.pendingCount === 0 ? 'Queue clear' : 'awaiting fulfill'}
              </span>
            </div>
            <div className="rq-stat">
              <span className="rq-stat-label">Head (next)</span>
              <span className="rq-stat-value mono">
                {stats.headRequestId ? `#${stats.headRequestId}` : '—'}
              </span>
              <span className="rq-stat-hint">nextPendingRequestId</span>
            </div>
            <div className="rq-stat">
              <span className="rq-stat-label">Oldest wait</span>
              <span className="rq-stat-value">{stats.oldestWaitLabel ?? '—'}</span>
              <span className="rq-stat-hint">time in queue</span>
            </div>
            <div className="rq-stat">
              <span className="rq-stat-label">Avg wait</span>
              <span className="rq-stat-value">{stats.avgWaitLabel ?? '—'}</span>
              <span className="rq-stat-hint">across pending</span>
            </div>
          </div>

          <p className="muted rq-fetched">
            Fetched {formatLocalDateTime(result.fetchedAtIso)} ·{' '}
            <a href={result.basescanQueue} target="_blank" rel="noreferrer" className="mono">
              {shorten(result.queueAddress)}
            </a>
          </p>

          {!empty && (
            <>
              <h3 className="rq-section-title">Queue order (FIFO)</h3>
              <div className="rq-rail" role="list" aria-label="Pending redemption FIFO order">
                {result.pending.map((row) => (
                  <QueueChip key={row.requestId} row={row} />
                ))}
              </div>

              <div className="rq-filters">
                <label className="field">
                  <span>Filter user</span>
                  <input
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    placeholder="0x…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="field">
                  <span>Filter requestId</span>
                  <input
                    value={idFilter}
                    onChange={(e) => setIdFilter(e.target.value)}
                    placeholder="e.g. 12"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
              </div>

              <h3 className="rq-section-title">
                Pending requests
                <span className="muted">
                  {' '}
                  · {filtered.length}
                  {filtered.length !== result.pending.length
                    ? ` of ${result.pending.length}`
                    : ''}
                </span>
              </h3>

              {filtered.length === 0 ? (
                <p className="muted">No requests match the filter.</p>
              ) : (
                <ul className="rq-list">
                  {filtered.map((row) => (
                    <li key={row.requestId} className={row.isHead ? 'rq-card rq-card-head' : 'rq-card'}>
                      <div className="rq-card-top">
                        <div className="rq-card-id">
                          {row.isHead ? (
                            <span className="badge-warn">NEXT</span>
                          ) : (
                            <span className="badge-muted">#{row.queueIndex + 1} in line</span>
                          )}
                          <strong className="mono">Request #{row.requestId}</strong>
                        </div>
                        <span className="rq-wait" title={`${row.waitSeconds}s`}>
                          waiting {row.waitLabel}
                        </span>
                      </div>
                      <dl className="kv rq-card-kv">
                        <div>
                          <dt>User</dt>
                          <dd className="mono">
                            <a href={row.basescanUser} target="_blank" rel="noreferrer">
                              {shorten(row.user)}
                            </a>
                          </dd>
                        </div>
                        <div>
                          <dt>Position ID</dt>
                          <dd className="mono">{row.positionId}</dd>
                        </div>
                        <div>
                          <dt>Created</dt>
                          <dd>{formatLocalDateTime(row.createdAtIso)}</dd>
                        </div>
                        <div>
                          <dt>Bot ID</dt>
                          <dd className="mono" title={row.botId}>
                            {shortenBytes32(row.botId)}
                          </dd>
                        </div>
                        <div>
                          <dt>HL portion</dt>
                          <dd className="mono" title={row.hlPortionId}>
                            {shortenBytes32(row.hlPortionId)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {empty && (
            <div className="rq-empty">
              <p className="rq-empty-title">No pending redemptions</p>
              <p className="muted">
                The FIFO queue is empty — every close that enqueued an HL portion has been fulfilled
                (or none are waiting).
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function QueueChip({ row }: { row: RedemptionPendingRequest }) {
  return (
    <div
      role="listitem"
      className={row.isHead ? 'rq-chip rq-chip-head' : 'rq-chip'}
      title={`#${row.requestId} · ${row.user} · ${row.waitLabel}`}
    >
      <span className="rq-chip-pos">{row.isHead ? 'HEAD' : row.queueIndex + 1}</span>
      <span className="rq-chip-id mono">#{row.requestId}</span>
      <span className="rq-chip-wait">{row.waitLabel}</span>
    </div>
  )
}
