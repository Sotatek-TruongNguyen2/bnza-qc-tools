'use client'

import { useEffect, useState } from 'react'
import { CalldataBuilderResult } from './calldata-builder-result'
import { CalldataSwapPathSelect } from './calldata-swap-path-select'
import { ButtonLoadingLabel } from './button-loading-label'
import { apiGetJson, apiPostJson } from '@/lib/api-client'
import type { OpenTxPrefill } from '@/lib/calldata/fetch-from-open-tx'
import {
  buildCloseExecuteStrategy,
  buildCollectExecuteStrategy,
  buildOpenExecuteStrategy,
  buildRebalanceExecuteStrategy,
  type CalldataAction,
  type ExecuteStrategyFields,
} from '@/lib/calldata/encode-strategy-params'
import {
  DEFAULT_CCTP_DESTINATION_DOMAIN,
  DEFAULT_MIN_EARNED_USDC,
  DEFAULT_OPEN_BNZA_TOKEN,
  DEFAULT_OPEN_LP_POOL_FEE,
  DEFAULT_OPEN_PAIRED_TOKEN,
  DEFAULT_OPERATION_FEE_BPS,
  DEFAULT_OPERATOR_ADDRESS,
  DEFAULT_PERFORMANCE_FEE_BPS,
  DEFAULT_REBALANCE_SLIPPAGE_BPS,
} from '@/lib/calldata/constants'
import type { SimulateExecuteStrategyResult } from '@/lib/calldata/simulate-execute-strategy'
import { setCachedMintTx } from '@/lib/position/open-price-local-cache'

const ACTIONS: CalldataAction[] = ['open', 'collect', 'close', 'rebalance']

function isCalldataAction(v: string): v is CalldataAction {
  return (ACTIONS as string[]).includes(v)
}

