import {
  formatEther,
  formatGwei,
  keccak256,
  numberToHex,
  toBytes,
  type Address,
  type Hex,
  type Log,
} from 'viem'
import type { BasePublicClient } from '@/lib/rpc'
import { formatRpcError } from '@/lib/rpc'
import {
  GAS_BUFFER_BPS,
  GAS_LOG_CHUNK_BLOCKS,
  GAS_LOOKBACK_BLOCKS,
  GAS_MAX_SAMPLES,
  GAS_VAULT_ADDRESS,
  getGasOpConfigs,
  type GasOpConfig,
} from './constants'
import type { GasEstimateResult, GasOpEstimate, GasSample } from './types'

const TOPIC_DEPOSITED = keccak256(toBytes('Deposited(address,bytes32,address,uint256)'))
const TOPIC_WITHDRAWN = keccak256(toBytes('Withdrawn(address,bytes32,address,uint256)'))
const TOPIC_STRATEGY_EXECUTED = keccak256(toBytes('StrategyExecuted(address,address,bytes32)'))

function strategyAddressFromLog(log: Log): string | null {
  const topic = log.topics?.[1]
  if (!topic || topic.length !== 66) return null
  return `0x${topic.slice(26)}`.toLowerCase()
}

function medianBigInt(values: bigint[]): bigint | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2n
}

function formatUsd(ethAmount: string, ethUsd: number | null): string | null {
  if (ethUsd == null) return null
  const eth = Number(ethAmount)
  if (!Number.isFinite(eth)) return null
  const usd = eth * ethUsd
  if (usd >= 1) return usd.toFixed(2)
  if (usd >= 0.01) return usd.toFixed(4)
  return usd.toFixed(6)
}

async function fetchEthUsd(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH', {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { data?: { rates?: { USD?: string } } }
    const usd = Number(data?.data?.rates?.USD)
    return Number.isFinite(usd) && usd > 0 ? usd : null
  } catch {
    return null
  }
}

type RawLog = {
  address: Hex
  topics: Hex[]
  data: Hex
  blockNumber: Hex
  transactionHash: Hex
  logIndex: Hex
}

function toLog(raw: RawLog): Log {
  return {
    address: raw.address,
    topics: raw.topics,
    data: raw.data,
    blockNumber: BigInt(raw.blockNumber),
    transactionHash: raw.transactionHash,
    logIndex: Number(raw.logIndex),
    removed: false,
  } as Log
}

/** Find recent successful vault txs (calldata source for eth_estimateGas replay). */
async function getLogsChunked(
  client: BasePublicClient,
  params: {
    address: Address
    topic0: Hex
    fromBlock: bigint
    toBlock: bigint
    earlyStopUniqueTxs?: number
    earlyStopPerStrategy?: { addresses: Address[]; minEach: number }
  },
): Promise<Log[]> {
  const { address, topic0, fromBlock, toBlock, earlyStopUniqueTxs, earlyStopPerStrategy } = params
  const out: Log[] = []
  const seenTx = new Set<string>()
  const perStrategy = new Map<string, Set<string>>()
  const topic0Lower = topic0.toLowerCase()

  if (earlyStopPerStrategy) {
    for (const a of earlyStopPerStrategy.addresses) {
      perStrategy.set(a.toLowerCase(), new Set())
    }
  }

  for (let to = toBlock; to >= fromBlock; to -= GAS_LOG_CHUNK_BLOCKS + 1n) {
    const from =
      to - GAS_LOG_CHUNK_BLOCKS < fromBlock ? fromBlock : to - GAS_LOG_CHUNK_BLOCKS
    try {
      const raw = (await client.request({
        method: 'eth_getLogs',
        params: [
          {
            address,
            fromBlock: numberToHex(from),
            toBlock: numberToHex(to),
            topics: [topic0],
          },
        ],
      })) as RawLog[]

      const chunk = (raw ?? [])
        .filter((l) => (l.topics?.[0] ?? '').toLowerCase() === topic0Lower)
        .map(toLog)

      out.push(...chunk)

      for (const log of chunk) {
        if (!log.transactionHash) continue
        seenTx.add(log.transactionHash)
        if (earlyStopPerStrategy) {
          const strat = strategyAddressFromLog(log)
          if (strat && perStrategy.has(strat)) {
            perStrategy.get(strat)!.add(log.transactionHash)
          }
        }
      }

      if (earlyStopPerStrategy) {
        const minEach = earlyStopPerStrategy.minEach
        const allFilled = [...perStrategy.values()].every((set) => set.size >= minEach)
        if (allFilled) break
      } else if (earlyStopUniqueTxs != null && seenTx.size >= earlyStopUniqueTxs) {
        break
      }
    } catch (err) {
      console.warn(
        `[gas-estimate] getLogs failed ${from}-${to}:`,
        formatRpcError(err, 'getLogs failed'),
      )
    }
  }

  return out
}

