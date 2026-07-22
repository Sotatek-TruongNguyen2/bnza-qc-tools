'use client'

import { useState } from 'react'
import { CopyJsonButton } from './copy-json-button'
import { apiGetJson } from '@/lib/api-client'
import type { GasEstimateResult, GasOpEstimate } from '@/lib/gas/types'
import { basescanLink } from '@/lib/position/format'

function basescanTx(hash: string): string {
  return `https://basescan.org/tx/${hash}`
}

function formatFee(op: GasOpEstimate): string {
  if (op.estimatedFeeEth == null) return '—'
  const eth = Number(op.estimatedFeeEth)
  const ethLabel = Number.isFinite(eth)
    ? eth < 0.0001
      ? `${op.estimatedFeeEth} ETH`
      : `${eth.toFixed(6)} ETH`
    : `${op.estimatedFeeEth} ETH`
  if (op.estimatedFeeUsd != null) return `${ethLabel} (≈ $${op.estimatedFeeUsd})`
  return ethLabel
}

export function GasEstimatePanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GasEstimateResult | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGetJson<GasEstimateResult>('/api/gas-estimate')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <div className="result-header addresses-header">
        <div>
          <h2>Gas estimates</h2>
          <p className="muted">
            <code>eth_estimateGas</code> replay of recent vault calls · +
            {result ? Math.round((result.gasBuffer - 1) * 100) : 20}% buffer · manual Reload only.
          </p>
        </div>
        <div className="result-actions">
          {result && <CopyJsonButton value={result} label="Copy JSON" />}
          <button type="button" className="btn-primary" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Estimating…' : result ? 'Reload' : 'Load estimates'}
          </button>
        </div>
      </div>

      <p className="hint">
        For each critical op we find a recent successful Base tx, then call{' '}
        <code>eth_estimateGas</code> with that calldata at the parent block (pre-tx state —
        same idea as operator <code>estimateContractGas</code>). Fee = estimate × 1.2 × current
        network fee.
      </p>

      {error && <p className="error">{error}</p>}

      {!result && !loading && !error && (
        <p className="muted">Click Load estimates to run eth_estimateGas on recent vault calls.</p>
      )}

      {loading && !result && (
        <p className="muted">Running eth_estimateGas (may take ~15–40s on public Base RPC)…</p>
      )}

      {result && (
        <div className="result">
          <dl className="kv gas-meta">
            <div>
              <dt>Vault</dt>
              <dd className="mono">
                <a href={basescanLink(result.vault)} target="_blank" rel="noreferrer">
                  {result.vault}
                </a>
              </dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>
                <code>eth_estimateGas</code> · buffer {result.gasBuffer}×
              </dd>
            </div>
            <div>
              <dt>Lookback</dt>
              <dd>
                {result.lookedBackBlocks} blocks · #{result.fromBlock} → #{result.toBlock}
              </dd>
            </div>
            <div>
              <dt>Fee per gas (now)</dt>
              <dd className="mono">
                {result.feePerGasGwei} gwei
                {result.ethUsd != null ? ` · ETH ≈ $${result.ethUsd.toFixed(2)}` : ''}
              </dd>
            </div>
            <div>
              <dt>Fetched</dt>
              <dd className="mono">{result.fetchedAt}</dd>
            </div>
          </dl>

          <div className="table-wrap">
            <table className="address-table gas-table">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Payer</th>
                  <th>Samples</th>
                  <th>Gas estimate (median)</th>
                  <th>Min / max</th>
                  <th>Est. fee (buffered)</th>
                </tr>
              </thead>
              <tbody>
                {result.operations.map((op) => (
                  <tr key={op.id}>
                    <td>
                      <strong>{op.label}</strong>
                      {op.method && (
                        <div className="muted gas-row-note">
                          <code>{op.method}</code>
                        </div>
                      )}
                      {op.error && <div className="error gas-row-note">{op.error}</div>}
                      {!op.error && op.note && op.sampleCount === 0 && (
                        <div className="muted gas-row-note">{op.note}</div>
                      )}
                    </td>
                    <td>{op.payer}</td>
                    <td className="mono">{op.sampleCount}</td>
                    <td className="mono">{op.gasEstimateMedian ?? '—'}</td>
                    <td className="mono">
                      {op.gasEstimateMin != null && op.gasEstimateMax != null
                        ? `${op.gasEstimateMin} / ${op.gasEstimateMax}`
                        : '—'}
                    </td>
                    <td className="mono">{formatFee(op)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.operations.some((op) => op.samples.length > 0) && (
            <div className="gas-samples">
              <h3>Sample txs (estimateGas source)</h3>
              {result.operations
                .filter((op) => op.samples.length > 0)
                .map((op) => (
                  <div key={op.id} className="gas-sample-group">
                    <h4>{op.label}</h4>
                    <ul className="gas-sample-list">
                      {op.samples.map((s) => (
                        <li key={s.txHash}>
                          <a href={basescanTx(s.txHash)} target="_blank" rel="noreferrer" className="mono">
                            {s.txHash.slice(0, 10)}…{s.txHash.slice(-8)}
                          </a>
                          <span className="muted">
                            {' '}
                            · estimate {s.gasEstimate}
                            {s.gasUsed != null ? ` · used ${s.gasUsed}` : ''}
                            {s.feeEth != null ? ` · ~${Number(s.feeEth).toFixed(6)} ETH` : ''}
                            {' · '}
                            block {s.blockNumber}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}

          <div className="caveats">
            <h3>Caveats</h3>
            <ul className="caveat-list">
              {result.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
