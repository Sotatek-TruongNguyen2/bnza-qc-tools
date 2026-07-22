'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AddressesPanel } from './addresses-panel'
import { BotPanel } from './bot-panel'
import { PositionPanel } from './position-panel'
import { QuotePanel } from './quote-panel'
import { TxPnlPanel } from './tx-pnl-panel'
import { replaceQueryParams } from '@/lib/url-query'

type Tool = 'position' | 'quote' | 'bot' | 'addresses' | 'tx-pnl'

function toolFromParam(value: string | null): Tool {
  if (
    value === 'bot' ||
    value === 'quote' ||
    value === 'position' ||
    value === 'addresses' ||
    value === 'tx-pnl'
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
          Read-only helpers for EXBOT bot vault state, LP position inspection, and swap route
          quotes. No wallet or private key needed.
        </p>
      </header>

      <nav className="tabs" aria-label="Tools">
        <button
          type="button"
          className={tool === 'bot' ? 'tab active' : 'tab'}
          onClick={() => selectTool('bot')}
        >
          Bot lookup
        </button>
        <button
          type="button"
          className={tool === 'position' ? 'tab active' : 'tab'}
          onClick={() => selectTool('position')}
        >
          Position lookup
        </button>
        <button
          type="button"
          className={tool === 'quote' ? 'tab active' : 'tab'}
          onClick={() => selectTool('quote')}
        >
          Swap quote
        </button>
        <button
          type="button"
          className={tool === 'tx-pnl' ? 'tab active' : 'tab'}
          onClick={() => selectTool('tx-pnl')}
        >
          PnL
        </button>
        <button
          type="button"
          className={tool === 'addresses' ? 'tab active' : 'tab'}
          onClick={() => selectTool('addresses')}
        >
          Addresses
        </button>
      </nav>

      <div className="tab-panels">
        {/* Mount only the active tool — avoids hidden panels rewriting the URL / refetching. */}
        {tool === 'bot' && <BotPanel />}
        {tool === 'position' && <PositionPanel />}
        {tool === 'quote' && <QuotePanel />}
        {tool === 'tx-pnl' && <TxPnlPanel />}
        {tool === 'addresses' && <AddressesPanel />}
      </div>

      <footer className="footer">
        <code>get-bot-status</code> vault views / <code>query-uniswap-v3-position-base</code> /{' '}
        <code>quote-uniswap-v3-routes-base</code>. Quotes / reads only — no transactions.
      </footer>
    </main>
  )
}
