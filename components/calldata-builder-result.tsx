'use client'

import { CopyTextButton } from './copy-text-button'
import type { ExecuteStrategyFields } from '@/lib/calldata/encode-strategy-params'
import type { SimulateExecuteStrategyResult } from '@/lib/calldata/simulate-execute-strategy'
import { BASESCAN_VAULT_WRITE } from '@/lib/calldata/constants'

type Props = {
  result: ExecuteStrategyFields
  simulation: SimulateExecuteStrategyResult | null
  simulationLoading: boolean
  simulationError: string | null
  onResimulate: () => void
}

function FieldRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="calldata-field">
      <div className="calldata-field-head">
        <span>
          {label}
          {hint ? <span className="muted"> · {hint}</span> : null}
        </span>
        <CopyTextButton value={value} />
      </div>
      <code className="calldata-value mono">{value}</code>
    </div>
  )
}

export function CalldataBuilderResult({
  result,
  simulation,
  simulationLoading,
  simulationError,
  onResimulate,
}: Props) {
  return (
    <div className="result calldata-result">
      <div className="result-header">
        <div>
          <h2>Basescan paste fields</h2>
          <p className="muted">
            {result.strategyLabel} → vault <code>executeStrategy</code>
          </p>
        </div>
        <a className="btn-secondary" href={BASESCAN_VAULT_WRITE} target="_blank" rel="noreferrer">
          Open vault Write
        </a>
      </div>

      <ol className="calldata-steps">
        <li>
          Open{' '}
          <a href={BASESCAN_VAULT_WRITE} target="_blank" rel="noreferrer">
            Basescan vault Write as Proxy
          </a>{' '}
          and connect the <strong>operator</strong> wallet.
        </li>
        <li>
          Find <code>executeStrategy</code> and paste the four fields below (order matters).
        </li>
        <li>Write / confirm the tx. This tool only builds + simulates — it does not send.</li>
      </ol>

      {result.warnings.length > 0 && (
        <ul className="calldata-warnings">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="calldata-sim">
        <div className="calldata-sim-head">
          <h3>Simulation</h3>
          <button
            type="button"
            className="btn-secondary"
            disabled={simulationLoading}
            onClick={onResimulate}
          >
            {simulationLoading ? 'Simulating…' : 'Re-simulate'}
          </button>
        </div>
        {simulationLoading && !simulation && (
          <p className="muted">Running eth_call + eth_estimateGas as operator…</p>
        )}
        {simulationError && <p className="error">{simulationError}</p>}
        {simulation && (
          <>
            <p>
              <span className={simulation.ok ? 'badge-ok' : 'badge-warn'}>
                {simulation.ok ? 'Would succeed' : 'Would revert'}
              </span>{' '}
              <span className="muted">{simulation.message}</span>
            </p>
            <dl className="kv calldata-sim-kv">
              <div>
                <dt>Operator (from)</dt>
                <dd className="mono">{simulation.operator}</dd>
              </div>
              <div>
                <dt>OPERATOR_ROLE</dt>
                <dd>
                  {simulation.operatorHasRole == null
                    ? '—'
                    : simulation.operatorHasRole
                      ? 'yes'
                      : 'no'}
                </dd>
              </div>
              <div>
                <dt>Gas estimate</dt>
                <dd className="mono">
                  {simulation.gasEstimate
                    ? `${Number(simulation.gasEstimate).toLocaleString('en-US')}`
                    : '—'}
                  {simulation.gasEstimateBuffered
                    ? ` → ${Number(simulation.gasEstimateBuffered).toLocaleString('en-US')} (+20%)`
                    : ''}
                </dd>
              </div>
            </dl>
            {simulation.warnings.length > 0 && (
              <ul className="calldata-warnings">
                {simulation.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <FieldRow label="strategy (address)" value={result.strategy} hint="arg 1" />
      <FieldRow label="user (address)" value={result.user} hint="arg 2 · investor EOA" />
      <FieldRow label="botId (bytes32)" value={result.botIdBytes32} hint="arg 3" />
      <FieldRow label="params (bytes)" value={result.params} hint="arg 4 · ABI-encoded" />

      <details className="calldata-advanced">
        <summary>Advanced / debug</summary>
        <FieldRow label="Full executeStrategy calldata" value={result.executeStrategyCalldata} />
        <FieldRow label="deadline (unix)" value={result.deadlineUnix} />
        <pre className="json-block">{JSON.stringify(result.decoded, null, 2)}</pre>
      </details>
    </div>
  )
}