export function CalldataBuilderPanel() {
  const [action, setAction] = useState<CalldataAction>('close')
  const [openTx, setOpenTx] = useState('')
  const [prefillExpanded, setPrefillExpanded] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [prefillNote, setPrefillNote] = useState<string | null>(null)
  const [prefillError, setPrefillError] = useState<string | null>(null)

  const [user, setUser] = useState('')
  const [botId, setBotId] = useState('')
  const [tokenId, setTokenId] = useState('')

  // Close
  const [performanceFeeBps, setPerformanceFeeBps] = useState(String(DEFAULT_PERFORMANCE_FEE_BPS))
  const [amountOutMinimum, setAmountOutMinimum] = useState('0')
  const [swapPath, setSwapPath] = useState('')
  const [defaultSwapFee, setDefaultSwapFee] = useState('500')
  const [convertPrincipalToUsdc, setConvertPrincipalToUsdc] = useState(true)

  // Rebalance
  const [newTickLower, setNewTickLower] = useState('')
  const [newTickUpper, setNewTickUpper] = useState('')
  const [slippageBps, setSlippageBps] = useState(String(DEFAULT_REBALANCE_SLIPPAGE_BPS))
  const [rebalanceAmountOutMin, setRebalanceAmountOutMin] = useState('0')

  // Open
  const [pairedToken, setPairedToken] = useState<string>(DEFAULT_OPEN_PAIRED_TOKEN)
  const [bnzaToken, setBnzaToken] = useState<string>(DEFAULT_OPEN_BNZA_TOKEN)
  const [lpPoolFee, setLpPoolFee] = useState(String(DEFAULT_OPEN_LP_POOL_FEE))
  const [bnzaBuybackFee, setBnzaBuybackFee] = useState('0')
  const [tickLower, setTickLower] = useState('')
  const [tickUpper, setTickUpper] = useState('')
  const [totalUsdc, setTotalUsdc] = useState('')
  const [bnzaBuybackUsdc, setBnzaBuybackUsdc] = useState('0')
  const [swapAmount, setSwapAmount] = useState('0')
  const [openAmountOutMin, setOpenAmountOutMin] = useState('0')
  const [hlPortionUsdc, setHlPortionUsdc] = useState('0')
  const [agentWallet, setAgentWallet] = useState('')
  const [bridgeHlPortionViaCctp, setBridgeHlPortionViaCctp] = useState(true)
  const [cctpDestinationDomain, setCctpDestinationDomain] = useState(
    String(DEFAULT_CCTP_DESTINATION_DOMAIN),
  )

  // Collect
  const [collectUseDefaults, setCollectUseDefaults] = useState(true)
  const [operationFeeBps, setOperationFeeBps] = useState(String(DEFAULT_OPERATION_FEE_BPS))
  const [collectPerformanceFeeBps, setCollectPerformanceFeeBps] = useState(
    String(DEFAULT_PERFORMANCE_FEE_BPS),
  )
  const [minEarnedUsdc, setMinEarnedUsdc] = useState(String(DEFAULT_MIN_EARNED_USDC))

  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExecuteStrategyFields | null>(null)
  const [operator, setOperator] = useState<string>(DEFAULT_OPERATOR_ADDRESS)
  const [sender, setSender] = useState('')
  const [simulation, setSimulation] = useState<SimulateExecuteStrategyResult | null>(null)
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  const needsTokenId = action !== 'open'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const a = params.get('action')
    if (a && isCalldataAction(a)) setAction(a)
    const u = params.get('user')
    const b = params.get('botId')
    const t = params.get('tokenId')
    const tx = params.get('openTx')
    if (u) setUser(u)
    if (b) setBotId(b)
    if (t) setTokenId(t)
    if (tx) {
      setOpenTx(tx)
      setPrefillExpanded(true)
    }
    const tl = params.get('tickLower')
    const tu = params.get('tickUpper')
    if (tl) {
      setNewTickLower(tl)
      setTickLower(tl)
    }
    if (tu) {
      setNewTickUpper(tu)
      setTickUpper(tu)
    }
    const agent = params.get('agentWallet')
    if (agent) setAgentWallet(agent)
    const total = params.get('totalUsdc')
    if (total) setTotalUsdc(total)
  }, [])

  async function loadFromOpenTx() {
    setPrefillLoading(true)
    setPrefillError(null)
    setPrefillNote(null)
    setError(null)
    try {
      const data = await apiGetJson<OpenTxPrefill>(
        `/api/calldata/from-open-tx?tx=${encodeURIComponent(openTx.trim())}`,
      )
      setUser(data.user)
      setBotId(data.botIdBytes32)
      setTokenId(data.tokenId)
      setCachedMintTx(data.tokenId, data.txHash)
      // Seed rebalance / open range from the open ticks (editable).
      setNewTickLower(String(data.tickLower))
      setNewTickUpper(String(data.tickUpper))
      setTickLower(String(data.tickLower))
      setTickUpper(String(data.tickUpper))
      setPrefillNote(data.note)
      setResult(null)

      const url = new URL(window.location.href)
      url.searchParams.set('tool', 'calldata')
      url.searchParams.set('openTx', data.txHash)
      url.searchParams.set('user', data.user)
      url.searchParams.set('botId', data.botIdBytes32)
      url.searchParams.set('tokenId', data.tokenId)
      window.history.replaceState({}, '', url)
    } catch (err) {
      setPrefillError(err instanceof Error ? err.message : 'Prefill failed')
    } finally {
      setPrefillLoading(false)
    }
  }

  async function runSimulation(fields: ExecuteStrategyFields) {
    setSimulationLoading(true)
    setSimulationError(null)
    setSimulation(null)
    try {
      const data = await apiPostJson<SimulateExecuteStrategyResult>('/api/calldata/simulate', {
        strategy: fields.strategy,
        user: fields.user,
        botIdBytes32: fields.botIdBytes32,
        params: fields.params,
        executeStrategyCalldata: fields.executeStrategyCalldata,
        operator: operator.trim() || DEFAULT_OPERATOR_ADDRESS,
        sender: sender.trim() || undefined,
      })
      setSimulation(data)
    } catch (err) {
      setSimulationError(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setSimulationLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setSimulation(null)
    setSimulationError(null)

    const url = new URL(window.location.href)
    url.searchParams.set('tool', 'calldata')
    url.searchParams.set('action', action)
    if (user.trim()) url.searchParams.set('user', user.trim())
    if (botId.trim()) url.searchParams.set('botId', botId.trim())
    if (tokenId.trim()) url.searchParams.set('tokenId', tokenId.trim())
    window.history.replaceState({}, '', url)

    setSimulationLoading(true)
    try {
      let built: ExecuteStrategyFields
      if (action === 'open') {
        built = buildOpenExecuteStrategy({
          user,
          botId,
          pairedToken,
          bnzaToken,
          lpPoolFee,
          bnzaBuybackFee,
          tickLower,
          tickUpper,
          totalUsdc,
          bnzaBuybackUsdc,
          swapAmount,
          amountOutMinimum: openAmountOutMin,
          hlPortionUsdc,
          agentWallet,
          bridgeHlPortionViaCctp,
          cctpDestinationDomain,
        })
      } else if (action === 'collect') {
        built = buildCollectExecuteStrategy({
          user,
          botId,
          tokenId,
          useDefaults: collectUseDefaults,
          operationFeeBps,
          performanceFeeBps: collectPerformanceFeeBps,
          minEarnedUsdc,
        })
      } else if (action === 'close') {
        built = buildCloseExecuteStrategy({
          user,
          botId,
          tokenId,
          performanceFeeBps,
          amountOutMinimum,
          swapPath,
          defaultSwapFee,
          convertPrincipalToUsdc,
        })
      } else {
        built = buildRebalanceExecuteStrategy({
          user,
          botId,
          tokenId,
          newTickLower,
          newTickUpper,
          slippageBps,
          amountOutMinimum: rebalanceAmountOutMin,
        })
      }
      setResult(built)
      void runSimulation(built)
    } catch (err) {
      setSimulationLoading(false)
      setError(err instanceof Error ? err.message : 'Build failed')
    }
  }

  return (
    <section className="panel">
      <div className="result-header addresses-header">
        <div>
          <h2>Calldata builder</h2>
          <p className="muted">
            Build vault <code>executeStrategy</code> args for Basescan paste, then simulate with
            eth_call. Does not send txs.
          </p>
        </div>
      </div>

      <form className="calldata-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Action</span>
          <select
            className="calldata-select"
            value={action}
            onChange={(e) => {
              const next = e.target.value as CalldataAction
              setAction(next)
              setResult(null)
              if (next === 'open') {
                setPrefillExpanded(false)
                setPrefillNote(null)
                setPrefillError(null)
              }
            }}
          >
            <option value="open">Open position</option>
            <option value="collect">Collect fees</option>
            <option value="close">Close position</option>
            <option value="rebalance">Rebalance position</option>
          </select>
        </label>

        {action !== 'open' && (
          <div className="calldata-prefill">
            {!prefillExpanded ? (
              <button
                type="button"
                className="calldata-prefill-suggest"
                onClick={() => setPrefillExpanded(true)}
              >
                <span className="calldata-prefill-suggest-icon" aria-hidden>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v3" />
                    <path d="M12 18v3" />
                    <path d="M3 12h3" />
                    <path d="M18 12h3" />
                    <path d="M5.6 5.6l2.1 2.1" />
                    <path d="M16.3 16.3l2.1 2.1" />
                    <path d="M5.6 18.4l2.1-2.1" />
                    <path d="M16.3 7.7l2.1-2.1" />
                    <circle cx="12" cy="12" r="3.25" />
                  </svg>
                </span>
                <span className="calldata-prefill-suggest-copy">
                  <strong>Do you want to autofill?</strong>
                  <span className="muted">
                    Paste an open/mint tx to fill user, bot ID, tokenId, and ticks.
                  </span>
                </span>
                <span className="calldata-prefill-suggest-cta">Yes, autofill</span>
              </button>
            ) : (
              <>
                <div className="calldata-prefill-expanded-head">
                  <span className="calldata-prefill-expanded-title">
                    <span className="calldata-prefill-suggest-icon" aria-hidden>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3v3" />
                        <path d="M12 18v3" />
                        <path d="M3 12h3" />
                        <path d="M18 12h3" />
                        <path d="M5.6 5.6l2.1 2.1" />
                        <path d="M16.3 16.3l2.1 2.1" />
                        <path d="M5.6 18.4l2.1-2.1" />
                        <path d="M16.3 7.7l2.1-2.1" />
                        <circle cx="12" cy="12" r="3.25" />
                      </svg>
                    </span>
                    Autofill from open position tx
                  </span>
                  <button
                    type="button"
                    className="calldata-prefill-dismiss"
                    onClick={() => {
                      setPrefillExpanded(false)
                      setPrefillNote(null)
                      setPrefillError(null)
                    }}
                  >
                    Hide
                  </button>
                </div>
                <label className="field field-with-hint">
                  <span className="sr-only">Open position tx</span>
                  <div className="calldata-prefill-row">
                    <input
                      value={openTx}
                      onChange={(e) => setOpenTx(e.target.value)}
                      placeholder="0x… or https://basescan.org/tx/0x…"
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={prefillLoading || !openTx.trim()}
                      onClick={() => void loadFromOpenTx()}
                    >
                      {prefillLoading ? 'Loading…' : 'Autofill'}
                    </button>
                  </div>
                  <span className="field-hint">
                    Vault <strong>open/mint</strong> tx → user, bot ID, tokenId, ticks from{' '}
                    <code>PositionOpened</code>.
                  </span>
                </label>
                {prefillNote && <p className="hint calldata-prefill-ok">{prefillNote}</p>}
                {prefillError && <p className="error">{prefillError}</p>}
              </>
            )}
          </div>
        )}

        <div className="calldata-row">
          <label className="field field-with-hint">
            <span>User EOA wallet</span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="field-hint">Vault `user` argument — the investor EOA.</span>
          </label>

          <label className="field field-with-hint">
            <span>Bot ID</span>
            <input
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              placeholder="UUID or 0x bytes32"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="field-hint">Autofill uses on-chain bytes32 — that is fine to paste.</span>
          </label>
        </div>

        <div className="calldata-row">
          {needsTokenId ? (
            <label className="field">
              <span>Position tokenId</span>
              <input
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                placeholder="e.g. 42"
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
          ) : (
            <label className="field field-with-hint">
              <span>Agent wallet (CUSTODY)</span>
              <input
                value={agentWallet}
                onChange={(e) => setAgentWallet(e.target.value)}
                placeholder="0x… per-user CUSTODY"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="field-hint">Required open param — HL agent / CUSTODY wallet.</span>
            </label>
          )}

          <label className="field field-with-hint">
            <span>Operator (role check / default sender)</span>
            <input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="0x… OPERATOR_ROLE"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="field-hint">
              Checked for <code>OPERATOR_ROLE</code>. Also used as sender when the optional sender field is empty.
            </span>
          </label>
        </div>

        <label className="field field-with-hint">
          <span>Sender (optional simulation from)</span>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="0x… optional msg.sender override"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="field-hint">
            Actual <code>msg.sender</code> for eth_call / estimateGas. Leave blank to simulate from the operator above.
          </span>
        </label>

        {action === 'open' && (
          <>
            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>Paired token</span>
                <input
                  value={pairedToken}
                  onChange={(e) => setPairedToken(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="field-hint">Non-USDC pool leg (default WETH).</span>
              </label>
              <label className="field field-with-hint">
                <span>BNZA token</span>
                <input
                  value={bnzaToken}
                  onChange={(e) => setBnzaToken(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="field-hint">Buyback token address.</span>
              </label>
            </div>

            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>LP pool fee</span>
                <input
                  value={lpPoolFee}
                  onChange={(e) => setLpPoolFee(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">500 = 0.05% Uniswap fee tier.</span>
              </label>
              <label className="field field-with-hint">
                <span>BNZA buyback fee</span>
                <input
                  value={bnzaBuybackFee}
                  onChange={(e) => setBnzaBuybackFee(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">Uniswap fee for buyback hop; 0 OK if buyback USDC is 0.</span>
              </label>
            </div>

            <div className="calldata-row">
              <label className="field">
                <span>Tick lower</span>
                <input
                  value={tickLower}
                  onChange={(e) => setTickLower(e.target.value)}
                  placeholder="e.g. -200100"
                  inputMode="numeric"
                />
              </label>
              <label className="field">
                <span>Tick upper</span>
                <input
                  value={tickUpper}
                  onChange={(e) => setTickUpper(e.target.value)}
                  placeholder="e.g. -199500"
                  inputMode="numeric"
                />
              </label>
            </div>

            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>Total USDC (raw, 6 decimals)</span>
                <input
                  value={totalUsdc}
                  onChange={(e) => setTotalUsdc(e.target.value)}
                  placeholder="e.g. 100000000 (= 100 USDC)"
                  inputMode="numeric"
                />
                <span className="field-hint">Must be ≤ idle vault balance for this user/bot.</span>
              </label>
              <label className="field field-with-hint">
                <span>HL portion USDC (raw)</span>
                <input
                  value={hlPortionUsdc}
                  onChange={(e) => setHlPortionUsdc(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">0 = LP-only open.</span>
              </label>
            </div>

            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>BNZA buyback USDC (raw)</span>
                <input
                  value={bnzaBuybackUsdc}
                  onChange={(e) => setBnzaBuybackUsdc(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">0 skips buyback leg.</span>
              </label>
              <label className="field field-with-hint">
                <span>Open swap amount (raw USDC)</span>
                <input
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">USDC → paired before mint; 0 = full USDC → pool.</span>
              </label>
            </div>

            <label className="field field-with-hint">
              <span>Min amount out (raw)</span>
              <input
                value={openAmountOutMin}
                onChange={(e) => setOpenAmountOutMin(e.target.value)}
                inputMode="numeric"
              />
              <span className="field-hint">Floor for open-side swap; 0 OK when swapAmount is 0.</span>
            </label>

            <label className="calldata-check field-with-hint">
              <span className="calldata-check-main">
                <input
                  type="checkbox"
                  checked={bridgeHlPortionViaCctp}
                  onChange={(e) => setBridgeHlPortionViaCctp(e.target.checked)}
                />
                <span>Bridge HL portion via CCTP</span>
              </span>
              <span className="field-hint">Live client default is on (domain 3 = Arbitrum).</span>
            </label>

            {bridgeHlPortionViaCctp && (
              <label className="field field-with-hint">
                <span>CCTP destination domain</span>
                <input
                  value={cctpDestinationDomain}
                  onChange={(e) => setCctpDestinationDomain(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">3 = Arbitrum.</span>
              </label>
            )}
          </>
        )}

        {action === 'collect' && (
          <>
            <label className="calldata-check field-with-hint">
              <span className="calldata-check-main">
                <input
                  type="checkbox"
                  checked={collectUseDefaults}
                  onChange={(e) => setCollectUseDefaults(e.target.checked)}
                />
                <span>Use SC CollectFeeParams defaults</span>
              </span>
              <span className="field-hint">
                Checked → <code>abi.encode(tokenId)</code> only (op 50 / PF 3000 / min $10). Uncheck
                to encode full tuple.
              </span>
            </label>

            {!collectUseDefaults && (
              <div className="calldata-row">
                <label className="field field-with-hint">
                  <span>Operation fee (bps)</span>
                  <input
                    value={operationFeeBps}
                    onChange={(e) => setOperationFeeBps(e.target.value)}
                    inputMode="numeric"
                  />
                  <span className="field-hint">50 = 0.5%.</span>
                </label>
                <label className="field field-with-hint">
                  <span>Performance fee (bps)</span>
                  <input
                    value={collectPerformanceFeeBps}
                    onChange={(e) => setCollectPerformanceFeeBps(e.target.value)}
                    inputMode="numeric"
                  />
                  <span className="field-hint">3000 = 30% of earned.</span>
                </label>
                <label className="field field-with-hint">
                  <span>Min earned USDC (raw)</span>
                  <input
                    value={minEarnedUsdc}
                    onChange={(e) => setMinEarnedUsdc(e.target.value)}
                    inputMode="numeric"
                  />
                  <span className="field-hint">10000000 = $10 dust floor.</span>
                </label>
              </div>
            )}
          </>
        )}

        {action === 'close' && (
          <>
            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>Performance fee (bps)</span>
                <input
                  value={performanceFeeBps}
                  onChange={(e) => setPerformanceFeeBps(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">3000 = 30% of positive PnL. Must match operator config.</span>
              </label>
            </div>

            <label className="field field-with-hint">
              <span>Min USDC out (raw, 6 decimals)</span>
              <input
                value={amountOutMinimum}
                onChange={(e) => setAmountOutMinimum(e.target.value)}
                inputMode="numeric"
              />
              <span className="field-hint">0 = no floor (risky). 1 USDC = 1000000.</span>
            </label>

            <CalldataSwapPathSelect
              tokenId={tokenId}
              value={swapPath}
              onChange={setSwapPath}
              defaultSwapFee={defaultSwapFee}
              onDefaultSwapFeeChange={setDefaultSwapFee}
            />

            <label className="calldata-check field-with-hint">
              <span className="calldata-check-main">
                <input
                  type="checkbox"
                  checked={convertPrincipalToUsdc}
                  onChange={(e) => setConvertPrincipalToUsdc(e.target.checked)}
                />
                <span>Convert principal to USDC on close</span>
              </span>
              <span className="field-hint">
                When checked, non-USDC principal (e.g. WETH) is swapped to USDC and credited via the
                vault. Leave on for normal QC closes. Uncheck only if you want principal paid in the
                pair token instead.
              </span>
            </label>
          </>
        )}

        {action === 'rebalance' && (
          <>
            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>Slippage tolerance (bps)</span>
                <input
                  value={slippageBps}
                  onChange={(e) => setSlippageBps(e.target.value)}
                  inputMode="numeric"
                />
                <span className="field-hint">100 = 1% slippage on rebalance swap.</span>
              </label>
            </div>

            <div className="calldata-row">
              <label className="field field-with-hint">
                <span>New tick lower</span>
                <input
                  value={newTickLower}
                  onChange={(e) => setNewTickLower(e.target.value)}
                  placeholder="e.g. -200100"
                  inputMode="numeric"
                />
                <span className="field-hint">Autofill seeds from the open range — edit before build.</span>
              </label>
              <label className="field">
                <span>New tick upper</span>
                <input
                  value={newTickUpper}
                  onChange={(e) => setNewTickUpper(e.target.value)}
                  placeholder="e.g. -199500"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="field field-with-hint">
              <span>Min amount out (raw)</span>
              <input
                value={rebalanceAmountOutMin}
                onChange={(e) => setRebalanceAmountOutMin(e.target.value)}
                inputMode="numeric"
              />
              <span className="field-hint">Internal swap floor; 0 OK for smoke tests.</span>
            </label>
          </>
        )}

        <button
          type="submit"
          className="btn-primary calldata-submit"
          disabled={simulationLoading}
        >
          {simulationLoading ? (
            <ButtonLoadingLabel>Building…</ButtonLoadingLabel>
          ) : (
            'Build + simulate'
          )}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <CalldataBuilderResult
          result={result}
          simulation={simulation}
          simulationLoading={simulationLoading}
          simulationError={simulationError}
          onResimulate={() => void runSimulation(result)}
        />
      )}
    </section>
  )
}
