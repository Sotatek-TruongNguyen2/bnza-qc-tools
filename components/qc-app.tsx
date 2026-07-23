'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AddressesPanel } from './addresses-panel'
import { BotPanel } from './bot-panel'
import { CalldataBuilderPanel } from './calldata-builder-panel'
import { GasEstimatePanel } from './gas-estimate-panel'
import { PositionPanel } from './position-panel'
import { QuotePanel } from './quote-panel'
import { TxPnlPanel } from './tx-pnl-panel'
import { replaceQueryParams } from '@/lib/url-query'

type Tool = 'position' | 'quote' | 'bot' | 'addresses' | 'tx-pnl' | 'gas' | 'calldata'

const TOOL_GROUPS: {
  id: string
  label: string
  tools: { id: Tool; label: string; title: string }[]
}[] = [
  {
    id: 'lookup',
    label: 'Lookup',
    tools: [
      { id: 'bot', label: 'Bot', title: 'Bot vault / custody lookup' },
      { id: 'position', label: 'Position', title: 'Uniswap LP position lookup' },
      { id: 'quote', label: 'Quote', title: 'Uniswap V3 swap quote' },
    ],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    tools: [
      { id: 'tx-pnl', label: 'PnL', title: 'Transaction PnL' },
      { id: 'gas', label: 'Gas', title: 'Gas fee estimates' },
    ],
  },
  {
    id: 'ops',
    label: 'Ops',
    tools: [
      { id: 'calldata', label: 'Calldata', title: 'Basescan close / rebalance params' },
      { id: 'addresses', label: 'Addresses', title: 'Deployed contract addresses' },
    ],
  },
]

function toolFromParam(value: string | null): Tool {
  if (
    value === 'bot' ||
    value === 'quote' ||
    value === 'position' ||
    value === 'addresses' ||
    value === 'tx-pnl' ||
    value === 'gas' ||
    value === 'calldata'
  ) {
    return value
  }
  return 'position'
}

export function QcApp() {
  const searchParams = useSearchParams()
  const [tool, setTool] = useState<Tool>(() => toolFromParam(searchParams.get('tool')))

  // Sync if the URL is changed by the browser (back/forward) or a full load.
  useEffect(() => {
    setTool(toolFromParam(searchParams.get('tool')))
  }, [searchParams])

  function selectTool(next: Tool) {
    if (next === tool) return
    setTool(next)
    replaceQueryParams((params) => {
      params.set('tool', next)
    })
  }

  return (
    <main className="shell">
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">BNZA · Base mainnet</p>
          <div className="hero-brands" aria-label="Integrations">
            <span className="hero-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/uniswap.svg" alt="" width={22} height={22} />
              Uniswap
            </span>
            <span className="hero-brand-sep" aria-hidden="true">
              ·
            </span>
            <span className="hero-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/hyperliquid.svg" alt="" width={22} height={22} />
              Hyperliquid
            </span>
          </div>
        </div>
        <h1>QC Uniswap tools</h1>
        <p className="lede">
          Helpers for EXBOT bot vault state, LP inspection, swap quotes, gas samples, and Basescan
          calldata for close / rebalance. No private keys stored here.
        </p>
      </header>

      <nav className="tool-nav" aria-label="Tools">
        {TOOL_GROUPS.map((group) => (
          <div key={group.id} className="tool-nav-group" role="group" aria-label={group.label}>
            <span className="tool-nav-label">{group.label}</span>
            <div className="tool-nav-pills">
              {group.tools.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={tool === item.id ? 'tab active' : 'tab'}
                  title={item.title}
                  aria-current={tool === item.id ? 'page' : undefined}
                  onClick={() => selectTool(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="tab-panels">
        {/* Mount only the active tool — avoids hidden panels rewriting the URL / refetching. */}
        {tool === 'bot' && <BotPanel />}
        {tool === 'position' && <PositionPanel />}
        {tool === 'quote' && <QuotePanel />}
        {tool === 'tx-pnl' && <TxPnlPanel />}
        {tool === 'gas' && <GasEstimatePanel />}
        {tool === 'calldata' && <CalldataBuilderPanel />}
        {tool === 'addresses' && <AddressesPanel />}
      </div>

      <footer className="footer">
        <code>get-bot-status</code> / position / quote helpers. Calldata builder only encodes params —
        operator sends on Basescan.
      </footer>
    </main>
  )
}
