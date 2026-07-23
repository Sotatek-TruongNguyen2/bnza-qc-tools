'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuoteRoutePath } from './quote-route-path'
import { RefreshIconButton } from './refresh-icon-button'
import { TokenIcon } from './token-icon'
import { apiGetJson } from '@/lib/api-client'
import { BASE_USDC_ADDRESS, BASE_WETH_ADDRESS } from '@/lib/base-known-tokens'
import {
  feeTierShortLabel,
  pickCloseConvertTokenIn,
} from '@/lib/calldata/pick-close-convert-token-in'
import type { PositionResult } from '@/lib/position/types'
import type { QuoteResult, RouteHop, TokenInfo } from '@/lib/quote/types'

/** Tiny probe amount — only used to rank routes; never shown in UI. */
const PROBE_AMOUNT = '0.1'

type RouteOption = {
  path: string
  rank: number
  hops: RouteHop[]
  description: string
}

type Props = {
  tokenId: string
  value: string
  onChange: (path: string) => void
  defaultSwapFee: string
  onDefaultSwapFeeChange: (fee: string) => void
}

function autoHops(tokenIn: TokenInfo, fee: number): RouteHop[] {
  return [
    {
      tokenIn: tokenIn.address,
      tokenOut: BASE_USDC_ADDRESS,
      fee,
    },
  ]
}