function sortLogsNewestFirst(logs: Log[]): Log[] {
  return [...logs].sort((a, b) => {
    const ba = a.blockNumber ?? 0n
    const bb = b.blockNumber ?? 0n
    if (ba !== bb) return ba > bb ? -1 : 1
    return (b.logIndex ?? 0) - (a.logIndex ?? 0)
  })
}

/**
 * eth_estimateGas by replaying a successful vault tx at the parent block
 * (pre-tx state). Estimating at the tx’s own block usually reverts because
 * that block’s state is already post-execution.
 */
async function estimateGasFromTx(
  client: BasePublicClient,
  txHash: `0x${string}`,
  feePerGasWei: bigint,
): Promise<GasSample | null> {
  try {
    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: txHash }),
      client.getTransactionReceipt({ hash: txHash }).catch(() => null),
    ])

    if (!tx.to || !tx.input || tx.input === '0x' || tx.blockNumber == null) return null

    const parentBlock = tx.blockNumber > 0n ? tx.blockNumber - 1n : 0n

    const gasEstimate = await client.estimateGas({
      account: tx.from,
      to: tx.to,
      data: tx.input,
      value: tx.value,
      blockNumber: parentBlock,
    })

    const buffered = (gasEstimate * GAS_BUFFER_BPS) / 1000n
    return {
      txHash,
      gasEstimate: gasEstimate.toString(),
      gasUsed: receipt?.gasUsed?.toString() ?? null,
      blockNumber: tx.blockNumber.toString(),
      feeEth: formatEther(buffered * feePerGasWei),
    }
  } catch (err) {
    console.warn(`[gas-estimate] estimateGas ${txHash}:`, formatRpcError(err, 'estimateGas failed'))
    return null
  }
}

async function samplesFromLogs(
  client: BasePublicClient,
  logs: Log[],
  feePerGasWei: bigint,
): Promise<GasSample[]> {
  const newest = sortLogsNewestFirst(logs)
  const seen = new Set<string>()
  const uniqueHashes: `0x${string}`[] = []

  for (const log of newest) {
    if (!log.transactionHash) continue
    if (seen.has(log.transactionHash)) continue
    seen.add(log.transactionHash)
    uniqueHashes.push(log.transactionHash)
    if (uniqueHashes.length >= GAS_MAX_SAMPLES) break
  }

  const samples: GasSample[] = []
  // Sequential to avoid public RPC rate limits on estimateGas.
  for (const hash of uniqueHashes) {
    const sample = await estimateGasFromTx(client, hash, feePerGasWei)
    if (sample) samples.push(sample)
  }

  samples.sort((a, b) => {
    const ba = BigInt(a.blockNumber)
    const bb = BigInt(b.blockNumber)
    return ba > bb ? -1 : ba < bb ? 1 : 0
  })
  return samples
}

function buildOpEstimate(
  config: GasOpConfig,
  samples: GasSample[],
  feePerGasWei: bigint,
  ethUsd: number | null,
  error: string | null = null,
): GasOpEstimate {
  if (error) {
    return {
      id: config.id,
      label: config.label,
      payer: config.payer,
      strategyAddress: config.strategyAddress,
      method: null,
      sampleCount: 0,
      gasEstimateMedian: null,
      gasEstimateMin: null,
      gasEstimateMax: null,
      estimatedFeeEth: null,
      estimatedFeeUsd: null,
      samples: [],
      note: null,
      error,
    }
  }

  const gasValues = samples.map((s) => BigInt(s.gasEstimate))
  const med = medianBigInt(gasValues)
  const min = gasValues.length ? gasValues.reduce((a, b) => (a < b ? a : b)) : null
  const max = gasValues.length ? gasValues.reduce((a, b) => (a > b ? a : b)) : null
  const bufferedMed = med != null ? (med * GAS_BUFFER_BPS) / 1000n : null
  const estimatedFeeEth = bufferedMed != null ? formatEther(bufferedMed * feePerGasWei) : null

  return {
    id: config.id,
    label: config.label,
    payer: config.payer,
    strategyAddress: config.strategyAddress,
    method: samples.length > 0 ? 'eth_estimateGas' : null,
    sampleCount: samples.length,
    gasEstimateMedian: med?.toString() ?? null,
    gasEstimateMin: min?.toString() ?? null,
    gasEstimateMax: max?.toString() ?? null,
    estimatedFeeEth,
    estimatedFeeUsd: estimatedFeeEth != null ? formatUsd(estimatedFeeEth, ethUsd) : null,
    samples,
    note:
      samples.length === 0
        ? 'No recent successful call to replay for eth_estimateGas. Run this op once on Base, then Reload.'
        : `eth_estimateGas replay of ${samples.length} recent tx(s) at parent block (pre-tx state) · fee uses estimate × 1.2 buffer × current fee.`,
    error: null,
  }
}

