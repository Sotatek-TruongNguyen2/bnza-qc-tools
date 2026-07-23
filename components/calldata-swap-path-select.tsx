'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { QuoteRoutePath } from './quote-route-path'
import { apiGetJson } from '@/lib/api-client'
import { BASE_WETH_ADDRESS } from '@/lib/base-known-tokens'
import {
  feeTierShortLabel,
  pickCloseConvertTokenIn,
} from '@/lib/calldata/pick-close-convert-token-in'
import type { PositionResult } from '@/lib/position/types'
import type { QuoteResult } from '@/lib/quote/types'

const EMPTY = ''
const CUSTOM = '__custom__'
/** Nominal size for ranking routes — path encoding does not depend on amount. */
const QUOTE_AMOUNT = '0.1'

type RouteOption = {
  path: string
  label: string
  hops: QuoteResult['quotes'][number]['hops']
  description: string
}

type Props = {
  tokenId: string
  value: string
  onChange: (path: string) => void
  defaultSwapFee: string
  onDefaultSwapFeeChange: (fee: string) => void
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
  const [tokenOutMeta, setTokenOutMeta] = useState<QuoteResult['tokenOut'] | null>(null)
  const [tokenInMeta, setTokenInMeta] = useState<QuoteResult['tokenIn'] | null>(null)
  const [pairNote, setPairNote] = useState<string | null>(null)
  const [mode, setMode] = useState<'auto' | 'route' | 'custom'>('auto')
  const [customPath, setCustomPath] = useState('')

  const loadRoutes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let nextIn: string = BASE_WETH_ADDRESS
      let nextInSymbol = 'WETH'
      let note =
        'Routes for close convert: WETH → USDC (same discovery as the Quote tab).'

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
          // keep WETH→USDC if position lookup fails
        }
      }

      setTokenInSymbol(nextInSymbol)
      setPairNote(note)

      const qs = new URLSearchParams({
        amount: QUOTE_AMOUNT,
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
          hops: q.hops,
          description: q.description,
          label: `#${q.rank} · ${q.kind === 'multi-hop' ? `${q.hopCount}-hop` : 'direct'} · ${q.description} · ~${q.amountOutHuman}`,
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

  useEffect(() => {
    void loadRoutes()
  }, [tokenId]) // eslint-disable-line react-hooks/exhaustive-deps -- refresh on tokenId; manual Refresh for rest

  const selected = useMemo(
    () => routes.find((r) => r.path.toLowerCase() === value.toLowerCase()) ?? null,
    [routes, value],
  )

  const selectValue =
    mode === 'custom'
      ? CUSTOM
      : mode === 'auto' || !value
        ? EMPTY
        : selected
          ? selected.path
          : CUSTOM

  function onSelectChange(next: string) {
    if (next === EMPTY) {
      setMode('auto')
      onChange('')
      return
    }
    if (next === CUSTOM) {
      setMode('custom')
      onChange(customPath.trim())
      return
    }
    setMode('route')
    onChange(next)
  }

  return (
    <div className="calldata-swap-path">
      <label className="field field-with-hint">
        <span>Swap path (from Quote routes)</span>
        <div className="calldata-prefill-row">
          <select
            className="calldata-select"
            value={selectValue}
            onChange={(e) => onSelectChange(e.target.value)}
            disabled={loading}
          >
            <option value={EMPTY}>
              Auto default · {tokenInSymbol}→USDC @{' '}
              {feeTierShortLabel(Number(defaultSwapFee) || 500)}
            </option>
            {routes.map((r) => (
              <option key={r.path} value={r.path}>
                {r.label}
              </option>
            ))}
            <option value={CUSTOM}>Custom hex path…</option>
          </select>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={() => void loadRoutes()}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <span className="field-hint">
          Reuses Quote tab route discovery
          {tokenInMeta && tokenOutMeta
            ? ` (${tokenInMeta.symbol} → ${tokenOutMeta.symbol})`
            : ` (${tokenInSymbol} → USDC)`}
          . Sample {QUOTE_AMOUNT} ranks routes only — not the close size.
        </span>
      </label>

      {pairNote && <p className="hint">{pairNote}</p>}
      {error && <p className="error">{error}</p>}

      {selected && tokenInMeta && tokenOutMeta && mode === 'route' && (
        <div className="calldata-route-preview">
          <QuoteRoutePath
            hops={selected.hops}
            tokenIn={tokenInMeta}
            tokenOut={tokenOutMeta}
            description={selected.description}
          />
          <span className="muted mono calldata-route-path-hex">
            {selected.path.slice(0, 18)}…
          </span>
        </div>
      )}

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
          <span className="field-hint">Only for Auto default. 500 = 0.05%, 3000 = 0.3%.</span>
        </label>
      )}
    </div>
  )
}