export function CalldataSwapPathSelect({
  tokenId,
  value,
  onChange,
  defaultSwapFee,
  onDefaultSwapFeeChange,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [tokenInSymbol, setTokenInSymbol] = useState('WETH')
  const [tokenOutMeta, setTokenOutMeta] = useState<TokenInfo | null>(null)
  const [tokenInMeta, setTokenInMeta] = useState<TokenInfo | null>(null)
  const [pairNote, setPairNote] = useState<string | null>(null)
  const [mode, setMode] = useState<'auto' | 'route' | 'custom'>('auto')
  const [customPath, setCustomPath] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadRoutes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let nextIn: string = BASE_WETH_ADDRESS
      let nextInSymbol = 'WETH'
      let note = 'Close convert path: WETH → USDC (same route discovery as Quote).'

      const id = tokenId.trim()
      if (/^\d+$/.test(id)) {
        try {
          const pos = await apiGetJson<PositionResult>(
            `/api/position?tokenId=${encodeURIComponent(id)}`,
          )
          const picked = pickCloseConvertTokenIn(pos)
          nextIn = picked.tokenIn
          nextInSymbol = picked.tokenInSymbol
          note = picked.note
        } catch {
          // keep WETH→USDC
        }
      }

      setTokenInSymbol(nextInSymbol)
      setPairNote(note)

      const qs = new URLSearchParams({
        amount: PROBE_AMOUNT,
        tokenIn: nextIn,
        tokenOut: 'USDC',
        slippage: '0.5',
      })
      const data = await apiGetJson<QuoteResult>(`/api/quote?${qs}`)
      setTokenInMeta(data.tokenIn)
      setTokenOutMeta(data.tokenOut)

      const opts: RouteOption[] = data.quotes
        .filter((q) => q.path && q.path !== '0x' && q.kind !== 'identity')
        .map((q) => ({
          path: q.path,
          rank: q.rank,
          hops: q.hops,
          description: q.description,
        }))
      setRoutes(opts)

      if (value && opts.some((o) => o.path.toLowerCase() === value.toLowerCase())) {
        setMode('route')
      } else if (value && value !== '0x') {
        setMode('custom')
        setCustomPath(value)
      } else {
        setMode('auto')
      }
    } catch (err) {
      setRoutes([])
      setError(err instanceof Error ? err.message : 'Failed to load Quote routes')
    } finally {
      setLoading(false)
    }
  }, [tokenId, value])

  // No auto-fetch on mount / tokenId / tab focus — only Refresh or first open of the menu.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openMenu() {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen && routes.length === 0 && !loading) {
      await loadRoutes()
    }
  }

  const selected = useMemo(
    () => routes.find((r) => r.path.toLowerCase() === value.toLowerCase()) ?? null,
    [routes, value],
  )

  const fee = Number(defaultSwapFee) || 500
  const fallbackIn: TokenInfo = tokenInMeta ?? {
    address: BASE_WETH_ADDRESS,
    symbol: tokenInSymbol,
    decimals: 18,
  }
  const fallbackOut: TokenInfo = tokenOutMeta ?? {
    address: BASE_USDC_ADDRESS,
    symbol: 'USDC',
    decimals: 6,
  }

  function pickAuto() {
    setMode('auto')
    onChange('')
    setOpen(false)
  }

  function pickRoute(path: string) {
    setMode('route')
    onChange(path)
    setOpen(false)
  }

  function pickCustom() {
    setMode('custom')
    onChange(customPath.trim())
    setOpen(false)
  }

  return (
    <div className="calldata-swap-path" ref={rootRef}>
      <div className="field field-with-hint">
        <span>Swap path (from Quote routes)</span>
        <div className="calldata-route-picker">
          <div className="calldata-prefill-row">
            <button
              type="button"
              className="calldata-route-trigger"
              disabled={loading}
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => void openMenu()}
            >
              <span className="calldata-route-trigger-main">
                {mode === 'route' && selected ? (
                  <>
                    <span className="muted calldata-route-rank">#{selected.rank}</span>
                    <QuoteRoutePath
                      hops={selected.hops}
                      tokenIn={fallbackIn}
                      tokenOut={fallbackOut}
                      description={selected.description}
                    />
                  </>
                ) : mode === 'custom' ? (
                  <span>Custom hex path</span>
                ) : (
                  <>
                    <span className="muted">Auto</span>
                    <span className="quote-route-path">
                      <span className="quote-route-token">
                        <TokenIcon
                          symbol={fallbackIn.symbol}
                          address={fallbackIn.address}
                          size={18}
                        />
                        <span>{fallbackIn.symbol}</span>
                      </span>
                      <span className="quote-route-hop muted">
                        <span className="quote-route-fee">{feeTierShortLabel(fee)}</span>
                        <span className="quote-route-arrow" aria-hidden>
                          →
                        </span>
                      </span>
                      <span className="quote-route-token">
                        <TokenIcon symbol="USDC" address={BASE_USDC_ADDRESS} size={18} />
                        <span>USDC</span>
                      </span>
                    </span>
                  </>
                )}
              </span>
              <span className="calldata-route-chevron" aria-hidden>
                ▾
              </span>
            </button>
            <RefreshIconButton
              loading={loading}
              onClick={() => void loadRoutes()}
              label="Refresh routes"
              loadingLabel="Loading routes…"
            />
          </div>

          {open && (
            <ul className="calldata-route-menu" role="listbox">
              <li>
                <button type="button" className="calldata-route-option" onClick={pickAuto}>
                  <span className="muted calldata-route-rank">Auto</span>
                  <QuoteRoutePath
                    hops={autoHops(fallbackIn, fee)}
                    tokenIn={fallbackIn}
                    tokenOut={fallbackOut}
                    description={`Auto default ${fallbackIn.symbol}→USDC @ ${fee}`}
                  />
                  <span className="muted">{feeTierShortLabel(fee)} default</span>
                </button>
              </li>
              {routes.map((r) => (
                <li key={r.path}>
                  <button
                    type="button"
                    className={
                      selected?.path === r.path
                        ? 'calldata-route-option is-selected'
                        : 'calldata-route-option'
                    }
                    onClick={() => pickRoute(r.path)}
                  >
                    <span className="muted calldata-route-rank">#{r.rank}</span>
                    <QuoteRoutePath
                      hops={r.hops}
                      tokenIn={fallbackIn}
                      tokenOut={fallbackOut}
                      description={r.description}
                    />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="calldata-route-option" onClick={pickCustom}>
                  <span className="muted calldata-route-rank">…</span>
                  <span>Custom hex path</span>
                </button>
              </li>
            </ul>
          )}
        </div>
        <span className="field-hint">
          Same Uniswap V3 paths as the Quote tab
          {tokenInMeta && tokenOutMeta
            ? ` (${tokenInMeta.symbol} → ${tokenOutMeta.symbol})`
            : ` (${tokenInSymbol} → USDC)`}
          . Amounts are not shown — close size is separate (Min USDC out).
        </span>
      </div>

      {pairNote && <p className="hint">{pairNote}</p>}
      {error && <p className="error">{error}</p>}

      {mode === 'custom' && (
        <label className="field field-with-hint">
          <span>Custom swap path hex</span>
          <input
            value={customPath || value}
            onChange={(e) => {
              const v = e.target.value
              setCustomPath(v)
              setMode('custom')
              onChange(v)
            }}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      )}

      {mode === 'auto' && (
        <label className="field field-with-hint">
          <span>Default swap fee (auto path)</span>
          <input
            value={defaultSwapFee}
            onChange={(e) => onDefaultSwapFeeChange(e.target.value)}
            inputMode="numeric"
            placeholder="500"
          />
          <span className="field-hint">Only for Auto. 500 = 0.05%, 3000 = 0.3%.</span>
        </label>
      )}
    </div>
  )
}
