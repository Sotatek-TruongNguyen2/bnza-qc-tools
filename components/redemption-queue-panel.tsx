'use client'

import { useEffect, useMemo, useState } from 'react'
import { CopyIconButton } from './copy-icon-button'
import { CopyJsonButton } from './copy-json-button'
import { RefreshIconButton } from './refresh-icon-button'
import { apiGetJson } from '@/lib/api-client'
import { formatLocalDateTime } from '@/lib/format-datetime'
import type {
  RedemptionPendingRequest,
  RedemptionQueueResult,
} from '@/lib/redemption-queue/types'

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
          <RefreshIconButton
            loading={loading}
            onClick={() => void reload()}
            label={result ? 'Refresh' : 'Load queue'}
            loadingLabel={result ? 'Refreshing…' : 'Loading…'}
          />
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
            <span className="rq-copyable">
              <a href={result.basescanQueue} target="_blank" rel="noreferrer" className="mono">
                {result.queueAddress}
              </a>
              <CopyIconButton value={result.queueAddress} label="Copy queue address" />
            </span>
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
                    <RequestCard key={row.requestId} row={row} />
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

function shorten(addr: string, left = 4, right = 4): string {
  if (addr.length < left + right + 2) return addr
  return `${addr.slice(0, left + 2)}…${addr.slice(-right)}`
}

/** Middle-trim bytes32 the same way as addresses: 0xabcd…wxyz */
function shortenBytes32(hex: string, left = 4, right = 4): string {
  if (!hex.startsWith('0x') || hex.length <= 2 + left + right + 1) return hex
  return `${hex.slice(0, 2 + left)}…${hex.slice(-right)}`
}

/** Short display + CSS tooltip with full value (native title is unreliable on truncated text). */
function TrimmedId({
  full,
  display,
  href,
}: {
  full: string
  display: string
  href?: string
}) {
  const text = href ? (
    <a href={href} target="_blank" rel="noreferrer" className="mono">
      {display}
    </a>
  ) : (
    <span className="mono">{display}</span>
  )

  if (display === full) return text

  return (
    <span className="rq-trim has-tooltip" tabIndex={0}>
      {text}
      <span className="rq-trim-tooltip mono" role="tooltip">
        {full}
      </span>
    </span>
  )
}

function RequestCard({ row }: { row: RedemptionPendingRequest }) {
  return (
    <li className={row.isHead ? 'rq-card rq-card-head' : 'rq-card'}>
      <div className="rq-card-top">
        <div className="rq-card-id">
          {row.isHead ? (
            <span className="badge-warn">NEXT</span>
          ) : (
            <span className="badge-muted">#{row.queueIndex + 1} in line</span>
          )}
        </div>
        <span className="rq-wait" title={`${row.waitSeconds}s`}>
          {row.waitLabel}
        </span>
      </div>
      <dl className="kv rq-card-kv">
        <div>
          <dt>Request ID</dt>
          <dd>
            <span className="rq-copyable">
              <span className="mono">{row.requestId}</span>
              <CopyIconButton value={row.requestId} label="Copy request ID" />
            </span>
          </dd>
        </div>
        <div>
          <dt>User</dt>
          <dd>
            <span className="rq-copyable">
              <TrimmedId full={row.user} display={shorten(row.user)} href={row.basescanUser} />
              <CopyIconButton value={row.user} label="Copy user address" />
            </span>
          </dd>
        </div>
        <div>
          <dt>Bot ID</dt>
          <dd>
            <span className="rq-copyable">
              <TrimmedId full={row.botId} display={shortenBytes32(row.botId)} />
              <CopyIconButton value={row.botId} label="Copy bot ID" />
            </span>
          </dd>
        </div>
        <div>
          <dt>Position ID</dt>
          <dd>
            <span className="rq-copyable">
              <span className="mono">{row.positionId}</span>
              <CopyIconButton value={row.positionId} label="Copy position ID" />
            </span>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd title={row.createdAtIso}>{formatLocalDateTime(row.createdAtIso)}</dd>
        </div>
      </dl>
    </li>
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