export async function fetchGasEstimates(client: BasePublicClient): Promise<GasEstimateResult> {
  const latest = await client.getBlockNumber()
  const fromBlock = latest > GAS_LOOKBACK_BLOCKS ? latest - GAS_LOOKBACK_BLOCKS : 0n
  const toBlock = latest
  const configs = getGasOpConfigs()
  const strategyAddresses = configs
    .filter((c) => c.strategyAddress != null)
    .map((c) => c.strategyAddress!)

  const [block, ethUsd, priorityFee, depositedLogs, withdrawnLogs, strategyLogs] =
    await Promise.all([
      client.getBlock({ blockNumber: latest }),
      fetchEthUsd(),
      client.estimateMaxPriorityFeePerGas().catch(() => 1_000_000n),
      getLogsChunked(client, {
        address: GAS_VAULT_ADDRESS,
        topic0: TOPIC_DEPOSITED,
        fromBlock,
        toBlock,
        earlyStopUniqueTxs: GAS_MAX_SAMPLES,
      }),
      getLogsChunked(client, {
        address: GAS_VAULT_ADDRESS,
        topic0: TOPIC_WITHDRAWN,
        fromBlock,
        toBlock,
        earlyStopUniqueTxs: GAS_MAX_SAMPLES,
      }),
      getLogsChunked(client, {
        address: GAS_VAULT_ADDRESS,
        topic0: TOPIC_STRATEGY_EXECUTED,
        fromBlock,
        toBlock,
        // Need ≥1 successful call per strategy to eth_estimateGas-replay.
        earlyStopPerStrategy: {
          addresses: strategyAddresses,
          minEach: 1,
        },
      }),
    ])

  const baseFee = block.baseFeePerGas ?? 0n
  const feePerGasWei = baseFee + priorityFee

  const strategyByAddr = new Map<string, Log[]>()
  for (const log of strategyLogs) {
    const addr = strategyAddressFromLog(log)
    if (!addr) continue
    const list = strategyByAddr.get(addr) ?? []
    list.push(log)
    strategyByAddr.set(addr, list)
  }

  const operations: GasOpEstimate[] = []

  for (const config of configs) {
    try {
      let logs: Log[]
      if (config.kind === 'deposit') logs = depositedLogs
      else if (config.kind === 'withdraw') logs = withdrawnLogs
      else logs = strategyByAddr.get(config.strategyAddress!.toLowerCase()) ?? []

      const samples = await samplesFromLogs(client, logs, feePerGasWei)
      operations.push(buildOpEstimate(config, samples, feePerGasWei, ethUsd))
    } catch (err) {
      operations.push(
        buildOpEstimate(
          config,
          [],
          feePerGasWei,
          ethUsd,
          formatRpcError(err, `Failed to estimateGas for ${config.label}`),
        ),
      )
    }
  }

  const caveats = [
    'Primary signal is eth_estimateGas (replay successful vault calldata at parent block) — not receipt gasUsed.',
    'Fee = median(estimate) × 1.2 buffer (same as bnza-operator) × current (baseFee + tip).',
    'Replay needs ≥1 recent successful call in the lookback window; empty rows mean that op has not run recently (or estimateGas failed).',
    'Deposit / withdraw = user-paid. Open / close / rebalance / collect = operator-paid via executeStrategy.',
  ]

  return {
    network: 'Base mainnet',
    chainId: 8453,
    vault: GAS_VAULT_ADDRESS,
    gasBuffer: 1.2,
    lookedBackBlocks: GAS_LOOKBACK_BLOCKS.toString(),
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    ethUsd,
    feePerGasWei: feePerGasWei.toString(),
    feePerGasGwei: formatGwei(feePerGasWei),
    fetchedAt: new Date().toISOString(),
    operations,
    caveats,
  }
}
