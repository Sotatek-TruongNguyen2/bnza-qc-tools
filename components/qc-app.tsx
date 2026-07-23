'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AddressesPanel } from './addresses-panel'
import { BotPanel } from './bot-panel'
import { CalldataBuilderPanel } from './calldata-builder-panel'
import { GasEstimatePanel } from './gas-estimate-panel'
import { PositionPanel } from './position-panel'
import { QuotePanel } from './quote-panel'
import { RecentOpensStats } from './recent-opens-stats'
import { RedemptionQueuePanel } from './redemption-queue-panel'
import { ToolNavGroupIcon } from './tool-nav-group-icon'
import { ToolNavIcon } from './tool-nav-icon'
import { TxPnlPanel } from './tx-pnl-panel'
import { replaceQueryParams } from '@/lib/url-query'

type Tool = 'position' | 'quote' | 'bot' | 'addresses' | 'tx-pnl' | 'gas' | 'calldata' | 'queue'

const TOOL_GROUPS: {
  id: string
  label: string
  tools: { id: Tool; label: string; title: string }[]
}[] = [
  {
    id: 'lookup',
    label: 'Lookup',
    tools: [
      { id: 'bot', label: 'Bot', title: 'Bot vault / user EOA lookup' },
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
      { id: 'queue', label: 'Queue', title: 'HL redemption queue' },
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
    value === 'calldata' ||
    value === 'queue'
  ) {
    return value
  }
  return 'position'
}

export function QcApp() {
  const searchParams = useSearchParams()
  const [tool, setTool] = useState<Tool>(() => toolFromParam(searchParams.get('tool')))
  /** Keep visited tabs mounted (hidden) so switching back does not remount + re-hit RPC. */
  const [mounted, setMounted] = useState<Set<Tool>>(() => new Set([toolFromParam(searchParams.get('tool'))]))

  // Sync if the URL is changed by the browser (back/forward) or a full load.
  useEffect(() => {
    const next = toolFromParam(searchParams.get('tool'))
    setTool(next)
    setMounted((prev) => {
      if (prev.has(next)) return prev
      const copy = new Set(prev)
      copy.add(next)
      return copy
    })
  }, [searchParams])

  /** Re-trigger enter animation on each tab switch without remounting keep-alive panels. */
  const [playEnter, setPlayEnter] = useState(true)
  useEffect(() => {
    setPlayEnter(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPlayEnter(true))
    })
    return () => cancelAnimationFrame(id)
  }, [tool])

  function selectTool(next: Tool) {
    if (next === tool) return
    setTool(next)
    setMounted((prev) => {
      if (prev.has(next)) return prev
      const copy = new Set(prev)
      copy.add(next)
      return copy
    })
    replaceQueryParams((params) => {
      params.set('tool', next)
    })
  }

  function panelClass(id: Tool): string {
    if (tool !== id) return 'tab-panel tab-panel-hidden'
    return playEnter ? 'tab-panel tab-panel-enter' : 'tab-panel'
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
          Helpers for EXBOT bot vault state, LP inspection, swap quotes, gas samples, redemption
          queue, and Basescan calldata. No private keys stored here.
        </p>
      </header>

      <RecentOpensStats />

      <nav className="tool-nav" aria-label="Tools">
        {TOOL_GROUPS.map((group) => (
          <div key={group.id} className="tool-nav-group" role="group" aria-label={group.label}>
            <span className="tool-nav-label">
              <ToolNavGroupIcon groupId={group.id} />
              {group.label}
            </span>
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
                  <ToolNavIcon toolId={item.id} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="tab-panels">
        {/* Lazy-mount on first visit, then keep alive hidden — no remount refetch on tab switch. */}
        {mounted.has('bot') && (
          <div className={panelClass('bot')} hidden={tool !== 'bot'}>
            <BotPanel />
          </div>
        )}
        {mounted.has('position') && (
          <div className={panelClass('position')} hidden={tool !== 'position'}>
            <PositionPanel />
          </div>
        )}
        {mounted.has('quote') && (
          <div className={panelClass('quote')} hidden={tool !== 'quote'}>
            <QuotePanel />
          </div>
        )}
        {mounted.has('tx-pnl') && (
          <div className={panelClass('tx-pnl')} hidden={tool !== 'tx-pnl'}>
            <TxPnlPanel />
          </div>
        )}
        {mounted.has('gas') && (
          <div className={panelClass('gas')} hidden={tool !== 'gas'}>
            <GasEstimatePanel />
          </div>
        )}
        {mounted.has('queue') && (
          <div className={panelClass('queue')} hidden={tool !== 'queue'}>
            <RedemptionQueuePanel />
          </div>
        )}
        {mounted.has('calldata') && (
          <div className={panelClass('calldata')} hidden={tool !== 'calldata'}>
            <CalldataBuilderPanel />
          </div>
        )}
        {mounted.has('addresses') && (
          <div className={panelClass('addresses')} hidden={tool !== 'addresses'}>
            <AddressesPanel />
          </div>
        )}
      </div>

      <footer className="footer">
        <code>get-bot-status</code> / position / quote helpers. Calldata builder only encodes params —
        operator sends on Basescan.
      </footer>
    </main>
  )
}
