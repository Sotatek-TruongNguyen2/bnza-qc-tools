'use client'

import { useEffect, useState } from 'react'
import { PositionPanel } from './position-panel'
import { QuotePanel } from './quote-panel'

type Tool = 'position' | 'quote'

export function QcApp() {
  const [tool, setTool] = useState<Tool>('position')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tool')
    if (t === 'quote' || t === 'position') setTool(t)
  }, [])

  function selectTool(next: Tool) {
    setTool(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tool', next)
    if (next === 'position') {
      // keep tokenId if present
    } else {
      url.searchParams.delete('tokenId')
    }
    window.history.replaceState({}, '', url)
  }

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">BNZA · Base mainnet</p>
        <h1>QC Uniswap tools</h1>
        <p className="lede">
          Read-only helpers for LP position inspection and swap route quotes. No wallet or private
          key needed.
        </p>
      </header>

      <nav className="tabs" aria-label="Tools">
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
      </nav>

      {tool === 'position' ? <PositionPanel /> : <QuotePanel />}

      <footer className="footer">
        <code>query-uniswap-v3-position-base</code> /{' '}
        <code>quote-uniswap-v3-routes-base</code> scripts. Quotes / reads only — no
        transactions.
      </footer>
    </main>
  )
}
