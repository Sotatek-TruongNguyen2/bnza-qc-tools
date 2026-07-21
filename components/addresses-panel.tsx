'use client'

import { useMemo } from 'react'
import { CopyJsonButton } from './copy-json-button'
import { getBaseMainnetDeployedAddressGroups } from '@/lib/deployed-addresses/base-mainnet'
import { basescanLink } from '@/lib/position/format'

export function AddressesPanel() {
  const groups = useMemo(() => getBaseMainnetDeployedAddressGroups(), [])

  const exportPayload = useMemo(
    () => ({
      network: 'Base mainnet',
      chainId: 8453,
      release: '2026-07-base-scale-down',
      groups: groups.map((g) => ({
        title: g.title,
        entries: g.entries.map((e) => ({ name: e.name, address: e.address, note: e.note })),
      })),
    }),
    [groups],
  )

  return (
    <section className="panel">
      <div className="result-header addresses-header">
        <div>
          <h2>Deployed addresses</h2>
          <p className="muted">
            Base mainnet (chainId 8453) · EXBOT release{' '}
            <span className="mono">2026-07-base-scale-down</span>
          </p>
        </div>
        <CopyJsonButton value={exportPayload} label="Copy JSON" />
      </div>

      <p className="hint">
        Proxies are the integration surface. Strategy addresses may be redeployed — prefer{' '}
        <code>ExbotAddressesProvider</code> on-chain getters when wiring production code.
      </p>

      {groups.map((group) => (
        <div key={group.id} className="address-group">
          <h3>{group.title}</h3>
          {group.description && <p className="muted address-group-desc">{group.description}</p>}
          <div className="table-wrap">
            <table className="address-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Address</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={`${group.id}-${entry.address}-${entry.name}`}>
                    <td>{entry.name}</td>
                    <td className="mono">
                      <a href={basescanLink(entry.address)} target="_blank" rel="noreferrer">
                        {entry.address}
                      </a>
                    </td>
                    <td className="muted">{entry.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  )
}
